
export type AppEvent = 'finance:updated' | 'invoice:updated' | 'data:changed';

export const evoEvents = {
    emit: (event: AppEvent) => window.dispatchEvent(new CustomEvent(event)),
    on: (event: AppEvent, cb: () => void) => window.addEventListener(event, cb as EventListener),
    off: (event: AppEvent, cb: () => void) => window.removeEventListener(event, cb as EventListener),
} as const;
