export type EvoProfile = {
    id: string;          // "raquel", "amalia", "daniel" o UUID
    name: string;        // "Raquel Hilario"
    color?: string;      // opcional para UI
    drivePrefix: string; // "evoapp_raquel" (para nombres de archivos en Drive)
    dbPrefix: string;    // "raquel" (para namespace local)
    createdAt: string;
    lastOpenedAt?: string;
};
