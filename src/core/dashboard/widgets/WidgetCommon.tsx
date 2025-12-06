import type { ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';

export function WidgetSkeleton() {
    return (
        <div className="h-full rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800 animate-pulse">
            <div className="flex gap-4">
                <div className="h-10 w-10 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
                <div className="h-6 w-32 bg-gray-200 dark:bg-gray-700 rounded mt-2"></div>
            </div>
            <div className="mt-8 space-y-3">
                <div className="h-8 w-2/3 bg-gray-200 dark:bg-gray-700 rounded"></div>
                <div className="h-4 w-1/2 bg-gray-200 dark:bg-gray-700 rounded"></div>
            </div>
        </div>
    );
}

export function WidgetError({ message }: { message: string }) {
    return (
        <div className="h-full rounded-xl border border-red-200 bg-red-50 p-6 shadow-sm dark:border-red-900/30 dark:bg-red-900/10 flex flex-col items-center justify-center text-center">
            <AlertCircle className="h-8 w-8 text-red-500 mb-2" />
            <p className="text-sm font-medium text-red-800 dark:text-red-300">{message}</p>
        </div>
    );
}

interface WidgetCardProps {
    children: ReactNode;
    className?: string;
}

export function WidgetCard({ children, className = '' }: WidgetCardProps) {
    return (
        <div className={`group relative h-full flex flex-col justify-between rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition-all hover:shadow-md dark:border-gray-700 dark:bg-gray-800 ${className}`}>
            {children}
        </div>
    );
}
