import { Shield, Database, Trash2, Info, Upload } from 'lucide-react';
import { useRef } from 'react';
import { dataStore } from '../core/data/dataStore';
import { useSync } from '../modules/core/sync/SyncProvider';
import { useProfile } from '../modules/core/profiles/ProfileProvider';

export function Settings() {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const {
        isDriveConnected,
        connectDrive,
        saveNow,
        openRestore,
        isSaving,
        isRestoring,
        lastSavedAt,
        lastError
    } = useSync();
    const { activeProfile } = useProfile();

    const handleClearData = async () => {
        if (window.confirm('¿Estás seguro de que deseas borrar todos los datos locales? Esta acción no se puede deshacer.')) {
            try {
                await dataStore.clearAll();
                localStorage.clear();
                window.location.reload();
            } catch (error) {
                console.error('Failed to clear data:', error);
                alert('Error al borrar algunos datos. Por favor, inténtalo de nuevo.');
            }
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
                {/* Header */}
                <div className="flex flex-col gap-1 mb-4">
                    <h1 className="text-2xl font-semibold tracking-tight text-slate-50">Ajustes</h1>
                    <p className="text-sm text-slate-400">Administra la apariencia, datos y copias de seguridad.</p>
                </div>

                {/* Google Drive Backup Section */}
                <section className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-xl shadow-lg shadow-black/40 p-5 flex flex-col gap-4 transition-transform transition-shadow duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-black/50">
                    <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-300">
                        <Upload className="h-5 w-5" />
                        <h2>Respaldo en Google Drive</h2>
                    </div>

                    <div className="p-4 rounded-lg bg-slate-950/50 border border-slate-800/50 space-y-4">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                                <p className="text-sm font-medium text-slate-200">
                                    Perfil activo: <span className="text-blue-400">{activeProfile.name}</span>
                                </p>
                                <p className="text-xs text-slate-400 mt-1">
                                    Los respaldos son privados en tu carpeta de aplicación de Google Drive.
                                    {isDriveConnected ? ' (Conectado)' : ' (No conectado)'}
                                </p>
                            </div>

                            <div className="flex gap-3">
                                {!isDriveConnected ? (
                                    <button
                                        onClick={() => connectDrive()}
                                        className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors"
                                    >
                                        Conectar Google Drive
                                    </button>
                                ) : (
                                    <>
                                        <button
                                            onClick={() => saveNow()}
                                            disabled={isSaving}
                                            className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
                                        >
                                            {isSaving ? 'Guardando...' : 'Respaldar ahora'}
                                        </button>
                                        <button
                                            onClick={() => openRestore()}
                                            disabled={isRestoring}
                                            className="px-4 py-2 rounded-lg border border-slate-600 hover:bg-slate-800 text-slate-200 text-sm font-medium transition-colors disabled:opacity-50"
                                        >
                                            Abrir backups
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>

                        {lastSavedAt && (
                            <p className="text-xs text-slate-500">
                                Último respaldo exitoso: {new Date(lastSavedAt).toLocaleString()}
                            </p>
                        )}
                        {lastError && (
                            <p className="text-xs text-red-400">
                                {lastError}
                            </p>
                        )}
                    </div>
                </section>

                {/* General Section */}
                <section className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-xl shadow-lg shadow-black/40 p-5 flex flex-col gap-4 transition-transform transition-shadow duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-black/50">
                    <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-300">
                        <Shield className="h-5 w-5" />
                        <h2>General</h2>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <h3 className="text-sm font-medium text-slate-200">Apariencia</h3>
                            <p className="mt-1 text-xs text-slate-400">
                                El tema se controla desde el interruptor en la barra superior.
                            </p>
                        </div>
                    </div>
                </section>

                {/* Data Management Section */}
                <section className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-xl shadow-lg shadow-black/40 p-5 flex flex-col gap-4 transition-transform transition-shadow duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-black/50">
                    <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-300">
                        <Database className="h-5 w-5" />
                        <h2>Gestión de datos</h2>
                    </div>

                    <div className="space-y-6">
                        <div className="rounded-lg bg-slate-950/50 p-4 border border-slate-800/50">
                            <div className="flex gap-3">
                                <Info className="h-5 w-5 text-slate-500 shrink-0 mt-0.5" />
                                <div className="space-y-2 text-xs text-slate-400">
                                    <p>
                                        <span className="font-medium text-slate-200">Motor de datos:</span> LocalStorage (compatible con CSV)
                                    </p>
                                    <p>
                                        <span className="font-medium text-slate-200">Nota:</span> Debido al aislamiento del navegador, la aplicación no puede escribir CSV directamente en tu disco. Usa el botón de copiar para exportar datos.
                                    </p>
                                </div>
                            </div>

                            <div className="mt-4 flex flex-wrap gap-3">
                                {/* Copy CSV Button */}
                                <button
                                    onClick={async () => {
                                        try {
                                            const csv = await dataStore.exportAllAsCsv();
                                            await navigator.clipboard.writeText(csv);
                                            alert('¡CSV copiado al portapapeles!');
                                        } catch (err) {
                                            console.error('Failed to copy CSV', err);
                                            alert('Error al copiar CSV');
                                        }
                                    }}
                                    className="inline-flex items-center justify-center px-3 py-2 rounded-lg border border-slate-600 bg-slate-900/70 hover:bg-slate-800 text-xs font-semibold text-slate-200 transition-colors duration-150"
                                >
                                    Copiar vista previa CSV
                                </button>

                                {/* Download CSV Button */}
                                <button
                                    onClick={async () => {
                                        try {
                                            const blob = await dataStore.exportToCSVBlob();
                                            const url = URL.createObjectURL(blob);
                                            const a = document.createElement('a');
                                            a.href = url;
                                            const date = new Date();
                                            const timestamp = date.toISOString().replace(/[:.]/g, '-').slice(0, 16);
                                            a.download = `evorix-backup-${timestamp}.csv`;
                                            document.body.appendChild(a);
                                            a.click();
                                            document.body.removeChild(a);
                                            URL.revokeObjectURL(url);
                                        } catch (err) {
                                            console.error('Failed to download CSV', err);
                                            alert('Error al descargar la copia CSV');
                                        }
                                    }}
                                    className="inline-flex items-center justify-center px-3 py-2 rounded-lg bg-emerald-500/90 hover:bg-emerald-400 text-slate-900 text-xs font-semibold shadow-md shadow-emerald-900/50 transition-colors duration-150"
                                >
                                    <Upload className="h-4 w-4 rotate-180 mr-2" />
                                    Descargar copia CSV
                                </button>

                                {/* Restore Input & Button */}
                                <input
                                    type="file"
                                    accept=".csv"
                                    className="hidden"
                                    ref={fileInputRef}
                                    onChange={async (e) => {
                                        const file = e.target.files?.[0];
                                        if (!file) return;

                                        try {
                                            const text = await file.text();
                                            const result = await dataStore.importFromCsv(text, { clearBefore: true });

                                            if (result.importedCount === 0) {
                                                let msg = 'No se pudieron restaurar registros de este CSV.';
                                                if (result.errors.length > 0) {
                                                    msg += '\n\nErrores encontrados:\n' + result.errors.slice(0, 5).join('\n');
                                                    if (result.errors.length > 5) msg += `\n...y ${result.errors.length - 5} más.`;
                                                } else {
                                                    msg += '\n\nPor favor verifica la fila de encabezado y que el CSV no haya sido reformateado.';
                                                }
                                                alert(msg);
                                            } else {
                                                let msg = `Se restauraron exitosamente ${result.importedCount} registros desde CSV.`;
                                                if (result.errorCount > 0) {
                                                    msg += `\n(${result.errorCount} filas omitidas debido a errores)`;
                                                }
                                                alert(msg);
                                                window.location.reload();
                                            }

                                            if (result.errors.length > 0) {
                                                console.warn('CSV Import Warnings:', result.errors);
                                            }
                                        } catch (err) {
                                            console.error('Failed to import CSV', err);
                                            alert('Error al restaurar datos desde CSV. Revisa la consola para más detalles.');
                                        } finally {
                                            if (fileInputRef.current) {
                                                fileInputRef.current.value = '';
                                            }
                                        }
                                    }}
                                />
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="inline-flex items-center justify-center px-3 py-2 rounded-lg border border-slate-600 bg-slate-900/70 hover:bg-slate-800 text-xs font-semibold text-slate-200 transition-colors duration-150"
                                >
                                    <Upload className="h-4 w-4 mr-2" />
                                    Restaurar datos desde CSV
                                </button>
                            </div>
                            <p className="mt-2 text-xs text-slate-500">
                                Usa esto para restaurar tus datos desde una copia de seguridad CSV exportada previamente desde esta aplicación.
                                <br />
                                El CSV debe tener las columnas: id, toolId, createdAt, updatedAt, payload_json.
                            </p>
                        </div>

                        <div className="pt-4 border-t border-slate-800">
                            <h3 className="text-sm font-medium text-slate-200 mb-2">Zona de peligro</h3>
                            <div className="flex items-center justify-between">
                                <p className="text-xs text-slate-400">
                                    Eliminar permanentemente todos los datos locales de este navegador.
                                </p>
                                <button
                                    onClick={handleClearData}
                                    className="inline-flex items-center justify-center px-3 py-2 rounded-lg bg-rose-600/80 hover:bg-rose-500 text-slate-50 text-xs font-semibold shadow-md shadow-rose-900/50 transition-colors duration-150"
                                >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Borrar datos locales
                                </button>
                            </div>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
}
