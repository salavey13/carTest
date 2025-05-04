"use client";

import React from 'react';
import parse, { domToReact, HTMLReactParserOptions, Element, attributesToProps } from 'html-react-parser';
import Link from 'next/link';
import * as Fa6Icons from "react-icons/fa6";
import { debugLogger as logger } from "@/lib/debugLogger";

// Type guard to check if a key exists on the Fa6Icons object
function isValidFa6Icon(iconName: string): iconName is keyof typeof Fa6Icons {
    // Ensure it starts with Fa and exists in the Fa6Icons object
    return typeof iconName === 'string' && iconName.startsWith('Fa') && iconName in Fa6Icons;
}

// Function to attempt PascalCase reconstruction from lowercase fa* tags
function reconstructPascalCase(lowerCaseName: string): string | null {
    if (typeof lowerCaseName !== 'string' || !lowerCaseName.startsWith('fa') || lowerCaseName.length <= 2) {
        // logger.debug(`[reconstructPascalCase] Input '${lowerCaseName}' is not a candidate.`);
        return null; // Not a candidate for reconstruction
    }
    // Simple rule: Fa + Uppercase(3rd char) + rest
    // Example: 'facopy' -> 'Fa' + 'C' + 'opy' = 'FaCopy'
    // Example: 'faangleup' -> 'Fa' + 'A' + 'ngleup' = 'FaAngleUp'
    // Example: 'fa6' -> 'Fa' + '6' + '' = 'Fa6' (handles single char after fa)
    // Example: faarrowuprightfromsquare -> FaArrowuprightfromsquare (This is the limitation, needs manual check/mapping for multi-word)
    // Example: faimagereplacetask -> FaImagereplacetask
    const thirdChar = lowerCaseName.charAt(2);
    if (!thirdChar) return null; // Should not happen if length > 2, but safety first
    const restOfString = lowerCaseName.substring(3);
    const reconstructed = `Fa${thirdChar.toUpperCase()}${restOfString}`;
    // logger.debug(`[reconstructPascalCase] Reconstructed '${lowerCaseName}' -> '${reconstructed}'`);
    return reconstructed;
}


