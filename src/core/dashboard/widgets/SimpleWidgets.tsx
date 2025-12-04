import { Zap, Activity } from 'lucide-react';

export function QuickStartWidget() {
    return (
        <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-xl shadow-lg shadow-black/40 p-4 flex flex-col gap-3 transition-transform transition-shadow duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-black/50 h-full">
            <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400">
                <Zap className="h-5 w-5" />
            </div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Inicio rápido</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
                Ve a Tools Hub para abrir tus módulos.
            </p>
        </div>
    );
}

export function SystemStatusWidget() {
    return (
        <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-xl shadow-lg shadow-black/40 p-4 flex flex-col gap-3 transition-transform transition-shadow duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-black/50 h-full">
            <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
                <Activity className="h-5 w-5" />
            </div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Estado del sistema</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
                Almacenamiento local activo y funcionando.
            </p>
        </div>
    );
}
