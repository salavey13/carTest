"use client";

import React from 'react';
import parse, { domToReact, HTMLReactParserOptions, Element, attributesToProps, Text } from 'html-react-parser';
import Link from 'next/link';
import * as Fa6Icons from "react-icons/fa6";
import { debugLogger as logger } from "@/lib/debugLogger";
import { iconNameMap } from '@/lib/iconNameMap'; 

function isValidFa6Icon(iconName: string): iconName is keyof typeof Fa6Icons {
    return typeof iconName === 'string' && iconName.startsWith('Fa') && iconName in Fa6Icons;
}

function preprocessIconSyntax(content: string): string {
    if (!content) return '';
    // Updated regex to be more specific about `::FaIcon::` or `::FaIcon className="foo"::`
    // It now correctly captures icon names and optional classNames.
    return content.replace(
        /::(Fa\w+)(?:\s+className=(?:"([^"]*)"|'([^']*)'))?::/g,
        (_match, iconName, classValDouble, classValSingle) => {
            const classNameValue = classValDouble || classValSingle;
            if (!isValidFa6Icon(iconName)) {
                logger.warn(`[VCR Preprocessor] Encountered invalid icon name in custom syntax: ${iconName}. Rendering as text.`);
                return `[ICON ERR!: ${iconName}]`;
            }
            // Convert to a self-closing HTML-like tag for the parser
            return `<${iconName}${classNameValue ? ` class="${classNameValue}"` : ''} />`;
        }
    );
}

const simplifiedParserOptions: HTMLReactParserOptions = {
    replace: (domNode) => {
        if (domNode.type === 'text' || domNode instanceof Text) {
            // logger.debug("[VCR] Passing through text node:", (domNode as Text).data?.substring(0, 30) + "...");
            return undefined; // Let parser handle text nodes
        }

        if (domNode instanceof Element && domNode.name) {
            const nodeName = domNode.name;
            const lowerCaseName = nodeName.toLowerCase();
            // logger.debug(`[VCR] Processing Element: <${nodeName}>, Low: <${lowerCaseName}>`, domNode.attribs);

            const mutableAttribs = attributesToProps(domNode.attribs || {});
            const children = domNode.children && domNode.children.length > 0
                           ? domToReact(domNode.children, simplifiedParserOptions)
                           : null;

            // --- Icon Handling ---
            // Check if the nodeName (which could be PascalCase like "FaBolt" from preprocessing)
            // is a valid Fa6 icon OR if its lowercase version has a mapping in iconNameMap.
            let iconToRender: keyof typeof Fa6Icons | undefined = undefined;
            let iconComponentName: string = nodeName; // Assume nodeName is correct initially

            if (isValidFa6Icon(nodeName)) { // Direct check for PascalCase name (e.g. <FaBolt />)
                iconToRender = nodeName as keyof typeof Fa6Icons;
            } else if (iconNameMap[lowerCaseName]) { // Check map for lowercase (e.g. <fa-bolt />)
                const mappedName = iconNameMap[lowerCaseName];
                if (isValidFa6Icon(mappedName)) {
                    iconToRender = mappedName;
                    iconComponentName = mappedName; // Use the correct PascalCase name for logging
                }
            }
            
            if (iconToRender) {
                const IconComponent = Fa6Icons[iconToRender];
                const { className, style, ...restProps } = mutableAttribs;
                const finalProps: Record<string, any> = {
                    ...restProps,
                    className: `${className || ''} inline align-baseline mx-px`.trim(),
                    style: style,
                };
                // logger.debug(`[VCR] Rendering <${iconComponentName} /> with props:`, finalProps);
                try {
                    return React.createElement(IconComponent, finalProps, children);
                } catch (e) {
                    logger.error(`[VCR] Error rendering icon <${iconComponentName}>:`, e, "Props:", finalProps);
                    return <span title={`Error rendering icon: ${iconComponentName}`} className="text-red-500 font-bold">{`[ICON ERR!]`}</span>;
                }
            } else if (lowerCaseName.startsWith('fa') || nodeName.startsWith('Fa')) { // Fallback for unmapped/invalid Fa icons
                logger.warn(`[VCR] Unknown Fa Icon Tag or unmapped: <${nodeName}> (lc: ${lowerCaseName})`);
                return <span title={`Unknown/Unmapped Fa Icon: ${nodeName}`} className="text-orange-500 font-bold">{`<${nodeName}>`}</span>;
            }

            // --- Link Handling ---
            if (lowerCaseName === 'a') {
                const hrefVal = mutableAttribs.href;
                const isInternal = hrefVal && typeof hrefVal === 'string' && (hrefVal.startsWith('/') || hrefVal.startsWith('#'));
                
                let linkClassName = mutableAttribs.className || '';
                mutableAttribs.className = `${linkClassName} mx-1 px-0.5`.trim(); // Apply base styling

                if (isInternal && !mutableAttribs.target && hrefVal) {
                    // logger.debug("[VCR] Rendering Next Link for:", hrefVal);
                    const { href, className: finalLinkClassName, style: linkStyle, title: linkTitle, ...restLinkProps } = mutableAttribs;
                    return <Link href={href as string} className={finalLinkClassName as string} style={linkStyle as React.CSSProperties} title={linkTitle as string} {...restLinkProps}>{children}</Link>;
                }
                // logger.debug("[VCR] Rendering standard <a> tag for:", hrefVal);
                return React.createElement('a', mutableAttribs, children);
            }
            
            // For any other standard HTML element, let html-react-parser handle it.
            // logger.debug(`[VCR] Passing through <${nodeName}> for default parsing.`);
            return undefined; 
        }
        
        // logger.debug("[VCR] Node not processed by custom logic, passing through:", domNode.type);
        return undefined; 
    },
};

interface VibeContentRendererProps {
  content: string | null | undefined;
  className?: string; 
}

export const VibeContentRenderer: React.FC<VibeContentRendererProps> = React.memo(({ content, className }) => {
    if (typeof content !== 'string' || !content.trim()) {
        // logger.debug("[VCR Root] Content is null, undefined, or empty. Returning null.");
        return null;
    }
    // logger.debug(`[VCR Root] Rendering content (length: ${content.length}): "${content.substring(0, 100)}${content.length > 100 ? '...' : ''}"`, { wrapperClassName: className });
    try {
      const preprocessedContent = preprocessIconSyntax(String(content));
      // logger.debug(`[VCR Root] Preprocessed content: "${preprocessedContent.substring(0,100)}${preprocessedContent.length > 100 ? '...' : ''}"`);
      const parsedContent = parse(preprocessedContent, simplifiedParserOptions); 
      
      if (className) {
        // logger.debug("[VCR Root] Rendering parsed content within a div with className:", className);
        return <div className={className}>{parsedContent}</div>;
      }
      // logger.debug("[VCR Root] Rendering parsed content as a fragment.");
      return <>{parsedContent}</>;

    } catch (error) {
      logger.error("[VCR Root] Parse Error:", error, "Input:", content);
      const ErrorSpan = () => <span className="text-red-500">[Content Parse Error]</span>;
      if (className) {
        return <div className={className}><ErrorSpan /></div>;
      }
      return <ErrorSpan />;
    }
});

VibeContentRenderer.displayName = 'VibeContentRenderer';
export default VibeContentRenderer;