"use client";

import React from 'react';
import parse, { domToReact, HTMLReactParserOptions, Element, attributesToProps, Text } from 'html-react-parser';
import Link from 'next/link';
import * as Fa6Icons from "react-icons/fa6";
import { debugLogger as logger } from "@/lib/debugLogger";
import { iconNameMap } from '@/lib/iconNameMap'; 

// Initial check for Fa6Icons module
if (typeof Fa6Icons !== 'object' || Fa6Icons === null || Object.keys(Fa6Icons).length === 0) {
    logger.error("[VCR Pre-Init] Fa6Icons module from 'react-icons/fa6' appears to be empty or not loaded correctly. This will cause icon rendering failures.");
} else {
    // Optional: Check for a specific known icon to be more certain
    if (!Fa6Icons.FaBolt || typeof Fa6Icons.FaBolt !== 'function') {
        logger.warn("[VCR Pre-Init] Fa6Icons.FaBolt is missing or not a function. There might be an issue with the 'react-icons/fa6' import or package itself.");
    } else {
        // logger.debug("[VCR Pre-Init] Fa6Icons module seems to be loaded with FaBolt available.");
    }
}

function isValidFa6Icon(iconName: string): iconName is keyof typeof Fa6Icons {
    if (typeof Fa6Icons !== 'object' || Fa6Icons === null) return false; // Guard against Fa6Icons not being an object
    return typeof iconName === 'string' && iconName.startsWith('Fa') && iconName in Fa6Icons && typeof Fa6Icons[iconName as keyof typeof Fa6Icons] === 'function';
}

function preprocessIconSyntax(content: string): string {
    // ADDED: Log the content being preprocessed for TRIM_DEBUG
    logger.debug(`[VCR Preprocessor TRIM_DEBUG] Input content: "${String(content).substring(0,50)}", type: ${typeof content}`);
    if (typeof content !== 'string' || !content) { // Ensure content is a non-empty string before processing
        logger.debug("[VCR Preprocessor TRIM_DEBUG] Content is not a non-empty string, returning empty string.");
        return '';
    }
    // Ensure trim is only called on a string.
    const trimmedContent = content.trim();
    logger.debug(`[VCR Preprocessor TRIM_DEBUG] Trimmed content for regex: "${trimmedContent.substring(0,50)}"`);

    return trimmedContent.replace(
        /::(Fa\w+)(?:\s+className=(?:"([^"]*)"|'([^']*)'))?::/g,
        (_match, iconName, classValDouble, classValSingle) => {
            const classNameValue = classValDouble || classValSingle;
            if (!isValidFa6Icon(iconName)) {
                logger.warn(`[VCR Preprocessor] Encountered invalid or non-functional icon name in custom syntax: ${iconName}. Rendering as text.`);
                return `[ICON ERR!: ${iconName}]`;
            }
            return `<${iconName}${classNameValue ? ` class="${classNameValue}"` : ''} />`;
        }
    );
}

const simplifiedParserOptions: HTMLReactParserOptions = {
    replace: (domNode) => {
        if (domNode.type === 'text' || domNode instanceof Text) {
            return undefined; 
        }

        if (domNode instanceof Element && domNode.name) {
            const nodeName = domNode.name;
            const lowerCaseName = nodeName.toLowerCase();
            const mutableAttribs = attributesToProps(domNode.attribs || {});
            const children = domNode.children && domNode.children.length > 0
                           ? domToReact(domNode.children, simplifiedParserOptions)
                           : null;

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
                if (typeof IconComponent !== 'function') {
                    logger.error(`[VCR Render] IconComponent for '${iconToRender}' ('${iconComponentName}') is not a function at render time. Value:`, IconComponent);
                    return <span title={`Render Error: ${iconToRender} is not a function`} className="text-red-600 font-bold">{`[ICON FN ERR!: ${iconToRender}]`}</span>;
                }
                const { className, style, ...restProps } = mutableAttribs;
                const finalProps: Record<string, any> = {
                    ...restProps,
                    className: `${className || ''} inline align-baseline mx-px`.trim(),
                    style: style,
                };
                try {
                    return React.createElement(IconComponent, finalProps, children);
                } catch (e) {
                    logger.error(`[VCR Render] Error during React.createElement for icon <${iconComponentName}>:`, e, "Props:", finalProps);
                    return <span title={`createElement Error: ${iconComponentName}`} className="text-red-600 font-bold">{`[ICON CREATE ERR!: ${iconComponentName}]`}</span>;
                }
            } else if (lowerCaseName.startsWith('fa') || nodeName.startsWith('Fa')) { 
                logger.warn(`[VCR Render] Unknown/Unmapped/Invalid Fa Icon Tag: <${nodeName}> (lc: ${lowerCaseName})`);
                return <span title={`Unknown/Unmapped/Invalid Fa Icon: ${nodeName}`} className="text-orange-500 font-bold">{`[?${nodeName}?]`}</span>;
            }

            if (lowerCaseName === 'a') {
                const hrefVal = mutableAttribs.href;
                const isInternal = hrefVal && typeof hrefVal === 'string' && (hrefVal.startsWith('/') || hrefVal.startsWith('#'));
                let linkClassName = mutableAttribs.className || '';
                mutableAttribs.className = `${linkClassName} mx-1 px-0.5`.trim(); 

                if (isInternal && !mutableAttribs.target && hrefVal) {
                    const { href, className: finalLinkClassName, style: linkStyle, title: linkTitle, ...restLinkProps } = mutableAttribs;
                    return <Link href={href as string} className={finalLinkClassName as string} style={linkStyle as React.CSSProperties} title={linkTitle as string} {...restLinkProps}>{children}</Link>;
                }
                return React.createElement('a', mutableAttribs, children);
            }
            
            if (nodeName.match(/^[A-Z]/) && !iconToRender) {
                logger.warn(`[VCR Render] Encountered unknown uppercase tag <${nodeName}>. Not a recognized icon. Parser will attempt default handling or fail if not a known React component.`);
            }

            return undefined; 
        }
        
        return undefined; 
    },
};

interface VibeContentRendererProps {
  content: string | null | undefined;
  className?: string; 
}

export const VibeContentRenderer: React.FC<VibeContentRendererProps> = React.memo(({ content, className }) => {
    // ADDED: Log the raw content prop
    logger.debug(`[VCR TRIM_DEBUG] Raw content prop: "${String(content).substring(0,50)}", type: ${typeof content}`);

    if (typeof content !== 'string' || !content.trim()) { // Ensures content is a non-empty string
        logger.debug("[VCR] Content is null, undefined, or empty string after trim. Returning null.");
        return null;
    }
    
    // At this point, `content` is guaranteed to be a non-empty string.
    // `String(content)` is redundant but harmless.
    // `content.trim()` is safe.

    try {
      // `content` is already confirmed to be a string here.
      const preprocessedContent = preprocessIconSyntax(content); // Pass the string directly
      logger.debug(`[VCR TRIM_DEBUG] Content for parse(): "${preprocessedContent.substring(0,50)}"`);
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