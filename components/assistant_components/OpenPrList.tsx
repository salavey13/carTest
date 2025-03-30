import React from 'react';

interface OpenPrListProps {
    openPRs: any[]; // Use more specific type if available from Octokit
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
                            by {pr.user?.login}
                        </span>
                    </li>
                ))}
            </ul>
        </section>
    );
};
OpenPrList.displayName = 'OpenPrList';