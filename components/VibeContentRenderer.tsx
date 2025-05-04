"use client";

import React from 'react';
import parse, { domToReact, HTMLReactParserOptions, Element, attributesToProps } from 'html-react-parser';
import Link from 'next/link';
import * as Fa6Icons from "react-icons/fa6";
import { debugLogger as logger } from "@/lib/debugLogger";

// Type guard to check if a key exists on the Fa6Icons object
function isValidFa6Icon(iconName: string): iconName is keyof typeof Fa6Icons {
    // Ensure it starts with Fa and exists in the Fa6Icons object
    // Added explicit check for string type for robustness
    return typeof iconName === 'string' && iconName.startsWith('Fa') && iconName in Fa6Icons;
}

// Robust Parser Options - Centralized Logic
const robustParserOptions: HTMLReactParserOptions = {
    replace: (domNode) => {
        if (domNode instanceof Element && domNode.attribs) {
            const { name, attribs, children } = domNode; // Use original name first
            const props = attributesToProps(attribs); // Convert HTML attributes to React props
            const lowerCaseName = name?.toLowerCase(); // Keep for other checks like 'a'

            try { // Add a top-level try-catch for the replacer logic

                // --- Icon Handling (Revised Logic) ---
                // 1. Check if the *original* name is a valid PascalCase icon from Fa6Icons
                if (isValidFa6Icon(name)) {
                    const IconComponent = Fa6Icons[name];
                    try {
                        // logger.debug(`[VibeContentRenderer] Rendering VALID icon: <${name}>`);
                        const { class: className, style, ...restProps } = props;
                        // Filter potentially unsafe props
                        const safeProps = Object.entries(restProps).reduce((acc, [key, value]) => {
                            if (typeof value === 'string' || typeof value === 'number' || key === 'title' || key.startsWith('aria-')) {
                                acc[key] = value;
                            }
                            return acc;
                        }, {} as Record<string, any>);

                        const parsedChildren = children && domNode.children.length > 0 ? domToReact(children, robustParserOptions) : null;
                        const finalProps: Record<string, any> = { ...safeProps };
                        if (className) finalProps.className = className;
                        if (style) finalProps.style = style;

                        // Render the valid icon component
                        return React.createElement(IconComponent, finalProps, parsedChildren);
                    } catch (iconRenderError: any) {
                        // Error during rendering even if the component was found
                        logger.error(`[VibeContentRenderer] Error rendering VALID icon <${name}>!`, iconRenderError, { props });
                        return <span title={`Error rendering icon: ${name}`} className="text-red-500 font-bold">[ICON ERR!]</span>;
                    }
                }
                // 2. If original name is NOT valid, check if lowercase starts with 'fa'
                // This catches cases where the input was <facopy> or the parser lowercased <FaCopy>
                else if (lowerCaseName?.startsWith('fa')) {
                     // --- POTENTIALLY LOWERCASED or INVALID ICON ---
                     // Log a specific warning about the likely cause
                     logger.warn(`[VibeContentRenderer] Invalid/Unknown icon tag detected. Original name received by parser: <${name}>. This is likely because the tag was typed in lowercase (e.g., <facopy>) instead of PascalCase (e.g., <FaCopy>), or it's not a valid Fa6 icon. Skipping render.`);
                     // Return a placeholder instead of crashing
                     return <span title={`Unknown or lowercase icon: ${name}`} className="text-yellow-500 font-bold">[?]</span>;
                }
                // --- End Icon Handling ---


                // --- Link Handling (Keep as is) ---
                if (lowerCaseName === 'a') {
                    const isInternal = props.href && (props.href.startsWith('/') || props.href.startsWith('#'));
                    const parsedChildren = children ? domToReact(children, robustParserOptions) : null;

                    if (isInternal && !props.target && props.href) {
                        try {
                           const { class: className, style, ...linkProps } = props;
                           return <Link href={props.href} {...linkProps} className={className} style={style}>{parsedChildren}</Link>;
                        } catch (linkError) {
                            logger.error("[VibeContentRenderer] Error creating Next Link:", linkError, props);
                            return <a {...props}>{parsedChildren}</a>; // Fallback
                        }
                    } else {
                        return <a {...props}>{parsedChildren}</a>;
                    }
                }
                // --- End Link Handling ---

                // --- Standard HTML Elements (Keep as is) ---
                const knownTags = /^(p|div|span|ul|ol|li|h[1-6]|strong|em|b|i|u|s|code|pre|blockquote|hr|br|img|table|thead|tbody|tr|th|td)$/;
                if (typeof lowerCaseName === 'string' && knownTags.test(lowerCaseName)) {
                   try {
                        const childrenToRender = children ? domToReact(children, robustParserOptions) : null;
                        if (lowerCaseName === 'br' || lowerCaseName === 'hr' || lowerCaseName === 'img') {
                             return React.createElement(lowerCaseName, props);
                        } else {
                            return React.createElement(lowerCaseName, props, childrenToRender);
                        }
                   } catch (createElementError) {
                       logger.error(`[VibeContentRenderer] Error React.createElement for <${lowerCaseName}>:`, createElementError, { props });
                       return <>{children ? domToReact(children, robustParserOptions) : null}</>;
                   }
               }
                // --- End Standard HTML Elements ---


            } catch (replaceError: any) {
                 logger.error("[VibeContentRenderer] Error in replace function:", replaceError, { name, attribs });
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
      // Wrap with a div if className is provided, otherwise use React Fragment
      const ParsedComponent = () => parse(content, robustParserOptions);
      // logger.debug("[VibeContentRenderer] Parsing successful."); // Less verbose log
      return className ? <div className={className}><ParsedComponent /></div> : <><ParsedComponent /></>;
    } catch (error) {
      logger.error("[VibeContentRenderer] Error during parse:", error, "Input:", content);
      // Return the error message wrapped in the optional className div/span
      const ErrorSpan = () => <span className="text-red-500">[Parse Error]</span>;
      return className ? <div className={className}><ErrorSpan /></div> : <ErrorSpan />;
    }
});

VibeContentRenderer.displayName = 'VibeContentRenderer';

export default VibeContentRenderer;