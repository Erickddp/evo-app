import React, { useEffect } from 'react';

interface BackupFile {
    id: string;
    name: string;
    modifiedTime?: string;
    size?: number;
}

interface RestoreModalProps {
    open: boolean;
    onClose: () => void;
    onRestore: (file: BackupFile) => void;
    backups: BackupFile[];
    loadingBackups: boolean;
    errorBackups?: string;
    refreshBackups: () => void;
    // Restore Progress State
    isRestoring: boolean;
    restoreProgress?: { phase: string; percent: number; message?: string };
    restoreError?: string;
    onCancelRestore: () => void;
}

export const RestoreModal: React.FC<RestoreModalProps> = ({
    open,
    onClose,
    onRestore,
    backups,
    loadingBackups,
    errorBackups,
    refreshBackups,
    isRestoring,
    restoreProgress,
    restoreError,
    onCancelRestore
}) => {
    // Esc to close (only if not restoring)
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (!isRestoring) onClose();
            }
        };
        if (open) window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [open, onClose, isRestoring]);

    // Initial load
    useEffect(() => {
        if (open && backups.length === 0 && !loadingBackups) {
            refreshBackups();
        }
    }, [open]);

    if (!open) return null;

    // Helper to format bytes
    const formatBytes = (bytes?: number) => {
        if (bytes === undefined || bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    // Helper to format date (assuming filename or modifiedTime)
    const formatDate = (isoString?: string) => {
        if (!isoString) return 'Desconocido';
        return new Date(isoString).toLocaleString();
    };

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 10000,
            display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
            <div style={{
                backgroundColor: '#fff',
                borderRadius: '8px',
                width: '500px',
                maxWidth: '90vw',
                maxHeight: '80vh',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
                color: '#333' // Force simple text color
            }}>
                {/* Header */}
                <div style={{ padding: '16px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>
                        {isRestoring ? 'Restaurando...' : 'Abrir desde Google Drive'}
                    </h3>
                    {!isRestoring && (
                        <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#666' }}>&times;</button>
                    )}
                </div>

                {/* Content */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
                    {isRestoring ? (
                        <div style={{ textAlign: 'center', padding: '20px' }}>
                            <div style={{ height: '8px', background: '#eee', borderRadius: '4px', overflow: 'hidden', marginBottom: '16px' }}>
                                <div style={{ height: '100%', background: '#2196f3', width: `${restoreProgress?.percent || 0}%`, transition: 'width 0.3s ease' }}></div>
                            </div>
                            <p style={{ fontWeight: 500, margin: '8px 0' }}>{restoreProgress?.percent.toFixed(0)}%</p>
                            <p style={{ color: '#666' }}>{restoreProgress?.message}</p>

                            {restoreError && (
                                <div style={{ marginTop: '16px', color: '#f44336', padding: '8px', background: '#ffebee', borderRadius: '4px' }}>
                                    {restoreError}
                                </div>
                            )}
                        </div>
                    ) : (
                        <>
                            {loadingBackups && <p>Cargando copias de seguridad...</p>}
                            {errorBackups && <p style={{ color: '#f44336' }}>Error: {errorBackups}</p>}

                            {!loadingBackups && backups.length === 0 && !errorBackups && (
                                <p style={{ color: '#666', fontStyle: 'italic' }}>No se encontraron copias de seguridad.</p>
                            )}

                            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                                {backups.map(file => (
                                    <li key={file.id} style={{
                                        padding: '12px',
                                        borderBottom: '1px solid #f0f0f0',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        cursor: 'pointer',
                                    }}
                                        className="hover:bg-gray-50" // tailwind trick if supported, otherwise just plain
                                    >
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontWeight: 500 }}>{formatDate(file.modifiedTime)}</div>
                                            <div style={{ fontSize: '12px', color: '#888' }}>
                                                {formatBytes(file.size)} &middot; {file.name}
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => onRestore(file)}
                                            style={{
                                                padding: '6px 12px',
                                                borderRadius: '4px',
                                                border: '1px solid #ddd',
                                                background: '#fff',
                                                cursor: 'pointer',
                                                marginLeft: '8px'
                                            }}
                                        >
                                            Restaurar
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </>
                    )}
                </div>

                {/* Footer */}
                <div style={{ padding: '16px', borderTop: '1px solid #eee', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                    {isRestoring ? (
                        <>
                            {!restoreError && (
                                <button
                                    onClick={onCancelRestore}
                                    style={{ padding: '8px 16px', background: '#f44336', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                                >
                                    Cancelar
                                </button>
                            )}
                            {restoreError && (
                                <button onClick={onClose} style={{ padding: '8px 16px', background: '#333', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                                    Cerrar
                                </button>
                            )}
                        </>
                    ) : (
                        <button onClick={onClose} style={{ padding: '8px 16px', background: '#eee', color: '#333', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                            Cancelar
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};
