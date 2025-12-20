import React from 'react';
import { useLibrary } from '../hooks/useLibrary';
import { LibraryTree } from './LibraryTree';
import { LibraryViewer } from './LibraryViewer';

export const LibraryLayout: React.FC = () => {
    const { data, loading, error, currentUrl, reload, selectDocument } = useLibrary();

    if (loading) {
        return (
            <div className="flex items-center justify-center p-8 h-full bg-gray-50 dark:bg-black text-gray-500">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    <p>Cargando índice de biblioteca...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center p-8 h-full bg-gray-50 dark:bg-black">
                <div className="text-center">
                    <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-2">Error de conexión</h3>
                    <p className="text-red-500 mb-6">{error}</p>
                    <button
                        onClick={reload}
                        className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow transition-all"
                    >
                        Reintentar
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-full w-full overflow-hidden bg-gray-50 dark:bg-black border-t border-gray-200 dark:border-gray-800">
            {/* Sidebar Navigation */}
            <aside className="w-72 flex-shrink-0 border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 flex flex-col shadow-sm z-10">
                <div className="p-4 border-b border-gray-100 dark:border-gray-900 bg-gray-50 dark:bg-gray-900/50">
                    <h2 className="font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                        <span>📚</span> Biblioteca Contable
                    </h2>
                </div>

                <div className="flex-1 overflow-hidden py-2">
                    {data && data.root.length > 0 ? (
                        <LibraryTree
                            data={data.root}
                            onSelect={selectDocument}
                            selectedUrl={currentUrl}
                        />
                    ) : (
                        <div className="p-8 text-center text-sm text-gray-400">
                            <p>No se encontraron carpetas.</p>
                        </div>
                    )}
                </div>

                <div className="p-2 border-t border-gray-100 dark:border-gray-900 text-xs text-gray-400 text-center bg-gray-50 dark:bg-gray-900/50">
                    EVO-LIBRARY v2.0 (Thin Client)
                </div>
            </aside>

            {/* Main Viewport */}
            <main className="flex-1 flex flex-col overflow-hidden relative bg-white dark:bg-gray-900">
                <LibraryViewer url={currentUrl} />
            </main>
        </div>
    );
};
