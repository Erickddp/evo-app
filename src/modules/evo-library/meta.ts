import { Library } from 'lucide-react';
import type { ToolDefinition } from '../shared/types';
import { EvoLibrary } from './index';

export const evoLibraryDefinition: ToolDefinition = {
    meta: {
        id: 'evo-library',
        name: 'EVO Library',
        description: 'Biblioteca de documentos y recursos fiscales/contables.',
        icon: Library,
        version: '0.1.0'
    },
    component: EvoLibrary
};
