// src/components/ToolsSidebar.tsx
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
        <div
            className={`
        bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 
        flex flex-col overflow-hidden transition-all duration-300 ease-in-out h-full
        ${collapsed ? "w-20" : "w-72"}
      `}
        >
            {/* Header */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center h-[60px]">
                {!collapsed && (
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white whitespace-nowrap overflow-hidden">
                        Available Tools
                    </h2>
                )}
                <button
                    onClick={onToggleCollapse}
                    className={`
            p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 
            text-gray-500 dark:text-gray-400 transition-colors
            ${collapsed ? "mx-auto" : ""}
          `}
                    title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                >
                    {collapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
                </button>
            </div>

            {/* Tools List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {tools.length === 0 ? (
                    !collapsed && (
                        <div className="p-4 text-center text-gray-500 dark:text-gray-400 text-sm">
                            No tools installed.
                        </div>
                    )
                ) : (
                    tools.map((tool) => (
                        <button
                            key={tool.meta.id}
                            onClick={() => onSelect(tool.meta.id)}
                            title={collapsed ? tool.meta.name : undefined}
                            className={`
                w-full rounded-md flex items-center transition-colors
                ${collapsed ? "justify-center p-2" : "p-3 gap-3 text-left"}
                ${selectedToolId === tool.meta.id
                                    ? "bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800"
                                    : "hover:bg-gray-50 dark:hover:bg-gray-700/50 border border-transparent"
                                }
              `}
                        >
                            <div
                                className={`
                p-2 bg-white dark:bg-gray-700 rounded-md shadow-sm text-blue-600 dark:text-blue-400
                flex-shrink-0 flex items-center justify-center
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

                            {!collapsed && (
                                <div className="overflow-hidden">
                                    <h3 className="font-medium text-gray-900 dark:text-gray-100 truncate">
                                        {tool.meta.name}
                                    </h3>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1">
                                        {tool.meta.description}
                                    </p>
                                </div>
                            )}
                        </button>
                    ))
                )}
            </div>
        </div>
    );
}

export default ToolsSidebar;
