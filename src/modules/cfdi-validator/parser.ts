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
}

export function parseCfdiXml(xmlContent: string, fileName: string): CfdiSummary {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlContent, "text/xml");

    // Check for parsing errors
    const parserError = xmlDoc.getElementsByTagName("parsererror");
    if (parserError.length > 0) {
        throw new Error(`Error parsing XML file: ${fileName}`);
    }

    // Helper to get attribute from node (handling namespaces loosely if needed, but standard DOM methods usually work)
    // We will look for elements by tag name, ignoring namespace prefix if possible or using getElementsByTagNameNS if we knew the exact NS URI.
    // Since NS URIs can vary (though standard), simple getElementsByTagName is often enough if we just want the local name, 
    // but in XML with namespaces, getElementsByTagName("cfdi:Comprobante") might not work in all browsers/modes same way.
    // However, standard practice for CFDI is usually strict. Let's try to be robust.
    // A robust way without hardcoding NS URIs for every single tag is to search by local name or try both prefixed and non-prefixed.
    // But standard DOM `getElementsByTagName` returns all elements with the given tag name. 
    // In HTML documents invoke it with lower case, in XML it is case-sensitive.
    // CFDI tags are usually PascalCase (Comprobante, Emisor, etc).

    // Let's try to find the root Comprobante
    let comprobante = xmlDoc.getElementsByTagName("cfdi:Comprobante")[0];
    if (!comprobante) {
        // Fallback: try without prefix or with different prefix if user has weird XML
        // But strictly speaking valid CFDI uses cfdi:Comprobante. 
        // Let's try local name check if standard fails.
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

    const getAttr = (el: Element, name: string) => el.getAttribute(name) || undefined;

    // Comprobante attributes
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

    // TimbreFiscalDigital (usually in Complemento)
    // Namespace is usually tfd
    let timbre = xmlDoc.getElementsByTagName("tfd:TimbreFiscalDigital")[0];
    if (!timbre) {
        // Try finding by localName "TimbreFiscalDigital"
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

    return summary;
}
