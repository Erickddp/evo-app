import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../theme/ThemeProvider';

export function TopBar() {
    const { resolvedTheme, toggleTheme } = useTheme();

    return (
        <header className="h-16 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-6 transition-colors duration-200">
            <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-200">
                Welcome Back
            </h2>

            <button
                onClick={toggleTheme}
                className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 transition-colors"
                aria-label="Toggle theme"
            >
                {resolvedTheme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </button>
        </header>
    );
}
