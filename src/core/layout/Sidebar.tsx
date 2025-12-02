import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Wrench, Settings } from 'lucide-react';

export function Sidebar() {
    const navItems = [
        { to: '/', label: 'Dashboard', icon: LayoutDashboard },
        { to: '/tools', label: 'Tools Hub', icon: Wrench },
        { to: '/settings', label: 'Settings', icon: Settings },
    ];

    return (
        <aside className="w-64 bg-gray-100 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col h-full transition-colors duration-200">
            <div className="p-4 border-b border-gray-200 dark:border-gray-800">
                <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                    <span className="text-blue-600 dark:text-blue-400">EVORIX</span> Core
                </h1>
            </div>

            <nav className="flex-1 p-4 space-y-2">
                {navItems.map((item) => (
                    <NavLink
                        key={item.to}
                        to={item.to}
                        className={({ isActive }) =>
                            `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors duration-200 ${isActive
                                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                                : 'text-gray-600 hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-gray-800'
                            }`
                        }
                    >
                        <item.icon size={20} />
                        <span className="font-medium">{item.label}</span>
                    </NavLink>
                ))}
            </nav>

            <div className="p-4 border-t border-gray-200 dark:border-gray-800 text-xs text-center text-gray-500 dark:text-gray-500">
                v0.1.0 Alpha
            </div>
        </aside>
    );
}
