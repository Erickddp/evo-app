import React, { useState } from 'react';
import { useProfile } from './ProfileProvider';
import { useSync } from '../sync/SyncProvider';

export const ProfileSwitcher: React.FC = () => {
    const {
        profiles,
        activeProfile,
        switchProfile,
        createProfile,
    } = useProfile();

    const { isDirty, saveNow } = useSync();

    const [isOpen, setIsOpen] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [newName, setNewName] = useState('');

    // Safety Modal State
    const [showUnsavedModal, setShowUnsavedModal] = useState(false);
    const [pendingProfileId, setPendingProfileId] = useState<string | null>(null);

    const handleCreate = (e: React.FormEvent) => {
        e.preventDefault();
        if (newName.trim()) {
            createProfile(newName.trim());
            setNewName('');
            setIsCreating(false);
        }
    };

    const requestSwitch = (targetId: string) => {
        if (targetId === activeProfile.id) return;

        if (isDirty) {
            setPendingProfileId(targetId);
            setShowUnsavedModal(true);
        } else {
            switchProfile(targetId);
            setIsOpen(false);
        }
    };

    const resolvePendingSwitch = async (shouldSave: boolean) => {
        if (!pendingProfileId) return;

        if (shouldSave) {
            try {
                await saveNow();
            } catch (e) {
                console.error("Save failed during switch", e);
                // If save failed, should we interrupt? 
                // For now, alerting user might be best, but we'll proceed if we follow prompt 'save and switch'.
                // A robust system would check success.
                alert("Error al guardar. Verifica tu conexión.");
                // We stay in modal so user can choose to discard or try again
                return;
            }
        }

        await switchProfile(pendingProfileId);
        setPendingProfileId(null);
        setShowUnsavedModal(false);
        setIsOpen(false);
    };

    const cancelPendingSwitch = () => {
        setPendingProfileId(null);
        setShowUnsavedModal(false);
    };

    return (
        <>
            <div style={{ position: 'relative', display: 'inline-block' }}>
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    style={{
                        background: 'transparent',
                        border: '1px solid rgba(255,255,255,0.2)',
                        color: '#fff',
                        padding: '6px 12px',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '14px'
                    }}
                    title="Ctrl+Shift+P"
                >
                    <span style={{ opacity: 0.7 }}>Perfil:</span>
                    <span style={{ fontWeight: 600 }}>{activeProfile.name}</span>
                    <span style={{ fontSize: '10px' }}>▼</span>
                </button>

                {isOpen && (
                    <div style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        marginTop: '4px',
                        background: '#fff',
                        borderRadius: '4px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                        minWidth: '200px',
                        zIndex: 1000,
                        color: '#333'
                    }}>
                        <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                            {profiles.map(p => (
                                <div
                                    key={p.id}
                                    onClick={() => requestSwitch(p.id)}
                                    style={{
                                        padding: '10px 16px',
                                        cursor: 'pointer',
                                        background: p.id === activeProfile.id ? '#f0f7ff' : '#fff',
                                        borderBottom: '1px solid #eee',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px'
                                    }}
                                >
                                    {p.id === activeProfile.id ? '●' : '○'} {p.name}
                                </div>
                            ))}
                        </div>

                        {isCreating ? (
                            <form onSubmit={handleCreate} style={{ padding: '8px' }}>
                                <input
                                    autoFocus
                                    placeholder="Nombre del perfil"
                                    value={newName}
                                    onChange={e => setNewName(e.target.value)}
                                    style={{ width: '100%', padding: '6px', boxSizing: 'border-box' }}
                                />
                                <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
                                    <button type="submit" style={{ flex: 1, cursor: 'pointer' }}>Crear</button>
                                    <button type="button" onClick={() => setIsCreating(false)} style={{ cursor: 'pointer' }}>Cancel</button>
                                </div>
                            </form>
                        ) : (
                            <div
                                onClick={() => setIsCreating(true)}
                                style={{
                                    padding: '10px 16px',
                                    cursor: 'pointer',
                                    color: '#2196f3',
                                    fontWeight: 500,
                                    borderTop: '1px solid #eee'
                                }}
                            >
                                + Nuevo Perfil
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Global Unsaved Changes Modal */}
            {showUnsavedModal && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.5)', zIndex: 11000,
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                    <div style={{ background: '#fff', padding: '24px', borderRadius: '8px', maxWidth: '400px', boxShadow: '0 10px 25px rgba(0,0,0,0.3)', color: '#333' }}>
                        <h3 style={{ marginTop: 0 }}>Cambios sin guardar</h3>
                        <p style={{ color: '#666' }}>
                            Si cambias de perfil ahora, podrías perder los cambios locales que no han sido respaldados en Google Drive.
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '24px' }}>
                            <button
                                onClick={() => resolvePendingSwitch(true)}
                                style={{ padding: '10px', background: '#2196f3', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}
                            >
                                Guardar y Cambiar
                            </button>
                            <button
                                onClick={() => resolvePendingSwitch(false)}
                                style={{ padding: '10px', background: '#f44336', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                            >
                                Cambiar sin Guardar (Descartar)
                            </button>
                            <button
                                onClick={cancelPendingSwitch}
                                style={{ padding: '10px', background: '#eee', color: '#333', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Backdrop click to close */}
            {isOpen && <div style={{ position: 'fixed', inset: 0, zIndex: 999 }} onClick={() => setIsOpen(false)}></div>}
        </>
    );
};
