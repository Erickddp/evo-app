import { Library } from 'lucide-react';
import type { ToolDefinition } from '../shared/types';
import { EvoLibrary } from './index';

export const evoLibraryDefinition: ToolDefinition = {
    meta: {
        id: 'evo-library',
        name: 'Biblioteca Contable',
        description: 'Consulta de documentos fiscales y guías.',
        icon: Library,
        version: '2.0.0-thin'
    },
    component: EvoLibrary
};
