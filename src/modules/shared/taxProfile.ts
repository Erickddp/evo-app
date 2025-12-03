export type TaxProfile = {
    id: string;               // único
    nombre: string;           // nombre de la persona o representante
    razonSocial: string;      // razón social / nombre completo
    rfc: string;
    tipoPersona: "PF" | "PM";
    regimenFiscal:
    | "PF_RESICO"
    | "PM_RESICO"
    | "PF_ACT_EMPRESARIAL"
    | "PM_GENERAL";

    createdAt: string;
    updatedAt: string;
};
