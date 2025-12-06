import { useEffect, useState } from 'react';
import { Zap, Activity, CheckCircle2, AlertTriangle } from 'lucide-react';
import { WidgetCard } from './WidgetCommon';
import { evoStore } from '../../evoappDataStore';

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
    const [status, setStatus] = useState<'checking' | 'ok' | 'error'>('checking');

    useEffect(() => {
        let isMounted = true;
        async function check() {
            try {
                // Lightweight check: try to read one store
                await evoStore.registrosFinancieros.getAll();
                if (isMounted) setStatus('ok');
            } catch (e) {
                console.error('System check failed', e);
                if (isMounted) setStatus('error');
            }
        }
        check();
        return () => { isMounted = false; };
    }, []);

    const isOk = status === 'ok';
    const isError = status === 'error';

    return (
        <WidgetCard className="bg-slate-900/60 dark:bg-slate-900/60 border-slate-800 dark:border-slate-800">
            <div className="flex flex-col gap-3">
                <div className={`mb-1 flex h-10 w-10 items-center justify-center rounded-lg ${isError ? 'bg-red-500/10 text-red-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                    {isError ? <AlertTriangle className="h-5 w-5" /> : <Activity className="h-5 w-5" />}
                </div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Estado del sistema</h3>
                <div className="text-xs text-slate-400 leading-relaxed">
                    {status === 'checking' && <span className="animate-pulse">Verificando sistema...</span>}
                    {isOk && (
                        <div className="flex items-center gap-1.5">
                            <CheckCircle2 size={12} className="text-emerald-500" />
                            <span>Almacenamiento local inicializado.</span>
                        </div>
                    )}
                    {isError && (
                        <div className="flex items-center gap-1.5 text-red-400">
                            <AlertTriangle size={12} />
                            <span>Error al inicializar almacenamiento.</span>
                        </div>
                    )}
                </div>
            </div>
        </WidgetCard>
    );
}
