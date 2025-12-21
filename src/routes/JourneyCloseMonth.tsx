import { useParams, Link } from 'react-router-dom';
import { CheckCircle2, Circle, AlertCircle, ArrowRight, Lock, ArrowLeft } from 'lucide-react';
import { useEffect, useState } from 'react';
import { journeyEngine } from '../modules/core/journey/JourneyEngine';
import { journeyStore } from '../modules/core/journey/JourneyStore';
import type { JourneyState, JourneyStep } from '../core/evoappDataModel';
import { isJourneyEnabled } from '../config/flags';
import { useDashboardData } from '../modules/core/data-provider/useDashboardData';
import { useProfiles } from '../modules/core/profiles/ProfileProvider';

// Static Metadata for Rich UX
const JOURNEY_METADATA: Record<string, {
    title: string;
    shortDesc: string;
    whyItMatters: string;
    unlocks: string;
    ctaLabel: string;
    deepLink: string | null;
}> = {
    'select-month': {
        title: 'Selección de Periodo',
        shortDesc: 'Confirma el mes que deseas cerrar.',
        whyItMatters: 'Base temporal para todos los cálculos.',
        unlocks: 'Habilita la importación de datos.',
        ctaLabel: 'Listo',
        deepLink: null
    },
    'import-bank': {
        title: 'Importar Banco',
        shortDesc: 'Carga tus estados de cuenta (PDF/CSV).',
        whyItMatters: 'Es la verdad financiera de tus flujos de efectivo.',
        unlocks: 'Permite la conciliación contra facturas.',
        ctaLabel: 'Importar Movimientos',
        deepLink: '/tools/bank-reconciler'
    },
    'import-cfdi': {
        title: 'Importar Facturas',
        shortDesc: 'Carga tus XMLs emitidos y recibidos.',
        whyItMatters: 'Justifica fiscalmente tus ingresos y gastos.',
        unlocks: 'Habilita la clasificación fiscal.',
        ctaLabel: 'Validar Facturas',
        deepLink: '/tools/cfdi-validator'
    },
    'classify': {
        title: 'Clasificar Movimientos',
        shortDesc: 'Identifica qué gastos son deducibles.',
        whyItMatters: 'Optimiza tu base gravable legalmente.',
        unlocks: 'Habilita el cálculo preliminar de impuestos.',
        ctaLabel: 'Clasificar',
        deepLink: '/tools/classify'
    },
    'reconcile': {
        title: 'Conciliación Bancaria',
        shortDesc: 'Cruza tus bancos contra tus facturas.',
        whyItMatters: 'Asegura que cada peso tenga justificación.',
        unlocks: 'Genera certeza en la estimación fiscal.',
        ctaLabel: 'Conciliar',
        deepLink: '/tools/reconcile'
    },
    'fiscal-preview': {
        title: 'Estimación Fiscal',
        shortDesc: 'Previsualiza tu carga tributaria del mes.',
        whyItMatters: 'Evita sorpresas y planifica tu flujo de caja.',
        unlocks: 'Permite cerrar el mes con seguridad.',
        ctaLabel: 'Ver Estimación',
        deepLink: '/dashboard'
    },
    'backup': {
        title: 'Respaldo y Cierre',
        shortDesc: 'Descarga una copia de seguridad.',
        whyItMatters: 'Tu información es tuya. Asegúrala.',
        unlocks: 'Finaliza el proceso de cierre mensual.',
        ctaLabel: 'Ir a Ajustes',
        deepLink: '/settings'
    }
};

function NextBestActionBanner({ nextStep, month }: { nextStep: JourneyStep, month: string }) {
    const meta = JOURNEY_METADATA[nextStep.id];
    if (!meta) return null;

    const link = meta.deepLink ? `${meta.deepLink}?month=${month}` : null;

    return (
        <div className="mb-8 p-6 rounded-2xl bg-gradient-to-r from-blue-900/40 to-slate-900 border border-blue-500/30 flex items-center justify-between gap-6 shadow-xl shadow-blue-900/10 relative overflow-hidden group">
            <div className="absolute inset-0 bg-blue-500/5 group-hover:bg-blue-500/10 transition-colors" />
            <div className="relative z-10">
                <div className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-1">Siguiente paso recomendado</div>
                <div className="text-2xl font-semibold text-slate-100 mb-2">{meta.title}</div>
                <div className="text-slate-400 text-sm max-w-lg">{meta.shortDesc} <span className="text-slate-500 hidden sm:inline">— {meta.whyItMatters}</span></div>
            </div>
            {link && (
                <Link to={link} className="relative z-10 shrink-0 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-xl shadow-lg shadow-blue-900/20 transition-all hover:scale-105 active:scale-95 flex items-center gap-2">
                    {meta.ctaLabel}
                    <ArrowRight size={18} />
                </Link>
            )}
        </div>
    );
}

