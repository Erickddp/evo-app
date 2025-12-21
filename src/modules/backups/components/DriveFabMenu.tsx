import { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useSync } from '../../core/sync/SyncProvider';
import { useProfile } from '../../core/profiles/ProfileProvider';
import {
    Plus,
    Check,
    ChevronDown,
    Cloud,
    AlertCircle,
    Clock
} from 'lucide-react';

export function DriveFabMenu() {
    const [isOpen, setIsOpen] = useState(false);
    const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);

    // Hooks
    const {
        isDriveConnected,
        driveUser,
        lastSavedAt,
        isSaving,
        isRestoring,
        connectDrive,
        saveNow,
        openRestore
    } = useSync();

    const {
        profiles,
        activeProfile,
        switchProfile,
        createProfile
    } = useProfile();

    const menuRef = useRef<HTMLDivElement>(null);
    const fabRef = useRef<HTMLButtonElement>(null);

    // Stale Logic (24h)
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 60000);
        return () => clearInterval(timer);
    }, []);

    const isStale = useMemo(() => {
        if (!lastSavedAt) return true;
        return (now - new Date(lastSavedAt).getTime() > 24 * 60 * 60 * 1000);
    }, [lastSavedAt, now]);

    // Status Colors
    // Green (Active/Fresh), Amber (Stale), Gray (Disconnected)
    const getStatusColor = () => {
        if (!isDriveConnected) return 'bg-slate-700/80 border-slate-600 text-slate-400';
        if (isSaving || isRestoring) return 'bg-blue-600 border-blue-400 animate-pulse text-white';
        if (isStale) return 'bg-amber-500/90 border-amber-400 text-white shadow-amber-900/20';
        return 'bg-emerald-600 border-emerald-500 text-white shadow-emerald-900/20';
    };

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                menuRef.current && !menuRef.current.contains(event.target as Node) &&
                fabRef.current && !fabRef.current.contains(event.target as Node)
            ) {
                setIsOpen(false);
                setIsProfileMenuOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    // Portal content
    const portalContent = isOpen && createPortal(
        <div
            ref={menuRef}
            className="fixed bottom-[80px] right-3 sm:right-5 z-[9999] w-[300px] sm:w-[320px] origin-bottom-right animate-in fade-in slide-in-from-bottom-4 duration-200"
            style={{
                paddingBottom: 'env(safe-area-inset-bottom)'
            }}
        >
            <div className="bg-zinc-950/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col items-stretch text-slate-200">

                {/* Header: Title & Connection Status */}
                <div className="px-5 py-4 border-b border-white/5 bg-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-3 overflow-hidden">
                        {/* Google Avatar or Default Badge */}
                        <div className="shrink-0">
                            {isDriveConnected && driveUser?.photoLink ? (
                                <img
                                    src={driveUser.photoLink}
                                    alt={driveUser.displayName}
                                    className="h-9 w-9 rounded-full border border-slate-700/60 shadow-sm"
                                />
                            ) : (
                                <div className="rounded-full bg-white/10 border border-slate-700/60 p-1.5 flex items-center justify-center">
                                    <img src="/google-g.svg" alt="Google" className="h-5 w-5" />
                                </div>
                            )}
                        </div>

                        <div className="flex flex-col min-w-0">
                            <h3 className="text-sm font-semibold text-white leading-tight truncate">
                                {isDriveConnected ? (driveUser?.displayName || 'Cuenta de Google') : 'Copia de Seguridad'}
                            </h3>
                            <p className="text-[11px] text-slate-400 truncate">
                                {isDriveConnected ? (driveUser?.emailAddress || 'Conectado') : 'Sin conexión'}
                            </p>
                        </div>
                    </div>
                    {isDriveConnected && (
                        <div className={`shrink-0 w-2 h-2 rounded-full ${isStale ? 'bg-amber-500' : 'bg-emerald-500'} shadow-[0_0_8px_currentColor]`} />
                    )}
                </div>

                {/* Body Content */}
                <div className="p-5 flex flex-col gap-5">

                    {/* 1. Profile Selector */}
                    <div className="space-y-1.5 relative">
                        <label className="text-[10px] uppercase tracking-wider text-slate-500 font-medium ml-1">Perfil Activo</label>

                        <button
                            onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                            className="w-full flex items-center justify-between bg-zinc-900/50 hover:bg-zinc-800/80 border border-white/10 rounded-xl px-3 py-2.5 transition-colors group"
                        >
                            <div className="flex items-center gap-3 overflow-hidden">
                                <div className="w-6 h-6 rounded-md bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                                    {activeProfile.name.charAt(0).toUpperCase()}
                                </div>
                                <span className="text-sm font-medium text-slate-200 truncate">{activeProfile.name}</span>
                            </div>
                            <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${isProfileMenuOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {/* Dropdown Profile List (Absolute) */}
                        {isProfileMenuOpen && (
                            <div className="absolute top-full left-0 right-0 mt-1 bg-zinc-900 border border-white/10 rounded-xl shadow-xl z-20 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                                <div className="max-h-[160px] overflow-y-auto py-1 custom-scrollbar">
                                    {profiles.map(p => (
                                        <button
                                            key={p.id}
                                            onClick={() => {
                                                switchProfile(p.id);
                                                setIsProfileMenuOpen(false);
                                            }}
                                            className={`w-full text-left px-3 py-2 flex items-center justify-between hover:bg-white/5 transition-colors ${p.id === activeProfile.id ? 'bg-white/5' : ''}`}
                                        >
                                            <span className={`text-sm ${p.id === activeProfile.id ? 'text-white font-medium' : 'text-slate-400'}`}>
                                                {p.name}
                                            </span>
                                            {p.id === activeProfile.id && <Check className="w-3.5 h-3.5 text-emerald-500" />}
                                        </button>
                                    ))}
                                </div>
                                <div className="border-t border-white/5 p-1">
                                    <button
                                        onClick={() => {
                                            const name = prompt("Nombre del nuevo perfil:");
                                            if (name) {
                                                createProfile(name);
                                                setIsProfileMenuOpen(false);
                                            }
                                        }}
                                        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 rounded-lg transition-colors"
                                    >
                                        <Plus className="w-3.5 h-3.5" />
                                        Crear nuevo perfil
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 2. Backup Status Info */}
                    <div className="bg-white/5 rounded-xl p-3 border border-white/5 flex flex-col gap-1">
                        <div className="flex items-center gap-2 text-xs text-slate-400">
                            <Clock className="w-3.5 h-3.5" />
                            <span>Última copia:</span>
                        </div>
                        <p className="text-sm text-slate-200 font-medium pl-5.5">
                            {lastSavedAt ? new Date(lastSavedAt).toLocaleString() : 'Nunca'}
                        </p>
                        {isStale && lastSavedAt && (
                            <div className="mt-1 flex items-start gap-1.5 text-amber-400/90 text-[10px] pl-1">
                                <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
                                <span>Copia antigua. Se recomienda respaldar.</span>
                            </div>
                        )}
                    </div>

                    {/* 3. Actions */}
                    <div className="grid grid-cols-2 gap-3 mt-1">
                        {isDriveConnected ? (
                            <>
                                <button
                                    onClick={() => {
                                        openRestore();
                                        // Don't close immediately allows interaction
                                    }}
                                    className="col-span-1 px-4 py-2.5 rounded-xl bg-white text-black hover:bg-slate-200 font-semibold text-sm transition-colors shadow-lg shadow-white/10 active:scale-95"
                                >
                                    Abrir
                                </button>
                                <button
                                    onClick={() => saveNow()}
                                    disabled={isSaving}
                                    className="col-span-1 px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-medium text-sm border border-white/10 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95"
                                >
                                    {isSaving ? '...' : (
                                        <>
                                            <Cloud className="w-4 h-4" />
                                            <span>Respaldar</span>
                                        </>
                                    )}
                                </button>
                            </>
                        ) : (
                            <button
                                onClick={() => connectDrive()}
                                className="col-span-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition-all shadow-lg shadow-blue-500/25 active:scale-95"
                            >
                                Conectar Google Drive
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );


    return (
        <>
            {/* Floating Action Button */}
            <button
                ref={fabRef}
                onClick={() => setIsOpen(!isOpen)}
                aria-label="Google Drive Backup Menu"
                className={`
                    fixed right-3 bottom-3 sm:right-5 sm:bottom-5 z-[9999]
                    w-[44px] h-[44px] rounded-full
                    flex items-center justify-center
                    shadow-lg backdrop-blur-sm
                    transition-all duration-300 ease-out
                    border
                    focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500
                    active:scale-90
                    ${getStatusColor()}
                    ${isOpen ? 'ring-2 ring-white/20 scale-110' : 'opacity-80 hover:opacity-100 hover:scale-105 active:scale-95'}
                `}
                style={{
                    paddingBottom: 'env(safe-area-inset-bottom)',
                    paddingRight: 'env(safe-area-inset-right)'
                }}
            >
                {/* Image Google Badge */}
                <div className="rounded-full bg-white/10 border border-slate-700/60 p-2 flex items-center justify-center">
                    <img src="/google-g.svg" alt="Google" className="h-7 w-7" />
                </div>
            </button>

            {/* Portal Menu */}
            {portalContent}
        </>
    );
}
