import React, { useMemo } from 'react';
import { Search, Folder, ExternalLink, X } from 'lucide-react';
import type { LibraryItem } from '../providers/types';
import { normalize, getIconForType, getTypeName, generateFallbackSummary } from '../utils/helpers';

interface AllItemsViewProps {
    items: LibraryItem[];
    searchTerm: string;
    onSearchChange: (term: string) => void;
}

const TYPE_FILTERS = [
    { id: 'all', label: 'Todo' },
    { id: 'pdf', label: 'PDF' },
    { id: 'xlsx', label: 'Excel' },
    { id: 'docx', label: 'Word' },
    { id: 'image', label: 'Imagen' },
    { id: 'folder', label: 'Carpetas' },
];

export function AllItemsView({ items, searchTerm, onSearchChange }: AllItemsViewProps) {
    const [selectedType, setSelectedType] = React.useState('all');

    const filteredItems = useMemo(() => {
        if (!items.length) return [];

        let result = items;
        const term = normalize(searchTerm);

        // Filter by Type
        if (selectedType !== 'all') {
            if (selectedType === 'folder') {
                result = result.filter(i => i.type === 'folder');
            } else if (selectedType === 'image') {
                result = result.filter(i => ['png', 'jpg', 'jpeg', 'webp'].includes(i.ext?.toLowerCase() || ''));
            } else if (selectedType === 'pdf') {
                result = result.filter(i => i.ext?.toLowerCase() === 'pdf');
            } else if (selectedType === 'xlsx') {
                result = result.filter(i => ['xlsx', 'xls', 'csv'].includes(i.ext?.toLowerCase() || ''));
            } else if (selectedType === 'docx') {
                result = result.filter(i => ['docx', 'doc'].includes(i.ext?.toLowerCase() || ''));
            }
        }

        // Filter by Search Term (Name, Path ONLY)
        if (term) {
            result = result.filter(item => {
                const inName = normalize(item.name).includes(term);
                const inPath = normalize(item.path).includes(term);
                return inName || inPath;
            });
        }

        return result;
    }, [items, searchTerm, selectedType]);

    // Click handler to open in new tab
    const handleItemClick = (item: LibraryItem) => {
        if (!item.driveUrl) return;
        window.open(item.driveUrl, "_blank", "noopener,noreferrer");
    };

    return (
        <div className="flex flex-col h-full animate-in fade-in zoom-in-95 duration-300">
            {/* Search & Filter Header */}
            <div className="p-4 md:p-6 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
                {/* Search Bar */}
                <div className="relative max-w-3xl mx-auto mb-4">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <Search className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                        type="text"
                        className="block w-full pl-11 pr-4 py-3 bg-gray-100 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:text-white dark:placeholder-gray-400 transition-all shadow-sm text-lg"
                        placeholder="Buscar documentos, carpetas, guías..."
                        value={searchTerm}
                        onChange={(e) => onSearchChange(e.target.value)}
                    />
                    {searchTerm && (
                        <button
                            onClick={() => onSearchChange('')}
                            className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                        >
                            <X size={18} />
                        </button>
                    )}
                </div>

                {/* Type Filters */}
                <div className="flex flex-wrap gap-2 justify-center">
                    {TYPE_FILTERS.map(type => (
                        <button
                            key={type.id}
                            onClick={() => setSelectedType(type.id)}
                            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${selectedType === type.id
                                ? 'bg-blue-600 text-white shadow-md'
                                : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
                                }`}
                        >
                            {type.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* List Results */}
            <div className="flex-1 overflow-auto p-4 md:p-8 bg-gray-50 dark:bg-gray-900/50">
                <div className="max-w-6xl mx-auto">
                    {filteredItems.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                            <Search size={48} className="mb-4 opacity-20" />
                            <p className="text-lg font-medium">No se encontraron resultados</p>
                            <p className="text-sm">Intenta con otros términos o filtros</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-1 gap-3">
                            <div className="hidden md:grid grid-cols-12 gap-4 px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                                <div className="col-span-1 text-center">Tipo</div>
                                <div className="col-span-4">Nombre</div>
                                <div className="col-span-3">Ubicación</div>
                                <div className="col-span-3">Resumen</div>
                                <div className="col-span-1 text-right">Acción</div>
                            </div>

                            {filteredItems.map((item) => (
                                <div
                                    key={item.id}
                                    onClick={() => handleItemClick(item)}
                                    className="group bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-md transition-all duration-200 p-4 md:p-3 md:grid md:grid-cols-12 md:gap-4 md:items-center cursor-pointer"
                                >
                                    <div className="col-span-12 md:col-span-1 flex items-center md:justify-center mb-3 md:mb-0">
                                        <div className="p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg group-hover:scale-110 transition-transform">
                                            {getIconForType(item.type, item.ext)}
                                        </div>
                                        <div className="md:hidden ml-3 overflow-hidden">
                                            <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                                                {item.name}
                                            </h3>
                                            <p className="text-xs text-gray-500">{getTypeName(item.type, item.ext)}</p>
                                        </div>
                                    </div>

                                    <div className="hidden md:block col-span-4">
                                        <h3 className="font-medium text-gray-900 dark:text-gray-100 truncate" title={item.name}>
                                            {item.name}
                                        </h3>
                                        <div className="flex gap-1 mt-1">
                                            {/* We ignore keywords as requested, but keep them in UI if available/mocked */}
                                            {item.keywords?.slice(0, 2).map(k => (
                                                <span key={k} className="text-[10px] px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-500 rounded-full truncate max-w-[80px]">
                                                    {k}
                                                </span>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="col-span-12 md:col-span-3 mb-2 md:mb-0">
                                        <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/80 rounded-md px-2 py-1 truncate w-fit max-w-full">
                                            <Folder size={10} className="shrink-0" />
                                            <span className="truncate" title={item.path}>
                                                {item.path.split('/').pop() || 'Root'}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="col-span-12 md:col-span-3 mb-3 md:mb-0">
                                        <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 leading-relaxed">
                                            {item.summary || generateFallbackSummary(item)}
                                        </p>
                                    </div>

                                    <div className="col-span-12 md:col-span-1 text-right">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleItemClick(item);
                                            }}
                                            className="inline-flex items-center justify-center w-full md:w-auto px-4 py-2 md:p-2 bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50 rounded-lg transition-colors text-sm font-medium gap-2"
                                            title="Abrir en Google Drive"
                                        >
                                            <span className="md:hidden">Abrir en Drive</span>
                                            <ExternalLink size={18} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
