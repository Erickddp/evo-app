import { useEffect, useState } from 'react';
import { FileCheck, ArrowUpRight, ArrowDownRight, AlertTriangle } from 'lucide-react';
import { dataStore } from '../../data/dataStore';
import type { CfdiSummary } from '../../../modules/cfdi-validator/parser';
import { WidgetSkeleton, WidgetError, WidgetCard } from './WidgetCommon';

interface CfdiStats {
    totalProcessed: number;
    emittedCount: number;
    receivedCount: number;
    invalidCount: number;
    lastRun?: string;
}

export function CfdiWidget() {
    const [stats, setStats] = useState<CfdiStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    useEffect(() => {
        let isMounted = true;
        async function load() {
            try {
                const records = await dataStore.listRecords<{ rows: CfdiSummary[], errors: any[] }>('cfdi-validator');
                if (!isMounted) return;

                if (records.length === 0) {
                    setStats(null);
                    setLoading(false);
                    return;
                }

                const latest = records.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
                const rows = latest.payload.rows || [];
                const invalid = (latest.payload.errors || []).length;

                setStats({
                    totalProcessed: rows.length + invalid,
                    emittedCount: rows.filter(r => r.type === 'Emitted').length,
                    receivedCount: rows.filter(r => r.type === 'Received').length,
                    invalidCount: invalid,
                    lastRun: latest.createdAt
                });
                setLoading(false);
            } catch (e) {
                console.error(e);
                if (isMounted) {
                    setError(true);
                    setLoading(false);
                }
            }
        }
        void load();
        return () => { isMounted = false; };
    }, []);

    if (loading) return <WidgetSkeleton />;
    if (error) return <WidgetError message="No fue posible cargar el resumen de CFDI." />;

    return (
        <WidgetCard>
            <div>
                <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400">
                            <FileCheck className="h-5 w-5" />
                        </div>
                        <div>
                            <h3 className="text-lg font-medium text-gray-900 dark:text-white">Validación de CFDI</h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                Basado en la última validación de CFDI.
                            </p>
                        </div>
                    </div>
                </div>

                {!stats ? (
                    <div className="text-center py-8">
                        <p className="text-sm text-gray-500 dark:text-gray-400">Sin validaciones de CFDI registradas.</p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {/* Main Metric: Total */}
                        <div>
                            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Total Procesados</p>
                            <p className="text-4xl font-bold tracking-tight text-gray-900 dark:text-white">
                                {stats.totalProcessed}
                            </p>
                        </div>

                        {/* Breakdown Grid */}
                        <div className="grid grid-cols-3 gap-2">
                            <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800">
                                <p className="text-[10px] font-medium text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                                    <ArrowUpRight size={10} /> Emitidos
                                </p>
                                <p className="text-lg font-bold text-blue-700 dark:text-blue-300">{stats.emittedCount}</p>
                            </div>
                            <div className="p-2 rounded-lg bg-purple-50 dark:bg-purple-900/10 border border-purple-100 dark:border-purple-800">
                                <p className="text-[10px] font-medium text-purple-600 dark:text-purple-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                                    <ArrowDownRight size={10} /> Recibidos
                                </p>
                                <p className="text-lg font-bold text-purple-700 dark:text-purple-300">{stats.receivedCount}</p>
                            </div>
                            <div className={`p-2 rounded-lg border ${stats.invalidCount > 0 ? 'bg-red-50 dark:bg-red-900/10 border-red-100 dark:border-red-800' : 'bg-gray-50 dark:bg-gray-800/50 border-gray-100 dark:border-gray-700'}`}>
                                <p className={`text-[10px] font-medium uppercase tracking-wider mb-1 flex items-center gap-1 ${stats.invalidCount > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'}`}>
                                    <AlertTriangle size={10} /> Errores
                                </p>
                                <p className={`text-lg font-bold ${stats.invalidCount > 0 ? 'text-red-700 dark:text-red-300' : 'text-gray-700 dark:text-gray-300'}`}>{stats.invalidCount}</p>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {stats && stats.lastRun && (
                <div className="mt-4 border-t border-gray-100 dark:border-gray-700 pt-4">
                    <p className="text-xs text-gray-400">
                        Última ejecución: {new Date(stats.lastRun).toLocaleDateString('es-MX')} {new Date(stats.lastRun).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                </div>
            )}
        </WidgetCard>
    );
}
