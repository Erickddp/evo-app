import React from 'react';
import { NavLink } from 'react-router-dom';
import { Calculator, FileSearch, TrendingUp } from 'lucide-react';

const TOOLS = [
    {
        name: 'Validador CFDI',
        desc: 'Verifica estatus y valida estructuras XML.',
        to: '/tools?id=cfdi-validator',
        icon: FileSearch,
        color: 'text-blue-500',
        bg: 'bg-blue-50 dark:bg-blue-900/20'
    },
    {
        name: 'Calculadora Fiscal',
        desc: 'Cálculo rápido de ISR e IVA.',
        to: '/tools?id=tax-calculation',
        icon: Calculator,
        color: 'text-green-500',
        bg: 'bg-green-50 dark:bg-green-900/20'
    },
    {
        name: 'Resumen Financiero',
        desc: 'Visualiza ingresos y egresos del mes.',
        to: '/tools?id=financial-summary',
        icon: TrendingUp,
        color: 'text-purple-500',
        bg: 'bg-purple-50 dark:bg-purple-900/20'
    }
];

export function ReferenceCards() {
    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {TOOLS.map((tool) => (
                <NavLink
                    key={tool.name}
                    to={tool.to}
                    className="block p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:shadow-md transition-all group"
                >
                    <div className="flex items-start justify-between mb-2">
                        <div className={`p-2 rounded-lg ${tool.bg} ${tool.color}`}>
                            <tool.icon size={20} />
                        </div>
                    </div>
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        {tool.name}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        {tool.desc}
                    </p>
                </NavLink>
            ))}
        </div>
    );
}
