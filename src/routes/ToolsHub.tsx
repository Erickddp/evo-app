import { useState, useEffect } from 'react';
import { toolsRegistry } from '../modules/registry';
import { ErrorBoundary } from '../core/errors/ErrorBoundary';

export function ToolsHub() {
  const [selectedToolId, setSelectedToolId] = useState<string | null>(() => {
    return localStorage.getItem('evorix-selected-tool');
  });

  const selectedTool = toolsRegistry.find((t) => t.meta.id === selectedToolId);

  useEffect(() => {
    if (selectedToolId) {
      localStorage.setItem('evorix-selected-tool', selectedToolId);
    }
  }, [selectedToolId]);

  return (
    <div className="h-full flex gap-6">
      {/* Tools List */}
      <div className="w-1/3 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Available Tools</h2>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-2">
          {toolsRegistry.length === 0 ? (
            <div className="p-4 text-center text-gray-500 dark:text-gray-400 text-sm">
              No tools installed.
            </div>
          ) : (
            toolsRegistry.map((tool) => (
              <button
                key={tool.meta.id}
                onClick={() => setSelectedToolId(tool.meta.id)}
                className={`w-full text-left p-3 rounded-md flex items-start gap-3 transition-colors ${selectedToolId === tool.meta.id
                  ? 'bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800'
                  : 'hover:bg-gray-50 dark:hover:bg-gray-700/50 border border-transparent'
                  } `}
              >
                <div className="p-2 bg-white dark:bg-gray-700 rounded-md shadow-sm text-blue-600 dark:text-blue-400">
                  {(() => {
                    const Icon = tool.meta.icon;
                    return Icon ? <Icon size={20} /> : null;
                  })()}
                </div>
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-gray-100">{tool.meta.name}</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1">
                    {tool.meta.description}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Active Tool Area */}
      <div className="flex-1 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden">
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