// /components/assistant_components/OpenPrList.tsx
import React from 'react';
import { SimplePullRequest } from '@/contexts/RepoXmlPageContext'; // Import type

interface OpenPrListProps {
    openPRs: SimplePullRequest[]; // Use the shared type
}

export const OpenPrList: React.FC<OpenPrListProps> = ({ openPRs }) => {
    if (openPRs.length === 0) {
        return null; // Don't render if no open PRs
    }

    return (
        <section className="mb-4 bg-gray-800 p-4 rounded-xl shadow-[0_0_12px_rgba(0,255,157,0.3)]">
            <h2 className="text-lg font-semibold text-cyan-400 mb-2">
                Открытые Pull Requests ({openPRs.length})
            </h2>
            <ul className="space-y-2 max-h-40 overflow-y-auto pr-2 simple-scrollbar">
                {openPRs.map((pr) => (
                    <li key={pr.id || pr.number} className="flex items-center gap-2 bg-gray-900 p-2 rounded text-sm border border-gray-700 shadow-sm">
                        <a href={pr.html_url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline truncate flex-grow" title={pr.title}>
                            #{pr.number}: {pr.title}
                        </a>
                        <span className="text-xs text-gray-500 ml-auto flex-shrink-0">
                            by {pr.user?.login || 'unknown'}
                        </span>
                         {/* Display branch if needed for context */}
                         <span className="text-xs text-gray-600 ml-1 flex-shrink-0 truncate" title={`Branch: ${pr.head.ref}`}>({pr.head.ref})</span>
                    </li>
                ))}
            </ul>
        </section>
    );
};
OpenPrList.displayName = 'OpenPrList';