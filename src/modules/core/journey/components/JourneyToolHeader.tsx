import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar } from 'lucide-react';


interface JourneyToolHeaderProps {
    currentMonth: string;
    title: string;
    subtitle?: string;
    hideMonthBadge?: boolean;
}

/**
 * Standard Header for Tools participating in the Journey.
 * Provides "Back to Journey" navigation and context visibility.
 */
export const JourneyToolHeader: React.FC<JourneyToolHeaderProps> = ({
    currentMonth,
    title,
    subtitle,
    hideMonthBadge = false
}) => {
    const navigate = useNavigate();

    const handleBack = () => {
        // Always navigate back to the Close Month Journey for the specific month
        if (currentMonth) {
            navigate(`/journey/close-month/${currentMonth}`);
        } else {
            // Fallback (should ideally not happen if month is enforced)
            navigate('/');
        }
    };

    return (
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center justify-between mb-4 rounded-t-lg">
            <div className="flex items-center gap-4">
                <button
                    onClick={handleBack}
                    className="flex items-center gap-1 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 transition-colors"
                >
                    <ArrowLeft size={16} />
                    <span className="hidden sm:inline">Volver al Cierre</span>
                </button>

                <div className="h-6 w-px bg-gray-300 dark:bg-gray-600 mx-2" />

                <div>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 leading-none">
                        {title}
                    </h2>
                    {subtitle && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            {subtitle}
                        </p>
                    )}
                </div>
            </div>

            {!hideMonthBadge && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                    <Calendar size={14} className="text-gray-500 dark:text-gray-400" />
                    <span className="text-sm font-mono font-medium text-gray-700 dark:text-gray-300">
                        {currentMonth}
                    </span>
                </div>
            )}
        </div>
    );
};
