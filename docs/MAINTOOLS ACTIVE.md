# EVOAPP Strict Architecture & Enforcement Specification

**Version:** 1.0.0 (Canonical)  
**Status:** ENFORCED  
**Scope:** Global

---

## 1. Propósito

Este documento define la **Ley Suprema de Arquitectura** para EVOAPP. Su objetivo es garantizar que el sistema evolucione sin deuda técnica, manteniendo la integridad de los datos financieros y la consistencia de la experiencia de usuario (Month Context).

Cualquier cambio de código que viole este contrato será rechazado automáticamente en auditoría y PR. **No existen excepciones.**

---

## 2. Mapa de Capas (Layered Architecture)

El sistema sigue una arquitectura unidireccional estricta.

```mermaid
flowchart TD
    UI[UI Layer (Components/Widgets)] -->|Reads| STORE[Core Store (Read-Only Snapshots)]
    UI -->|Actions| MODULES[Modules (Tools)]
    
    MODULES -->|Writes Normalized Data| GATEKEEPER[Gatekeeper (Normalization Layer)]
    GATEKEEPER -->|Persists| DB[(IndexedDB / Canonical Store)]
    
    JOURNEY[Journey Engine] -->|Derives State| DB
    JOURNEY -.->|ReadOnly| UI
```

1.  **Core (`src/core/*`)**: Contiene los contratos de datos, el Gatekeeper, y utilidades universales. **Inmutable** salvo por refactor mayor.
2.  **Modules (`src/modules/*`)**: Implementan lógica de negocio (Income, Tax, Bank). **Deben normalizar sus datos ANTES** de tocar el Core.
3.  **Routes (`src/routes/*`)**: Orquestadores de UI. **Solo pueden navegar preservando el contexto**.

---

## 3. Contratos Núcleo

### 3.1 Data Contract: `RegistroFinanciero`

Todo movimiento financiero en el sistema **DEBE** adherirse estrictamente a esta interfaz.

**Archivo:** `src/core/evoappDataModel.ts`

```typescript
interface RegistroFinanciero {
  id: string;               // UUID o hash estable
  date: string;             // ISO 8601 (YYYY-MM-DD)
  amount: number;           // SIEMPRE POSITIVO (> 0)
  type: 'ingreso' | 'gasto'; // ÚNICO VOCABULARIO PERMITIDO
  concept: string;          // OBLIGATORIO (Root Level)
  source: 'manual' | 'bank' | 'cfdi' | 'tax';
  
  // Metadata es SOLO respaldo, NO fuente de verdad para lógica core
  metadata?: {
    [key: string]: unknown;
  };
}
```

> **Prohibido:** Usar `income`, `expense`, valores negativos en `amount` para indicar gasto, o fechas no normalizadas.

### 3.2 Navigation Contract: Month Context

La aplicación es **"Month-Aware"**. El usuario siempre opera en el contexto de un mes fiscal.

**Regla de Oro:** El parámetro `?month=YYYY-MM` es sagrado.

*   **Lectura:** `const [searchParams] = useSearchParams(); const month = searchParams.get('month');`
*   **Propagación:** Todos los links internos deben arrastrar este parámetro.
*   **Helper Obligatorio:** `getJourneyLink(toolId, month)` (`src/modules/core/journey/journeyLinks.ts`)

### 3.3 Journey Contract: Option A (Lectura Pura)

El Journey Engine (`src/modules/core/journey/JourneyEngine.ts`) es un observador puro.
*   **Input:** Snapshot completo de datos (`RegistroFinanciero[]`, `Factura[]`).
*   **Output:** Estado derivado (`JourneyState`).
*   **Write:** NUNCA escribe cambios de estado colaterales. Solo el usuario avanza al completar acciones en los módulos.

---

## 4. Puntos de Enforcement (Single Source of Truth)

Solo hay **3 puntos autorizados** donde los datos sucios pueden convertirse en datos limpios.

1.  **Gatekeeper Core (`src/core/evoappDataStore.ts` -> `normalizeRegistroGatekeeper`)**:
    *   La barrera final. Sanitiza cualquier intento de escritura a `evoStore.registrosFinancieros`.
    *   Rechaza o corrige tipos inválidos (`income` -> `ingreso`).
    *   Asegura `concept` en raíz.

2.  **Ingresos Manager Local (`src/modules/ingresos-manager/utils.ts` -> `normalizeIngresosToRegistro`)**:
    *   Validación temprana (frontend) para inputs manuales y CSVs.
    *   Rechaza filas inválidas antes de intentar guardar.

3.  **Bank Ingest (`src/modules/bank-reconciler/ingest.ts`)**:
    *   Normaliza PDFs bancarios a la estructura canónica.
    *   Asigna IDs deterministas para evitar duplicados.

---

## 5. Reglas para Modificar un Módulo

Antes de fusionar código, verifica:

1.  **¿Nuevas Rutas?**
    *   **NO:** Reutiliza `src/routes/ToolsHub.tsx`.
    *   **SI:** Deben aceptar `?month` y propagarlo.

2.  **¿Nuevos Datos?**
    *   Si escribes a `evoStore`, ¿tus datos pasan el Gatekeeper sin warnings?
    *   ¿Usas `ingreso`/`gasto` explícitamente?

3.  **¿Dependencias?**
    *   Prohibido importar desde otros módulos hermanos (`src/modules/A` no debe importar de `src/modules/B` salvo tipos compartidos en `shared`).
    *   Usa siempre `src/core` como puente.

---

## 6. Mapa de Flujos End-to-End

