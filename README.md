# EVORIX Core

EVORIX Core es una plataforma web modular diseñada para la gestión personal de herramientas fiscales y financieras. Funciona como un “sistema operativo” web: un núcleo (shell) que unifica múltiples aplicaciones independientes, manteniendo consistencia visual, navegación fluida y manejo de errores centralizado.

---

## 🧩 Arquitectura General

### **1. Núcleo (Shell)**
Ubicado en: `src/core/`

Responsable de:
- Layout general
- Enrutamiento global entre módulos
- Manejo de tema (oscuro/claro)
- Límites de error globales
- Comportamientos compartidos

El núcleo no depende de ningún módulo.

---

### **2. Módulos (Plugins)**
Ubicación: `src/modules/`

Cada módulo es una herramienta independiente, aislada y plug-and-play.

Módulos actuales:
- **CFDI Validator** – Validador de facturas XML.
- **Ingresos Manager** – Registro y control de ingresos.
- **Bank Reconciler** – Conciliación bancaria; procesa estados de cuenta PDF.
- **Tax Tracker** – Seguimiento fiscal.
- **Financial Summary** – Resumen financiero general.
- **Facturas** – Organización y control de facturación.

Reglas:
- Ningún módulo puede importar directamente código de otro.
- La lógica compartida debe ir en `src/core` o `src/shared`.

---

### **3. Backend**
Ubicación: `server/index.js`

Backend Express ligero que funciona como:
- Procesador de PDFs (pdf-parse).
- Proxy seguro hacia OpenAI API (GPT-4o).
- API para parsing de estados de cuenta BBVA:
  - `POST /api/parse-bank-statement`

---

## 🛠️ Tecnologías

- **Frontend:** React 19, Vite, TypeScript
- **Estilos:** Tailwind CSS v4
- **Backend:** Node.js + Express
- **IA:** OpenAI GPT-4o
- **PDFs:** pdf-parse
- **Entorno:** Variables en `.env`

---

## 📈 Plan de Mejora

### **A. Robustez y Seguridad**
- Validación de datos con **zod**.
- Sistema global de notificaciones (toasts).
- Manejo estricto de variables de entorno.

### **B. Experiencia de Usuario**
- Dashboard personalizable.
- Persistencia:
  - SQLite / PostgreSQL  
  - o localStorage / IndexedDB
- Micro-interacciones mejoradas.

### **C. Backend**
- Optimizar costo de IA.
- Mejorar procesamiento local de PDFs.
- Tipado compartido entre frontend y backend (tRPC o tipos comunes).

### **D. Calidad del Código**
- Tests unitarios para parsers.
- Tests de integración para flujos de carga.
- README por cada módulo.

---

## 🧠 Notas para desarrolladores y agentes IA

- Mantén siempre el aislamiento entre módulos.
- Para cambios en APIs, actualiza:
  - Backend
  - Tipos TypeScript
  - Componentes consumidores
- En el módulo Bank Reconciler, el resultado normalizado **debe** devolver:
  - `operationDate`
  - `postingDate`
  - `description`
  - `amount`
  - `balance`
  - `type` (ingreso/egreso)

---

## 📦 Scripts

```bash
npm run dev       # Frontend y shell
npm run server    # Backend Express
npm run build     # Compilar proyecto completo
