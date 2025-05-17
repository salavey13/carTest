// /components/VibeContentRenderer.tsx
import React from 'react';
import * as Fa6Icons from 'react-icons/fa6';
import { iconNameMap } from '@/lib/iconNameMap';
import { debugLogger as logger } from '@/lib/debugLogger';

interface VibeContentRendererProps {
  content: string | null | undefined;
  debugContext?: string;
}

const VibeContentRenderer: React.FC<VibeContentRendererProps> = ({ content, debugContext = "VCR" }) => {
  if (typeof content !== 'string' || !content) {
    return null;
  }

  const renderableParts: (JSX.Element | string)[] = [];
  let lastIndex = 0;

  // Regex to capture:
  // 1. Icon alias (FaCamelCase or fa-kebab-case)
  // 2. The rest of the string within :: :: which might contain attributes
  const iconRegex = /::(Fa[A-Za-z0-9]+|fa-[a-z0-9-]+)((?:\s+[^:]+)?)::/g;
  // Example: ::FaBeer className='text-blue-500' title='Beer time'::
  // match[1] = "FaBeer" (iconAlias)
  // match[2] = " className='text-blue-500' title='Beer time'" (rawAttributesString)

  let match;
  while ((match = iconRegex.exec(content)) !== null) {
    const plainText = content.substring(lastIndex, match.index);
    if (plainText) {
      renderableParts.push(plainText);
    }

    const fullMatch = match[0];
    const iconAlias = match[1].toLowerCase(); 
    const rawAttributesString = (match[2] || "").trim(); 

    logger.debug(`[${debugContext}] Matched icon tag: ${fullMatch} | Alias: ${iconAlias} | Raw Attributes: '${rawAttributesString}'`);

    const IconComponent = iconNameMap[iconAlias] ? Fa6Icons[iconNameMap[iconAlias] as keyof typeof Fa6Icons] : null;

    if (IconComponent) {
      const props: any = {};
      if (rawAttributesString) {
        // Regex to parse individual attributes: key='value', key="value", or key={value}
        const attrRegex = /(className|title|style)\s*=\s*(?:'([^']*)'|"([^"]*)"|({[^}]*?}))/g;
        let attrMatch;
        while((attrMatch = attrRegex.exec(rawAttributesString)) !== null) {
          const key = attrMatch[1];
          const singleQuotedValue = attrMatch[2];
          const doubleQuotedValue = attrMatch[3];
          const objectValue = attrMatch[4]; // For style objects like {color:'red'}

          if (key === 'style' && objectValue) {
            try {
              // This is a very basic style parser. For production, a safer method is needed.
              // It attempts to convert something like "{color:'red', fontSize:'12px'}"
              // It expects keys and string values to be single-quoted for this simple replacement.
              const styleStringForJson = objectValue
                .replace(/(\w+)\s*:/g, '"$1":') // Add quotes to keys: {color: -> {"color":
                .replace(/'/g, '"'); // Replace single quotes with double quotes for JSON
              const styleObject = JSON.parse(styleStringForJson);
              props.style = styleObject;
              logger.debug(`[${debugContext}] Parsed style for ${iconAlias}:`, styleObject);
            } catch (e) {
              logger.error(`[${debugContext}] Failed to parse style attribute for ${iconAlias}: ${objectValue}`, e);
            }
          } else {
            props[key] = singleQuotedValue || doubleQuotedValue || objectValue; // prioritize quoted values
            logger.debug(`[${debugContext}] Parsed prop for ${iconAlias}: ${key} = ${props[key]}`);
          }
        }
      }
      
      const key = `icon-${match.index}-${iconAlias}`;
      renderableParts.push(React.createElement(IconComponent, { key, ...props }));
      logger.debug(`[${debugContext}] Rendered <${iconNameMap[iconAlias]}> with props:`, props);

    } else {
      logger.warn(`[${debugContext}] Icon alias "${iconAlias}" not found in iconNameMap or Fa6Icons. Full tag: ${fullMatch}`);
      renderableParts.push(`[ICON ERR: ${iconAlias}]`);
    }
    lastIndex = match.index + match[0].length;
  }

  const remainingText = content.substring(lastIndex);
  if (remainingText) {
    renderableParts.push(remainingText);
  }
  
  if (renderableParts.length === 0 && content.trim() !== "") {
      logger.warn(`[${debugContext}] No renderable parts produced for non-empty content: "${content}". This might indicate a regex issue or no icons to parse.`);
      return <>{content}</>; 
  }
  if (renderableParts.length === 1 && typeof renderableParts[0] === 'string' && renderableParts[0] === content) {
     logger.debug(`[${debugContext}] Content "${content}" is plain text, no icons found.`);
  }

  return <>{renderableParts}</>;
};

export default VibeContentRenderer;