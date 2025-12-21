import type { DriveClient } from './drive/driveClient';
import { evoStore } from '../../../core/evoappDataStore';
import { dataStore } from '../../../core/data/dataStore';

export type RestoreProgress = {
    phase: "downloading" | "parsing" | "clearing" | "importing" | "finalizing";
    percent: number; // 0..100
    message?: string;
};

export async function restoreFromBackupFile(params: {
    drive: DriveClient;
    fileId: string;
    onProgress: (p: RestoreProgress) => void;
    signal?: AbortSignal;
}): Promise<void> {
    const { drive, fileId, onProgress, signal } = params;

    try {
        if (signal?.aborted) throw new DOMException('Aborted before start', 'AbortError');
        onProgress({ phase: 'downloading', percent: 0, message: 'Descargando manifiesto...' });

        const blob = await drive.downloadFile(fileId);
        const text = await blob.text();
        let payload;
        try {
            payload = JSON.parse(text);
        } catch (e) {
            throw new Error("El archivo no es un JSON válido.");
        }

        const schemaVersion = payload.schemaVersion || 1; // Default to 1 if missing

        if (schemaVersion === 1) {
            // V1: Monolithic JSON
            if (payload.data) {
                await restoreV1(payload, onProgress, signal);
            } else if (payload.stores) {
                // Hybrid/V1ish manifest pointing to single file?
                // Current V1 logic in backupSerializer creates a manifest AND a backup_full file.
                // If the USER selected 'evoapp_backup_full_...' file (JSON), payload.data exists.
                // If the USER selected 'evoapp_manifest_...' (JSON), payload.stores exists.
                // In V1 manifest, it points to 'evoapp_backup_full_...'.
                // We need to resolve that file.
                await restoreManifestBased(payload, drive, onProgress, signal);
            } else {
                throw new Error("Formato desconocido.");
            }
        } else if (schemaVersion === 2) {
            // V2: Manifest + NDJSON GZ files
            await restoreManifestBased(payload, drive, onProgress, signal);
        } else {
            throw new Error(`Versión de backup no soportada: ${schemaVersion}`);
        }

        // 4. Mark Migration/Restore as Complete to prevent merges
        await dataStore.setSnapshot('system:migration', {
            v1_complete: true,
            restored_at: new Date().toISOString(),
            source: 'restore-v2'
        });

        onProgress({ phase: 'finalizing', percent: 100, message: '¡Completado!' });

    } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
            console.warn("Restore cancelled by user");
            throw err;
        }
        console.error("Restore failed:", err);
        throw new Error(`Error al restaurar: ${err instanceof Error ? err.message : String(err)}`);
    }
}

async function restoreV1(payload: any, onProgress: (p: RestoreProgress) => void, signal?: AbortSignal) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    onProgress({ phase: 'clearing', percent: 10, message: 'Limpiando base de datos...' });
    await evoStore.clearAll();

    onProgress({ phase: 'importing', percent: 20, message: 'Restaurando datos V1...' });
    const data = payload.data as Record<string, unknown>;

    await evoStore.importAll(data, {
        signal,
        onBatch: (done, total) => {
            const progress = 20 + Math.floor((done / total) * 70);
            onProgress({
                phase: 'importing',
                percent: progress,
                message: `Importando store ${done}/${total}...`
            });
        }
    });
}

async function restoreManifestBased(manifest: any, drive: DriveClient, onProgress: (p: RestoreProgress) => void, signal?: AbortSignal) {
    onProgress({ phase: 'clearing', percent: 10, message: 'Limpiando base de datos...' });
    // Wipe physically to ensure no legacy artifacts remain
    await dataStore.wipeAllRecords();

    const stores = manifest.stores || [];
    const totalStores = stores.length;
    let storesDone = 0;

    for (const storeMeta of stores) {
        if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

        onProgress({
            phase: 'downloading',
            percent: 10 + Math.floor((storesDone / totalStores) * 80),
            message: `Restaurando ${storeMeta.storeKey || 'datos'}...`
        });

        // 1. Find file ID by filename
        const filename = storeMeta.filename;
        if (!filename) continue;

        const foundFiles = await drive.listAppDataFiles(filename);
        // Precise match filter
        const targetFile = foundFiles.find(f => f.name === filename);

        if (!targetFile) {
            console.warn(`Backup file not found: ${filename}`);
            // Should we fail or continue?
            // Missing data is critical.
            throw new Error(`Archivo de backup faltante: ${filename}`);
        }

        // 2. Download Stream
        const blob = await drive.downloadFile(targetFile.id);

        // 3. Process
        if (storeMeta.format === 'ndjson+gzip' || filename.endsWith('.gz')) {
            await restoreStreamV2(storeMeta.storeKey, blob, signal);
        } else if (storeMeta.format === 'ndjson' || filename.endsWith('.json')) {
            // V1 full backup referenced by manifest
            // It's likely the monolithic file.
            // If storeKey is "all" or undefined, it's the full backup.
            if (storeMeta.toolId === 'all' || !storeMeta.storeKey) {
                const text = await blob.text();
                const json = JSON.parse(text);
                if (json.data) {
                    await evoStore.importAll(json.data, { signal });
                }
            } else {
                // Single store JSON? Not implemented in V1 but hypothetically possible.
            }
        }

        storesDone++;
    }
}

async function restoreStreamV2(storeKey: string, blob: Blob, signal?: AbortSignal) {
    if (!storeKey) return;

    // Decompress
    const ds = new DecompressionStream('gzip');
    const stream = blob.stream().pipeThrough(ds);
    const textStream = stream.pipeThrough(new TextDecoderStream());
    const reader = textStream.getReader();

    let { value: chunk, done } = await reader.read();
    let buffer = '';
    const itemsBatch: any[] = [];
    const BATCH_SIZE = 500;

    try {
        while (!done || buffer.length > 0) {
            if (signal?.aborted) {
                reader.cancel();
                throw new DOMException('Aborted', 'AbortError');
            }

            if (chunk) {
                buffer += chunk;
            }

            // Process lines
            let newlineIndexer;
            while ((newlineIndexer = buffer.indexOf('\n')) >= 0) {
                const line = buffer.slice(0, newlineIndexer).trim();
                buffer = buffer.slice(newlineIndexer + 1);

                if (line) {
                    try {
                        const item = JSON.parse(line);
                        itemsBatch.push(item);

                        if (itemsBatch.length >= BATCH_SIZE) {
                            await evoStore.putMany(storeKey, itemsBatch);
                            itemsBatch.length = 0; // clear
                            // Yield to UI
                            await new Promise(r => setTimeout(r, 0));
                        }
                    } catch (e) {
                        console.warn('JSON parse error in streaming line', e);
                    }
                }
            }

            if (done) break;
            ({ value: chunk, done } = await reader.read());
        }

        // Final batch
        if (itemsBatch.length > 0) {
            await evoStore.putMany(storeKey, itemsBatch);
        }

    } catch (err) {
        reader.cancel();
        throw err;
    }
}
