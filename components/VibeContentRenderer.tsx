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
    return content.replace(
        /::(Fa\w+)(?:\s+className=(?:"([^"]*)"|'([^']*)'))?::/g,
        (_match, iconName, classValDouble, classValSingle) => {
            const classNameValue = classValDouble || classValSingle;
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
                    // logger.debug(`[VCR] Rendering <${correctPascalCaseName} /> with props:`, finalProps);
                    return React.createElement(IconComponent, finalProps, children);
                } else {
                    logger.warn(`[VCR] Unknown Fa Icon Tag: <${nodeName}> (lc: ${lowerCaseName})`);
                    return <span title={`Unknown Fa Icon: ${nodeName}`} className="text-orange-500 font-bold">{`<${nodeName}>`}</span>;
                }
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
            
            // For any other standard HTML element, let html-react-parser handle it.
            // This ensures that tags like <b>, <i>, <span>, <p>, <br/> etc., are rendered normally along with their children.
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
        return null;
    }
    // logger.debug(`[VCR Root] Rendering content (length: ${content.length}): "${content.substring(0, 100)}${content.length > 100 ? '...' : ''}"`, { wrapperClassName: className });
    try {
      const preprocessedContent = preprocessIconSyntax(String(content));
      // logger.debug(`[VCR Root] Preprocessed content: "${preprocessedContent.substring(0,100)}${preprocessedContent.length > 100 ? '...' : ''}"`);
      const parsedContent = parse(preprocessedContent, simplifiedParserOptions); 
      
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