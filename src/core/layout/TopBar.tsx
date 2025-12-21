import { Moon, Sun, Menu } from 'lucide-react';
import { useTheme } from '../theme/ThemeProvider';
import { useProfile } from '../../modules/core/profiles/ProfileProvider';

interface TopBarProps {
    toggleSidebar: () => void;
}

export function TopBar({ toggleSidebar }: TopBarProps) {
    const { resolvedTheme, toggleTheme } = useTheme();
    const { activeProfile } = useProfile();

    return (
        <header className="h-16 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-6 transition-colors duration-200">
            <div className="flex items-center gap-4">
                <button
                    onClick={toggleSidebar}
                    className="md:hidden p-2 -ml-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 transition-colors"
                    aria-label="Open menu"
                >
                    <Menu size={24} />
                </button>

                <h2 className="text-lg font-semibold tracking-tight text-gray-800 dark:text-gray-100">
                    {activeProfile?.name || 'EVOAPP'}
                </h2>
            </div>

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
