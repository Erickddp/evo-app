import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Wrench, Settings, ChevronLeft, ChevronRight } from 'lucide-react';

interface SidebarProps {
    isCollapsed: boolean;
    isMobile: boolean;
    isOpen: boolean;
    toggleSidebar: () => void;
    closeMobileSidebar: () => void;
}

export function Sidebar({ isCollapsed, isMobile, isOpen, toggleSidebar, closeMobileSidebar }: SidebarProps) {
    const navItems = [
        { to: '/', label: 'Dashboard', icon: LayoutDashboard },
        { to: '/tools', label: 'Tools Hub', icon: Wrench },
        { to: '/settings', label: 'Settings', icon: Settings },
    ];

    // Determine width classes based on state
    const widthClass = isMobile
        ? 'w-64' // Mobile always full width when open
        : isCollapsed
            ? 'w-20'
            : 'w-60';

    // Mobile overlay visibility
    const translateClass = isMobile && !isOpen ? '-translate-x-full' : 'translate-x-0';

    return (
        <>
            {/* Mobile Overlay Backdrop */}
            {isMobile && isOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-20 transition-opacity duration-200"
                    onClick={closeMobileSidebar}
                />
            )}

            <aside
                className={`
                    fixed md:static inset-y-0 left-0 z-30
                    ${widthClass}
                    bg-gray-100 dark:bg-gray-900 
                    border-r border-gray-200 dark:border-gray-800 
                    flex flex-col h-full 
                    transition-all duration-300 ease-in-out
                    ${translateClass}
                `}
            >
                {/* Header */}
                <div className={`
                    h-16 flex items-center 
                    justify-between
                    ${isCollapsed && !isMobile ? 'px-3' : 'px-4'}
                    border-b border-gray-200 dark:border-gray-800
                `}>
                    {!isCollapsed || isMobile ? (
                        <h1 className="text-2xl font-extrabold flex items-center gap-2 whitespace-nowrap overflow-hidden">
                            <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400">
                                EVOAPP
                            </span>
                        </h1>
                    ) : (
                        <span className="text-2xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400">
                            E
                        </span>
                    )}

                    {/* Desktop Toggle Button */}
                    {!isMobile && (
                        <button
                            onClick={toggleSidebar}
                            className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-500 transition-colors"
                            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                        >
                            {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
                        </button>
                    )}
                </div>

                {/* Navigation */}
                <nav className="flex-1 p-3 space-y-2 overflow-y-auto overflow-x-hidden">
                    {navItems.map((item) => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            onClick={isMobile ? closeMobileSidebar : undefined}
                            title={isCollapsed && !isMobile ? item.label : undefined}
                            className={({ isActive }) =>
                                `flex items-center gap-3 px-3 py-3 rounded-lg transition-all duration-200 
                                ${isActive
                                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                                    : 'text-gray-600 hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-gray-800'
                                }
                                ${isCollapsed && !isMobile ? 'justify-center' : ''}
                                `
                            }
                        >
                            <item.icon size={22} className="shrink-0" />
                            {(!isCollapsed || isMobile) && (
                                <span className="font-medium whitespace-nowrap overflow-hidden transition-opacity duration-200">
                                    {item.label}
                                </span>
                            )}
                        </NavLink>
                    ))}
                </nav>

                {/* Footer / Version */}
                <div className="p-4 border-t border-gray-200 dark:border-gray-800 text-xs text-center text-gray-500 dark:text-gray-500 whitespace-nowrap overflow-hidden">
                    {(!isCollapsed || isMobile) ? 'v0.1.0 Alpha' : 'v0.1'}
                </div>
            </aside>
        </>
    );
}
