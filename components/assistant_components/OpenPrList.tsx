import React from 'react';
import { SimplePullRequest } from '@/contexts/RepoXmlPageContext'; // Import type
import { FaExternalLinkAlt } from 'react-icons/fa'; // Used implicitly

interface OpenPrListProps {
    openPRs: SimplePullRequest[]; // Use the shared type
}

export const OpenPrList: React.FC<OpenPrListProps> = ({ openPRs }) => {
    if (openPRs.length === 0) {
        return null; // Don't render if no open PRs
    }

    return (
        <section className="mb-4 bg-card p-4 rounded-xl shadow-[0_0_12px_hsl(var(--brand-cyan)/0.3)] border border-border"> {/* Use theme colors */}
            <h2 className="text-lg font-semibold text-brand-cyan mb-2"> {/* Use theme color */}
                Открытые Pull Requests ({openPRs.length})
            </h2>
            <ul className="space-y-2 max-h-40 overflow-y-auto pr-2 simple-scrollbar">
                {openPRs.map((pr) => (
                    <li key={pr.id || pr.number} className="bg-muted/50 rounded-md text-sm border border-border shadow-sm hover:bg-muted/70 transition-colors duration-150"> {/* Use theme colors */}
                        <a
                            href={pr.html_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-x-2 gap-y-1 p-2 w-full group" // Added group for hover effect on icon
                            title={`${pr.title}\nBranch: ${pr.head.ref}\nby ${pr.user?.login || 'unknown'}`}
                        >
                            {/* Left side: PR Number and Title */}
                            <div className="flex items-center gap-2 min-w-0 flex-grow basis-3/5 sm:basis-auto"> {/* Allow grow, shrink, basis for wrap */}
                                <span className="text-brand-blue font-medium flex-shrink-0"> {/* Use theme color */}
                                    #{pr.number}:
                                </span>
                                <span className="text-foreground truncate" title={pr.title}> {/* Use theme color */}
                                    {pr.title}
                                </span>
                            </div>

                            {/* Right side: Author and Branch */}
                            <div className="flex items-center gap-2 min-w-0 flex-shrink-0 basis-2/5 sm:basis-auto justify-end w-full sm:w-auto"> {/* Allow shrink, basis for wrap */}
                                <span className="text-xs text-muted-foreground flex-shrink-0"> {/* Use theme color */}
                                    by {pr.user?.login || 'unknown'}
                                </span>
                                <span className="text-xs text-muted-foreground/80 truncate min-w-0" title={`Branch: ${pr.head.ref}`}> {/* Use theme color */}
                                    ({pr.head.ref})
                                </span>
                                {/* Add an external link icon */}
                                {/* <FaExternalLinkAlt className="w-3 h-3 text-muted-foreground/60 ml-1 group-hover:text-brand-blue transition-colors" /> */}
                            </div>
                        </a>
                    </li>
                ))}
            </ul>
        </section>
    );
};
OpenPrList.displayName = 'OpenPrList';