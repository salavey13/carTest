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

function preprocessIconSyntaxInternal(content: string): string {
    if (!content) return '';
    return content.replace(
        /::(fa[a-zA-Z0-9_]+)((?:\s+\w+(?:=(?:(["'])(?:(?!\3).)*\3|\w+)))*)\s*::/gi,
        (_match, rawIconName, attributesString) => {
            const lowerIconName = rawIconName.toLowerCase();
            let pascalCaseIconName = iconNameMap[lowerIconName];
            
            if (!pascalCaseIconName) {
                if (rawIconName.startsWith('Fa')) {
                    pascalCaseIconName = rawIconName as keyof typeof Fa6Icons;
                } else if (rawIconName.startsWith('fa')) {
                    pascalCaseIconName = ('F' + rawIconName.substring(1)) as keyof typeof Fa6Icons;
                }
            }
            if (!isValidFa6Icon(pascalCaseIconName as string)) {
                 if (!pascalCaseIconName && rawIconName.length > 2) {
                    pascalCaseIconName = rawIconName.charAt(0).toUpperCase() + rawIconName.slice(1) as keyof typeof Fa6Icons;
                 } else if (!pascalCaseIconName) {
                    pascalCaseIconName = rawIconName as keyof typeof Fa6Icons;
                 }
            }
            
            const attrs = attributesString ? attributesString.trim() : '';
            return `<${pascalCaseIconName}${attrs ? ' ' + attrs : ''}></${pascalCaseIconName}>`;
        }
    );
}

function applySimpleMarkdown(content: string): string {
    if (!content) return '';
    let result = content;
    result = result.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    result = result.replace(/\*(.*?)\*/g, '<em>$1</em>');
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

        // Ensure we are dealing with an Element node before accessing properties like .name or .children
        if (domNode instanceof Element && domNode.name) {
            const nodeName = domNode.name;
            const lowerCaseName = nodeName.toLowerCase();
            
            const mutableAttribs = attributesToProps(domNode.attribs || {});
            const children = domNode.children && domNode.children.length > 0
                           ? domToReact(domNode.children, simplifiedParserOptions) 
                           : null;

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
                return React.createElement(IconComponent, finalProps);
            } else if (lowerCaseName.startsWith('fa') && !isValidFa6Icon(nodeName) && !iconNameMap[lowerCaseName]) {
                logger.warn(`[VCR] Unknown Fa Icon Tag or unmapped: <${nodeName}> (lc: ${lowerCaseName})`);
                return <span title={`Unknown/Unmapped Fa Icon: ${nodeName}`} className="text-orange-500 font-bold">{`[?] Неизвестная иконка <${nodeName}>`}</span>;
            }

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