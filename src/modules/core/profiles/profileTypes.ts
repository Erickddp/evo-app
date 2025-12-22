export type EvoProfile = {
    id: string;          // "raquel", "amalia", "daniel" o UUID
    name: string;        // "Raquel Hilario"
    color?: string;      // opcional para UI
    drivePrefix: string; // "evoapp_raquel" (para nombres de archivos en Drive)
    dbPrefix: string;    // "raquel" (para namespace local)
    createdAt: string;
    lastOpenedAt?: string;
    // Fiscal Profile
    taxRegime?: 'PM' | 'PF_RESICO'; // Obligatorio para operación, pero opcional en tipos viejos migrados
    taxYear?: number;
    periodicity?: 'monthly';
    featureFlags?: {
        journeyV1?: boolean;
        taxEngineV1?: boolean;
    };
    rfc?: string; // RFC for SAT Import Classification
};
