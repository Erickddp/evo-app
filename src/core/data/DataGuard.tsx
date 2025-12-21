import React, { useEffect, useState } from 'react';
import { useProfile } from '../../modules/core/profiles/ProfileProvider';
import { MigrationService } from './migration/MigrationService';

export const DataGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { activeProfile } = useProfile();
    const [status, setStatus] = useState<'checking' | 'ready' | 'error'>('checking');
    const [err, setErr] = useState<string>();

    useEffect(() => {
        // When profile changes (or on mount), we check migration for that profile's DB
        let mounted = true;

        const runCheck = async () => {
            if (!activeProfile) return;

            try {
                setStatus('checking');
                console.log(`[DataGuard] Checking consistency for profile: ${activeProfile.name}`);

                // This blocks until migration is verified/completed for the current DB
                await MigrationService.checkAndMigrate();

                if (mounted) setStatus('ready');
            } catch (e: any) {
                console.error('[DataGuard] Critical Error', e);
                if (mounted) {
                    setErr(e.message || 'Error de integridad de datos');
                    setStatus('error');
                }
            }
        };

        runCheck();

        return () => { mounted = false; };
    }, [activeProfile]);

    if (status === 'error') {
        return (
            <div className="h-screen w-screen flex items-center justify-center bg-slate-950 text-white">
                <div className="text-center p-8 max-w-md bg-slate-900 rounded-xl border border-red-500/30">
                    <h1 className="text-xl font-bold text-red-400 mb-4">Error Crítico</h1>
                    <p className="text-slate-300 mb-4">No se pudieron verificar los datos del perfil.</p>
                    <code className="block bg-black/30 p-2 rounded text-xs text-red-300 mb-6 font-mono">
                        {err}
                    </code>
                    <button
                        onClick={() => window.location.reload()}
                        className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded transition-colors"
                    >
                        Recargar Aplicación
                    </button>
                </div>
            </div>
        );
    }

    if (status === 'checking') {
        return (
            <div className="h-screen w-screen flex items-center justify-center bg-slate-950 text-white">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-8 h-8 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
                    <p className="text-sm font-medium text-indigo-300 animate-pulse">
                        Verificando integridad de datos...
                    </p>
                </div>
            </div>
        );
    }

    return <>{children}</>;
};
