import { useState, useEffect } from 'react';
import { toolsRegistry } from '../modules/registry';
import { ErrorBoundary } from '../core/errors/ErrorBoundary';
import { ToolsSidebar } from '../components/ToolsSidebar';

export function ToolsHub() {
  const [selectedToolId, setSelectedToolId] = useState<string | null>(() => {
    return localStorage.getItem('evorix-selected-tool');
  });

  // State for sidebar collapse. Defaults to false (expanded).
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const selectedTool = toolsRegistry.find((t) => t.meta.id === selectedToolId);

  useEffect(() => {
    if (selectedToolId) {
      localStorage.setItem('evorix-selected-tool', selectedToolId);
    }
  }, [selectedToolId]);

  const handleSelectTool = (id: string) => {
    setSelectedToolId(id);
    // Auto-collapse sidebar when a tool is selected
    setIsSidebarCollapsed(true);
  };

  return (
    <div className="h-full flex gap-6">
      {/* Collapsible Sidebar */}
      <ToolsSidebar
        tools={toolsRegistry}
        selectedToolId={selectedToolId}
        onSelect={handleSelectTool}
        collapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
      />

      {/* Active Tool Area */}
      <div className="flex-1 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden transition-all duration-300">
        {selectedTool ? (
          <div className="flex flex-col h-full">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50">
              <div className="flex items-center gap-2">
                {(() => {
                  const Icon = selectedTool.meta.icon;
                  return Icon ? <Icon size={18} className="text-gray-500" /> : null;
                })()}
                <h2 className="font-semibold text-gray-900 dark:text-white">
                  {selectedTool.meta.name}
                </h2>
                <span className="text-xs px-2 py-0.5 bg-gray-200 dark:bg-gray-700 rounded-full text-gray-600 dark:text-gray-300">
                  v{selectedTool.meta.version}
                </span>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-6 relative">
              <ErrorBoundary
                key={selectedTool.meta.id}
                fallback={
                  <div className="p-6 text-center">
                    <div className="text-red-500 mb-2">⚠️ Tool Crashed</div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      The tool "{selectedTool.meta.name}" encountered an error.
                    </p>
                    <button
                      onClick={() => window.location.reload()}
                      className="mt-4 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-md text-sm"
                    >
                      Reload App
                    </button>
                  </div>
                }
              >
                <selectedTool.component />
              </ErrorBoundary>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4 text-gray-400">
              <span className="text-2xl">←</span>
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              No Tool Selected
            </h3>
            <p className="text-gray-500 dark:text-gray-400 max-w-xs">
              Select a tool from the sidebar to launch it in this workspace.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}