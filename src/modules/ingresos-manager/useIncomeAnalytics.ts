import { useState, useMemo } from 'react';
import { type EvoTransaction } from '../../core/domain/evo-transaction';
import { getYearMonth, getYear } from './utils';
import { buildIncomeDashboardMetrics, type IncomeDashboardMetrics } from './metrics';

export type ViewType = 'current-month' | 'prev-month' | 'last-3-months' | 'year' | 'historic';
export type { IncomeDashboardMetrics };

export function useIncomeAnalytics(movements: EvoTransaction[]) {
    const [view, setView] = useState<ViewType>('current-month');
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1; // 1-12

    // Helper to format YYYY-MM
    const formatYM = (y: number, m: number) => `${y}-${m.toString().padStart(2, '0')}`;

    const currentYM = formatYM(currentYear, currentMonth);

    // Previous Month Logic
    let prevMonthYear = currentYear;
    let prevMonth = currentMonth - 1;
    if (prevMonth === 0) {
        prevMonth = 12;
        prevMonthYear -= 1;
    }
    const prevYM = formatYM(prevMonthYear, prevMonth);

    const filteredMovements = useMemo(() => {
        return movements.filter(m => {
            const mYM = getYearMonth(m.date);
            const mYear = getYear(m.date);

            switch (view) {
                case 'current-month':
                    return mYM === currentYM;
                case 'prev-month':
                    return mYM === prevYM;
                case 'last-3-months':
                    // Simple "is within range" check.
                    const d = new Date(m.date);
                    const threeMonthsAgo = new Date();
                    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
                    return d >= threeMonthsAgo;
                case 'year':
                    return mYear === selectedYear;
                case 'historic':
                default:
                    return true;
            }
        });
    }, [movements, view, selectedYear, currentYM, prevYM]);

    const metrics = useMemo<IncomeDashboardMetrics>(() => {
        return buildIncomeDashboardMetrics(movements);
    }, [movements]);

    const availableYears = useMemo(() => {
        const years = new Set(movements.map(m => getYear(m.date)));
        years.add(currentYear);
        return Array.from(years).sort((a, b) => b - a);
    }, [movements, currentYear]);

    return {
        view,
        setView,
        selectedYear,
        setSelectedYear,
        filteredMovements,
        metrics,
        availableYears
    };
}
