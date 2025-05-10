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

// Simplified Parser Options
const simplifiedParserOptions: HTMLReactParserOptions = {
    replace: (domNode) => {
        // 1. Handle text nodes by letting the parser render them by default.
        if (domNode.type === 'text' || domNode instanceof Text) { 
            return undefined;
        }

        // 2. Handle Element nodes.
        if (domNode instanceof Element && domNode.name) {
            const mutableAttribs = attributesToProps(domNode.attribs || {}); 
            const lowerCaseName = domNode.name.toLowerCase();
            const children = domNode.children && domNode.children.length > 0 
                             ? domToReact(domNode.children, simplifiedParserOptions) 
                             : null;

            try {
                // --- Icon Handling ---
                if (lowerCaseName.startsWith('fa')) {
                    const correctPascalCaseName = iconNameMap[lowerCaseName];
                    if (correctPascalCaseName && isValidFa6Icon(correctPascalCaseName)) {
                         const IconComponent = Fa6Icons[correctPascalCaseName];
                         const { className, style, ...restProps } = mutableAttribs;
                         const finalProps: Record<string, any> = {
                             ...restProps,
                             className: `${className || ''} inline align-baseline mx-px`.trim(),
                             style: style, 
                         };
                         return React.createElement(IconComponent, finalProps, children);
                    } else {
                        logger.warn(`[VCR Simple] Unknown Icon Tag: <${domNode.name}> (lc: ${lowerCaseName})`);
                        return <span title={`Unknown Icon: ${domNode.name}`} className="text-yellow-500">[?]</span>;
                    }
                }

                // --- Link Handling ---
                if (lowerCaseName === 'a') {
                    const hrefVal = mutableAttribs.href;
                    const isInternal = hrefVal && typeof hrefVal === 'string' && (hrefVal.startsWith('/') || hrefVal.startsWith('#'));
                    
                    let linkClassName = mutableAttribs.className || '';
                    mutableAttribs.className = `${linkClassName} mx-1 px-0.5`.trim();

                    if (isInternal && !mutableAttribs.target && hrefVal) {
                        const { href, className: finalLinkClassName, style: linkStyle, title: linkTitle, ...restLinkProps } = mutableAttribs;
                        return <Link href={href as string} className={finalLinkClassName as string} style={linkStyle as React.CSSProperties} title={linkTitle as string} {...restLinkProps}>{children}</Link>;
                    }
                    // For external links or links with a target, or if NextLink creation fails, use regular 'a'
                    return React.createElement('a', mutableAttribs, children);
                }
                
                // For any other standard HTML element (p, span, div, b, strong, em, br, etc.),
                // html-react-parser will handle them with their default behavior and process their children.
                // `attributesToProps` already converted 'class' to 'className' and 'style' string to an object.
                // Returning undefined lets the parser continue its default processing.
                return undefined; 

            } catch (replaceError: any) {
                 logger.error("[VCR Simple] Replace Error:", replaceError, { name: domNode.name, attribs: domNode.attribs });
                 return <span title={`Processing Error: ${domNode.name}`} className="text-red-500">[ERR!]</span>;
            }
        }
        
        // For any other node type not explicitly handled, let the parser do its default action.
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
      // Use the simplified parser options
      const parsedContent = parse(preprocessedContent, simplifiedParserOptions); 
      
      if (className) {
        return <div className={className}>{parsedContent}</div>;
      }
      return <>{parsedContent}</>;

    } catch (error) {
      logger.error("[VCR Simple] Parse Error:", error, "Input:", content);
      const ErrorSpan = () => <span className="text-red-500">[Content Parse Error]</span>;
      if (className) {
        return <div className={className}><ErrorSpan /></div>;
      }
      return <ErrorSpan />;
    }
});

VibeContentRenderer.displayName = 'VibeContentRenderer';
export default VibeContentRenderer;