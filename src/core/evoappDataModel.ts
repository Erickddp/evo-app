/**
 * EVOAPP DATA CONTRACT
 * 
 * Este archivo define las interfaces canónicas (en español) que deben usar todos los módulos
 * para garantizar interoperabilidad, un formato de datos común y backups globales consistentes.
 * 
 * OBJETIVO:
 * - Unificar la nomenclatura (Español).
 * - Definir contratos claros para intercambio de datos entre módulos.
 * - Facilitar la exportación/importación global.
 */

// ==========================================
// 1. REGISTROS FINANCIEROS (INGRESOS / GASTOS)
// ==========================================

/**
 * Representa un movimiento de dinero (Ingreso o Gasto).
 * Módulos: Ingresos Manager, Estado Financiero.
 * Mapeo actual: `EvoTransaction` (src/core/domain/evo-transaction.ts)
 */
export interface RegistroFinanciero {
    id: string;
    fecha: string;          // ISO 8601 (YYYY-MM-DD)
    concepto: string;       // Descripción corta
    monto: number;          // Valor absoluto (siempre positivo)
    tipo: 'ingreso' | 'gasto';
    categoria?: string;     // Opcional: Clasificación (ej. "Servicios", "Nómina")
    origen: string;         // 'manual', 'factura', 'banco', 'importacion'

    // Metadatos opcionales para trazabilidad
    referenciaId?: string;  // ID de factura o movimiento bancario relacionado
    etiquetas?: string[];
    metadata?: Record<string, any>; // Extension flexible
    creadoEn?: string;      // ISO timestamp
    actualizadoEn?: string; // ISO timestamp
}

// ==========================================
// 2. FACTURACIÓN Y CLIENTES
// ==========================================

/**
 * Representa un Cliente para facturación.
 * Módulos: Facturación.
 * Mapeo actual: `Client` (src/modules/facturas/types.ts)
 */
export interface Cliente {
    id: string;
    rfc: string;
    razonSocial: string;    // Nombre o Razón Social
    email?: string;
    telefono?: string;
    direccion?: string;
    codigoPostal?: string;
    regimenFiscal?: string; // Clave del SAT (ej. "601")
    fechaRegistro: string;  // ISO timestamp
}

/**
 * Representa una Factura emitida o recibida.
 * Módulos: Facturación, Validador (lectura).
 * Mapeo actual: `Invoice` (src/modules/facturas/types.ts)
 */
export interface Factura {
    id: string;
    folio: string;
    fechaEmision: string;   // ISO 8601 (YYYY-MM-DD)
    clienteId?: string;     // Referencia a Cliente (si existe en BD)
    clienteNombre: string;  // Snapshot del nombre en el momento de la factura
    rfcCliente: string;
    concepto: string;
    subtotal?: number;
    impuestosTrasladados?: number; // IVA, etc.
    impuestosRetenidos?: number;   // ISR Ret, IVA Ret
    total: number;
    moneda: string;         // 'MXN', 'USD', etc.
    tipoComprobante: 'I' | 'E' | 'P'; // Ingreso, Egreso, Pago

    estado: 'pagada' | 'pendiente' | 'cancelada';
    uuidSAT?: string;       // Folio Fiscal (si está timbrada)

    // Datos de control interno
    pagada: boolean;
    fechaPago?: string;

    // Optional fields for CSV V2 / Facturación specifics
    formaPago?: string;
    metodoPago?: string;
    usoCfdi?: string;
    notas?: string;
}

// ==========================================
// 3. CONCILIACIÓN BANCARIA
// ==========================================

/**
 * Representa un movimiento bruto extraído de un estado de cuenta bancario.
 * Módulos: Conciliación Bancaria.
 * Mapeo actual: Estructuras internas en `bank-reconciler`.
 */
export interface MovimientoBancario {
    id: string;
    fecha: string;          // ISO 8601
    descripcion: string;    // Texto tal cual aparece en el banco
    cargo?: number;         // Retiro / Salida
    abono?: number;         // Depósito / Entrada
    saldo?: number;         // Saldo después del movimiento (si está disponible)
    referencia?: string;

    // Estado de conciliación
    conciliado: boolean;
    registroFinancieroId?: string; // ID del RegistroFinanciero generado/enlazado
}

// ==========================================
// 4. IMPUESTOS (TAX TRACKER)
// ==========================================

/**
 * Representa un pago de impuestos realizado al SAT.
 * Módulos: Tax Tracker (Control Fiscal).
 * Mapeo actual: `TaxPayment` (src/modules/tax-tracker/types.ts)
 */
export interface PagoImpuesto {
    id: string;
    fechaPago: string;      // Fecha en que se pagó
    periodoMes: number;     // 1-12
    periodoAnio: number;    // YYYY
    concepto: string;       // "ISR Personas Físicas", "IVA", etc.
    monto: number;
    lineaCaptura?: string;
    estado: 'pagado' | 'pendiente';
    comprobanteUrl?: string; // Ruta o link al PDF del comprobante
}

/**
 * Representa el cálculo de impuestos de un periodo.
 * Módulos: Cálculo de Impuestos.
 */
export interface CalculoImpuesto {
    id: string;
    periodoMes: number;
    periodoAnio: number;
    totalIngresos: number;
    totalGastosDeducibles: number;
    baseGravable: number;
    ivaCobrado: number;
    ivaPagado: number;
    isrACargo: number;
    ivaACargo: number;
    totalAPagar: number;
    fechaCalculo: string;
}

// ==========================================
// MAPPING GUIDE (GUÍA DE MAPEO)
// ==========================================
/*
 * | Módulo Actual         | Tipo Interno (Legacy) | Interfaz Canónica (Nuevo) |
 * |-----------------------|-----------------------|---------------------------|
 * | Ingresos Manager      | EvoTransaction        | RegistroFinanciero        |
 * | Facturas              | Invoice               | Factura                   |
 * | Facturas              | Client                | Cliente                   |
 * | Tax Tracker           | TaxPayment            | PagoImpuesto              |
 * | Bank Reconciler       | (Internal State)      | MovimientoBancario        |
 * | Tax Calculation       | (Internal State)      | CalculoImpuesto           |
 */