// Robust Parser Options - Centralized Logic
const robustParserOptions: HTMLReactParserOptions = {
    replace: (domNode) => {
        if (domNode instanceof Element && domNode.attribs) {
            const { name, attribs, children } = domNode; // 'name' might be lowercased by the parser
            const props = attributesToProps(attribs);
            const lowerCaseName = name?.toLowerCase(); // Ensure we always have the lowercase version

            try { // Top-level try-catch

                // --- Icon Handling (NEW Logic: Reconstruct PascalCase) ---
                if (lowerCaseName?.startsWith('fa')) {
                    const reconstructedName = reconstructPascalCase(lowerCaseName);

                    if (reconstructedName && isValidFa6Icon(reconstructedName)) {
                        // Successfully reconstructed and validated a Fa6 icon
                        const IconComponent = Fa6Icons[reconstructedName];
                        try {
                            // logger.debug(`[VibeContentRenderer] Rendering RECONSTRUCTED icon: <${lowerCaseName}> -> <${reconstructedName}>`);
                            const { class: className, style, onClick, ...restProps } = props; // Explicitly ignore onClick from attributes

                            // Filter potentially unsafe props (keep simple ones + aria/data)
                            const safeProps = Object.entries(restProps).reduce((acc, [key, value]) => {
                                if (key.startsWith('aria-') || key.startsWith('data-') || key === 'title' || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
                                     acc[key] = value;
                                }
                                return acc;
                            }, {} as Record<string, any>);


                            const parsedChildren = children && domNode.children.length > 0 ? domToReact(children, robustParserOptions) : null;
                            const finalProps: Record<string, any> = { ...safeProps };
                             if (className) finalProps.className = className as string; // Convert class -> className

                             // Parse inline style string into an object if it exists
                            if (typeof style === 'string') {
                               try {
                                  const styleObject = style.split(';').reduce((acc, stylePart) => {
                                    const [key, value] = stylePart.split(':');
                                    if (key && value) {
                                      const camelCaseKey = key.trim().replace(/-([a-z])/g, (g) => g[1].toUpperCase());
                                      acc[camelCaseKey] = value.trim();
                                    }
                                    return acc;
                                  }, {} as React.CSSProperties);
                                  finalProps.style = styleObject;
                                } catch (styleParseError){
                                    logger.error(`[VibeContentRenderer] Error parsing inline style string for <${lowerCaseName}>:`, style, styleParseError);
                               }
                            } else if (typeof style === 'object' && style !== null) { // Handle if style is already object (less likely from parser)
                                finalProps.style = style;
                            }


                            // Render the valid icon component
                            return React.createElement(IconComponent, finalProps, parsedChildren);
                        } catch (iconRenderError: any) {
                            logger.error(`[VibeContentRenderer] Error rendering RECONSTRUCTED icon <${reconstructedName}>!`, iconRenderError, { props });
                            return <span title={`Error rendering icon: ${reconstructedName}`} className="text-red-500 font-bold">[ICON ERR!]</span>;
                        }
                    } else {
                        // Reconstruction failed or resulted in an invalid/unknown icon name
                        logger.warn(`[VibeContentRenderer] Invalid/Unknown icon tag detected or reconstruction failed. Original name: <${name}>, Lowercase: <${lowerCaseName}>, Reconstructed: ${reconstructedName || 'N/A'}. Skipping render.`);
                        return <span title={`Unknown or invalid icon: ${name}`} className="text-yellow-500 font-bold">[?]</span>;
                    }
                }
                // --- End Icon Handling ---


                // --- Link Handling (Keep as is, ensure className conversion) ---
                if (lowerCaseName === 'a') {
                    const isInternal = props.href && (props.href.startsWith('/') || props.href.startsWith('#'));
                    const parsedChildren = children ? domToReact(children, robustParserOptions) : null;
                    const finalProps = { ...props }; // Copy props
                    if (finalProps.class) { // Convert class to className
                        finalProps.className = finalProps.class as string;
                        delete finalProps.class;
                    }

                    if (isInternal && !props.target && props.href) {
                        try {
                           // Destructure known Link props, pass rest
                           const { href, className, style, title, children: _c, ...restLinkProps } = finalProps;
                           return <Link href={href} className={className as string} style={style as React.CSSProperties} title={title as string} {...restLinkProps}>{parsedChildren}</Link>;
                        } catch (linkError) {
                            logger.error("[VibeContentRenderer] Error creating Next Link:", linkError, finalProps);
                            return React.createElement('a', finalProps, parsedChildren); // Fallback to regular 'a'
                        }
                    } else {
                         // Render as regular 'a' tag
                         return React.createElement('a', finalProps, parsedChildren);
                    }
                }
                // --- End Link Handling ---

                // --- Standard HTML Elements (Keep as is, ensure className handling) ---
                const knownTags = /^(p|div|span|ul|ol|li|h[1-6]|strong|em|b|i|u|s|code|pre|blockquote|hr|br|img|table|thead|tbody|tr|th|td)$/;
                if (typeof lowerCaseName === 'string' && knownTags.test(lowerCaseName)) {
                   try {
                        const childrenToRender = children ? domToReact(children, robustParserOptions) : null;
                        const finalProps = { ...props }; // Copy props
                        if (finalProps.class) { // Convert class to className
                            finalProps.className = finalProps.class as string;
                            delete finalProps.class;
                        }
                        if (lowerCaseName === 'br' || lowerCaseName === 'hr' || lowerCaseName === 'img') {
                             return React.createElement(lowerCaseName, finalProps);
                        } else {
                            return React.createElement(lowerCaseName, finalProps, childrenToRender);
                        }
                   } catch (createElementError) {
                       logger.error(`[VibeContentRenderer] Error React.createElement for <${lowerCaseName}>:`, createElementError, { props });
                       const fallbackChildren = children ? domToReact(children, robustParserOptions) : null;
                       return <>{fallbackChildren}</>; // Fallback to rendering children only
                   }
               }
                // --- End Standard HTML Elements ---


            } catch (replaceError: any) {
                 logger.error("[VibeContentRenderer] Error in replace function:", replaceError, { name, attribs });
                 return <span title={`Error processing element: ${name}`} className="text-red-500">[PROCESS ERR]</span>;
            }
        }
        // Let the library handle text nodes and other defaults
        return undefined; // Important: return undefined for default handling
    },
};

// The Component Itself
interface VibeContentRendererProps {
  content: string | null | undefined;
  className?: string; // Optional className for the wrapper
}

export const VibeContentRenderer: React.FC<VibeContentRendererProps> = React.memo(({ content, className }) => {
    // logger.debug("[VibeContentRenderer] Rendering content:", content ? content.substring(0, 50) + "..." : "null/undefined");

    if (typeof content !== 'string' || !content.trim()) {
        return null;
    }

    try {
      const parsedContent = parse(content, robustParserOptions);
      // logger.debug("[VibeContentRenderer] Parsing successful.");

      return className ? <div className={className}>{parsedContent}</div> : <>{parsedContent}</>;
    } catch (error) {
      logger.error("[VibeContentRenderer] Error during parse:", error, "Input:", content);
      const ErrorSpan = () => <span className="text-red-500">[Parse Error]</span>;
      return className ? <div className={className}><ErrorSpan /></div> : <ErrorSpan />;
    }
});

VibeContentRenderer.displayName = 'VibeContentRenderer';

export default VibeContentRenderer;