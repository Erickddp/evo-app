import { useState, useEffect } from 'react';
import { dataStore } from '../../core/data/dataStore';
import { evoStore } from '../../core/evoappDataStore';
import { taxPaymentMapper } from '../../core/mappers/taxPaymentMapper';
import type { EvoTransaction } from '../../core/domain/evo-transaction';
import type { TaxPayment, MonthlyTaxSummary } from './types';
import {
    getCurrentYear,
    getPaymentsForYear,
    getYearTotals,
    getLastPayment,
    getMonthlyTaxSummary
} from './helpers';

export interface TaxSummary {
    totalYear: number;
    totalIVA: number;
    lastPayment: TaxPayment | null;
    monthlySummary: MonthlyTaxSummary[];
    loading: boolean;
    year: number;
}

export function useTaxSummary(year: number = getCurrentYear()): TaxSummary {
    const [summary, setSummary] = useState<TaxSummary>({
        totalYear: 0,
        totalIVA: 0,
        lastPayment: null,
        monthlySummary: [],
        loading: true,
        year
    });

    useEffect(() => {
        let isMounted = true;

        async function load() {
            try {
                // 1. Try loading from Unified Store (Canonical)
                const canonicalPayments = await evoStore.pagosImpuestos.getAll();
                let allPayments: TaxPayment[] = [];

                if (canonicalPayments.length > 0) {
                    allPayments = canonicalPayments.map(taxPaymentMapper.toLegacy);
                } else {
                    // 2. Migration: Try loading from evo-transactions
                    const records = await dataStore.listRecords<{ transactions: EvoTransaction[] }>('evo-transactions');

                    let transactions: EvoTransaction[] = [];
                    if (records.length > 0) {
                        records.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
                        transactions = records[0].payload.transactions || [];
                    }

                    // Map to TaxPayment
                    const legacyPayments: TaxPayment[] = transactions
                        .filter(t => t.type === 'impuesto')
                        .map(t => ({
                            id: t.id,
                            date: t.date,
                            concept: t.concept,
                            amount: t.amount,
                            type: (t.metadata?.taxType as any) || 'Other',
                            status: 'Paid',
                            metadata: t.metadata
                        }));

                    if (legacyPayments.length > 0) {
                        console.log(`Migrating ${legacyPayments.length} tax payments to canonical store...`);
                        // Save to new store
                        const canonicals = legacyPayments.map(taxPaymentMapper.toCanonical);
                        await evoStore.pagosImpuestos.saveAll(canonicals);
                        allPayments = legacyPayments;
                    }
                }

                if (!isMounted) return;

                // Filter by year
                const yearPayments = getPaymentsForYear(allPayments, year);

                // Calculate stats
                const { totalYear, totalIVA } = getYearTotals(yearPayments);
                const lastPayment = getLastPayment(allPayments);

                const monthlySummary = getMonthlyTaxSummary(yearPayments);

                setSummary({
                    totalYear,
                    totalIVA,
                    lastPayment,
                    monthlySummary,
                    loading: false,
                    year
                });

            } catch (e) {
                console.error(e);
                if (isMounted) {
                    setSummary(s => ({ ...s, loading: false }));
                }
            }
        }

        load();
        return () => { isMounted = false; };
    }, [year]);

    return summary;
}
