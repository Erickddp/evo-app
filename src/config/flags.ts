/**
 * Feature Flags Configuration
 * 
 * Defines global feature flags for controlled rollout and rebase.
 * 
 * Current defaults:
 * - Legacy data writes are DISABLED (Read-Only) to prevent drift during rebase.
 * - New Journey V1 is DISABLED.
 * - New Tax Engine V1 is DISABLED.
 */

export const FLAGS = {
    // If true, writing to legacy data stores (e.g. dataStore.saveRecord) should be prevented/no-op
    ENABLE_LEGACY_READONLY: true,

    // If true, enables access to the new Journey V1 features
    ENABLE_JOURNEY_V1: false,

    // If true, enables the new Tax Engine logic/calculations
    ENABLE_TAX_ENGINE_V1: false,
} as const;

// Profile partial type to avoid circular dependency
type ProfileWithFlags = { featureFlags?: { journeyV1?: boolean; taxEngineV1?: boolean } };

export const isLegacyReadonly = (): boolean => FLAGS.ENABLE_LEGACY_READONLY;

export const isJourneyEnabled = (profile?: ProfileWithFlags): boolean => {
    if (profile?.featureFlags?.journeyV1 !== undefined) return profile.featureFlags.journeyV1;
    return FLAGS.ENABLE_JOURNEY_V1;
};

export const isTaxEngineEnabled = (profile?: ProfileWithFlags): boolean => {
    if (profile?.featureFlags?.taxEngineV1 !== undefined) return profile.featureFlags.taxEngineV1;
    return FLAGS.ENABLE_TAX_ENGINE_V1;
};
