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
                return React.createElement(IconComponent, finalProps, children);
            } else if (lowerCaseName.startsWith('fa')) { // Fallback for unmapped/invalid Fa icons
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
            
            // --- Standard HTML Elements Styling ---
            // Add specific styles for common elements if needed, matching theme
            if (lowerCaseName === 'strong') {
                mutableAttribs.className = `${mutableAttribs.className || ''} font-semibold text-brand-yellow`.trim(); // Example using theme color
            }
            if (lowerCaseName === 'em') {
                mutableAttribs.className = `${mutableAttribs.className || ''} italic text-brand-cyan`.trim(); // Example using theme color
            }
            if (lowerCaseName === 'code' && domNode.parent?.name !== 'pre') {
                 mutableAttribs.className = `${mutableAttribs.className || ''} bg-muted px-1 py-0.5 rounded text-sm font-mono text-accent-foreground`.trim(); // Example using theme colors
            }
            if (lowerCaseName === 'pre') {
                 mutableAttribs.className = `${mutableAttribs.className || ''} bg-muted p-4 rounded-md overflow-x-auto simple-scrollbar`.trim(); // Example using theme colors
            }
            if (lowerCaseName === 'blockquote') {
                 mutableAttribs.className = `${mutableAttribs.className || ''} border-l-4 border-brand-purple pl-4 italic text-muted-foreground my-4`.trim(); // Example using theme colors
            }
            if (lowerCaseName === 'ul') {
                 mutableAttribs.className = `${mutableAttribs.className || ''} list-disc list-inside space-y-1 my-2`.trim();
            }
            if (lowerCaseName === 'ol') {
                 mutableAttribs.className = `${mutableAttribs.className || ''} list-decimal list-inside space-y-1 my-2`.trim();
            }
            if (lowerCaseName === 'li') {
                 mutableAttribs.className = `${mutableAttribs.className || ''} my-0.5`.trim();
            }
            if (lowerCaseName === 'hr') {
                 mutableAttribs.className = `${mutableAttribs.className || ''} border-border my-4`.trim(); // Use theme border
            }

            // Return the element with potentially modified attributes
            return React.createElement(nodeName, mutableAttribs, children);
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