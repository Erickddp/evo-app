import React from 'react';
import {
    Folder,
    FileText,
    FileSpreadsheet,
    Image as ImageIcon,
    File as FileIcon
} from 'lucide-react';
import type { LibraryItem } from '../providers/types';

export const normalize = (str: string) =>
    str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export const getIconForType = (type: string, ext?: string) => {
    if (type === 'folder') return <Folder className="text-blue-500" />;
    const e = ext?.toLowerCase();
    if (e === 'pdf') return <FileText className="text-red-500" />;
    if (e === 'xlsx' || e === 'xls') return <FileSpreadsheet className="text-green-600" />;
    if (e === 'docx' || e === 'doc') return <FileText className="text-blue-600" />;
    if (e === 'png' || e === 'jpg' || e === 'jpeg' || e === 'webp') return <ImageIcon className="text-purple-500" />;
    return <FileIcon className="text-gray-500" />;
};

export const getTypeName = (type: string, ext?: string) => {
    if (type === 'folder') return 'Carpeta';
    if (ext) return ext.toUpperCase();
    return 'Archivo';
};

export const generateFallbackSummary = (item: LibraryItem) => {
    return `${getTypeName(item.type, item.ext)} ubicado en ${item.path}`;
};
