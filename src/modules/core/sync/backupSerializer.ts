import type { EvoappBackupManifest, EvoappBackupManifestV2 } from './backupContract';
import type { EvoProfile } from '../profiles/profileTypes';
import { evoStore } from '../../../core/evoappDataStore';

export async function buildBackup(): Promise<{ manifest: EvoappBackupManifest; files: Array<{ name: string; blob: Blob }> }> {
    // 1. Gather all data
    const fullData = await evoStore.exportAll();
    const timestamp = new Date().toISOString();
    const tsSafe = timestamp.replace(/[:.]/g, '-');

    // 2. Create Full Backup File
    const backupContent = {
        schemaVersion: 1,
        exportedAt: timestamp,
        data: fullData
    };

    const backupJsonStr = JSON.stringify(backupContent, null, 2);
    const backupBlob = new Blob([backupJsonStr], { type: 'application/json' });
    const backupFileName = `evoapp_backup_full_${tsSafe}.json`;

    // 3. Create Manifest
    // In this "Full Snapshot" model, the manifest acts as a pointer to the main backup file
    const manifest: EvoappBackupManifest = {
        schemaVersion: 1,
        app: "EVOAPP",
        createdAt: timestamp,
        source: "web",
        stores: [
            {
                toolId: "all",
                count: Object.keys(fullData).length,
                format: "ndjson", // sticking to contract type, though we use JSON here
                filename: backupFileName
            }
        ]
    };

    const manifestJsonStr = JSON.stringify(manifest, null, 2);
    const manifestBlob = new Blob([manifestJsonStr], { type: 'application/json' });
    const manifestFileName = `evoapp_manifest_${tsSafe}.json`;

    return {
        manifest,
        files: [
            { name: manifestFileName, blob: manifestBlob },
            { name: backupFileName, blob: backupBlob }
        ]
    };
}

// V2: Streaming NDJSON + GZIP
export async function buildBackupV2(profile?: EvoProfile): Promise<{ manifest: EvoappBackupManifestV2; files: Array<{ name: string; blob: Blob }> }> {
    const timestamp = new Date().toISOString();
    const tsSafe = timestamp.replace(/[:.]/g, '-');
    const prefix = profile ? profile.drivePrefix : 'evoapp';

    // We only access known store keys
    const storeKeys = [
        'registrosFinancieros',
        'facturas',
        'clientes',
        'movimientosBancarios',
        'pagosImpuestos',
        'calculosImpuestos'
    ];

    const files: Array<{ name: string; blob: Blob }> = [];
    const storesMetadata = [];

    // Helper: GZIP Stream
    const compressStream = async (sourceStream: ReadableStream<string>): Promise<Blob> => {
        // Encode strings to bytes
        const textEncoder = new TextEncoder();
        const readableByteStream = sourceStream.pipeThrough(new TransformStream({
            transform(chunk, controller) {
                controller.enqueue(textEncoder.encode(chunk));
            }
        }));

        // Compress
        // @ts-ignore - CompressionStream might not be in generic TS lib yet depending on version
        const compressedStream = readableByteStream.pipeThrough(new CompressionStream('gzip'));

        // Consume to Blob
        const response = new Response(compressedStream);
        return await response.blob();
    };

    for (const key of storeKeys) {
        // Create a ReadableStream that yields NDJSON lines
        let count = 0;

        const sourceStream = new ReadableStream<string>({
            async start(controller) {
                try {
                    await evoStore.iterateStore(key, (item: any) => {
                        const line = JSON.stringify(item) + '\n';
                        controller.enqueue(line);
                        count++;
                    });
                    controller.close();
                } catch (e) {
                    controller.error(e);
                }
            }
        });

        const compressedBlob = await compressStream(sourceStream);

        const filename = `${prefix}_store_${key}.ndjson.gz`;

        files.push({
            name: filename,
            blob: compressedBlob
        });

        storesMetadata.push({
            storeKey: key,
            count,
            filename,
            format: "ndjson+gzip" as const
        });
    }

    const manifest: EvoappBackupManifestV2 = {
        schemaVersion: 2,
        app: "EVOAPP",
        createdAt: timestamp,
        source: "web",
        stores: storesMetadata
    };

    const manifestFileName = `${prefix}_manifest_${tsSafe}.json`;
    const manifestBlob = new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' });
    files.unshift({ name: manifestFileName, blob: manifestBlob });

    return { manifest, files };
}
