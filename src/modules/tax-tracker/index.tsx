import React, { useState, useEffect, useMemo } from 'react';
import { Plus, TrendingUp, DollarSign, Info } from 'lucide-react';
import { dataStore } from '../../core/data/dataStore';
import { evoStore } from '../../core/evoappDataStore';
import { taxPaymentMapper } from '../../core/mappers/taxPaymentMapper';
import { ingresosMapper } from '../../core/mappers/ingresosMapper';
import { type EvoTransaction } from '../../core/domain/evo-transaction';
import type { TaxPayment } from './types';


// --- Constants ---
const IVA_RATE = 0.16;
const ISR_RATE_ESTIMATE = 0.30; // Simplified estimation

// --- Helper Functions ---

function formatCurrency(amount: number): string {
    return amount.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
}

function todayAsIso(): string {
    return new Date().toISOString().split('T')[0];
}



// --- Component ---

export const TaxTrackerTool: React.FC = () => {
    const [payments, setPayments] = useState<TaxPayment[]>([]);
    const [allTransactions, setAllTransactions] = useState<EvoTransaction[]>([]);
    const [loading, setLoading] = useState(true);

    // Form State
    const [date, setDate] = useState(todayAsIso());
    const [concept, setConcept] = useState('');
    const [amountStr, setAmountStr] = useState('');
    const [type, setType] = useState<'IVA' | 'ISR' | 'Other'>('IVA');

    // Load data
    useEffect(() => {
        const load = async () => {
            try {
                // 1. Load Tax Payments from Unified Store
                const canonicalPayments = await evoStore.pagosImpuestos.getAll();
                let loadedPayments: TaxPayment[] = [];

                if (canonicalPayments.length > 0) {
                    loadedPayments = canonicalPayments.map(taxPaymentMapper.toLegacy);
                } else {
                    // Migration Check (if hooks.ts didn't run or empty)
                    // We rely on hooks.ts or just check here too for robustness
                    const records = await dataStore.listRecords<{ transactions: EvoTransaction[] }>('evo-transactions');
                    if (records.length > 0) {
                        const transactions = records[0].payload.transactions || [];
                        const legacyItems = transactions.filter(t => t.type === 'impuesto');
                        if (legacyItems.length > 0) {
                            loadedPayments = legacyItems.map(t => ({
                                id: t.id,
                                date: t.date,
                                concept: t.concept,
                                amount: t.amount,
                                type: (t.metadata?.taxType as any) || 'Other',
                                status: 'Paid',
                                metadata: t.metadata
                            }));
                            // We could migrate here too, but let's assume hooks.ts or lazy migration handles it.
                            // For now, just display.
                        }
                    }
                }
                setPayments(loadedPayments);

                // 2. Load Income/Expenses for Projections (from RegistrosFinancieros)
                const canonicalRegistros = await evoStore.registrosFinancieros.getAll();
                let loadedTransactions: EvoTransaction[] = [];

                if (canonicalRegistros.length > 0) {
                    loadedTransactions = canonicalRegistros.map(ingresosMapper.toLegacy);
                } else {
                    // Fallback to evo-transactions if migration hasn't happened
                    const records = await dataStore.listRecords<{ transactions: EvoTransaction[] }>('evo-transactions');
                    if (records.length > 0) {
                        loadedTransactions = records[0].payload.transactions || [];
                    }
                }
                setAllTransactions(loadedTransactions);

            } catch (e) {
                console.error('Failed to load data', e);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    // Projections Logic
    const projections = useMemo(() => {
        const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM

        // Filter for current month
        const monthlyTransactions = allTransactions.filter(t => t.date.startsWith(currentMonth));

        let totalIncome = 0;
        let totalExpenses = 0;

        for (const t of monthlyTransactions) {
            if (t.type === 'ingreso') totalIncome += t.amount;
            else if (t.type === 'gasto') totalExpenses += t.amount;
        }

        const estimatedIva = Math.max(0, (totalIncome - totalExpenses) * IVA_RATE);
        const estimatedIsr = Math.max(0, (totalIncome - totalExpenses) * ISR_RATE_ESTIMATE);

        return {
            period: currentMonth,
            totalIncome,
            totalExpenses,
            estimatedIva,
            estimatedIsr
        };
    }, [allTransactions]);

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!concept.trim() || !amountStr) return;

        const amount = parseFloat(amountStr);
        if (isNaN(amount)) return;

        const newPaymentLegacy: TaxPayment = {
            id: crypto.randomUUID(),
            date,
            concept,
            amount,
            type,
            status: 'Paid',
            metadata: { taxType: type }
        };

        try {
            // Save to Unified Store
            await evoStore.pagosImpuestos.add(taxPaymentMapper.toCanonical(newPaymentLegacy));

            setPayments(prev => [...prev, newPaymentLegacy]);

            // Reset form
            setConcept('');
            setAmountStr('');
        } catch (e) {
            console.error('Failed to save payment', e);
            alert('Error saving payment');
        }
    };

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Projections Card */}
                <div className="bg-gradient-to-br from-slate-800 to-slate-900 text-white rounded-xl p-6 shadow-lg">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        <TrendingUp size={20} className="text-blue-400" />
                        Tax Projections ({projections.period})
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="p-3 bg-white/10 rounded-lg">
                            <div className="text-xs text-slate-300 uppercase">Est. IVA to Pay</div>
                            <div className="text-xl font-bold text-blue-300">{formatCurrency(projections.estimatedIva)}</div>
                        </div>
                        <div className="p-3 bg-white/10 rounded-lg">
                            <div className="text-xs text-slate-300 uppercase">Est. ISR to Pay</div>
                            <div className="text-xl font-bold text-orange-300">{formatCurrency(projections.estimatedIsr)}</div>
                        </div>
                        <div className="p-3 bg-white/5 rounded-lg">
                            <div className="text-xs text-slate-400 uppercase">Month Income</div>
                            <div className="text-lg font-medium">{formatCurrency(projections.totalIncome)}</div>
                        </div>
                        <div className="p-3 bg-white/5 rounded-lg">
                            <div className="text-xs text-slate-400 uppercase">Month Expenses</div>
                            <div className="text-lg font-medium">{formatCurrency(projections.totalExpenses)}</div>
                        </div>
                    </div>
                    <p className="text-xs text-slate-500 mt-4 italic">
                        * Estimates based on recorded income/expenses. Actual tax may vary.
                    </p>
                </div>

                {/* Add Payment Form */}
                <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                        <DollarSign size={20} className="text-green-500" />
                        Register Tax Payment
                    </h3>
                    <form onSubmit={handleAdd} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Date</label>
                                <input
                                    type="date"
                                    value={date}
                                    onChange={e => setDate(e.target.value)}
                                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm p-2"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Type</label>
                                <select
                                    value={type}
                                    onChange={e => setType(e.target.value as any)}
                                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm p-2"
                                >
                                    <option value="IVA">IVA</option>
                                    <option value="ISR">ISR</option>
                                    <option value="Other">Other</option>
                                </select>
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Concept</label>
                            <input
                                type="text"
                                value={concept}
                                onChange={e => setConcept(e.target.value)}
                                placeholder="e.g. Pago Provisional Enero"
                                className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm p-2"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Amount</label>
                            <input
                                type="number"
                                step="0.01"
                                value={amountStr}
                                onChange={e => setAmountStr(e.target.value)}
                                placeholder="0.00"
                                className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm p-2"
                                required
                            />
                        </div>
                        <button
                            type="submit"
                            className="w-full py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
                        >
                            <Plus size={16} /> Register Payment
                        </button>
                    </form>
                </div>
            </div>

            {/* Chart */}
            {/* <TaxIncomeChart payments={payments} incomeMovements={ingresosMovements} /> */}
            {/* Chart temporarily disabled until updated to use EvoTransaction */}

            {/* Info Panel */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-xl p-4 flex items-start gap-3">
                <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                <div>
                    <h4 className="text-sm font-medium text-blue-900 dark:text-blue-300">Proyecciones de impuestos</h4>
                    <p className="text-sm text-blue-700 dark:text-blue-400 mt-1">
                        Este módulo genera proyecciones de pagos de impuestos con base en tus ingresos y pagos registrados. Son estimaciones históricas, no un cálculo oficial. Úsalas solo como referencia.
                    </p>
                </div>
            </div>

            {/* Payment History */}
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
                <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                    <h3 className="font-medium text-gray-900 dark:text-white">Payment History</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gray-50 dark:bg-gray-900/50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Date</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Concept</th>
                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Type</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Amount</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                            {loading ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-8 text-center text-sm text-gray-500">Loading...</td>
                                </tr>
                            ) : payments.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                                        No tax payments recorded yet.
                                    </td>
                                </tr>
                            ) : (
                                payments
                                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                                    .map((p) => (
                                        <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{p.date}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{p.concept}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-center text-sm">
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                                                    {p.metadata?.taxType || 'Tax'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-mono font-medium text-gray-900 dark:text-white">
                                                {formatCurrency(p.amount)}
                                            </td>
                                        </tr>
                                    ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
