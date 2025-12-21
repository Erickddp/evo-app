import { Database, Trash2, Upload, Palette, Cloud, RefreshCw, ExternalLink, ShieldCheck, AlertCircle, HardDrive, Calculator } from 'lucide-react';
import { useRef, useState } from 'react';
import { dataStore } from '../core/data/dataStore';
import { useSync } from '../modules/core/sync/SyncProvider';
import { useProfiles } from '../modules/core/profiles/ProfileProvider';


export function Settings() {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { activeProfile, updateProfile } = useProfiles();
    const {
        isDriveConnected,
        driveUser,
        connectDrive,
        saveNow,
        isSaving,
        lastSavedAt,
        openRestore,
        updateAccountStatus,
        lastUserRefreshAt
    } = useSync();

    // Local state for refreshing animation
    const [isRefreshingAccount, setIsRefreshingAccount] = useState(false);

    const handleRefreshAccount = async () => {
        setIsRefreshingAccount(true);
        await updateAccountStatus();
        setTimeout(() => setIsRefreshingAccount(false), 800); // Minimum visual time
    };

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

                {/* Section: Fiscal Profile */}
                <section className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-xl shadow-lg shadow-black/40 p-5 flex flex-col gap-4 transition-transform transition-shadow duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-black/50">
                    <div className="flex flex-col gap-2 border-b border-slate-800/50 pb-4">
                        <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-300">
                            <Calculator className="h-5 w-5" />
                            <h2>Perfil Fiscal</h2>
                        </div>
                        <p className="text-sm text-slate-400">Configura tu régimen y año fiscal para los cálculos de impuestos.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Regimen */}
                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Régimen Fiscal</label>
                            <select
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:ring-2 focus:ring-blue-600 focus:outline-none"
                                value={activeProfile.taxRegime || ''}
                                onChange={(e) => {
                                    const val = e.target.value as 'PM' | 'PF_RESICO' | '';
                                    if (val) updateProfile({ ...activeProfile, taxRegime: val });
                                }}
                            >
                                <option value="" disabled>Seleccionar...</option>
                                <option value="PF_RESICO">Persona Física (RESICO)</option>
                                <option value="PM">Persona Moral</option>
                            </select>
                        </div>

                        {/* Tax Year */}
                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Año Fiscal</label>
                            <select
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:ring-2 focus:ring-blue-600 focus:outline-none"
                                value={activeProfile.taxYear || new Date().getFullYear()}
                                onChange={(e) => {
                                    const val = parseInt(e.target.value);
                                    updateProfile({ ...activeProfile, taxYear: val });
                                }}
                            >
                                {[2023, 2024, 2025, 2026].map(y => (
                                    <option key={y} value={y}>{y}</option>
                                ))}
                            </select>
                        </div>

                        {/* Periodicity */}
                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Periodicidad</label>
                            <input
                                type="text"
                                className="w-full bg-slate-950/50 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-400 cursor-not-allowed"
                                value="Mensual"
                                disabled
                            />
                            <p className="text-[10px] text-slate-500">Fijo para este régimen.</p>
                        </div>
                    </div>
                </section>

                {/* Experimental Features */}
                <section className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-xl shadow-lg shadow-black/40 p-5 flex flex-col gap-4 transition-transform transition-shadow duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-black/50">
                    <div className="flex flex-col gap-2 border-b border-slate-800/50 pb-4">
                        <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-amber-500/90">
                            <AlertCircle className="h-5 w-5" />
                            <h2>Funcionalidades Beta (Experimental)</h2>
                        </div>
                        <p className="text-sm text-slate-400">Activa características en desarrollo. Pueden cambiar sin previo aviso.</p>
                    </div>

                    <div className="bg-amber-500/5 border border-amber-500/10 rounded-lg p-4 space-y-4">
                        {/* Journey Toggle */}
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="text-sm font-medium text-slate-200">Journey V1 (Guiado)</div>
                                <div className="text-xs text-slate-500">Activa el flujo paso a paso para Cierre Mensual.</div>
                            </div>
                            <button
                                onClick={() => updateProfile({
                                    ...activeProfile,
                                    featureFlags: {
                                        ...activeProfile.featureFlags,
                                        journeyV1: !activeProfile.featureFlags?.journeyV1
                                    }
                                })}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${activeProfile.featureFlags?.journeyV1 ? 'bg-amber-500' : 'bg-slate-700'
                                    }`}
                            >
                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${activeProfile.featureFlags?.journeyV1 ? 'translate-x-[22px]' : 'translate-x-1'
                                    }`} />
                            </button>
                        </div>

                        {/* Tax Engine Toggle */}
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="text-sm font-medium text-slate-200">Motor Fiscal V1</div>
                                <div className="text-xs text-slate-500">Habilita cálculo automático de impuestos estimados.</div>
                            </div>
                            <button
                                onClick={() => updateProfile({
                                    ...activeProfile,
                                    featureFlags: {
                                        ...activeProfile.featureFlags,
                                        taxEngineV1: !activeProfile.featureFlags?.taxEngineV1
                                    }
                                })}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${activeProfile.featureFlags?.taxEngineV1 ? 'bg-amber-500' : 'bg-slate-700'
                                    }`}
                            >
                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${activeProfile.featureFlags?.taxEngineV1 ? 'translate-x-[22px]' : 'translate-x-1'
                                    }`} />
                            </button>
                        </div>
                    </div>
                </section>

                {/* Section 1: Appearance */}
                <section className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-xl shadow-lg shadow-black/40 p-5 flex flex-col gap-4 transition-transform transition-shadow duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-black/50">
                    <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-300">
                            <Palette className="h-5 w-5" />
                            <h2>Apariencia</h2>
                        </div>
                        <p className="text-sm text-slate-400">El tema se controla desde el interruptor en la barra superior.</p>
                    </div>
                </section>

                {/* Section 2: Google Drive (Respaldo) - Premium */}
                <section className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-xl shadow-lg shadow-black/40 p-0 flex flex-col transition-transform transition-shadow duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-black/50 group">

                    {/* Header Strip */}
                    <div className="px-5 py-4 border-b border-white/5 bg-gradient-to-r from-emerald-950/20 to-transparent flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                            <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                                <HardDrive className="h-4 w-4" />
                            </div>
                            <h2 className="text-sm font-semibold uppercase tracking-wide text-emerald-400/90 text-shadow-sm">Google Drive (Respaldo)</h2>
                        </div>
                        {isDriveConnected && (
                            <div className="flex items-center gap-2">
                                <span className="relative flex h-2.5 w-2.5">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                                </span>
                                <span className="text-[10px] font-medium text-emerald-500 uppercase tracking-wider hidden sm:block">Sincronizado</span>
                            </div>
                        )}
                    </div>

                    <div className="p-5 space-y-6">
                        {/* Account Card */}
                        <div className="relative overflow-hidden rounded-xl border border-slate-700/50 bg-slate-950/30 p-4 flex flex-col sm:flex-row items-center sm:items-start justify-between gap-4">

                            <div className="flex items-center gap-4 w-full">
                                {/* Avatar */}
                                <div className="shrink-0 relative">
                                    {isDriveConnected && driveUser?.photoLink ? (
                                        <div className="h-12 w-12 rounded-full p-0.5 bg-gradient-to-tr from-emerald-500 to-blue-500 shadow-lg shadow-emerald-900/20">
                                            <img
                                                src={driveUser.photoLink}
                                                alt={driveUser.displayName}
                                                className="h-full w-full rounded-full border-2 border-slate-900 object-cover"
                                            />
                                        </div>
                                    ) : (
                                        <div className="h-12 w-12 rounded-full bg-slate-800 border-2 border-slate-700 flex items-center justify-center text-slate-500">
                                            <Cloud className="h-6 w-6 opacity-50" />
                                        </div>
                                    )}
                                    {isDriveConnected && (
                                        <div className="absolute -bottom-1 -right-1 bg-emerald-500 text-slate-950 rounded-full p-0.5 border-2 border-slate-900">
                                            <ShieldCheck className="h-3 w-3" />
                                        </div>
                                    )}
                                </div>

                                {/* User Info */}
                                <div className="flex flex-col min-w-0 flex-1">
                                    {isDriveConnected ? (
                                        <>
                                            {driveUser ? (
                                                <>
                                                    <h3 className="text-base font-medium text-slate-100 truncate">{driveUser.displayName}</h3>
                                                    <p className="text-xs text-slate-400 truncate font-mono">{driveUser.emailAddress}</p>
                                                </>
                                            ) : (
                                                <div className="space-y-2 animate-pulse">
                                                    <div className="h-4 bg-slate-800 rounded w-24"></div>
                                                    <div className="h-3 bg-slate-800/50 rounded w-32"></div>
                                                </div>
                                            )}
                                        </>
                                    ) : (
                                        <>
                                            <h3 className="text-base font-medium text-slate-200">Sin conexión</h3>
                                            <p className="text-xs text-slate-400">Conecta tu cuenta para respaldar tus datos.</p>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Status Badge */}
                            <div className="shrink-0">
                                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-semibold tracking-wide uppercase border ${isDriveConnected
                                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                    : 'bg-slate-800 text-slate-400 border-slate-700'
                                    }`}>
                                    {isDriveConnected ? 'Conectado' : 'No conectado'}
                                </span>
                            </div>
                        </div>

                        {/* Activity Stats Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            {/* Card 1: Last Copy */}
                            <div className="px-4 py-3 rounded-xl bg-slate-800/20 border border-white/5 flex flex-col gap-1">
                                <span className="text-[10px] uppercase text-slate-500 font-semibold tracking-wider">Última copia</span>
                                <div className="flex items-center gap-2">
                                    <Cloud className="h-3.5 w-3.5 text-blue-400" />
                                    <span className="text-sm text-slate-200 font-medium">
                                        {lastSavedAt ? new Date(lastSavedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '---'}
                                    </span>
                                </div>
                            </div>

                            {/* Card 2: Account Update */}
                            <div className="px-4 py-3 rounded-xl bg-slate-800/20 border border-white/5 flex flex-col gap-1">
                                <span className="text-[10px] uppercase text-slate-500 font-semibold tracking-wider">Actualización cuenta</span>
                                <div className="flex items-center gap-2">
                                    <RefreshCw className={`h-3.5 w-3.5 text-slate-400 ${isRefreshingAccount ? 'animate-spin' : ''}`} />
                                    <span className="text-sm text-slate-200 font-medium">
                                        {lastUserRefreshAt ? new Date(lastUserRefreshAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : '---'}
                                    </span>
                                </div>
                            </div>

                            {/* Card 3: Status */}
                            <div className="px-4 py-3 rounded-xl bg-slate-800/20 border border-white/5 flex flex-col gap-1">
                                <span className="text-[10px] uppercase text-slate-500 font-semibold tracking-wider">Estado respaldo</span>
                                <div className="flex items-center gap-2">
                                    {isDriveConnected && lastSavedAt ? (
                                        <>
                                            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                                            <span className="text-sm text-slate-200 font-medium">Activo</span>
                                        </>
                                    ) : (
                                        <>
                                            <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                                            <span className="text-sm text-slate-200 font-medium">{isDriveConnected ? 'Sin copias' : 'Inactivo'}</span>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Actions Toolbar */}
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2 border-t border-slate-800/50">
                            {!isDriveConnected ? (
                                <button
                                    onClick={connectDrive}
                                    className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold shadow-lg shadow-blue-900/30 transition-all hover:-translate-y-0.5 active:scale-95"
                                >
                                    <img src="/google-g.svg" className="h-4 w-4 bg-white rounded-full p-0.5" alt="" />
                                    Conectar Google Drive
                                </button>
                            ) : (
                                <>
                                    {/* Primary */}
                                    <button
                                        onClick={() => saveNow()}
                                        disabled={isSaving}
                                        className="inline-flex items-center justify-center gap-2 px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold shadow-lg shadow-emerald-900/20 transition-all hover:-translate-y-0.5 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <Upload className={`h-4 w-4 ${isSaving ? 'animate-bounce' : ''}`} />
                                        {isSaving ? 'Respaldando...' : 'Respaldar ahora'}
                                    </button>

                                    {/* Secondary */}
                                    <button
                                        onClick={openRestore}
                                        className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700/50 text-slate-200 text-sm font-medium transition-colors"
                                    >
                                        <ExternalLink className="h-4 w-4" />
                                        Abrir backups
                                    </button>

                                    {/* Tertiary/Discrete */}
                                    <button
                                        onClick={handleRefreshAccount}
                                        disabled={isRefreshingAccount}
                                        className="sm:ml-auto inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-slate-500 hover:text-slate-300 hover:bg-slate-900/50 transition-colors"
                                        title="Recargar datos de cuenta"
                                    >
                                        <RefreshCw className={`h-3 w-3 ${isRefreshingAccount ? 'animate-spin' : ''}`} />
                                        Actualizar cuenta
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </section>



                {/* Section 3: Local Storage */}
                <section className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-xl shadow-lg shadow-black/40 p-5 flex flex-col gap-4 transition-transform transition-shadow duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-black/50">
                    <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-300">
                            <Database className="h-5 w-5" />
                            <h2>Tus datos (almacenamiento local)</h2>
                            <div className="flex gap-2 ml-2">
                                <span className="px-2 py-0.5 rounded-full bg-slate-800 text-[10px] text-slate-400 font-medium border border-slate-700">Privado</span>
                                <span className="px-2 py-0.5 rounded-full bg-slate-800 text-[10px] text-slate-400 font-medium border border-slate-700">Sin servidor</span>
                            </div>
                        </div>
                        <p className="text-sm text-slate-400">EVOAPP guarda tu información en este navegador. Nadie más la ve.</p>
                    </div>

                    <div className="p-4 rounded-lg bg-slate-950/50 border border-slate-800/50 space-y-4">
                        <p className="text-xs text-slate-400">
                            Si borras datos del navegador o cambias de PC, se pierde. Por eso existen respaldos.
                        </p>

                        <div className="flex flex-wrap items-center gap-3">
                            {/* Download CSV (Primary) */}
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
                                className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium shadow-md shadow-blue-900/20 transition-colors"
                            >
                                <Upload className="h-4 w-4 rotate-180 mr-2" />
                                Descargar copia CSV
                            </button>

                            {/* Restore CSV (Secondary) */}
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
                                className="inline-flex items-center justify-center px-4 py-2 rounded-lg border border-slate-700 bg-slate-900/50 hover:bg-slate-800 text-slate-200 text-sm font-medium transition-colors"
                            >
                                <Upload className="h-4 w-4 mr-2" />
                                Restaurar datos desde CSV
                            </button>

                            {/* Copy CSV (Tertiary) */}
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
                                className="inline-flex items-center justify-center px-3 py-2 rounded-lg text-slate-400 hover:text-slate-200 text-sm font-medium transition-colors"
                            >
                                Copiar vista previa CSV
                            </button>
                        </div>
                        <p className="text-[10px] text-slate-500 font-mono">
                            Formato requerido: id, toolId, createdAt, updatedAt, payload_json.
                        </p>

                        {/* Danger Zone */}
                        <div className="mt-6 pt-4 border-t border-slate-800/50">
                            <div className="rounded-lg border border-rose-900/40 bg-rose-950/20 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                <div>
                                    <h3 className="text-sm font-medium text-rose-200 mb-1">Zona de peligro</h3>
                                    <p className="text-xs text-rose-300/70">
                                        Eliminar permanentemente todos los datos locales de este navegador.
                                    </p>
                                </div>
                                <button
                                    onClick={handleClearData}
                                    className="inline-flex items-center justify-center px-3 py-2 rounded-lg bg-rose-900/40 hover:bg-rose-900/60 border border-rose-800/50 text-rose-200 text-xs font-semibold transition-colors"
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
