import { useEffect, useState } from 'react';
import { FileCheck, AlertCircle } from 'lucide-react';
import { dataStore } from '../../data/dataStore';
import type { CfdiSummary } from '../../../modules/cfdi-validator/parser';

interface CfdiStats {
    totalProcessed: number;
    emittedCount: number;
    receivedCount: number;
    invalidCount: number;
}

export function CfdiWidget() {
    const [stats, setStats] = useState<CfdiStats | null>(null);

    useEffect(() => {
        let isMounted = true;
        async function load() {
            try {
                const records = await dataStore.listRecords<{ rows: CfdiSummary[], errors: any[] }>('cfdi-validator');
                if (!isMounted || records.length === 0) return;

                const latest = records.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
                const rows = latest.payload.rows || [];
                const invalid = (latest.payload.errors || []).length;

                setStats({
                    totalProcessed: rows.length + invalid,
                    emittedCount: rows.filter(r => r.type === 'Emitted').length,
                    receivedCount: rows.filter(r => r.type === 'Received').length,
                    invalidCount: invalid
                });
            } catch (e) {
                console.error(e);
            }
        }
        void load();
        return () => { isMounted = false; };
    }, []);

    return (
        <div className="group h-full rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition-all hover:shadow-md dark:border-gray-700 dark:bg-gray-800">
            <div className="flex items-center gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400">
                    <FileCheck className="h-5 w-5" />
                </div>
                <div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">Validación de CFDI</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Resumen de la última sesión.</p>
                </div>
            </div>

            {!stats ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">No hay validaciones recientes.</p>
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700">
                        <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Total</p>
                        <p className="text-xl font-bold text-gray-900 dark:text-white">{stats.totalProcessed}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800">
                        <p className="text-[10px] font-medium text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-1">Emitidos</p>
                        <p className="text-xl font-bold text-blue-700 dark:text-blue-300">{stats.emittedCount}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-purple-50 dark:bg-purple-900/10 border border-purple-100 dark:border-purple-800">
                        <p className="text-[10px] font-medium text-purple-600 dark:text-purple-400 uppercase tracking-wider mb-1">Recibidos</p>
                        <p className="text-xl font-bold text-purple-700 dark:text-purple-300">{stats.receivedCount}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-800">
                        <div className="flex items-center gap-1 mb-1">
                            <AlertCircle className="w-3 h-3 text-red-500" />
                            <p className="text-[10px] font-medium text-red-600 dark:text-red-400 uppercase tracking-wider">Errores</p>
                        </div>
                        <p className="text-xl font-bold text-red-700 dark:text-red-300">{stats.invalidCount}</p>
                    </div>
                </div>
            )}
        </div>
    );
}
