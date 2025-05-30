"use client";

import React from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { FileNode } from '../RepoTxtFetcher'; // Import FileNode interface

interface SelectedFilesPreviewProps {
    selectedFiles: Set<string>;
    allFiles: FileNode[];
    getLanguage: (path: string) => string;
}

// Memoize the component to prevent re-renders if props haven't changed by reference
const SelectedFilesPreview: React.FC<SelectedFilesPreviewProps> = React.memo(({
    selectedFiles,
    allFiles,
    getLanguage,
}) => {
    // Create a sorted array from the Set inside the component
    const sortedSelectedPaths = React.useMemo(() => Array.from(selectedFiles).sort(), [selectedFiles]);

    if (selectedFiles.size === 0) {
        return null;
    }

    return (
         <details className="mb-4 bg-gray-800/50 border border-gray-700 p-3 rounded-lg shadow-inner"> {/* Adjusted styles */}
            <summary className="text-base font-semibold text-cyan-300 cursor-pointer hover:text-cyan-200 transition-colors"> {/* Adjusted styles */}
                Предпросмотр выбранных файлов ({selectedFiles.size})
            </summary>
            <div className="mt-3 max-h-80 overflow-y-auto space-y-3 custom-scrollbar pr-1"> {/* Adjusted max-height, padding */}
                {sortedSelectedPaths.map((path) => {
                    const file = allFiles.find((f) => f.path === path);
                    if (!file) return null;
                    const lang = getLanguage(file.path);
                    // More aggressive truncation for preview
                    const MAX_PREVIEW_LENGTH = 500;
                    const isTruncated = file.content.length > MAX_PREVIEW_LENGTH;
                    const displayContent = isTruncated
                        ? file.content.substring(0, MAX_PREVIEW_LENGTH) + '\n\n... (содержимое усечено для предпросмотра)'
                        : file.content;

                    return (
                        <div key={file.path} className="bg-gray-900/80 rounded-md overflow-hidden border border-gray-700/40 shadow-sm">
                            <h4 className="text-[11px] font-medium text-purple-300 px-2 py-0.5 bg-gray-700/60 truncate" title={file.path}>{file.path}</h4>
                             <pre className="!m-0 !p-0 text-[10px]"> {/* Smaller base font for preview */}
                                <SyntaxHighlighter
                                    language={lang}
                                    style={oneDark}
                                    // Further optimize styles for preview
                                    customStyle={{ background: "transparent", padding: "0.5rem 0.75rem", margin: 0, maxHeight: '15rem', overflowY: 'auto' }}
                                    showLineNumbers={true}
                                    wrapLines={true}
                                    lineNumberStyle={{ color: '#5c6370', fontSize: '0.6rem', minWidth: '2.0em', paddingRight: '0.5em' }} // Adjusted line number style
                                >
                                    {displayContent}
                                </SyntaxHighlighter>
                             </pre>
                        </div>
                    );
                })}
            </div>
        </details>
    );
});
SelectedFilesPreview.displayName = 'SelectedFilesPreview'; // Add display name

export default SelectedFilesPreview;