# EVOAPP Data Flows & Analysis

Este documento describe la arquitectura de datos actual de EVOAPP, los flujos de información entre módulos y el plan para la unificación de datos (Phase 1 & 2).

## 1. Inventario de Módulos y Entidades

| Módulo | Ruta Principal | Entidades Generadas (Canonical) | Entidades Consumidas |
|--------|----------------|---------------------------------|----------------------|
| **Gestor de Ingresos** | `src/modules/ingresos-manager` | `RegistroFinanciero` (Ingreso/Gasto) | - |
| **Facturación** | `src/modules/facturas` | `Factura`, `Cliente` | - |
| **Conciliación Bancaria** | `src/modules/bank-reconciler` | `MovimientoBancario`, `RegistroFinanciero` (al guardar) | `RegistroFinanciero` (para comparar) |
| **Control Fiscal (Tax Tracker)** | `src/modules/tax-tracker` | `PagoImpuesto` | `RegistroFinanciero` (para proyecciones) |
| **Cálculo de Impuestos** | `src/modules/tax-calculation` | `CalculoImpuesto` | `RegistroFinanciero`, `PagoImpuesto` |
| **Estado Financiero** | `src/modules/financial-summary` | - (Solo visualización) | `RegistroFinanciero`, `PagoImpuesto` |
| **Validador CFDI** | `src/modules/cfdi-validator` | - (Validación efímera) | `Factura` (potencialmente) |

## 2. Implementación de Almacenamiento Unificado (Phase 2)

Se ha implementado un sistema de almacenamiento unificado (`evoStore`) que actúa como capa de abstracción sobre `IndexedDB`, garantizando consistencia y tipado fuerte.

### Arquitectura
- **Core Store:** `src/core/evoappDataStore.ts`
- **Modelos:** `src/core/evoappDataModel.ts` (Interfaces Canónicas en Español)
- **Mappers:** `src/core/mappers/` (Conversión bidireccional entre Legacy y Canonical)

### Flujo de Datos
1. **Lectura:** Los módulos solicitan datos a `evoStore` (ej. `evoStore.registrosFinancieros.getAll()`).
2. **Fallback/Migración:** Si `evoStore` está vacío, se consultan las claves legacy (`evo-transactions`, etc.) y se migran los datos al vuelo usando Mappers.
3. **Escritura:** Los nuevos datos se guardan directamente en `evoStore` usando las nuevas claves (`evo-registros-financieros`, `evo-pagos-impuestos`, etc.).

### Claves de Almacenamiento
| Entidad Canónica | Clave en IndexedDB |
|------------------|--------------------|
| `RegistroFinanciero` | `evo-registros-financieros` |
| `Factura` | `evo-facturas` |
| `Cliente` | `evo-clientes` |
| `MovimientoBancario` | `evo-movimientos-bancarios` |
| `PagoImpuesto` | `evo-pagos-impuestos` |
| `CalculoImpuesto` | `evo-calculos-impuestos` |

## 3. Backup Global (CSV Export)

Actualmente, la exportación global se maneja en `src/routes/Settings.tsx` a través de `dataStore.exportAllAsCsv()`.

### Mecanismo Actual
- **Fuente:** `IndexedDB` (wrapper sobre `localStorage` migrado).
- **Formato:** CSV crudo donde cada fila es un registro de la DB.
- **Columnas:** `id`, `toolId`, `createdAt`, `updatedAt`, `payload_json`.
- **Compatibilidad:** Al usar `dataStore` como base para `evoStore`, los nuevos registros se incluyen automáticamente en el backup global bajo sus respectivos `toolId` (las claves mencionadas arriba).

### Limitaciones Detectadas
- No es un CSV "plano" de negocio (ej. no tiene columnas "Fecha", "Monto" directamente), sino un dump de la base de datos.
- Para análisis externo (Excel), el usuario debe parsear el JSON de la columna `payload_json`.
- **Objetivo Fase 3:** Crear exportadores específicos que generen CSVs planos y legibles para cada tipo de entidad canónica (`RegistroFinanciero`, `Factura`, etc.), además del backup técnico.

## 4. Pendientes de Idioma (Inglés -> Español)

Se ha detectado texto en inglés en la interfaz de usuario que debe ser traducido en fases posteriores.

### Módulo: Bank Reconciler (`src/modules/bank-reconciler`)
| Contexto | Texto Actual (EN) | Sugerencia (ES) |
|----------|-------------------|-----------------|
| Título | "Bank Reconciler" | "Conciliación Bancaria" |
| Subtítulo | "Import bank movements from CSV..." | "Importa movimientos bancarios desde CSV..." |
| Botones | "Upload CSV", "Upload PDF" | "Subir CSV", "Subir PDF" |
| Pasos | "Map Columns", "Review" | "Mapear Columnas", "Revisar" |
| Acciones | "Save to Movements Manager" | "Guardar en Gestor de Movimientos" |
| Mensajes | "Saved successfully!" | "¡Guardado exitosamente!" |

### Módulo: Settings (`src/routes/Settings.tsx`)
| Contexto | Texto Actual (EN) | Sugerencia (ES) |
|----------|-------------------|-----------------|
| Título | "Settings" | "Ajustes" |
| Sección | "Data Management" | "Gestión de Datos" |
| Botones | "Download CSV backup" | "Descargar copia de seguridad CSV" |
| Danger | "Clear Local Data" | "Borrar Datos Locales" |

### Módulo: Ingresos Manager (`src/modules/ingresos-manager`)
| Contexto | Texto Actual (EN) | Sugerencia (ES) |
|----------|-------------------|-----------------|
| Formulario | "Date", "Concept", "Amount" | "Fecha", "Concepto", "Monto" |
| Botón | "Add" | "Agregar" |
| Tabla | "Actions" | "Acciones" |

## 5. Prioridades para Futuras Fases

1. **Refactorización de Tipos:** Completada en Fase 2.
2. **Unificación de Almacenamiento:** Completada en Fase 2.
3. **Localización Completa:** Reemplazar sistemáticamente los textos en inglés identificados.
4. **Mejora de Exportación:** Implementar una función "Exportar Datos de Negocio" que genere un ZIP con CSVs individuales por entidad (Ingresos.csv, Facturas.csv, etc.) con columnas planas.
