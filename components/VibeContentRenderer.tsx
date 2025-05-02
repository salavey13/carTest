"use client";

import React from 'react';
import parse, { domToReact, HTMLReactParserOptions, Element, attributesToProps } from 'html-react-parser';
import Link from 'next/link';
import * as Fa6Icons from "react-icons/fa6";
import { debugLogger as logger } from "@/lib/debugLogger";

// Type guard to check if a key exists on the Fa6Icons object
function isValidFa6Icon(iconName: string): iconName is keyof typeof Fa6Icons {
    if (!iconName || !iconName.startsWith('Fa')) return false;
    // Direct check against the imported module
    return iconName in Fa6Icons;
}

// Robust Parser Options - Centralized Logic
const robustParserOptions: HTMLReactParserOptions = {
    replace: (domNode) => {
        if (domNode instanceof Element && domNode.attribs) {
            const { name, attribs, children } = domNode;
            const lowerCaseName = name?.toLowerCase();
            const props = attributesToProps(attribs); // Convert HTML attributes to React props

            try { // Add a top-level try-catch for the replacer logic
                // --- Icon Handling ---
                if (lowerCaseName && lowerCaseName.startsWith('fa')) {
                    const iconComponentName = name; // Use original name for case sensitivity

                    if (isValidFa6Icon(iconComponentName)) {
                        const IconComponent = Fa6Icons[iconComponentName];
                        try {
                            // logger.debug(`[VibeContentRenderer] Rendering icon: <${iconComponentName}>`); // Less verbose log
                            const { class: className, ...restProps } = props; // Allow className
                            const parsedChildren = children && domNode.children.length > 0 ? domToReact(children, robustParserOptions) : null;
                            return React.createElement(IconComponent, { className: className ?? '', ...restProps }, parsedChildren);
                        } catch (iconRenderError: any) {
                            logger.error(`[VibeContentRenderer] Error rendering VALID icon <${iconComponentName}>!`, iconRenderError, { props });
                            return <span title={`Error rendering icon: ${iconComponentName}`} className="text-red-500 font-bold">[ICON ERR!]</span>;
                        }
                    } else {
                        // --- HALLUCINATED ICON DETECTED ---
                        logger.warn(`[VibeContentRenderer] Invalid/Unknown icon tag found: <${iconComponentName}>. Skipping render.`);
                        return <span title={`Unknown icon: ${iconComponentName}`} className="text-yellow-500 font-bold">[?]</span>; // Placeholder
                    }
                }
                // --- End Icon Handling ---

                // --- Link Handling ---
                if (lowerCaseName === 'a') {
                    const isInternal = props.href && (props.href.startsWith('/') || props.href.startsWith('#'));
                    const parsedChildren = children ? domToReact(children, robustParserOptions) : null;

                    if (isInternal && !props.target && props.href) {
                        try {
                           const { class: className, style, ...linkProps } = props;
                           // logger.debug("[VibeContentRenderer] Creating Next Link:", props.href); // Less verbose log
                           return <Link href={props.href} {...linkProps} className={className} style={style}>{parsedChildren}</Link>;
                        } catch (linkError) {
                            logger.error("[VibeContentRenderer] Error creating Next Link:", linkError, props);
                            return <a {...props}>{parsedChildren}</a>; // Fallback
                        }
                    } else {
                        // logger.debug("[VibeContentRenderer] Creating external/non-Next link:", props.href); // Less verbose log
                        return <a {...props}>{parsedChildren}</a>;
                    }
                }
                // --- End Link Handling ---

                // --- Standard HTML Elements (General Fallback) ---
                const knownTags = /^(p|div|span|ul|ol|li|h[1-6]|strong|em|b|i|u|s|code|pre|blockquote|hr|br)$/;
                if (typeof lowerCaseName === 'string' && knownTags.test(lowerCaseName)) {
                    try {
                         // logger.debug(`[VibeContentRenderer] Creating standard element: <${lowerCaseName}>`); // Less verbose log
                         return React.createElement(lowerCaseName!, props, children ? domToReact(children, robustParserOptions) : undefined);
                    } catch (createElementError) {
                        logger.error(`[VibeContentRenderer] Error React.createElement for <${lowerCaseName}>:`, createElementError);
                        return <>{children ? domToReact(children, robustParserOptions) : null}</>;
                    }
                }
                 // --- End Standard HTML Elements ---

            } catch (replaceError: any) {
                 logger.error("[VibeContentRenderer] Error in replace function:", replaceError, { name, attribs });
                 // Return a fallback or skip the node to prevent crash
                 return <span title={`Error processing element: ${name}`} className="text-red-500">[PROCESS ERR]</span>;
            }
        }
        // Let the library handle text nodes and other defaults
        return undefined;
    },
};

// The Component Itself
interface VibeContentRendererProps {
  content: string | null | undefined;
  className?: string; // Optional className for the wrapper
}

export const VibeContentRenderer: React.FC<VibeContentRendererProps> = React.memo(({ content, className }) => {
    // logger.debug("[VibeContentRenderer] Rendering content:", content ? content.substring(0, 50) + "..." : "null/undefined"); // Less verbose log

    if (typeof content !== 'string' || !content.trim()) {
        // logger.debug("[VibeContentRenderer] Null or empty content, returning null.");
        return null;
    }

    try {
      const parsedContent = parse(content, robustParserOptions);
      // logger.debug("[VibeContentRenderer] Parsing successful."); // Less verbose log
      return className ? <div className={className}>{parsedContent}</div> : <>{parsedContent}</>;
    } catch (error) {
      logger.error("[VibeContentRenderer] Error during parse:", error, "Input:", content);
      return <span className={`text-red-500 ${className ?? ''}`}>[Parse Error]</span>;
    }
});

VibeContentRenderer.displayName = 'VibeContentRenderer';

export default VibeContentRenderer;