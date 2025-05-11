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
    if (!Fa6Icons.FaBolt) {
        logger.warn("[VCR Pre-Init] Fa6Icons.FaBolt is missing. There might be an issue with the 'react-icons/fa6' import or package itself.");
    } else {
        // logger.debug("[VCR Pre-Init] Fa6Icons module seems to be loaded with FaBolt available.");
    }
}

function isValidFa6Icon(iconName: string): iconName is keyof typeof Fa6Icons {
    if (typeof Fa6Icons !== 'object' || Fa6Icons === null) return false; // Guard against Fa6Icons not being an object
    return typeof iconName === 'string' && iconName.startsWith('Fa') && iconName in Fa6Icons && typeof Fa6Icons[iconName as keyof typeof Fa6Icons] === 'function';
}

function preprocessIconSyntax(content: string): string {
    if (!content) return '';
    return content.replace(
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
                // Double check IconComponent is a function right before using it
                if (typeof IconComponent !== 'function') {
                    logger.error(`[VCR Render] IconComponent for '${iconToRender}' is not a function at render time. Value:`, IconComponent);
                    return <span title={`Render Error: ${iconToRender} is not a function`} className="text-red-600 font-bold">{`[ICON FN ERR!]`}</span>;
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
                    return <span title={`createElement Error: ${iconComponentName}`} className="text-red-600 font-bold">{`[ICON CREATE ERR!]`}</span>;
                }
            } else if (lowerCaseName.startsWith('fa') || nodeName.startsWith('Fa')) { 
                logger.warn(`[VCR Render] Unknown/Unmapped Fa Icon Tag: <${nodeName}> (lc: ${lowerCaseName})`);
                return <span title={`Unknown/Unmapped Fa Icon: ${nodeName}`} className="text-orange-500 font-bold">{`<${nodeName}>`}</span>;
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
    if (typeof content !== 'string' || !content.trim()) {
        return null;
    }
    try {
      const preprocessedContent = preprocessIconSyntax(String(content));
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