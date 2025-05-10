"use client";

import React from 'react';
import parse, { domToReact, HTMLReactParserOptions, Element, attributesToProps, Text } from 'html-react-parser';
import Link from 'next/link';
import * as Fa6Icons from "react-icons/fa6";
import { debugLogger as logger } from "@/lib/debugLogger";
import { iconNameMap } from '@/lib/iconNameMap'; // Import the centralized map

// Type guard
function isValidFa6Icon(iconName: string): iconName is keyof typeof Fa6Icons {
    return typeof iconName === 'string' && iconName.startsWith('Fa') && iconName in Fa6Icons;
}

// Preprocess content to convert ::FaIcon:: syntax to <FaIcon />
function preprocessIconSyntax(content: string): string {
    if (!content) return '';
    // This regex handles ::FaIconName className="..."옵션:: or ::FaIconName::
    // It correctly captures the icon name and optional className (with double or single quotes)
    const processed = content.replace(
        /::(Fa\w+)(?:\s+className=(?:"([^"]*)"|'([^']*)'))?::/g,
        (_match, iconName, classValDouble, classValSingle) => {
            const classNameValue = classValDouble || classValSingle;
            if (classNameValue) {
                return `<${iconName} class="${classNameValue}" />`;
            }
            return `<${iconName} />`;
        }
    );
    return processed;
}

// Robust Parser Options - Centralized Logic
const robustParserOptions: HTMLReactParserOptions = {
    replace: (domNode) => {
        // CRITICAL: Handle text nodes first. Let the parser render them by default.
        if (domNode.type === 'text' || domNode instanceof Text) { 
            // html-react-parser might pass Text nodes directly, or domNode.type might be 'text'.
            // In either case, we don't want to interfere with simple text rendering.
            return undefined;
        }

        if (domNode instanceof Element && domNode.name) { // Ensure domNode.name exists
            // attributesToProps converts HTML attributes (e.g., 'class', 'style' string)
            // to React props (e.g., 'className', style object).
            const mutableAttribs = attributesToProps(domNode.attribs || {}); 
            const lowerCaseName = domNode.name.toLowerCase();

            try {
                // --- Icon Handling ---
                if (lowerCaseName.startsWith('fa')) {
                    const correctPascalCaseName = iconNameMap[lowerCaseName];
                    if (correctPascalCaseName && isValidFa6Icon(correctPascalCaseName)) {
                         const IconComponent = Fa6Icons[correctPascalCaseName];
                         try {
                            const { className, style, ...restProps } = mutableAttribs; 
                            
                            const safeProps = Object.entries(restProps).reduce((acc, [key, value]) => {
                                if (key.startsWith('aria-') || key.startsWith('data-') || key === 'title' || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
                                     acc[key] = value;
                                }
                                return acc;
                            }, {} as Record<string, any>);

                            const parsedChildren = domNode.children && domNode.children.length > 0 ? domToReact(domNode.children, robustParserOptions) : null;
                            
                            const finalProps: Record<string, any> = {
                                ...safeProps,
                                className: `${className || ''} inline align-baseline mx-px`.trim(),
                                style: style, 
                            };
                            return React.createElement(IconComponent, finalProps, parsedChildren);
                         } catch (iconRenderError: any) {
                            logger.error(`[VCR] Icon Render Err <${correctPascalCaseName}>:`, iconRenderError, { mutableAttribs });
                            return <span title={`Err: ${correctPascalCaseName}`} className="text-red-500">[ICON!]</span>;
                         }
                    } else {
                        logger.warn(`[VCR] Unknown Icon: <${domNode.name}> (lc: <${lowerCaseName}>). Attribs:`, mutableAttribs);
                        return <span title={`Unknown: ${domNode.name}`} className="text-yellow-500">[?]</span>;
                    }
                }
                // --- Link Handling ---
                if (lowerCaseName === 'a') {
                    const hrefVal = mutableAttribs.href; // href should be a string
                    const isInternal = hrefVal && typeof hrefVal === 'string' && (hrefVal.startsWith('/') || hrefVal.startsWith('#'));
                    const parsedChildren = domNode.children ? domToReact(domNode.children, robustParserOptions) : null;
                    
                    let linkClassName = mutableAttribs.className || '';
                    mutableAttribs.className = `${linkClassName} mx-1 px-0.5`.trim();

                    if (isInternal && !mutableAttribs.target && hrefVal) {
                        try {
                           const { href, className: finalLinkClassName, style: linkStyle, title: linkTitle, ...restLinkProps } = mutableAttribs;
                           return <Link href={href as string} className={finalLinkClassName as string} style={linkStyle as React.CSSProperties} title={linkTitle as string} {...restLinkProps}>{parsedChildren}</Link>;
                        } catch (linkError) {
                            logger.error("[VCR] Next Link Err:", linkError, mutableAttribs);
                            // Fallback to regular 'a' tag if NextLink creation fails
                            return React.createElement('a', mutableAttribs, parsedChildren); 
                        }
                    } else {
                         // For external links or links with a target, use a regular 'a' tag
                         return React.createElement('a', mutableAttribs, parsedChildren);
                    }
                }
                
                // For any other standard HTML element, attributesToProps has already processed its attributes.
                // We return undefined to let html-react-parser handle its default rendering,
                // including its children (which will also be processed by this replace function).
                return undefined; 

            } catch (replaceError: any) {
                 logger.error("[VCR] Replace Err:", replaceError, { name: domNode.name, attribs: domNode.attribs });
                 return <span title={`Process Err: ${domNode.name}`} className="text-red-500">[ERR]</span>;
            }
        }
        // For any other node type not handled above (e.g., comments), or if it's not an Element with a name,
        // let the parser do its default action.
        return undefined; 
    },
};

interface VibeContentRendererProps {
  content: string | null | undefined;
  className?: string; 
}

export const VibeContentRenderer: React.FC<VibeContentRendererProps> = React.memo(({ content, className }) => {
    if (typeof content !== 'string' || !content.trim()) {
        return null;
    }
    try {
      const contentToParse = String(content);
      const preprocessedContent = preprocessIconSyntax(contentToParse);
      const parsedContent = parse(preprocessedContent, robustParserOptions);
      
      if (className) {
        return <div className={className}>{parsedContent}</div>;
      }
      // If no className for the wrapper, return the parsed content directly.
      // It might be a string, a React element, or an array of them (ReactFragment).
      return <>{parsedContent}</>;

    } catch (error) {
      logger.error("[VCR] Parse Err:", error, "Input:", content);
      const ErrorSpan = () => <span className="text-red-500">[Parse Error]</span>;
      if (className) {
        return <div className={className}><ErrorSpan /></div>;
      }
      return <ErrorSpan />;
    }
});

VibeContentRenderer.displayName = 'VibeContentRenderer';
export default VibeContentRenderer;