export function JourneyCloseMonth() {
    const { month } = useParams<{ month: string }>();
    const { activeProfile } = useProfiles();
    const targetMonth = month || new Date().toISOString().slice(0, 7);

    // Unified Data Source (Snapshot)
    const { snapshot, isLoading: isSnapshotLoading } = useDashboardData(targetMonth);

    const [journey, setJourney] = useState<JourneyState | null>(null);
    const [isLoadingJourney, setIsLoadingJourney] = useState(true);

    // 1. Load Initial State from Store (Once per month/profile)
    useEffect(() => {
        let mounted = true;
        const init = async () => {
            setIsLoadingJourney(true);
            try {
                const j = await journeyStore.getOrCreate(targetMonth);
                if (mounted) setJourney(j);
            } catch (err) {
                console.error("Failed to load journey", err);
            } finally {
                if (mounted) setIsLoadingJourney(false);
            }
        };
        init();
        return () => { mounted = false; };
    }, [targetMonth, activeProfile.id]);

    // 2. React to Snapshot Changes (Derive State)
    useEffect(() => {
        if (!journey || !snapshot || !activeProfile) return;

        // Compute derived state without saving
        // Use functional update to ensure we use latest local journey state as base
        setJourney(current => {
            if (!current) return null;
            // Optimization: We could check if snapshot actually impacts us, 
            // but engine is fast enough.
            // We compare JSON string to avoid render loops if object is identical content-wise but new ref
            const next = journeyEngine.computeDerivedState(current, snapshot, activeProfile);

            if (JSON.stringify(next) !== JSON.stringify(current)) {
                return next;
            }
            return current;
        });
    }, [snapshot, activeProfile]);

    // Manual Action Commit
    const handleToggleStep = async (stepId: string) => {
        if (!journey) return;

        // Toggle status
        const nextSteps = journey.steps.map(s => {
            if (s.id === stepId) {
                return { ...s, status: s.status === 'done' ? 'pending' : 'done' };
            }
            return s;
        });

        const nextJourney = {
            ...journey,
            steps: nextSteps as any,
            updatedAt: new Date().toISOString()
        };

        // Optimistic Update
        setJourney(nextJourney);

        // Commit to Store
        await journeyStore.commit(nextJourney);
    };

    // Feature Flag Check (Profile override)
    if (!isJourneyEnabled(activeProfile)) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
                <div className="max-w-md text-center space-y-4">
                    <div className="inline-flex p-3 rounded-full bg-slate-900 border border-slate-800 text-slate-400">
                        <Lock className="h-6 w-6" />
                    </div>
                    <h1 className="text-xl font-semibold text-slate-100">Journey V1 Deshabilitado</h1>
                    <p className="text-slate-400 text-sm">
                        Esta funcionalidad es experimental. Puedes activarla en Ajustes {'>'} Beta Features.
                    </p>
                    <Link to="/settings" className="inline-block px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-200 text-sm transition-colors">
                        Ir a Ajustes
                    </Link>
                </div>
            </div>
        );
    }

    if ((isSnapshotLoading || isLoadingJourney) && !journey) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    if (!journey) return null;

    const nextAction = journeyEngine.getNextAction(journey);

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
            <header className="border-b border-slate-800/50 bg-slate-900/50 backdrop-blur sticky top-0 z-10">
                <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link to="/dashboard" className="p-2 hover:bg-slate-800 rounded-full text-slate-400 transition-colors">
                            <ArrowLeft size={18} />
                        </Link>
                        <div>
                            <div className="text-xs font-mono text-slate-400 uppercase tracking-widest mb-1">Cierre Mensual</div>
                            <h1 className="text-xl font-semibold text-slate-100 flex items-center gap-2">
                                <span>{targetMonth}</span>
                                {!nextAction && (
                                    <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                        Completado
                                    </span>
                                )}
                            </h1>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-3xl mx-auto px-4 py-8 pb-32">
                {nextAction && <NextBestActionBanner nextStep={nextAction} month={targetMonth} />}

                <div className="space-y-8 relative">
                    <div className="absolute left-6 top-8 bottom-8 w-0.5 bg-slate-800 -z-10" />

                    {journey.steps.map((step) => {
                        const isNext = nextAction?.id === step.id;
                        return (
                            <StepCard
                                key={step.id}
                                step={step}
                                isNext={isNext}
                                month={targetMonth}
                                onToggle={() => handleToggleStep(step.id)}
                            />
                        );
                    })}
                </div>

                {!nextAction && (
                    <div className="mt-12 p-8 border border-emerald-500/20 bg-emerald-900/10 rounded-2xl text-center animate-in fade-in slide-in-from-bottom-4 duration-700">
                        <div className="inline-flex p-4 rounded-full bg-emerald-500/10 mb-4 text-emerald-400">
                            <CheckCircle2 size={32} />
                        </div>
                        <h2 className="text-2xl font-bold text-emerald-400 mb-2">¡Todo listo!</h2>
                        <p className="text-slate-400 max-w-md mx-auto">
                            Has completado todos los pasos para el cierre de este mes. Tu información está al día.
                        </p>
                    </div>
                )}
            </main>
        </div>
    );
}

