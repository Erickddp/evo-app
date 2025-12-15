import React, { useState, useEffect } from 'react';
import { BookOpen, Layers } from 'lucide-react';
import { useLibraryCatalog } from './hooks/useLibraryCatalog';
import { ApiStatusPanel } from './components/ApiStatusPanel';
import { RecommendedView } from './components/RecommendedView';
import { AllItemsView } from './components/AllItemsView';

interface RecommendationEvent {
    detail: {
        keywords: string[];
        context?: string;
    };
}

export function EvoLibrary() {
    // Data Hook (Provider Pattern)
    const { items, loading, providerStatus, usingSource, sync, refresh } = useLibraryCatalog();

    // UI State
    const [activeTab, setActiveTab] = useState<'reco' | 'all'>('reco');
    const [searchTerm, setSearchTerm] = useState('');
    const [recommendations, setRecommendations] = useState<string[]>([]);

    // 1. Load Persisted Recommendations
    useEffect(() => {
        const saved = localStorage.getItem('evx.library.reco.v1');
        if (saved) {
            try {
                setRecommendations(JSON.parse(saved));
            } catch (e) {
                console.error('Failed to parse recommendations', e);
            }
        }
    }, []);

    // 2. Listen for Recommendation Events
    useEffect(() => {
        const handleRecommend = (e: Event) => {
            const detail = (e as CustomEvent<RecommendationEvent['detail']>).detail;
            if (detail && detail.keywords) {
                setRecommendations(detail.keywords);
                localStorage.setItem('evx.library.reco.v1', JSON.stringify(detail.keywords));
                // Optionally switch to Reco tab if event fires?
                // setActiveTab('reco');
            }
        };

        window.addEventListener('evx:library:recommend', handleRecommend);
        return () => window.removeEventListener('evx:library:recommend', handleRecommend);
    }, []);

    // 3. Quick Search / Chip Handler
    const handleQuickSearch = (term: string) => {
        setSearchTerm(term);
        setActiveTab('all');
    };

    if (loading && items.length === 0) {
        return (
            <div className="h-full flex items-center justify-center bg-gray-50 dark:bg-gray-900">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900 overflow-hidden">
            {/* API Status Boundary */}
            <ApiStatusPanel
                status={providerStatus}
                source={usingSource}
                onSync={sync}
            />

            {/* Header & Tabs */}
            <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 pt-6 px-6 pb-0 shadow-sm shrink-0 z-20">
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400">
                            EVO Library
                        </h1>
                        <p className="text-gray-500 dark:text-gray-400 mt-1">
                            Accede a todos tus recursos, guías y documentos fiscales centralizados.
                        </p>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-6">
                    <button
                        onClick={() => setActiveTab('reco')}
                        className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'reco'
                                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                            }`}
                    >
                        <Layers size={16} />
                        Recomendadas
                    </button>
                    <button
                        onClick={() => setActiveTab('all')}
                        className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'all'
                                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                            }`}
                    >
                        <BookOpen size={16} />
                        Todas
                    </button>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-hidden relative">
                {activeTab === 'reco' ? (
                    <div className="h-full overflow-auto">
                        <RecommendedView
                            items={items}
                            recommendations={recommendations}
                            onQuickSearch={handleQuickSearch}
                        />
                    </div>
                ) : (
                    <AllItemsView
                        items={items}
                        searchTerm={searchTerm}
                        onSearchChange={setSearchTerm}
                    />
                )}
            </div>
        </div>
    );
}