### Flujo de Navegación Segura
```text
[Dashboard (month=X)] 
   --> Click Widget 
     --> [JourneyLink Helper] 
       --> [ToolsHub /tools/tool-id?month=X] 
         --> [Module UI (Lee month de URL)]
           --> [Back Button] 
             --> [Dashboard?month=X]
```

### Flujo de Escritura Segura
```text
[User Input / CSV] 
   --> [Local Normalizer (Module Utils)]
     --> [Objeto RegistroFinanciero Preliminar]
       --> [evoStore.registrosFinancieros.add()]
         --> [CORE GATEKEEPER (Sanitización Final)]
           --> [IndexedDB]
             --> [Evento 'data:changed']
               --> [UI Refresh]
```

---

## 7. Antipatrones Prohibidos

| Antipatrón | Ejemplo (Incorrecto) | Corrección (Correcto) |
| :--- | :--- | :--- |
| **Bilingüismo** | `type: 'expense'` | `type: 'gasto'` |
| **Fecha Cruda** | `new Date()` | `new Date().toISOString().split('T')[0]` |
| **Concepto Oculto** | `metadata: { concept: 'Venta' }` | `concept: 'Venta'` |
| **Navegación Ciega** | `navigate('/tools/facturas')` | `navigate(getJourneyLink('facturas', currentMonth))` |
| **Signo Ambiguo** | `amount: -500` (Gasto) | `amount: 500, type: 'gasto'` |

---

## 8. Reglas de Nomenclatura y Vocabulario

*   **Tipos de Datos:** PascalCase (`RegistroFinanciero`, `JourneyStep`).
*   **Variables de Store:** camelCase (`registrosFinancieros`, `pagosImpuestos`).
*   **Valores de Enum:** lowercase estricto (`ingreso`, `gasto`, `manual`, `bank`).

---

## 9. Suite de Tests de Contrato (Pseudocódigo Vitest)

Estos tests deben existir en `src/tests/contracts/` para validar la integridad.

```typescript
// test/contracts/Gatekeeper.test.ts

describe('Gatekeeper Enforcement', () => {
  it('should normalize "income" to "ingreso"', () => {
    const input = { type: 'income', amount: 100, concept: 'Test' };
    const output = normalizeRegistroGatekeeper(input);
    expect(output.type).toBe('ingreso');
  });

  it('should ensure positive amount', () => {
     const input = { type: 'gasto', amount: -500, concept: 'Test' };
     const output = normalizeRegistroGatekeeper(input);
     expect(output.amount).toBe(500);
  });

  it('should promote metadata.concept to root', () => {
    const input = { type: 'gasto', amount: 100, metadata: { concept: 'Hidden' } };
    const output = normalizeRegistroGatekeeper(input);
    expect(output.concept).toBe('Hidden');
  });
});
```

---

## 10. Guardrails Automatizables

Configurar en CI/Pre-commit:

1.  **Grep Check (Blocker):**
    *   `grep -r "type: 'income'" src/` -> Debe estar vacío.
    *   `grep -r "type: 'expense'" src/` -> Debe estar vacío.
    *   `grep -r "navigate('/" src/` -> Warning (Revisar si falta query string).

2.  **Type Check:**
    *   `tsc --noEmit` debe pasar limpio (asegura que las interfaces se respetan).

---

## 11. Checklist de Verificación Manual (Pull Request)

1.  [ ] **Build:** `npm run build` termina en 0 errores.
2.  [ ] **Contexto:** Abrir una herramienta desde Dashboard (ej. Feb 2024), recargar página. ¿Sigue en Feb 2024?
3.  [ ] **Regreso:** Botón "Atrás" o "Dashboard" mantiene el mes.
4.  [ ] **Datos:** Crear un registro manual. Verificar en consola/IndexedDB que `type` es `ingreso`/`gasto`.
5.  [ ] **CSV:** Importar archivo con fechas mixtas. ¿Se normalizan a YYYY-MM-DD?
6.  [ ] **Logs:** No hay warnings de "Filtered invalid registros" en consola.

---

## 12. Apéndice: Inventario de Archivos Clave

*   **Store:** `src/core/evoappDataStore.ts` (Gatekeeper)
*   **Modelos:** `src/core/evoappDataModel.ts` (Interfaces)
*   **Normalización:** `src/modules/core/normalize/normalizeToRegistroFinanciero.ts`
*   **Navegación:** `src/modules/core/journey/journeyLinks.ts`
*   **Utils (Mes):** `src/modules/core/utils/month.ts`

---

## 13. Glosario Canónico

*   **RegistroFinanciero:** La unidad atómica de dinero en el tiempo.
*   **Gatekeeper:** Función que intercepta escrituras al store para validar reglas de negocio.
*   **Journey:** El flujo de pasos mensuales que guía al usuario (Cierre de Mes).
*   **Snapshot:** Estado completo del sistema en un momento dado (leído por el Journey).
*   **Shielding:** Práctica de proteger componentes contra datos mal formados.

---

### Plan de adopción incremental

**Fase 1: Stop the Bleeding (YA COMPLETADO)**
*   Implementar Gatekeeper.
*   Eliminar referencias a `income`/`expense` en mappers críticos.
*   Blindar navegación (`ToolsHub`).

**Fase 2: Limpieza Profunda (Recomendada Siguiente)**
*   Ejecutar script de migración en la base de datos del usuario para convertir registros históricos `income`/`expense` a `ingreso`/`gasto`.
*   Aplicar tipos estrictos en todos los componentes de UI (`modules/*`) para que TypeScript falle si alguien intenta usar strings en inglés.

**Fase 3: Bloqueo (CI/CD)**
*   Agregar reglas de linter personalizadas que prohíban strings mágicos relacionados con finanzas fuera de los mappers autorizados.
