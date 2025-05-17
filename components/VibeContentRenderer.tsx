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
    // Updated regex to ensure attributes are correctly captured and spaces are handled
    return content.replace(
        /::(Fa\w+)((?:\s+\w+=(?:(["'])(?:(?!\3)[^"'])*\3|[^"'\s]+))*)?\s*::/g,
        (_match, iconName, attributesString) => {
            const attrs = attributesString ? attributesString.trim() : '';
            // Create a self-closing tag structure that the parser can handle
            // Or ensure it's a simple tag if no children are expected, e.g. <FaIconName attributes />
            // For parser, it's better to use a structure like <FaIconName attributes></FaIconName>
            // Or if it MUST be self-closing for some reason, ensure parser knows.
            // Let's try with a non-self-closing structure for broader compatibility with html-react-parser.
            return `<${iconName}${attrs ? ' ' + attrs : ''}></${iconName}>`;
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
            let determinedIconName = nodeName; // Start with the original node name

            if (isValidFa6Icon(determinedIconName)) { 
                iconToRender = determinedIconName as keyof typeof Fa6Icons;
            } else {
                const mappedName = iconNameMap[lowerCaseName];
                if (mappedName && isValidFa6Icon(mappedName)) {
                    iconToRender = mappedName;
                    determinedIconName = mappedName; // Update determinedIconName if mapped
                }
            }
            
            if (iconToRender) {
                const IconComponent = Fa6Icons[iconToRender];
                // Ensure className is a string and handle potential undefined style/title
                const currentClassName = typeof mutableAttribs.className === 'string' ? mutableAttribs.className : '';
                const finalProps: Record<string, any> = {
                    ...mutableAttribs, // Spread original attributes first
                    className: `${currentClassName} inline align-baseline mx-px`.trim(), // Append default classes
                    style: mutableAttribs.style ?? undefined,
                    title: mutableAttribs.title ?? determinedIconName, // Use icon name as fallback title
                };
                delete finalProps.children; // Icons generally don't have children from HTML parsing
                return React.createElement(IconComponent, finalProps);
            } else if (lowerCaseName.startsWith('fa') && !isValidFa6Icon(nodeName) && !iconNameMap[lowerCaseName]) {
                logger.warn(`[VCR] Unknown Fa Icon Tag or unmapped: <${nodeName}> (lc: ${lowerCaseName})`);
                return <span title={`Unknown/Unmapped Fa Icon: ${nodeName}`} className="text-orange-500 font-bold">{`[?]`}</span>;
            }

            // --- Link Handling ---
            if (lowerCaseName === 'a') {
                const hrefVal = mutableAttribs.href;
                const isInternal = hrefVal && typeof hrefVal === 'string' && (hrefVal.startsWith('/') || hrefVal.startsWith('#'));
                
                let linkClassName = typeof mutableAttribs.className === 'string' ? mutableAttribs.className : '';
                mutableAttribs.className = `${linkClassName} mx-1 px-0.5`.trim(); 

                if (isInternal && !mutableAttribs.target && hrefVal) {
                    return <Link {...mutableAttribs} href={hrefVal as string}>{children}</Link>;
                }
                return React.createElement('a', mutableAttribs, children);
            }
            
            // --- Standard HTML Elements Styling & Passing Children ---
            const currentElemClassName = typeof mutableAttribs.className === 'string' ? mutableAttribs.className : '';
            if (lowerCaseName === 'strong') {
                mutableAttribs.className = `${currentElemClassName} font-semibold text-brand-yellow`.trim();
            }
            if (lowerCaseName === 'em') {
                mutableAttribs.className = `${currentElemClassName} italic text-brand-cyan`.trim();
            }
            if (lowerCaseName === 'code' && domNode.parent?.name !== 'pre') {
                 mutableAttribs.className = `${currentElemClassName} bg-muted px-1 py-0.5 rounded text-sm font-mono text-accent-foreground`.trim();
            }
            if (lowerCaseName === 'pre') {
                 mutableAttribs.className = `${currentElemClassName} bg-muted p-4 rounded-md overflow-x-auto simple-scrollbar`.trim();
            }
            if (lowerCaseName === 'blockquote') {
                 mutableAttribs.className = `${currentElemClassName} border-l-4 border-brand-purple pl-4 italic text-muted-foreground my-4`.trim();
            }
            if (lowerCaseName === 'ul') {
                 mutableAttribs.className = `${currentElemClassName} list-disc list-inside space-y-1 my-2`.trim();
            }
            if (lowerCaseName === 'ol') {
                 mutableAttribs.className = `${currentElemClassName} list-decimal list-inside space-y-1 my-2`.trim();
            }
            if (lowerCaseName === 'li') {
                 mutableAttribs.className = `${currentElemClassName} my-0.5`.trim();
            }
            if (lowerCaseName === 'hr') {
                 mutableAttribs.className = `${currentElemClassName} border-border my-4`.trim();
            }

            return React.createElement(nodeName, mutableAttribs, children);
        }
        
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
      processedContent = applySimpleMarkdown(processedContent);
      processedContent = preprocessIconSyntaxInternal(processedContent);
      
      const parsedContent = parse(processedContent, simplifiedParserOptions); 
      
      if (className) {
        return <div className={className}>{parsedContent}</div>;
      }
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