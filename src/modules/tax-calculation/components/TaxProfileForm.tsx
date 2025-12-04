import React, { useState, useEffect } from 'react';
import { Save, User, Building2, FileText, CheckCircle, AlertCircle } from 'lucide-react';
import type { TaxProfile } from '../../shared/taxProfile';
import { taxProfileStore } from '../store/taxProfileStore';

export const TaxProfileForm: React.FC<{
    onProfileSaved?: () => void;
    onCancel?: () => void;
    showCancel?: boolean;
}> = ({ onProfileSaved, onCancel, showCancel }) => {
    const [profile, setProfile] = useState<TaxProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    // Form state
    const [nombre, setNombre] = useState('');
    const [razonSocial, setRazonSocial] = useState('');
    const [rfc, setRfc] = useState('');
    const [tipoPersona, setTipoPersona] = useState<"PF" | "PM">('PF');
    const [regimenFiscal, setRegimenFiscal] = useState<TaxProfile['regimenFiscal']>('PF_RESICO');

    useEffect(() => {
        loadProfile();
    }, []);

    const loadProfile = async () => {
        setLoading(true);
        try {
            const saved = await taxProfileStore.getTaxProfile();
            if (saved) {
                setProfile(saved);
                setNombre(saved.nombre);
                setRazonSocial(saved.razonSocial);
                setRfc(saved.rfc);
                setTipoPersona(saved.tipoPersona);
                setRegimenFiscal(saved.regimenFiscal);
            }
        } catch (e) {
            console.error("Failed to load tax profile", e);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setMessage(null);

        // Basic validation
        if (!rfc.trim()) {
            setMessage({ type: 'error', text: 'El RFC es obligatorio.' });
            return;
        }

        // Validation for RESICO PF
        if (tipoPersona === 'PF' && regimenFiscal === 'PF_RESICO') {
            if (!nombre.trim()) {
                setMessage({ type: 'error', text: 'El Nombre Completo es obligatorio para RESICO PF.' });
                return;
            }
        } else {
            if (!nombre.trim() && !razonSocial.trim()) {
                setMessage({ type: 'error', text: 'Debes ingresar Nombre o Razón Social.' });
                return;
            }
        }

        const newProfile: TaxProfile = {
            id: profile?.id || crypto.randomUUID(),
            nombre,
            razonSocial,
            rfc,
            tipoPersona,
            regimenFiscal,
            createdAt: profile?.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        try {
            await taxProfileStore.saveTaxProfile(newProfile);
            setProfile(newProfile);
            setMessage({ type: 'success', text: 'Perfil confirmado y guardado.' });

            // Clear success message after 3 seconds
            setTimeout(() => setMessage(null), 3000);

            if (onProfileSaved) onProfileSaved();
        } catch (e) {
            console.error("Failed to save profile", e);
            setMessage({ type: 'error', text: 'Error al guardar el perfil.' });
        }
    };

    if (loading) return <div className="text-sm text-gray-500">Cargando perfil...</div>;

    // Expanded View (Form)
    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700 mb-6">
            <div className="flex justify-between items-start mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <FileText className="text-indigo-600" size={20} />
                    Configurar Perfil Fiscal
                </h3>
                {showCancel && (
                    <button
                        onClick={onCancel}
                        className="text-xs text-gray-500 hover:text-gray-700"
                    >
                        Cancelar
                    </button>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Tipo de Persona</label>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setTipoPersona('PF')}
                            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border transition-colors ${tipoPersona === 'PF'
                                ? 'bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-900/20 dark:border-indigo-800 dark:text-indigo-300'
                                : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300'
                                }`}
                        >
                            <User size={16} className="inline mr-2" /> Física
                        </button>
                        <button
                            onClick={() => setTipoPersona('PM')}
                            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border transition-colors ${tipoPersona === 'PM'
                                ? 'bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-900/20 dark:border-indigo-800 dark:text-indigo-300'
                                : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300'
                                }`}
                        >
                            <Building2 size={16} className="inline mr-2" /> Moral
                        </button>
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Régimen Fiscal</label>
                    <select
                        value={regimenFiscal}
                        onChange={(e) => setRegimenFiscal(e.target.value as any)}
                        className="w-full p-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                    >
                        {tipoPersona === 'PF' ? (
                            <>
                                <option value="PF_RESICO">RESICO (Persona Física)</option>
                                <option value="PF_ACT_EMPRESARIAL">Actividad Empresarial</option>
                            </>
                        ) : (
                            <>
                                <option value="PM_RESICO">RESICO (Persona Moral)</option>
                                <option value="PM_GENERAL">Régimen General de Ley</option>
                            </>
                        )}
                    </select>
                </div>

                <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">RFC</label>
                    <input
                        type="text"
                        value={rfc}
                        onChange={(e) => setRfc(e.target.value.toUpperCase())}
                        placeholder="XAXX010101000"
                        className="w-full p-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 uppercase"
                    />
                </div>

                <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                        {tipoPersona === 'PF' ? 'Nombre Completo' : 'Razón Social'}
                    </label>
                    <input
                        type="text"
                        value={tipoPersona === 'PF' ? nombre : razonSocial}
                        onChange={(e) => tipoPersona === 'PF' ? setNombre(e.target.value) : setRazonSocial(e.target.value)}
                        placeholder={tipoPersona === 'PF' ? 'Juan Pérez' : 'Empresa S.A. de C.V.'}
                        className="w-full p-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                    />
                </div>
            </div>

            <div className="flex items-center justify-between">
                <div className="text-sm">
                    {message && (
                        <span className={`flex items-center gap-2 ${message.type === 'success' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                            {message.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
                            {message.text}
                        </span>
                    )}
                </div>
                <button
                    onClick={handleSave}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors"
                >
                    <Save size={16} />
                    {tipoPersona === 'PF' && regimenFiscal === 'PF_RESICO'
                        ? 'Confirmar perfil y calcular'
                        : 'Guardar Perfil'}
                </button>
            </div>
        </div>
    );
};
