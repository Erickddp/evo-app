import { Zap, Activity } from 'lucide-react';

export function QuickStartWidget() {
    return (
        <div className="group h-full rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-all hover:shadow-md dark:border-gray-700 dark:bg-gray-800">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400">
                <Zap className="h-5 w-5" />
            </div>
            <h3 className="text-base font-medium text-gray-900 dark:text-white">Inicio rápido</h3>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                Ve a Tools Hub para abrir tus módulos.
            </p>
        </div>
    );
}

export function SystemStatusWidget() {
    return (
        <div className="group h-full rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-all hover:shadow-md dark:border-gray-700 dark:bg-gray-800">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400">
                <Activity className="h-5 w-5" />
            </div>
            <h3 className="text-base font-medium text-gray-900 dark:text-white">Estado del sistema</h3>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                Almacenamiento local activo y funcionando.
            </p>
        </div>
    );
}
