"use client";

import React from 'react';
import parse, { domToReact, HTMLReactParserOptions, Element, attributesToProps, Text, Comment } from 'html-react-parser';
import Link from 'next/link';
import * as Fa6Icons from "react-icons/fa6";
import { debugLogger as logger } from "@/lib/debugLogger";
import { iconNameMap } from '@/lib/iconNameMap'; 

function isValidFa6Icon(iconName: string): iconName is keyof typeof Fa6Icons {
    return typeof iconName === 'string' && iconName.startsWith('Fa') && iconName in Fa6Icons;
}

// Internal function for icon syntax preprocessing
function preprocessIconSyntaxInternal(content: string): string {
    if (!content) return '';
    return content.replace(
        /::(Fa\w+)((?:\s+\w+(?:=(?:(["'])(?:(?!\3).)*\3|\w+)))*)\s*::/g,
        (_match, iconName, attributesString) => {
            // Ensure attributesString is not undefined and trim it
            const attrs = attributesString ? attributesString.trim() : '';
            return `<${iconName}${attrs ? ' ' + attrs : ''} />`;
        }
    );
}

// Function to apply simple markdown conversions
function applySimpleMarkdown(content: string): string {
    if (!content) return '';
    let result = content;
    result = result.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    result = result.replace(/\*(.*?)\*/g, '<em>$1</em>');
    // Note: Be cautious with more complex regex to avoid unclosed tags or invalid HTML
    return result;
}

const simplifiedParserOptions: HTMLReactParserOptions = {
    replace: (domNode) => {
        if (domNode.type === 'text' || domNode instanceof Text) {
            return undefined; 
        }

        if (domNode.type === 'comment' || domNode instanceof Comment) {
            return <></>;
        }

        if (domNode instanceof Element && domNode.name) {
            const nodeName = domNode.name;
            const lowerCaseName = nodeName.toLowerCase();
            
            const mutableAttribs = attributesToProps(domNode.attribs || {});
            const children = domNode.children && domNode.children.length > 0
                           ? domToReact(domNode.children, simplifiedParserOptions) 
                           : null;

            // --- Icon Handling ---
            let iconToRender: keyof typeof Fa6Icons | undefined = undefined;
            
            if (isValidFa6Icon(nodeName)) { 
                iconToRender = nodeName as keyof typeof Fa6Icons;
            } else if (iconNameMap[lowerCaseName]) { 
                const mappedName = iconNameMap[lowerCaseName];
                if (isValidFa6Icon(mappedName)) {
                    iconToRender = mappedName;
                }
            }
            
            if (iconToRender) {
                const IconComponent = Fa6Icons[iconToRender];
                const { className, style, title, ...restProps } = mutableAttribs; // Capture title
                const finalProps: Record<string, any> = {
                    ...restProps, 
                    className: `${className || ''} inline align-baseline mx-px`.trim(),
                    style: style,
                    title: title // Pass title if present
                };
                // react-icons components generally do not take children in the HTML sense.
                // Passing `children` here might be unintended if the source was e.g. <FaIcon>Text</FaIcon>.
                // Standard usage is self-closing <FaIcon />.
                return React.createElement(IconComponent, finalProps);
            } else if (lowerCaseName.startsWith('fa') && !isValidFa6Icon(nodeName) && !iconNameMap[lowerCaseName]) {
                logger.warn(`[VCR] Unknown Fa Icon Tag or unmapped: <${nodeName}> (lc: ${lowerCaseName})`);
                return <span title={`Unknown/Unmapped Fa Icon: ${nodeName}`} className="text-orange-500 font-bold">{`[?] Неизвестная иконка <${nodeName}>`}</span>;
            }

            // --- Link Handling ---
            if (lowerCaseName === 'a') {
                const hrefVal = mutableAttribs.href;
                const isInternal = hrefVal && typeof hrefVal === 'string' && (hrefVal.startsWith('/') || hrefVal.startsWith('#'));
                
                let linkClassName = mutableAttribs.className || '';
                // Avoid adding mx-1 px-0.5 if it's already part of a prose structure or specific styling
                // For now, let's keep it simple and apply it generally, can be refined later if needed.
                mutableAttribs.className = `${linkClassName} mx-1 px-0.5`.trim(); 

                if (isInternal && !mutableAttribs.target && hrefVal) {
                    // Use all attributes for Link component
                    return <Link {...mutableAttribs} href={hrefVal as string}>{children}</Link>;
                }
                return React.createElement('a', mutableAttribs, children);
            }
            
            // --- Standard HTML Elements Styling & Passing Children ---
            // These stylings are additive and should not break parsing.
            if (lowerCaseName === 'strong') {
                mutableAttribs.className = `${mutableAttribs.className || ''} font-semibold text-brand-yellow`.trim();
            }
            if (lowerCaseName === 'em') {
                mutableAttribs.className = `${mutableAttribs.className || ''} italic text-brand-cyan`.trim();
            }
            if (lowerCaseName === 'code' && domNode.parent?.name !== 'pre') {
                 mutableAttribs.className = `${mutableAttribs.className || ''} bg-muted px-1 py-0.5 rounded text-sm font-mono text-accent-foreground`.trim();
            }
            if (lowerCaseName === 'pre') {
                 mutableAttribs.className = `${mutableAttribs.className || ''} bg-muted p-4 rounded-md overflow-x-auto simple-scrollbar`.trim();
            }
            if (lowerCaseName === 'blockquote') {
                 mutableAttribs.className = `${mutableAttribs.className || ''} border-l-4 border-brand-purple pl-4 italic text-muted-foreground my-4`.trim();
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
                 mutableAttribs.className = `${mutableAttribs.className || ''} border-border my-4`.trim();
            }

            // Default: reconstruct the element with its attributes and children
            return React.createElement(nodeName, mutableAttribs, children);
        }
        
        // Fallback for any other node types not handled above (e.g., doctype, processing instructions)
        // Returning undefined lets html-react-parser decide or skip.
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
      let processedContent = String(content);
      // Apply simple markdown first, then preprocess icons to convert ::FaIcon:: to <FaIcon /> tags
      processedContent = applySimpleMarkdown(processedContent);
      processedContent = preprocessIconSyntaxInternal(processedContent);
      
      // Now parse the HTML string (which includes <FaIcon /> tags and simple markdown tags)
      const parsedContent = parse(processedContent, simplifiedParserOptions); 
      
      if (className) {
        return <div className={className}>{parsedContent}</div>;
      }
      // Return as a fragment if no className wrapper is needed
      return <>{parsedContent}</>;

    } catch (error) {
      logger.error("[VCR Root] Parse Error:", error, "Input for parsing:", content, "Processed HTML:", preprocessIconSyntaxInternal(applySimpleMarkdown(String(content))));
      const ErrorSpan = () => <span className="text-red-500">[Content Parse Error]</span>;
      if (className) {
        return <div className={className}><ErrorSpan /></div>;
      }
      return <ErrorSpan />;
    }
});

VibeContentRenderer.displayName = 'VibeContentRenderer';
export default VibeContentRenderer;