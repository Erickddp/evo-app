import type { ToolDefinition } from "../modules/shared/types";
import { ChevronLeft, ChevronRight } from "lucide-react";

type ToolsSidebarProps = {
    tools: ToolDefinition[];
    selectedToolId: string | null;
    onSelect: (id: string) => void;
    collapsed: boolean;
    onToggleCollapse: () => void;
};

export function ToolsSidebar({
    tools,
    selectedToolId,
    onSelect,
    collapsed,
    onToggleCollapse,
}: ToolsSidebarProps) {
    return (
        <>
            {/* Mobile Overlay */}
            <div
                className={`
                    fixed inset-0 bg-black/60 backdrop-blur-sm z-30 md:hidden transition-opacity duration-300
                    ${collapsed ? 'opacity-0 pointer-events-none' : 'opacity-100'}
                `}
                onClick={onToggleCollapse}
                aria-hidden="true"
            />

            <aside
                className={`
                    fixed md:static inset-y-0 left-0 z-40
                    bg-white dark:bg-gray-900 
                    border-r border-gray-200 dark:border-gray-800 
                    flex flex-col overflow-hidden 
                    transition-all duration-300 ease-in-out
                    ${collapsed ? '-translate-x-full md:translate-x-0 md:w-20' : 'translate-x-0 w-[85vw] sm:w-80 md:w-[260px] lg:w-72'}
                    h-full shadow-2xl md:shadow-none
                `}
            >
                {/* Header */}
                <div className={`
                    h-[70px] flex items-center justify-between px-4 shrink-0
                    border-b border-gray-200 dark:border-gray-800
                `}>
                    <div className={`flex items-center gap-3 overflow-hidden transition-all duration-300 ${collapsed ? 'w-full justify-center' : ''}`}>
                        {/* Logo */}
                        <div className="relative flex items-center justify-center w-8 h-8 shrink-0">
                            <img
                                src="/evorix-logo-white.png"
                                alt="EVO"
                                className="w-full h-full object-contain"
                                onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                    // Fallback text if image fails
                                    const span = document.createElement('span');
                                    span.className = "text-xl font-bold text-violet-500";
                                    span.innerText = "E";
                                    e.currentTarget.parentElement?.appendChild(span);
                                }}
                            />
                        </div>

                        {/* Title */}
                        <div className={`
                            font-bold text-lg tracking-tight text-gray-900 dark:text-white whitespace-nowrap
                            transition-opacity duration-200
                            ${collapsed ? 'opacity-0 w-0 hidden' : 'opacity-100'}
                        `}>
                            Herramientas Disponibles
                        </div>
                    </div>

                    {/* Desktop Toggle Button (only visible when expanded) */}
                    <button
                        onClick={onToggleCollapse}
                        className={`
                            hidden md:flex
                            p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 
                            text-gray-500 dark:text-gray-400 transition-colors
                            ${collapsed ? 'hidden' : ''}
                        `}
                        title="Collapse sidebar"
                    >
                        <ChevronLeft size={20} />
                    </button>
                </div>

                {/* Tools List */}
                <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
                    {tools.length === 0 ? (
                        !collapsed && (
                            <div className="p-4 text-center text-gray-500 dark:text-gray-400 text-sm">
                                No tools installed.
                            </div>
                        )
                    ) : (
                        tools.map((tool) => {
                            const isSelected = selectedToolId === tool.meta.id;
                            return (
                                <button
                                    key={tool.meta.id}
                                    onClick={() => onSelect(tool.meta.id)}
                                    title={collapsed ? tool.meta.name : undefined}
                                    className={`
                                        group w-full rounded-xl flex items-center transition-all duration-200
                                        ${collapsed ? 'justify-center p-2' : 'p-3 gap-3 text-left'}
                                        ${isSelected
                                            ? 'bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800 shadow-sm'
                                            : 'hover:bg-gray-50 dark:hover:bg-gray-800/50 border border-transparent hover:shadow-sm hover:border-gray-200 dark:hover:border-gray-700'
                                        }
                                    `}
                                >
                                    {/* Icon */}
                                    <div
                                        className={`
                                            p-2 rounded-lg transition-colors shrink-0
                                            ${isSelected
                                                ? 'bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-300'
                                                : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 group-hover:text-violet-500 dark:group-hover:text-violet-400 group-hover:bg-white dark:group-hover:bg-gray-700'
                                            }
                                        `}
                                    >
                                        {(() => {
                                            const Icon = tool.meta.icon;
                                            return Icon ? (
                                                <Icon size={20} />
                                            ) : (
                                                <span className="text-sm font-bold">
                                                    {tool.meta.name.charAt(0).toUpperCase()}
                                                </span>
                                            );
                                        })()}
                                    </div>

                                    {/* Text Content */}
                                    {!collapsed && (
                                        <div className="min-w-0 flex-1">
                                            <h3 className={`
                                                font-medium text-sm leading-tight mb-0.5
                                                ${isSelected ? 'text-violet-900 dark:text-violet-100' : 'text-gray-900 dark:text-gray-100'}
                                            `}>
                                                {tool.meta.name}
                                            </h3>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed">
                                                {tool.meta.description}
                                            </p>
                                        </div>
                                    )}
                                </button>
                            );
                        })
                    )}
                </div>

                {/* Footer / Expand Button for Desktop */}
                <div className="p-3 border-t border-gray-200 dark:border-gray-800 shrink-0">
                    {collapsed ? (
                        <button
                            onClick={onToggleCollapse}
                            className="hidden md:flex w-full justify-center p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-colors"
                            title="Expand sidebar"
                        >
                            <ChevronRight size={20} />
                        </button>
                    ) : (
                        <div className="text-xs text-center text-gray-400 dark:text-gray-600">
                            EVORIX Core v1.0
                        </div>
                    )}
                </div>
            </aside>
        </>
    );
}
