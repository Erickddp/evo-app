
import React, { useEffect, useState } from 'react';
import { useSync } from './SyncProvider';
import { ProfileSwitcher } from '../profiles/ProfileSwitcher';
import { useNavigate } from 'react-router-dom';

export const SaveBar: React.FC = () => {
    const {
        isDirty,
        isSaving,
        lastSavedAt,
        lastSaveStatus,
        lastError,
        saveNow,
        driveStatus,
        connectDrive,
        openRestore,
        isRestoring
    } = useSync();

    const navigate = useNavigate();
    // const location = useLocation();

    // Local state to hide the bar after a while if "Saved" and no changes
    const [isVisible, setIsVisible] = useState(true);

    useEffect(() => {
        if (isDirty || isSaving || isRestoring || lastSaveStatus === 'error' || driveStatus === 'missing-config') {
            setIsVisible(true);
        } else if (lastSaveStatus === 'ok' && !isRestoring) {
            const timer = setTimeout(() => {
                // Keep visible but maybe change style?
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [isDirty, isSaving, lastSaveStatus, isRestoring, driveStatus]);

    if (!isVisible) return null;

    let content: React.ReactNode = null;
    let bgColor = '#333';
    let textColor = '#fff';

    // Helper to navigate to settings
    const handleOpenGuide = () => {
        navigate('/settings', { state: { scrollTo: 'drive' } });
        // Simulating hash scroll if needed, but state is cleaner
        setTimeout(() => {
            const el = document.getElementById('drive');
            if (el) el.scrollIntoView({ behavior: 'smooth' });
        }, 500);
    };

    if (driveStatus === 'missing-config') {
        bgColor = '#607d8b'; // Blue Grey
        content = (
            <div style={{ display: 'flex', alignItems: 'center' }}>
                <span style={{ fontSize: '12px' }}>Drive no configurado</span>
                <button
                    onClick={handleOpenGuide}
                    style={{ marginLeft: '10px', padding: '4px 8px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.5)', background: 'transparent', color: '#fff', cursor: 'pointer', fontSize: '11px' }}
                >
                    Ver guía
                </button>
            </div>
        );
    } else if (driveStatus !== 'connected') {
        // Not connected (disconnected, error, loading)
        const isError = driveStatus === 'error';
        const isLoading = driveStatus === 'loading';

        if (isDirty) {
            bgColor = isError ? '#f44336' : '#ff9800'; // Red or Orange
            content = (
                <>
                    <span>{isError ? 'Error conexión' : 'Cambios sin guardar'}</span>
                    <button
                        onClick={() => !isLoading && connectDrive()}
                        disabled={isLoading}
                        style={{ marginLeft: '10px', padding: '4px 8px', borderRadius: '4px', border: 'none', background: '#fff', color: isError ? '#f44336' : '#ff9800', cursor: 'pointer', fontWeight: 'bold' }}
                    >
                        {isLoading ? 'Conectando...' : (isError ? 'Reintentar Drive' : 'Conectar Google Drive')}
                    </button>
                    {/* Always allow local save if dirty, even if drive is disconnected? 
                        Sync logic usually requires drive for "SaveNow" in this specific implementation, 
                        but if we want to allow "Offline" work (localStorage), we should enable a manual save 
                        that just commits to local store (which is usually automatic anyway).
                        The SyncContext 'saveNow' typically pushes to Drive.
                    */}
                </>
            );
        } else {
            // Clean but not connected
            bgColor = isError ? '#f44336' : '#333';
            content = (
                <>
                    <span>{isError ? 'Error al conectar' : 'Respaldo inactivo'}</span>
                    <button
                        onClick={() => !isLoading && connectDrive()}
                        disabled={isLoading}
                        style={{ marginLeft: '10px', padding: '4px 8px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.4)', background: 'transparent', color: '#fff', cursor: 'pointer', fontSize: '12px' }}
                    >
                        {isLoading ? '...' : (isError ? 'Reintentar' : 'Conectar')}
                    </button>
                </>
            );
        }
    } else {
        // Connected
        const openBtn = (
            <button
                onClick={openRestore}
                style={{ marginLeft: '10px', padding: '4px 8px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.4)', background: 'transparent', color: '#fff', cursor: 'pointer', fontSize: '13px' }}
                title="Ctrl+O / Cmd+O"
                disabled={isSaving || isRestoring}
            >
                Abrir
            </button>
        );

        if (isRestoring) {
            bgColor = '#9c27b0'; // Purple
            content = (
                <>
                    <span className="spinner" style={{ marginRight: '8px', display: 'inline-block', width: '12px', height: '12px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></span>
                    <span>Restaurando...</span>
                    <style>{`@keyframes spin { to { transform: rotate(360deg); } } `}</style>
                </>
            );
        } else if (isSaving) {
            bgColor = '#2196f3'; // Blue
            content = (
                <>
                    <span className="spinner" style={{ marginRight: '8px', display: 'inline-block', width: '12px', height: '12px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></span>
                    <span>Guardando...</span>
                    <style>{`@keyframes spin { to { transform: rotate(360deg); } } `}</style>
                </>
            );
        } else if (isDirty) {
            bgColor = '#ff9800'; // Orange
            content = (
                <>
                    <span>Cambios sin guardar</span>
                    <button
                        onClick={() => saveNow()}
                        style={{ marginLeft: '10px', padding: '4px 8px', borderRadius: '4px', border: 'none', background: 'rgba(255,255,255,0.2)', color: '#fff', cursor: 'pointer', fontWeight: 'bold' }}
                        title="Ctrl+G / Cmd+G"
                    >
                        Guardar
                    </button>
                    {openBtn}
                </>
            );
        } else if (lastSaveStatus === 'error') {
            bgColor = '#f44336'; // Red
            content = (
                <>
                    <span>Error: {lastError || 'No se pudo guardar'}</span>
                    <button
                        onClick={() => saveNow()}
                        style={{ marginLeft: '10px', padding: '4px 8px', borderRadius: '4px', border: 'none', background: '#fff', color: '#f44336', cursor: 'pointer', fontWeight: 'bold' }}
                    >
                        Reintentar
                    </button>
                    {openBtn}
                </>
            );
        } else { // status === ok
            bgColor = '#4caf50';
            const time = lastSavedAt ? new Date(lastSavedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
            const msg = `Guardado en la nube · ${time} `;

            content = (
                <>
                    <span>{msg}</span>
                    {openBtn}
                </>
            );
        }
    }

    return (
        <div style={{
            position: 'fixed',
            bottom: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: bgColor,
            color: textColor,
            padding: '8px 16px',
            borderRadius: '24px',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
            fontSize: '14px',
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            zIndex: 9999,
            transition: 'background-color 0.3s ease',
            gap: '12px'
        }}>
            <ProfileSwitcher />
            <div style={{ width: '1px', height: '16px', background: 'rgba(255,255,255,0.3)' }}></div>
            {content}
        </div>
    );
};
