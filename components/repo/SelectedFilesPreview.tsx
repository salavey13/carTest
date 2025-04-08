// /components/repo/SelectedFilesPreview.tsx
import React from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { FileNode } from '../RepoTxtFetcher'; // Import FileNode interface

interface SelectedFilesPreviewProps {
    selectedFiles: Set<string>;
    allFiles: FileNode[];
    getLanguage: (path: string) => string; // Receive helper function as prop
}

const SelectedFilesPreview: React.FC<SelectedFilesPreviewProps> = ({
    selectedFiles,
    allFiles,
    getLanguage,
}) => {
    // Create a sorted array from the Set for stable rendering order
    const sortedSelectedPaths = Array.from(selectedFiles).sort();

    if (selectedFiles.size === 0) {
        return null; // Don't render if no files selected
    }

    return (
         // *** UPDATED: Removed 'open' prop to make it collapsed by default ***
         <details className="mb-6 bg-gray-800/50 border border-gray-700 p-4 rounded-xl shadow-[0_0_12px_rgba(0,255,157,0.2)]">
            <summary className="text-lg font-bold text-cyan-400 cursor-pointer hover:text-cyan-300 transition-colors">Предпросмотр выбранных файлов ({selectedFiles.size})</summary>
            <div className="mt-3 max-h-96 overflow-y-auto space-y-4 custom-scrollbar">
                {sortedSelectedPaths.map((path) => {
                    const file = allFiles.find((f) => f.path === path);
                    if (!file) return null;
                    const lang = getLanguage(file.path);
                    const isTruncated = file.content.length > 1000;
                    const displayContent = isTruncated ? file.content.substring(0, 1000) + '\n... (содержимое усечено)' : file.content;

                    return (
                        <div key={file.path} className="bg-gray-900 rounded-lg overflow-hidden border border-gray-700/50 shadow-md">
                            <h4 className="text-xs font-bold text-purple-300 px-3 py-1 bg-gray-700/80 truncate" title={file.path}>{file.path}</h4>
                             {/* Use pre/code for better semantics and potential copy/paste */}
                             <pre className="!m-0 !p-0">
                                <SyntaxHighlighter
                                    language={lang}
                                    style={oneDark}
                                    customStyle={{ background: "#111827", padding: "0.75rem", margin: 0, fontSize: "0.75rem", maxHeight: '20rem', overflowY: 'auto' }}
                                    showLineNumbers={true}
                                    wrapLines={true}
                                    lineNumberStyle={{ color: '#5c6370', fontSize: '0.7rem' }} // Style line numbers
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
};

export default SelectedFilesPreview;