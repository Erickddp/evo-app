// src/modules/shared/types.ts
import type React from 'react';

export interface ToolMeta {
    id: string;
    name: string;
    description: string;
    icon?: React.ComponentType<{ className?: string; size?: number | string }>;
    version?: string;
}

export interface ToolDefinition {
    meta: ToolMeta;
    component: React.ComponentType;
}
