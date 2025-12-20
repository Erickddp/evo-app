
export const STORAGE_KEYS = {
    LEGACY: {
        EVO_TRANSACTIONS: 'evo-transactions',
        INGRESOS_MANAGER: 'ingresos-manager',
        FACTURAS_MANAGER: 'facturas-manager',
        CFDI_VALIDATOR: 'cfdi-validator',
    },
    CANONICAL: {
        REGISTROS_FINANCIEROS: 'registros-financieros',
        FACTURAS: 'facturas',
        CLIENTES: 'clientes',
        PAGOS_IMPUESTOS: 'pagos-impuestos',
    },
} as const;
