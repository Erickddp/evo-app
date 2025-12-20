export type LibraryNodeType = 'folder' | 'doc';

export type LibraryDocFormat =
    | 'md'
    | 'pdf'
    | 'img'
    | 'txt'
    | 'html';

interface LibraryNodeBase {
    id: string;
    title: string;
    type: LibraryNodeType;
}

export interface LibraryFolderNode extends LibraryNodeBase {
    type: 'folder';
    children: LibraryNode[];
}

export interface LibraryDocNode extends LibraryNodeBase {
    type: 'doc';
    format: LibraryDocFormat;
    url: string;
}

export type LibraryNode = LibraryFolderNode | LibraryDocNode;

export interface LibraryManifest {
    version: number;
    updatedAt?: string;
    root: LibraryNode[];
}
