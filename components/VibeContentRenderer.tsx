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

  // Updated regex to handle optional attributes and different quote types
  // Breakdown:
  // ::                                  - Opening delimiter
  // (                                   - Start of capturing group 1 (full icon tag)
  //   (Fa[A-Za-z0-9]+|fa-[a-z0-9-]+)    - Capturing group 2 (icon alias: FaCamelCase or fa-kebab-case)
  //   (                                 - Start of capturing group 3 (attributes string, optional)
  //     \s+                             - At least one space before attributes
  //     (?:                             - Start of non-capturing group for attributes
  //       (?:className|title|style)     - Attribute name (className, title, style)
  //       \s*=\s*                       - Equals sign with optional spaces
  //       (?:                           - Start of non-capturing group for attribute value
  //         '[^']*'                     - Single-quoted value
  //         |                           - OR
  //         "[^"]*"                     - Double-quoted value
  //         |                           - OR
  //         \{[^}]*?\}                  - Curly-braced value (e.g., for style object, non-greedy)
  //       )                             - End of attribute value group
  //       \s*                           - Optional spaces after attribute
  //     )+                              - Match one or more attributes
  //   )?                                - End of capturing group 3 (attributes string is optional)
  // )                                   - End of capturing group 1
  // ::                                  - Closing delimiter
  const iconRegex = /::((Fa[A-Za-z0-9]+|fa-[a-z0-9-]+)(\s+(?:(?:className|title|style)\s*=\s*(?:'[^']*'|"[^"]*"|\{[^}]*?\}))+)?)::/g;


  let match;
  while ((match = iconRegex.exec(content)) !== null) {
    const plainText = content.substring(lastIndex, match.index);
    if (plainText) {
      renderableParts.push(plainText);
    }

    const fullMatch = match[0];
    const iconTagContent = match[1]; // Content inside :: ::, e.g., "FaBeer className='text-blue-500'"
    const iconAlias = match[2].toLowerCase(); // Alias, e.g., "fabeer"
    const attributesString = match[3] || ""; // Attributes part, e.g., " className='text-blue-500'"

    logger.debug(`[${debugContext}] Matched icon tag: ${fullMatch} | Alias: ${iconAlias} | Attributes: '${attributesString}'`);

    const IconComponent = iconNameMap[iconAlias] ? Fa6Icons[iconNameMap[iconAlias] as keyof typeof Fa6Icons] : null;

    if (IconComponent) {
      const props: any = {};
      // Parse attributes
      // className='text-xl' title="My Icon" style={{color: 'red'}}
      const attrRegex = /(className|title|style)\s*=\s*(?:'([^']*)'|"([^"]*)"|({[^}]*?}))/g;
      let attrMatch;
      while((attrMatch = attrRegex.exec(attributesString)) !== null) {
        const key = attrMatch[1];
        const singleQuotedValue = attrMatch[2];
        const doubleQuotedValue = attrMatch[3];
        const objectValue = attrMatch[4];

        if (key === 'style' && objectValue) {
          try {
            // Convert style string "{color:'red'}" to an object.
            // This is a simplified parser; for complex styles, a more robust solution is needed.
            // For now, assume simple JSON-like structure for style.
            const styleObject = JSON.parse(objectValue.replace(/'/g, '"')); // Replace single quotes for JSON compatibility
            props.style = styleObject;
            logger.debug(`[${debugContext}] Parsed style for ${iconAlias}:`, styleObject);
          } catch (e) {
            logger.error(`[${debugContext}] Failed to parse style attribute for ${iconAlias}: ${objectValue}`, e);
          }
        } else {
          props[key] = singleQuotedValue || doubleQuotedValue || objectValue;
          logger.debug(`[${debugContext}] Parsed prop for ${iconAlias}: ${key} = ${props[key]}`);
        }
      }
      
      // Unique key for React list
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
      return <>{content}</>; // Return original content if parsing fails or no icons
  }
  if (renderableParts.length === 1 && typeof renderableParts[0] === 'string' && renderableParts[0] === content) {
     // This means no icons were found, and it's just plain text.
     logger.debug(`[${debugContext}] Content "${content}" is plain text, no icons found.`);
  }


  // logger.debug(`[${debugContext}] Final renderable parts:`, renderableParts.map(p => typeof p === 'string' ? p : `<${(p as JSX.Element).type.displayName || (p as JSX.Element).type.name || 'Icon'}>`));
  return <>{renderableParts}</>;
};

export default VibeContentRenderer;