import React, { useEffect, useState } from 'react';
import { libraryService } from '../services/libraryService';

interface LibraryViewerProps {
    url: string | null;
}

const getFullUrl = (url: string) => {
    const rawBase = import.meta.env.VITE_LIBRARY_BASE_URL || '/library-data';
    const base = rawBase.replace(/\/$/, '');
    if (url.startsWith('http')) return url;
    return `${base}/${url.replace(/^\//, '')}`;
};

export const LibraryViewer: React.FC<LibraryViewerProps> = ({ url }) => {
    const [content, setContent] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const isPdf = url?.toLowerCase().endsWith('.pdf');
    const isImage = /\.(jpg|jpeg|png|webp|gif)$/i.test(url || '');
    const isText = !isPdf && !isImage && url; // MD, TXT, etc.

    useEffect(() => {
        if (!url || !isText) {
            setContent(null);
            return;
        }

        setLoading(true);
        setError(null);

        libraryService.fetchDocument(url)
            .then(setContent)
            .catch((err) => setError(err.message))
            .finally(() => setLoading(false));
    }, [url, isText]);

    if (!url) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 p-8 text-center bg-gray-50 dark:bg-gray-900 bg-opacity-50">
                <span className="text-4xl mb-4">📚</span>
                <p>Selecciona un documento para visualizar</p>
            </div>
        );
    }

    const fullUrl = getFullUrl(url);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full text-gray-500">
                <span className="animate-pulse">Cargando contenido...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center h-full text-red-500 p-8">
                <p>Error: {error}</p>
            </div>
        );
    }

    return (
        <div className="h-full w-full flex flex-col bg-white dark:bg-gray-800 shadow-sm overflow-hidden">
            {isPdf && (
                <iframe
                    src={fullUrl}
                    className="w-full h-full border-0"
                    title="Visor PDF"
                />
            )}

            {isImage && (
                <div className="w-full h-full flex items-center justify-center p-4 overflow-auto bg-gray-100 dark:bg-gray-900">
                    <img src={fullUrl} alt="Documento" className="max-w-full max-h-full object-contain shadow-lg" />
                </div>
            )}

            {isText && content && (
                <div className="flex-1 overflow-y-auto p-8">
                    <div className="max-w-3xl mx-auto prose dark:prose-invert">
                        {/* Render simple: whitespace-pre-wrap handles newlines and basic indentation */}
                        <pre className="whitespace-pre-wrap font-sans text-sm text-gray-800 dark:text-gray-200 leading-relaxed">
                            {content}
                        </pre>
                    </div>
                </div>
            )}
        </div>
    );
};
