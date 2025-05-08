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
                    <li key={pr.id || pr.number} className="bg-gray-900 rounded-md text-sm border border-gray-700 shadow-sm hover:bg-gray-700/60 transition-colors duration-150">
                        <a
                            href={pr.html_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-x-2 gap-y-1 p-2 w-full" // Use flex-wrap for very small screens
                            title={`${pr.title}\nBranch: ${pr.head.ref}\nby ${pr.user?.login || 'unknown'}`}
                        >
                            {/* Left side: PR Number and Title */}
                            <div className="flex items-center gap-2 min-w-0 flex-grow basis-3/5 sm:basis-auto"> {/* Allow grow, shrink, basis for wrap */}
                                <span className="text-blue-400 font-medium flex-shrink-0">
                                    #{pr.number}:
                                </span>
                                <span className="text-gray-200 truncate" title={pr.title}>
                                    {pr.title}
                                </span>
                            </div>

                            {/* Right side: Author and Branch */}
                            <div className="flex items-center gap-2 min-w-0 flex-shrink-0 basis-2/5 sm:basis-auto justify-end w-full sm:w-auto"> {/* Allow shrink, basis for wrap */}
                                <span className="text-xs text-gray-500 flex-shrink-0">
                                    by {pr.user?.login || 'unknown'}
                                </span>
                                <span className="text-xs text-gray-600 truncate min-w-0" title={`Branch: ${pr.head.ref}`}> {/* Allow truncate */}
                                    ({pr.head.ref})
                                </span>
                            </div>
                        </a>
                    </li>
                ))}
            </ul>
        </section>
    );
};
OpenPrList.displayName = 'OpenPrList';