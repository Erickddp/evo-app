import { Wifi, WifiOff, AlertTriangle } from 'lucide-react';
import type { ProviderStatus, LibrarySource } from '../providers/types';

interface ApiStatusPanelProps {
    status: ProviderStatus;
    source: LibrarySource;
    // onSync prop removed as sync is not implemented
    onSync?: () => Promise<{ success: boolean; message?: string }>;
}

export function ApiStatusPanel({ status, source }: ApiStatusPanelProps) {
    // Only show if we are attempting to use API or if it's degraded/offline
    const isApiEnabled = import.meta.env.VITE_LIBRARY_API_ENABLED === 'true';

    if (!isApiEnabled) return null;

    return (
        <div className="flex items-center gap-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-2 text-sm z-30">
            <div className={`flex items-center gap-2 ${status === 'ok' ? 'text-green-600' :
                status === 'degraded' ? 'text-amber-500' : 'text-red-500'
                }`}>
                {status === 'ok' ? <Wifi size={14} /> :
                    status === 'degraded' ? <AlertTriangle size={14} /> : <WifiOff size={14} />}

                <span className="font-medium">
                    {source === 'api' ? 'Conectado a Drive' : 'Modo Local (Fallback)'}
                </span>
            </div>
        </div>
    );
}
