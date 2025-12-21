import { evoStore } from '../../../core/evoappDataStore';
import type { JourneyState, JourneyStep } from '../../../core/evoappDataModel';

const JOURNEY_ID = 'monthly-close';

export const journeyStore = {
    async getOrCreate(month: string): Promise<JourneyState> {
        const key = `${JOURNEY_ID}:${month}`;
        let current = await evoStore.journeys.getById(key);

        if (!current) {
            current = this.createInitialState(month);
            await this.commit(current);
        }
        return current;
    },

    async commit(state: JourneyState): Promise<void> {
        await evoStore.journeys.add(state);
    },

    createInitialState(month: string): JourneyState {
        const id = `${JOURNEY_ID}:${month}`;
        return {
            id,
            journeyId: JOURNEY_ID,
            month,
            updatedAt: new Date().toISOString(),
            steps: [
                { id: 'select-month', title: 'Seleccionar Mes', status: 'done' },
                { id: 'import-bank', title: 'Importar Banco', status: 'pending', cta: '/tools/bank' },
                { id: 'import-cfdi', title: 'Importar CFDI', status: 'pending', cta: '/tools/cfdi-validator' },
                { id: 'classify', title: 'Clasificar Movimientos', status: 'pending', cta: '/tools/classify', blockedBy: ['import-bank', 'import-cfdi'] },
                { id: 'reconcile', title: 'Conciliar', status: 'pending', blockedBy: ['classify'] },
                { id: 'fiscal-preview', title: 'Ver Estimación Fiscal', status: 'pending', blockedBy: ['reconcile'] },
                { id: 'backup', title: 'Exportar Respaldo', status: 'pending', blockedBy: ['fiscal-preview'] }
            ]
        };
    }
};
