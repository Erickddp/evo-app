import React, { useState } from 'react';
import type { LibraryNode } from '../types';

interface TreeNodeProps {
    node: LibraryNode;
    onSelect: (url: string) => void;
    selectedUrl: string | null;
    depth?: number;
}

const TreeNode: React.FC<TreeNodeProps> = ({ node, onSelect, selectedUrl, depth = 0 }) => {
    const [isOpen, setIsOpen] = useState(false);

    const isFolder = node.type === 'folder';
    const isSelected = !isFolder && node.url === selectedUrl;

    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (node.type === 'folder') {
            setIsOpen(!isOpen);
        } else {
            onSelect(node.url);
        }
    };

    return (
        <div className="select-none">
            <div
                className={`
          flex items-center py-1 px-2 cursor-pointer transition-colors duration-150
          ${isSelected ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-100' : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'}
        `}
                style={{ paddingLeft: `${depth * 1.5 + 0.5}rem` }}
                onClick={handleClick}
            >
                <span className="mr-2 opacity-70">
                    {isFolder ? (isOpen ? '📂' : '📁') : '📄'}
                </span>
                <span className="text-sm truncate">{node.title}</span>
            </div>

            {isFolder && isOpen && node.children && (
                <div>
                    {node.children.map(child => (
                        <TreeNode
                            key={child.id}
                            node={child}
                            onSelect={onSelect}
                            selectedUrl={selectedUrl}
                            depth={depth + 1}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

interface LibraryTreeProps {
    data: LibraryNode[];
    onSelect: (url: string) => void;
    selectedUrl: string | null;
}

export const LibraryTree: React.FC<LibraryTreeProps> = ({ data, onSelect, selectedUrl }) => {
    return (
        <div className="w-full h-full overflow-y-auto pb-4">
            {data.map(node => (
                <TreeNode
                    key={node.id}
                    node={node}
                    onSelect={onSelect}
                    selectedUrl={selectedUrl}
                />
            ))}
        </div>
    );
};
