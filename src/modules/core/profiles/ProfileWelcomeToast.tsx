import React, { useEffect, useState } from 'react';
import { useProfile } from './ProfileProvider';
import { useNavigate } from 'react-router-dom';
import { X, ArrowRight, PartyPopper } from 'lucide-react';
import { evoStore } from '../../../core/evoappDataStore';

export const ProfileWelcomeToast: React.FC = () => {
    const { activeProfile, justCreatedProfileId, clearNewProfileWelcome } = useProfile();
    const navigate = useNavigate();
    const [isEmpty, setIsEmpty] = useState<boolean | null>(null);

    // Only show if active profile matches the just created one
    const shouldShow = justCreatedProfileId === activeProfile.id;

    useEffect(() => {
        if (!shouldShow) return;

        let isMounted = true;
        const checkData = async () => {
            try {
                // Check minimal data existence to decide message
                const txs = await evoStore.registrosFinancieros.getAll();
                const invs = await evoStore.facturas.getAll();

                if (isMounted) {
                    setIsEmpty(txs.length === 0 && invs.length === 0);
                }
            } catch (e) {
                console.error("Error verifying profile data:", e);
                // On error, do not claim it is empty. Show neutral message.
                if (isMounted) setIsEmpty(false);
            }
        };

        checkData();
        return () => { isMounted = false; };
    }, [shouldShow, activeProfile.id]);

    if (!shouldShow) return null;
    if (isEmpty === null) return null; // Wait for check

    const handleAction = () => {
        // Navigate to Tools Hub to start
        navigate('/tools');
        clearNewProfileWelcome();
    };

    return (
        <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-5 duration-300">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl border-l-4 border-indigo-500 p-6 max-w-sm ring-1 ring-black/5">
                <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                        <PartyPopper className="text-indigo-500" size={24} />
                        <h3 className="font-bold text-gray-900 dark:text-white text-lg">
                            ¡Bienvenido, {activeProfile.name}!
                        </h3>
                    </div>
                    <button
                        onClick={clearNewProfileWelcome}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                <p className="text-gray-600 dark:text-gray-300 mb-5 text-sm leading-relaxed">
                    {isEmpty
                        ? "Este perfil está vacío. Empieza agregando tu primer movimiento o importa datos."
                        : "Tu perfil está listo para usarse."
                    }
                </p>

                <div className="flex gap-3">
                    <button
                        onClick={handleAction}
                        className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md font-medium text-sm flex items-center justify-center gap-2 transition-colors shadow-sm"
                    >
                        Explorar Herramientas <ArrowRight size={16} />
                    </button>
                </div>
            </div>
        </div>
    );
};
