
import { useState, useEffect, useRef } from 'react';
import { useProfile } from '../profiles/ProfileProvider';
import { evoStore } from '../../../core/evoappDataStore';
import { dashboardDataProvider } from './DashboardDataProvider';
import type { DashboardDataSnapshot } from './types';
import { evoEvents } from '../../../core/events';

export function useDashboardData(month: string) {
    const { activeProfile } = useProfile();
    const [snapshot, setSnapshot] = useState<DashboardDataSnapshot | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    // Reload Trigger
    const [version, setVersion] = useState(0);
    // Ref to avoid loops when other data changes but dashboard data is stable
    const lastDataHash = useRef<string>('');

    useEffect(() => {
        // Subscribe to data changes
        const unsub = evoEvents.on('data:changed', () => {
            setVersion(v => v + 1);
        });
        return unsub;
    }, []);

    useEffect(() => {
        let mounted = true;

        const load = async () => {
            try {
                // If loading for the first time or profile changed, we show loading
                // But for background updates, we might want to keep showing old data?
                // current logic sets loading=true always.
                // setLoading(true); // Optimization: Maybe don't flicker load on refresh

                // Fetch ALL records (Filtering is done in DataProvider)
                const registros = await evoStore.registrosFinancieros.getAll();

                if (!mounted) return;

                const data = dashboardDataProvider.getSnapshot(month, {
                    profile: activeProfile,
                    registros
                });

                // Deep compare important fields to prevent loop
                // "lastUpdatedAt" changes every time, so we exclude it from check
                // We include context (month/profile) to force update on switch even if empty data
                const compareKey = JSON.stringify({
                    month,
                    profileId: activeProfile.id,
                    stats: data.stats,
                    signals: data.signals,
                    taxSummary: data.taxSummary
                });

                if (compareKey !== lastDataHash.current) {
                    lastDataHash.current = compareKey;
                    setSnapshot(data);
                }

                setError(null);
            } catch (err) {
                if (mounted) setError(err as Error);
            } finally {
                if (mounted) setLoading(false);
            }
        };

        load();

        return () => { mounted = false; };
    }, [activeProfile.id, month, version]);

    return {
        snapshot,
        isLoading: loading,
        error
    };
}
