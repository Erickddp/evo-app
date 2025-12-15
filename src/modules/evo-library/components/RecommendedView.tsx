import { useMemo } from 'react';
import { Sparkles } from 'lucide-react';
import type { LibraryItem } from '../providers/types';
import { ReferenceCards } from './ReferenceCards';
import { normalize, getIconForType, generateFallbackSummary } from '../utils/helpers';

interface RecommendedViewProps {
    items: LibraryItem[];
    recommendations: string[];
    onQuickSearch: (term: string) => void;
}

const QUICK_CHIPS = [
    'Nómina', 'CFDI', 'Salarios', 'Anual', 'RESICO',
    'IMSS', 'Carta Porte', 'CUFIN', 'IVA', 'ISR'
];

export function RecommendedView({ items, recommendations, onQuickSearch }: RecommendedViewProps) {

    // Filter items based on recommendations
    const recommendedItems = useMemo(() => {
        if (!recommendations.length) return [];
        const terms = recommendations.map(normalize);
        return items.filter(item => {
            // Simple matching logic
            const text = normalize(item.name + ' ' + item.keywords.join(' ') + ' ' + (item.summary || ''));
            return terms.some(t => text.includes(t));
        }).slice(0, 5); // Limit to top 5
    }, [items, recommendations]);

    return (
        <div className="space-y-8 p-4 md:p-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* Block 1: Recommendations */}
            {recommendations.length > 0 && (
                <section>
                    <div className="flex items-center gap-2 mb-4">
                        <Sparkles className="text-amber-500" size={20} />
                        <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">
                            Recomendado para ti
                        </h2>
                    </div>

                    {/* Chips of current context */}
                    <div className="flex flex-wrap gap-2 mb-4">
                        {recommendations.map((rec, idx) => (
                            <span key={idx} className="px-3 py-1 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-700/50 rounded-full text-sm font-medium">
                                {rec}
                            </span>
                        ))}
                    </div>

                    {/* Results List (Mini version) */}
                    {recommendedItems.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {recommendedItems.map(item => (
                                <a
                                    key={item.id}
                                    href={item.driveUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-start gap-3 p-3 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:shadow-md transition-all group"
                                >
                                    <div className="shrink-0 p-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
                                        {getIconForType(item.type, item.ext)}
                                    </div>
                                    <div className="overflow-hidden">
                                        <h3 className="font-medium text-gray-900 dark:text-gray-100 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                            {item.name}
                                        </h3>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mt-1">
                                            {item.summary || generateFallbackSummary(item)}
                                        </p>
                                    </div>
                                </a>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-gray-500 italic">No hay documentos específicos para esta recomendación.</p>
                    )}
                </section>
            )}

            {/* Block 2: Suggested Tools */}
            <section>
                <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-4">
                    Herramientas Sugeridas
                </h2>
                <ReferenceCards />
            </section>

            {/* Block 3: Quick Access */}
            <section>
                <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-4">
                    Explorar por Temas
                </h2>
                <div className="flex flex-wrap gap-2">
                    {QUICK_CHIPS.map(chip => (
                        <button
                            key={chip}
                            onClick={() => onQuickSearch(chip)}
                            className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-600 dark:text-gray-300 hover:border-blue-500 hover:text-blue-600 dark:hover:border-blue-400 dark:hover:text-blue-400 transition-all shadow-sm hover:shadow"
                        >
                            {chip}
                        </button>
                    ))}
                </div>
            </section>

        </div>
    );
}
