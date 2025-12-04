import { useState, useEffect, useMemo } from 'react';
import { dataStore } from '../../../core/data/dataStore';
import { evoStore } from '../../../core/evoappDataStore';
import { type EvoTransaction } from '../../../core/domain/evo-transaction';

// --- Types ---

export type PeriodFilter =
    | { mode: 'historico' }
    | { mode: 'mesActual' }
    | { mode: 'esteAnio' }
    | { mode: 'rango'; from: string; to: string };

export type MovementKind = 'income' | 'expense' | 'tax';

export interface NormalizedMovement {
    id: string;
    date: string;       // YYYY-MM-DD
    concept: string;
    amount: number;
    kind: MovementKind;
    sourceTool: string;
}

export interface MonthlyTrendPoint {
    month: string; // YYYY-MM
    income: number;
    expenses: number;
    taxes: number;
}

export interface FinancialSummaryState {
    totalIncome: number;
    totalExpenses: number;
    totalTaxes: number;
    netProfit: number;
    monthlySeries: MonthlyTrendPoint[];
    detailedMovements: NormalizedMovement[];
    avgIncome: number;
    avgExpenses: number;
    avgProfit: number;
}

// --- Helpers ---

const filterMovementsByPeriod = (movements: NormalizedMovement[], filter: PeriodFilter): NormalizedMovement[] => {
    const now = new Date();

    let start: string | undefined;

    switch (filter.mode) {
        case 'mesActual':
            const currentYM = now.toISOString().substring(0, 7);
            return movements.filter(m => m.date.startsWith(currentYM));
        case 'esteAnio':
            start = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
            return movements.filter(m => m.date >= start!);
        case 'rango':
            return movements.filter(m => m.date >= filter.from && m.date <= filter.to);
        case 'historico':
        default:
            return movements;
    }
};

const calculateSummary = (movements: NormalizedMovement[]): FinancialSummaryState => {
    let totalIncome = 0;
    let totalExpenses = 0;
    let totalTaxes = 0;
    const monthlyMap = new Map<string, MonthlyTrendPoint>();

    movements.forEach(m => {
        const month = m.date.substring(0, 7); // YYYY-MM
        if (!monthlyMap.has(month)) {
            monthlyMap.set(month, { month, income: 0, expenses: 0, taxes: 0 });
        }
        const data = monthlyMap.get(month)!;

        if (m.kind === 'income') {
            totalIncome += m.amount;
            data.income += m.amount;
        } else if (m.kind === 'expense') {
            totalExpenses += m.amount;
            data.expenses += m.amount;
        } else if (m.kind === 'tax') {
            totalTaxes += m.amount;
            data.taxes += m.amount;
        }
    });

    const netProfit = totalIncome - totalExpenses - totalTaxes;
    const monthlySeries = Array.from(monthlyMap.values()).sort((a, b) => a.month.localeCompare(b.month));

    const monthsCount = Math.max(monthlySeries.length, 1);

    return {
        totalIncome,
        totalExpenses,
        totalTaxes,
        netProfit,
        monthlySeries,
        detailedMovements: movements,
        avgIncome: totalIncome / monthsCount,
        avgExpenses: totalExpenses / monthsCount,
        avgProfit: netProfit / monthsCount
    };
};

// --- Hook ---

export function useFinancialData() {
    const [allMovements, setAllMovements] = useState<NormalizedMovement[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<PeriodFilter>({ mode: 'historico' });

    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            try {
                const movements: NormalizedMovement[] = [];

                // 1. Load Registros Financieros (Income/Expenses)
                const canonicalRegistros = await evoStore.registrosFinancieros.getAll();

                if (canonicalRegistros.length > 0) {
                    canonicalRegistros.forEach(r => {
                        movements.push({
                            id: r.id,
                            date: r.fecha,
                            concept: r.concepto,
                            amount: r.monto,
                            kind: r.tipo === 'ingreso' ? 'income' : 'expense',
                            sourceTool: r.origen
                        });
                    });
                } else {
                    // Fallback to evo-transactions
                    const records = await dataStore.listRecords<{ transactions: EvoTransaction[] }>('evo-transactions');
                    if (records.length > 0) {
                        const transactions = records[0].payload.transactions || [];
                        transactions.forEach(t => {
                            if (t.type === 'ingreso') {
                                movements.push({ id: t.id, date: t.date, concept: t.concept, amount: t.amount, kind: 'income', sourceTool: t.source || 'unknown' });
                            } else if (t.type === 'gasto') {
                                movements.push({ id: t.id, date: t.date, concept: t.concept, amount: t.amount, kind: 'expense', sourceTool: t.source || 'unknown' });
                            }
                        });
                    }
                }

                // 2. Load Tax Payments
                const canonicalPagos = await evoStore.pagosImpuestos.getAll();

                if (canonicalPagos.length > 0) {
                    canonicalPagos.forEach(p => {
                        movements.push({
                            id: p.id,
                            date: p.fechaPago,
                            concept: p.concepto,
                            amount: p.monto,
                            kind: 'tax',
                            sourceTool: 'tax-tracker'
                        });
                    });
                } else {
                    // Fallback to evo-transactions (if not already loaded above, but we loaded separately)
                    // If we fell back above, we might have tax payments in 'transactions' too if we didn't filter them out.
                    // But let's check specifically for tax type in fallback if canonical is empty.
                    if (canonicalRegistros.length === 0) { // Only check fallback if we are in fallback mode
                        const records = await dataStore.listRecords<{ transactions: EvoTransaction[] }>('evo-transactions');
                        if (records.length > 0) {
                            const transactions = records[0].payload.transactions || [];
                            transactions.forEach(t => {
                                if (t.type === 'impuesto') {
                                    movements.push({ id: t.id, date: t.date, concept: t.concept, amount: t.amount, kind: 'tax', sourceTool: t.source || 'unknown' });
                                }
                            });
                        }
                    }
                }

                // Sort by date desc
                movements.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                setAllMovements(movements);

            } catch (e) {
                console.error("Failed to load financial data", e);
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, []);

    const summary = useMemo(() => {
        const filtered = filterMovementsByPeriod(allMovements, filter);
        return calculateSummary(filtered);
    }, [allMovements, filter]);

    return {
        loading,
        summary,
        filter,
        setFilter
    };
}
