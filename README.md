# EVORIX Core

**EVORIX Core** is a modular personal environment designed to host independent fiscal and financial tools. It provides a secure, unified interface with a shared layout, theme management, and error isolation.

## Concept

The architecture is built around a **Core** shell and pluggable **Modules** (Tools).
- **Core**: Handles routing, navigation, theming (dark/light), and global error boundaries.
- **Modules**: Independent tools that plug into the `toolsRegistry`. Each tool is isolated, so if one crashes, the rest of the app remains functional.

## Project Structure

```
src/
├── core/           # Layout, Theme, Error handling
├── modules/        # Independent tools
│   ├── cfdi-validator/
│   ├── ingresos-manager/
│   ├── shared/     # Shared types
│   └── registry.ts # Tool registration
├── routes/         # Main pages (Dashboard, ToolsHub, Settings)
└── App.tsx         # Main entry point
```

## How to Run

1.  Install dependencies:
    ```bash
    npm install
    ```
2.  Start the development server:
    ```bash
    npm run dev
    ```
3.  Open [http://localhost:5173](http://localhost:5173).

## How to Add a New Module

1.  **Create the Module Folder**:
    Create a new folder in `src/modules/` (e.g., `my-new-tool`).

2.  **Implement the Tool Component**:
    Create your main component (e.g., `MyTool.tsx`).

3.  **Define Tool Metadata**:
    Export a `ToolDefinition` object containing the tool's ID, name, description, icon, and component.

    ```typescript
    export const myToolDefinition: ToolDefinition = {
      meta: {
        id: 'my-new-tool',
        name: 'My New Tool',
        description: 'Does amazing things.',
        icon: MyIcon,
        version: '1.0.0',
      },
      component: MyTool,
    };
    ```

4.  **Register the Tool**:
    Import your definition in `src/modules/registry.ts` and add it to the `toolsRegistry` array.

    ```typescript
    import { myToolDefinition } from './my-new-tool';

    export const toolsRegistry: ToolDefinition[] = [
      // ... other tools
      myToolDefinition,
    ];
    ```
