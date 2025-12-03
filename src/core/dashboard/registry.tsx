import type { DashboardWidget } from './types';

const widgets = new Map<string, DashboardWidget>();

export function registerWidget(widget: DashboardWidget) {
    widgets.set(widget.id, widget);
}

export function getWidget(id: string): DashboardWidget | undefined {
    return widgets.get(id);
}

export function getAllWidgets(): DashboardWidget[] {
    return Array.from(widgets.values());
}
