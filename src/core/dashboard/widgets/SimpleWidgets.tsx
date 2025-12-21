import { useEffect, useState } from 'react';
import { Activity, Zap } from 'lucide-react';
import { WidgetCard } from './WidgetCommon';
import { evoStore } from '../../evoappDataStore';
import { useSync } from '../../../modules/core/sync/SyncProvider';

export function QuickStartWidget() {
    return (
        <WidgetCard className="bg-slate-900/60 dark:bg-slate-900/60 border-slate-800 dark:border-slate-800">
            <div className="flex flex-col gap-3">
                <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400">
                    <Zap className="h-5 w-5" />
                </div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Inicio rápido</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                    Ve a Tools Hub para abrir tus módulos.
                </p>
            </div>
        </WidgetCard>
    );
}

export function SystemStatusWidget() {
    const [counts, setCounts] = useState<{
        registros: number;
        facturas: number;
        clientes: number;
        impuestos: number;
        total: number;
    } | null>(null);

    const {
        isDriveConnected,
        driveUser,
        lastSavedAt,
        connectDrive,
        openRestore
    } = useSync();

    useEffect(() => {
        let isMounted = true;
        async function loadCounts() {
            try {
                // Lightweight check of record counts
                const [r, f, c, i] = await Promise.all([
                    evoStore.registrosFinancieros.getAll(),
                    evoStore.facturas.getAll(),
                    evoStore.clientes.getAll(),
                    evoStore.pagosImpuestos.getAll()
                ]);

                if (isMounted) {
                    setCounts({
                        registros: r.length,
                        facturas: f.length,
                        clientes: c.length,
                        impuestos: i.length,
                        total: r.length + f.length + c.length + i.length
                    });
                }
            } catch (e) {
                console.error("Failed to load data counts", e);
                if (isMounted) {
                    setCounts({ registros: 0, facturas: 0, clientes: 0, impuestos: 0, total: 0 });
                }
            }
        }

        loadCounts();
        return () => { isMounted = false; };
    }, []);

    const hasLocalData = counts && counts.total > 0;

    const formatTime = (iso?: string) => {
        if (!iso) return 'Aún sin copias';
        try {
            return `Última copia: ${new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`;
        } catch { return 'Fecha inválida'; }
    };

    const getInitials = (name?: string) => {
        if (!name) return 'E';
        return name.substring(0, 1).toUpperCase();
    };

    return (
        <WidgetCard className="bg-slate-900/60 dark:bg-slate-900/60 border-slate-800 dark:border-slate-800">
            <div className="flex flex-col gap-4">
                {/* Header */}
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400">
                        <Activity className="h-5 w-5" />
                    </div>
                    <div>
                        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Tu información</h3>
                        <div className="text-[10px] text-slate-500">Local y Google Drive</div>
                    </div>
                </div>

                {/* Local Data Section */}
                <div className="flex flex-col gap-2 p-3 rounded-md bg-slate-800/30 border border-slate-700/50">
                    <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                            <span className={`h-2 w-2 rounded-full ${hasLocalData ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]' : 'bg-slate-600'}`} />
                            <span className="text-xs font-semibold text-slate-300">Datos en este dispositivo</span>
                        </div>
                        {hasLocalData && counts && (
                            <span className="text-[10px] text-slate-500 font-mono">Total: {counts.total}</span>
                        )}
                    </div>

                    {counts ? (
                        hasLocalData ? (
                            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                                <CountLabel label="Registros" count={counts.registros} />
                                <CountLabel label="Facturas" count={counts.facturas} />
                                <CountLabel label="Clientes" count={counts.clientes} />
                                <CountLabel label="Impuestos" count={counts.impuestos} />
                            </div>
                        ) : (
                            <div className="text-xs text-slate-500 italic">
                                Sin datos locales
                            </div>
                        )
                    ) : (
                        <div className="text-xs text-slate-500 animate-pulse">Analizando...</div>
                    )}
                </div>

                {/* Google Drive Section */}
                <div className="flex flex-col gap-3 p-3 rounded-md bg-slate-800/30 border border-slate-700/50">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className={`h-2 w-2 rounded-full ${isDriveConnected ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]' : 'bg-slate-600'}`} />
                            <span className="text-xs font-semibold text-slate-300">Google Drive</span>
                        </div>
                        {isDriveConnected ? (
                            <span className="text-[10px] text-emerald-500 font-medium">Conectado</span>
                        ) : (
                            <span className="text-[10px] text-slate-500">No conectado</span>
                        )}
                    </div>

                    {!isDriveConnected && (
                        <div className="flex flex-col gap-2 mt-1">
                            <p className="text-[10px] text-slate-500 leading-snug">
                                Conecta para respaldar datos.
                            </p>
                            <button
                                onClick={() => connectDrive()}
                                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-medium transition-colors w-full text-center"
                            >
                                Conectar
                            </button>
                        </div>
                    )}

                    {isDriveConnected && (
                        <div className="flex flex-col gap-3">
                            {/* Profile Info Row with Avatar */}
                            <div className="flex items-center gap-3">
                                <div className="shrink-0 h-10 w-10 rounded-full bg-slate-700 flex items-center justify-center overflow-hidden border border-slate-600 relative">
                                    {driveUser?.photoLink ? (
                                        <img src={driveUser.photoLink} alt="Avatar" className="h-full w-full object-cover" />
                                    ) : (
                                        <span className="text-slate-300 font-bold text-sm">{getInitials(driveUser?.displayName || driveUser?.emailAddress)}</span>
                                    )}
                                </div>
                                <div className="flex flex-col min-w-0">
                                    <span className="text-xs text-slate-200 font-medium truncate block">
                                        {driveUser?.displayName || 'Usuario de Google'}
                                    </span>
                                    <span className="text-[10px] text-slate-500 truncate block">
                                        {driveUser?.emailAddress || ''}
                                    </span>
                                </div>
                            </div>

                            <div className="h-px bg-slate-700/50 w-full" />

                            <div className="flex flex-col gap-2">
                                <div className="flex justify-between items-center text-[10px] text-slate-500">
                                    <span className="font-mono text-slate-400">{formatTime(lastSavedAt)}</span>
                                </div>
                                <button
                                    onClick={openRestore}
                                    className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded text-xs font-medium transition-colors border border-slate-600 w-full text-center"
                                >
                                    Abrir copias
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </WidgetCard>
    );
}

function CountLabel({ label, count }: { label: string, count: number }) {
    return (
        <div className="flex justify-between items-center text-[10px]">
            <span className="text-slate-400">{label}</span>
            <span className={`font-mono ${count > 0 ? 'text-slate-200' : 'text-slate-600'}`}>{count}</span>
        </div>
    );
}
