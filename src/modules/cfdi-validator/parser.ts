export interface CfdiSummary {
    fileName: string;
    uuid?: string;
    serie?: string;
    folio?: string;
    fecha?: string;
    emisorRfc?: string;
    emisorNombre?: string;
    receptorRfc?: string;
    receptorNombre?: string;
    usoCfdi?: string;
    formaPago?: string;
    metodoPago?: string;
    moneda?: string;
    subtotal?: string;
    total?: string;
    tipoComprobante?: string;
    // New fields
    type: 'Emitted' | 'Received' | 'Unknown';
    status: 'Valid' | 'Invalid'; // Simple status based on parsing success
    conceptCount: number;
    totalImpuestosTrasladados: number;
    totalImpuestosRetenidos: number;
}

export function parseCfdiXml(xmlContent: string, fileName: string, targetRfc?: string): CfdiSummary {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlContent, "text/xml");

    // Check for parsing errors
    const parserError = xmlDoc.getElementsByTagName("parsererror");
    if (parserError.length > 0) {
        throw new Error(`Error parsing XML file: ${fileName}`);
    }

    // Helper to get attribute from node
    const getAttr = (el: Element, name: string) => el.getAttribute(name) || undefined;

    // Root Comprobante
    let comprobante = xmlDoc.getElementsByTagName("cfdi:Comprobante")[0];
    if (!comprobante) {
        // Fallback for local name
        const all = xmlDoc.getElementsByTagName("*");
        for (let i = 0; i < all.length; i++) {
            if (all[i].localName === "Comprobante") {
                comprobante = all[i];
                break;
            }
        }
    }

    if (!comprobante) {
        throw new Error("Missing <cfdi:Comprobante> node");
    }

    const summary: CfdiSummary = {
        fileName,
        serie: getAttr(comprobante, "Serie"),
        folio: getAttr(comprobante, "Folio"),
        fecha: getAttr(comprobante, "Fecha"),
        subtotal: getAttr(comprobante, "SubTotal"),
        total: getAttr(comprobante, "Total"),
        moneda: getAttr(comprobante, "Moneda"),
        tipoComprobante: getAttr(comprobante, "TipoDeComprobante"),
        formaPago: getAttr(comprobante, "FormaPago"),
        metodoPago: getAttr(comprobante, "MetodoPago"),
        type: 'Unknown',
        status: 'Valid',
        conceptCount: 0,
        totalImpuestosTrasladados: 0,
        totalImpuestosRetenidos: 0
    };

    // Emisor
    let emisor = xmlDoc.getElementsByTagName("cfdi:Emisor")[0];
    if (!emisor) {
        const all = xmlDoc.getElementsByTagName("*");
        for (let i = 0; i < all.length; i++) {
            if (all[i].localName === "Emisor") {
                emisor = all[i];
                break;
            }
        }
    }
    if (emisor) {
        summary.emisorRfc = getAttr(emisor, "Rfc");
        summary.emisorNombre = getAttr(emisor, "Nombre");
    }

    // Receptor
    let receptor = xmlDoc.getElementsByTagName("cfdi:Receptor")[0];
    if (!receptor) {
        const all = xmlDoc.getElementsByTagName("*");
        for (let i = 0; i < all.length; i++) {
            if (all[i].localName === "Receptor") {
                receptor = all[i];
                break;
            }
        }
    }
    if (receptor) {
        summary.receptorRfc = getAttr(receptor, "Rfc");
        summary.receptorNombre = getAttr(receptor, "Nombre");
        summary.usoCfdi = getAttr(receptor, "UsoCFDI");
    }

    // Classification Logic
    if (targetRfc) {
        const normalizedTarget = targetRfc.toUpperCase().trim();
        const emisorRfc = summary.emisorRfc?.toUpperCase().trim();
        const receptorRfc = summary.receptorRfc?.toUpperCase().trim();

        if (emisorRfc === normalizedTarget) {
            summary.type = 'Emitted';
        } else if (receptorRfc === normalizedTarget) {
            summary.type = 'Received';
        }
    }

    // Concepts Count
    let conceptos = xmlDoc.getElementsByTagName("cfdi:Conceptos")[0];
    if (!conceptos) {
        const all = xmlDoc.getElementsByTagName("*");
        for (let i = 0; i < all.length; i++) {
            if (all[i].localName === "Conceptos") {
                conceptos = all[i];
                break;
            }
        }
    }
    if (conceptos) {
        summary.conceptCount = conceptos.children.length; // Approximate count of Concepto children
    }

    // TimbreFiscalDigital
    let timbre = xmlDoc.getElementsByTagName("tfd:TimbreFiscalDigital")[0];
    if (!timbre) {
        const all = xmlDoc.getElementsByTagName("*");
        for (let i = 0; i < all.length; i++) {
            if (all[i].localName === "TimbreFiscalDigital") {
                timbre = all[i];
                break;
            }
        }
    }
    if (timbre) {
        summary.uuid = getAttr(timbre, "UUID");
    }

    // Impuestos (Global totals usually in cfdi:Impuestos at root level, not concept level)
    // Note: There can be multiple Impuestos nodes (one inside Comprobante, others inside Concepto).
    // We want the one that is a direct child of Comprobante or at least not inside Conceptos.
    // A simple heuristic: find cfdi:Impuestos that has TotalImpuestosTrasladados or TotalImpuestosRetenidos attributes.

    const impuestosNodes = xmlDoc.getElementsByTagName("cfdi:Impuestos");
    for (let i = 0; i < impuestosNodes.length; i++) {
        const node = impuestosNodes[i];
        // Check if this node belongs to Comprobante (parent is Comprobante)
        // In DOMParser, we can check parentNode.
        if (node.parentNode?.nodeName === "cfdi:Comprobante" || node.parentNode?.localName === "Comprobante") {
            const trasladados = getAttr(node, "TotalImpuestosTrasladados");
            const retenidos = getAttr(node, "TotalImpuestosRetenidos");

            if (trasladados) summary.totalImpuestosTrasladados = parseFloat(trasladados);
            if (retenidos) summary.totalImpuestosRetenidos = parseFloat(retenidos);
            break; // Found the global tax summary
        }
    }

    return summary;
}
