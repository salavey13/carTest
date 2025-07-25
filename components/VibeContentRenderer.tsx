"use client";

import React from 'react';
import parse, { domToReact, HTMLReactParserOptions, Element, attributesToProps, Text, Comment } from 'html-react-parser';
import Link from 'next/link';
import * as Fa6Icons from "react-icons/fa6";
import { debugLogger as logger } from "@/lib/debugLogger";
import { iconNameMap } from '@/lib/iconNameMap'; 
import { cn } from '@/lib/utils';

function isValidFa6Icon(iconName: string): iconName is keyof typeof Fa6Icons {
    return typeof iconName === 'string' && iconName.startsWith('Fa') && iconName in Fa6Icons;
}

function preprocessIconSyntaxInternal(content: string): string {
    if (!content) return '';
    // Regex to match ::faIconName attributes:: or ::FaIconName attributes::
    // It captures the "fa" + "IconName" part, and any attributes.
    // Uses 'i' flag for case-insensitivity on the icon name itself.
    return content.replace(
        /::(fa[a-zA-Z0-9_]+)((?:\s+\w+(?:=(?:(["'])(?:(?!\3).)*\3|\w+)))*)\s*::/gi,
        (_match, rawIconName, attributesString) => {
            const lowerIconName = rawIconName.toLowerCase(); // e.g., fausershield
            
            // Try to map to PascalCase using iconNameMap first
            let pascalCaseIconName = iconNameMap[lowerIconName];
            
            // If not in map, try to convert rawIconName to PascalCase (e.g., if user typed ::FaUserShield::)
            if (!pascalCaseIconName) {
                if (rawIconName.startsWith('Fa')) {
                    pascalCaseIconName = rawIconName as keyof typeof Fa6Icons;
                } else if (rawIconName.startsWith('fa')) {
                    pascalCaseIconName = ('F' + rawIconName.substring(1)) as keyof typeof Fa6Icons; // faUserShield -> FaUserShield
                }
            }
            // Final check if it's a valid icon name
            if (!isValidFa6Icon(pascalCaseIconName as string)) {
                 // Fallback: if it's not a known Fa icon even after attempts,
                 // we might pass the original rawIconName or a standardized PascalCase version.
                 // For now, construct the tag with the best guess PascalCase.
                 // The main parser will handle it if it's still not found.
                 if (!pascalCaseIconName && rawIconName.length > 2) {
                    pascalCaseIconName = rawIconName.charAt(0).toUpperCase() + rawIconName.slice(1) as keyof typeof Fa6Icons;
                 } else if (!pascalCaseIconName) {
                    pascalCaseIconName = rawIconName as keyof typeof Fa6Icons; // keep original if unsure
                 }
            }
            
            const attrs = attributesString ? attributesString.trim() : '';
            // Create a tag like <FaUserShield attributes />
            return `<${pascalCaseIconName}${attrs ? ' ' + attrs : ''}></${pascalCaseIconName}>`;
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
                const { className, style, title, ...restProps } = mutableAttribs; 
                const finalProps: Record<string, any> = {
                    ...restProps, 
                    className: `${className || ''} inline align-baseline mx-px`.trim(),
                    style: style,
                    title: title 
                };
                return React.createElement(IconComponent, finalProps); // Icons are self-closing
            } else if (lowerCaseName.startsWith('fa') && !isValidFa6Icon(nodeName) && !iconNameMap[lowerCaseName]) {
                logger.warn(`[VCR] Unknown Fa Icon Tag or unmapped: <${nodeName}> (lc: ${lowerCaseName})`);
                return <span title={`Unknown/Unmapped Fa Icon: ${nodeName}`} className="text-orange-500 font-bold">{`[?] Неизвестная иконка <${nodeName}>`}</span>;
            }

            // --- Link Handling ---
            if (lowerCaseName === 'a') {
                const hrefVal = mutableAttribs.href;
                const isInternal = hrefVal && typeof hrefVal === 'string' && (hrefVal.startsWith('/') || hrefVal.startsWith('#'));
                
                let linkClassName = mutableAttribs.className || '';
                mutableAttribs.className = `${linkClassName} mx-1 px-0.5`.trim(); 

                if (isInternal && !mutableAttribs.target && hrefVal) {
                    return <Link {...mutableAttribs} href={hrefVal as string}>{children}</Link>;
                }
                return React.createElement('a', mutableAttribs, children);
            }
            
            // --- Standard HTML Elements Styling & Passing Children ---
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
        // If the parsed content is a single, valid React element, clone it and apply the className.
        // This avoids adding a wrapper div, which was causing layout issues.
        if (React.isValidElement(parsedContent)) {
          return React.cloneElement(parsedContent, {
            className: cn(parsedContent.props.className, className)
          });
        } else {
          // If the content is complex (e.g., text and an icon), fall back to a SPAN wrapper.
          // This is more inline-friendly than a div.
          logger.warn("[VCR] Applying className to a span wrapper because content is not a single element.", content);
          return <span className={className}>{parsedContent}</span>;
        }
      }
      return <>{parsedContent}</>;

    } catch (error) {
      logger.error("[VCR Root] Parse Error:", error, "Input for parsing:", content, "Processed HTML:", preprocessIconSyntaxInternal(applySimpleMarkdown(String(content))));
      const ErrorSpan = () => <span className="text-red-500">[Content Parse Error]</span>;
      if (className) {
        // The wrapper for an error is acceptable.
        return <div className={className}><ErrorSpan /></div>;
      }
      return <ErrorSpan />;
    }
});

VibeContentRenderer.displayName = 'VibeContentRenderer';
export default VibeContentRenderer;