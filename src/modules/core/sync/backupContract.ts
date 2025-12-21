export type EvoappBackupManifest = {
    schemaVersion: 1;
    app: "EVOAPP";
    createdAt: string; // ISO
    source: "web";
    stores: Array<{
        toolId: string;
        count: number;
        format: "ndjson"; // future: json
        filename: string; // e.g: "tool_facturas.ndjson"
    }>;
};
export type EvoappBackupManifestV2 = {
    schemaVersion: 2;
    app: "EVOAPP";
    createdAt: string;
    source: "web";
    stores: Array<{
        storeKey: string;
        count: number;
        filename: string; // evoapp_store_<key>.ndjson.gz
        format: "ndjson+gzip";
    }>;
};
