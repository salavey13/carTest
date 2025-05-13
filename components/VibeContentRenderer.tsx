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

// Internal function for icon syntax preprocessing
function preprocessIconSyntaxInternal(content: string): string {
    if (!content) return '';
    // Regex to capture icon name and any attributes like attr='value' or attr="value" or attr=value
    // Handles various quoting and unquoted values for attributes if simple
    return content.replace(
        /::(Fa\w+)((?:\s+\w+(?:=(?:(["'])(?:(?!\3).)*\3|\w+)))*)\s*::/g,
        (_match, iconName, attributesString) => {
            // attributesString will be like " color='gold' size='2em'"
            // The parser will handle these attributes directly when creating the element
            return `<${iconName}${attributesString} />`;
        }
    );
}

// Function to apply simple markdown conversions
function applySimpleMarkdown(content: string): string {
    if (!content) return '';
    let result = content;
    // **bold** -> <strong>bold</strong>
    result = result.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    // *italic* -> <em>italic</em> (ensure this doesn't conflict with <strong> if more complex markdown were used)
    // This simple regex should be fine if **bold** is processed first.
    result = result.replace(/\*(.*?)\*/g, '<em>$1</em>');
    // Optional: _underline_ -> <u>underline</u> (if needed)
    // result = result.replace(/_(.*?)_/g, '<u>$1</u>');
    // Optional: `code` -> <code>code</code> (if not handled by main parser adequately or for inline emphasis)
    // result = result.replace(/`(.*?)`/g, '<code>$1</code>');
    return result;
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
            let iconToRender: keyof typeof Fa6Icons | undefined = undefined;
            let iconComponentName: string = nodeName; 

            if (isValidFa6Icon(nodeName)) { 
                iconToRender = nodeName as keyof typeof Fa6Icons;
            } else if (iconNameMap[lowerCaseName]) { 
                const mappedName = iconNameMap[lowerCaseName];
                if (isValidFa6Icon(mappedName)) {
                    iconToRender = mappedName;
                    iconComponentName = mappedName; 
                }
            }
            
            if (iconToRender) {
                const IconComponent = Fa6Icons[iconToRender];
                const { className, style, ...restProps } = mutableAttribs;
                const finalProps: Record<string, any> = {
                    ...restProps, // this will pass 'color', 'size', etc. from ::FaIcon color='val'::
                    className: `${className || ''} inline align-baseline mx-px`.trim(),
                    style: style, // style can also be passed as an attribute string if needed, but direct props are better
                };
                // logger.debug(`[VCR] Rendering <${iconComponentName} /> with props:`, finalProps);
                return React.createElement(IconComponent, finalProps, children);
            } else if (lowerCaseName.startsWith('fa') && !isValidFa6Icon(nodeName) && !iconNameMap[lowerCaseName]) { // Fallback for unmapped/invalid Fa icons
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
                    // logger.debug("[VCR] Rendering Next Link for:", hrefVal);
                    const { href, className: finalLinkClassName, style: linkStyle, title: linkTitle, ...restLinkProps } = mutableAttribs;
                    return <Link href={href as string} className={finalLinkClassName as string} style={linkStyle as React.CSSProperties} title={linkTitle as string} {...restLinkProps}>{children}</Link>;
                }
                // logger.debug("[VCR] Rendering standard <a> tag for:", hrefVal);
                return React.createElement('a', mutableAttribs, children);
            }
            
            // --- Standard HTML Elements Styling ---
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
        return null;
    }
    try {
      // Order of operations:
      // 1. Simple Markdown to HTML (bold, italic)
      // 2. Custom Icon Syntax to HTML tags
      // 3. Parse the resulting HTML string
      let processedContent = String(content);
      processedContent = applySimpleMarkdown(processedContent);
      processedContent = preprocessIconSyntaxInternal(processedContent);
      
      const parsedContent = parse(processedContent, simplifiedParserOptions); 
      
      if (className) {
        return <div className={className}>{parsedContent}</div>;
      }
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