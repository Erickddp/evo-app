import { Shield, Database, Trash2, Info, Upload } from 'lucide-react';
import { useRef } from 'react';
import { dataStore } from '../core/data/dataStore';

export function Settings() {
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleClearData = () => {
        if (window.confirm('Are you sure you want to clear all local data? This action cannot be undone.')) {
            localStorage.clear();
            window.location.reload();
        }
    };

    return (
        <div className="max-w-3xl space-y-8">
            <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>
                <p className="mt-2 text-gray-600 dark:text-gray-400">
                    Manage your application preferences and data storage.
                </p>
            </div>

            <div className="space-y-6">
                {/* General Section */}
                <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400">
                            <Shield className="h-5 w-5" />
                        </div>
                        <h2 className="text-lg font-medium text-gray-900 dark:text-white">General</h2>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Appearance</h3>
                            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                Theme preferences are currently managed via the toggle in the top navigation bar.
                            </p>
                        </div>
                    </div>
                </section>

                {/* Data Management Section */}
                <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 rounded-lg bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400">
                            <Database className="h-5 w-5" />
                        </div>
                        <h2 className="text-lg font-medium text-gray-900 dark:text-white">Data Management</h2>
                    </div>

                    <div className="space-y-6">
                        <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-900/50">
                            <div className="flex gap-3">
                                <Info className="h-5 w-5 text-gray-400 shrink-0 mt-0.5" />
                                <div className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
                                    <p>
                                        <span className="font-medium text-gray-900 dark:text-white">DataStore backend:</span> LocalStorage (CSV-ready)
                                    </p>
                                    <p>
                                        <span className="font-medium text-gray-900 dark:text-white">Note:</span> Due to browser sandboxing, the app cannot write arbitrary CSV directly to your disk. Use the copy button below to export data.
                                    </p>
                                </div>
                            </div>

                            <div className="mt-4 flex flex-wrap gap-3">
                                <button
                                    onClick={async () => {
                                        try {
                                            const csv = await dataStore.exportAllAsCsv();
                                            await navigator.clipboard.writeText(csv);
                                            alert('CSV copied to clipboard!');
                                        } catch (err) {
                                            console.error('Failed to copy CSV', err);
                                            alert('Failed to copy CSV');
                                        }
                                    }}
                                    className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors dark:text-blue-400 dark:bg-blue-900/20 dark:hover:bg-blue-900/30"
                                >
                                    Copy CSV preview to clipboard
                                </button>

                                <input
                                    type="file"
                                    accept=".csv"
                                    className="hidden"
                                    ref={fileInputRef}
                                    onChange={async (e) => {
                                        const file = e.target.files?.[0];
                                        if (!file) return;

                                        try {
                                            const text = await file.text();
                                            const count = await dataStore.importFromCsv(text, { clearBefore: true });
                                            alert(`Successfully restored ${count} records from CSV.`);
                                            // Optional: reload to reflect changes immediately if needed, though dataStore is reactive usually or we might need to trigger a re-fetch in other components.
                                            // For now, simple alert is enough as per requirements.
                                        } catch (err) {
                                            console.error('Failed to import CSV', err);
                                            alert('Error restoring data from CSV. Check console for details.');
                                        } finally {
                                            // Reset input so same file can be selected again
                                            if (fileInputRef.current) {
                                                fileInputRef.current.value = '';
                                            }
                                        }
                                    }}
                                />
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-md transition-colors dark:text-gray-300 dark:bg-gray-800 dark:border-gray-600 dark:hover:bg-gray-700"
                                >
                                    <Upload className="h-4 w-4" />
                                    Restore data from CSV
                                </button>
                            </div>
                            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                                Use this to restore your data from a CSV backup previously exported from this app.
                                <br />
                                The CSV must have columns: id, toolId, createdAt, updatedAt, payload_json.
                            </p>
                        </div>

                        <div className="pt-4 border-t border-gray-100 dark:border-gray-700">
                            <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Danger Zone</h3>
                            <div className="flex items-center justify-between">
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    Permanently remove all local data from this browser.
                                </p>
                                <button
                                    onClick={handleClearData}
                                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors dark:text-red-400 dark:hover:bg-red-900/20"
                                >
                                    <Trash2 className="h-4 w-4" />
                                    Clear Local Data
                                </button>
                            </div>
                        </div>
                    </div>
                </section>
            </div >
        </div >
    );
}