function StepCard({ step, isNext, month, onToggle }: { step: JourneyStep, isNext: boolean, month: string, onToggle: () => void }) {
    const isDone = step.status === 'done';
    const isBlocked = step.status === 'blocked';
    const isManual = step.id === 'backup';

    const meta = JOURNEY_METADATA[step.id];
    // Fallback if metadata missing
    const title = meta?.title || step.title;
    const desc = isBlocked ? (meta?.unlocks ? `Completa lo anterior. ${meta.unlocks}` : 'Paso bloqueado.') : (meta?.shortDesc || '');
    const ctaLabel = meta?.ctaLabel || 'Comenzar';

    // Construct CTA link from Metadata (Source of Truth)
    const getCtaLink = () => {
        if (!meta?.deepLink) return null;
        if (meta.deepLink.includes('?')) return meta.deepLink;
        return `${meta.deepLink}?month=${month}`;
    };
    const ctaLink = getCtaLink();

    // Visual State Logic
    let Icon = Circle;
    let iconClass = "text-slate-600 bg-slate-950 border-slate-700";
    let cardClass = "bg-slate-900/40 border-slate-800 hover:bg-slate-900/60";
    let titleClass = "text-slate-200";

    if (isDone) {
        Icon = CheckCircle2;
        iconClass = "text-emerald-500 bg-emerald-500/10 border-emerald-500/20";
        titleClass = "text-emerald-400";
    } else if (isBlocked) {
        Icon = Lock;
        iconClass = "text-slate-700 bg-slate-900 border-slate-800";
        cardClass = "opacity-60 grayscale bg-slate-950/50 border-slate-800";
    } else if (isNext) {
        Icon = ArrowRight;
        iconClass = "text-blue-500 bg-blue-500/10 border-blue-500/50";
        cardClass = "bg-slate-900 border-blue-500/30 ring-1 ring-blue-500/20 shadow-xl shadow-black/50";
        titleClass = "text-blue-200";
    } else {
        Icon = Circle;
        titleClass = "text-slate-300";
    }

    return (
        <div className={`relative flex gap-6 ${isBlocked ? '' : ''}`}>
            <div className={`shrink-0 h-12 w-12 rounded-full border-2 flex items-center justify-center z-10 transition-all duration-300 ${iconClass} ${isNext ? 'ring-4 ring-blue-500/10 scale-110' : ''}`}>
                <Icon className={`h-6 w-6 ${isNext ? 'animate-pulse' : ''}`} />
            </div>

            <div className={`flex-1 rounded-xl border p-5 transition-all duration-300 ${cardClass}`}>
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="space-y-1">
                        <h3 className={`font-medium text-lg ${titleClass}`}>
                            {title}
                        </h3>
                        <p className="text-sm text-slate-400 leading-relaxed max-w-xl">
                            {desc}
                        </p>
                        {!isBlocked && !isDone && meta?.whyItMatters && (
                            <p className="text-xs text-slate-500 pt-1 italic">
                                "{meta.whyItMatters}"
                            </p>
                        )}
                        {step.id === 'fiscal-preview' && isBlocked && (
                            <p className="text-xs text-amber-500 mt-2 flex items-center gap-1 font-medium bg-amber-500/10 p-2 rounded border border-amber-500/20 inline-block">
                                <AlertCircle size={12} /> Requiere activar "Motor Fiscal V1" en Ajustes.
                            </p>
                        )}
                    </div>

                    <div className="flex items-center gap-3 shrink-0 pt-2 sm:pt-0">
                        {ctaLink && !isBlocked && !isDone && !isNext && (
                            <Link
                                to={ctaLink}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium border border-slate-700 transition-all hover:text-white"
                            >
                                {ctaLabel}
                            </Link>
                        )}

                        {ctaLink && !isBlocked && !isDone && isNext && (
                            <Link
                                to={ctaLink}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium shadow-lg shadow-blue-900/20 transition-all hover:scale-105 active:scale-95"
                            >
                                {ctaLabel}
                                <ArrowRight className="h-4 w-4" />
                            </Link>
                        )}

                        {isManual && !isBlocked && (
                            <div className="flex gap-2">
                                {ctaLink && (
                                    <Link
                                        to={ctaLink}
                                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium border border-slate-700 transition-all hover:text-white"
                                    >
                                        Ir a Ajustes
                                    </Link>
                                )}
                                <button
                                    onClick={onToggle}
                                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${isDone
                                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20'
                                        : 'bg-slate-100 text-slate-900 hover:bg-white border border-slate-200'}`}
                                >
                                    {isDone ? (
                                        <>
                                            <CheckCircle2 size={16} /> Hecho
                                        </>
                                    ) : (
                                        "Marcar como hecho"
                                    )}
                                </button>
                            </div>
                        )}

                        {isDone && !isManual && (
                            <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-semibold border border-emerald-500/20 flex items-center gap-1">
                                <CheckCircle2 size={12} /> Completado
                            </span>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
