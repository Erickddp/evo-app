import { useState, useEffect } from 'react';
import { evoEvents } from '../../core/events';
import { evoStore } from '../../core/evoappDataStore';
import { taxPaymentMapper } from '../../core/mappers/taxPaymentMapper';
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
                }

                // Legacy Migration handled by MigrationService. 
                // We rely on canonical data only.

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

        const handleDataChanged = () => {
            setSummary(s => ({ ...s, loading: true, monthlySummary: [], totalYear: 0, totalIVA: 0, lastPayment: null }));
            load();
        };

        evoEvents.on('data:changed', handleDataChanged);

        return () => {
            isMounted = false;
            evoEvents.off('data:changed', handleDataChanged);
        };
    }, [year]);

    return summary;
}
