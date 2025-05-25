"use client";

import React from 'react';
import parse, { HTMLReactParserOptions, Element, attributesToProps, domToReact } from 'html-react-parser';
import Link from 'next/link';
import * as Fa6Icons from "react-icons/fa6";
import { debugLogger as logger } from "@/lib/debugLogger";
import { cn } from '@/lib/utils'; // Assuming cn utility is available for class merging

// Full Icon Name Map (Lowercase or common names to PascalCase from react-icons/fa6)
// This map helps resolve various text representations to actual Fa6 icon component names.
const iconNameMap: { [key: string]: keyof typeof Fa6Icons } = {
  // General utility
  faspinner: 'FaSpinner',
  facheckcircle: 'FaCircleCheck', // faCheckCircle in FA5 is FaCircleCheck in FA6
  fatriangleexclamation: 'FaTriangleExclamation',
  falanguage: 'FaLanguage',
  facopy: 'FaCopy',
  fapaste: 'FaPaste',
  faexternallinkalt: 'FaExternalLinkAlt', 
  faarrowupfrombracket: 'FaArrowUpFromBracket',
  fapaperplane: 'FaPaperPlane',

  // Specific to this page (XLSX, Brain, PDF, WandMagicSparkles)
  fafileexcel: 'FaFileExcel', 
  faupload: 'FaUpload',
  fafilepdf: 'FaFilePdf',
  fabrain: 'FaBrain',
  fawandmagicsparkles: 'FaWandMagicSparkles', 

  // Placeholder/Fallback
  faquestion: 'FaQuestion',
  fatools: 'FaToolbox', 
};

// Helper function to get the icon component by its name
const getIconComponent = (name: string): React.ComponentType<any> | undefined => {
  const normalizedName = name.toLowerCase(); 
  // Try direct lookup in map first
  if (iconNameMap[normalizedName]) {
    return Fa6Icons[iconNameMap[normalizedName] as keyof typeof Fa6Icons];
  }

  // Try PascalCase conversion if not found in map
  // E.g., 'FaUpload' -> 'FaUpload', 'FaFilePdf' -> 'FaFilePdf'
  if (Fa6Icons[name as keyof typeof Fa6Icons]) {
    return Fa6Icons[name as keyof typeof Fa6Icons];
  }
  
  // As a last resort, try removing 'fa' prefix and then PascalCase
  const trimmedName = name.startsWith('Fa') ? name.substring(2) : name;
  const pascalCaseName = trimmedName.split(/(?=[A-Z])/).map(word => word.charAt(0).toUpperCase() + word.slice(1)).join('');
  if (Fa6Icons[`Fa${pascalCaseName}` as keyof typeof Fa6Icons]) {
      return Fa6Icons[`Fa${pascalCaseName}` as keyof typeof Fa6Icons];
  }


  logger.warn(`[VibeContentRenderer] Icon component for "${name}" not found in Fa6Icons or map.`);
  return undefined; // Icon not found
};


interface VibeContentRendererProps {
  content: string | null | undefined;
  className?: string;
  spin?: boolean; // Added spin prop for animation
}

export const VibeContentRenderer: React.FC<VibeContentRendererProps> = React.memo(({ content, className, spin }) => {
    if (typeof content !== 'string' || !content.trim()) {
        return null; // Return null if content is not a valid string
    }

    const options: HTMLReactParserOptions = {
        replace: (domNode) => {
            // Intercept custom icon syntax like "::FaIconName::"
            if (domNode.type === 'text') {
                const text = domNode.data || '';
                const iconRegex = /::(Fa[A-Za-z0-9]+)::/g; // Matches ::FaIconName::
                const parts: (string | React.ReactNode)[] = [];
                let lastIndex = 0;
                let match;

                while ((match = iconRegex.exec(text)) !== null) {
                    const iconKey = match[1]; // e.g., "FaWandMagicSparkles"
                    const IconComponent = getIconComponent(iconKey);

                    // Add text before the icon
                    if (match.index > lastIndex) {
                        parts.push(text.substring(lastIndex, match.index));
                    }

                    if (IconComponent) {
                        // Pass className and spin prop to the icon component
                        // react-icons doesn't have a `spin` prop directly, so use `animate-spin` Tailwind class
                        parts.push(
                            <IconComponent
                                key={iconKey + match.index} // Unique key for react list
                                className={cn(className, spin && 'animate-spin')} // Apply animate-spin if `spin` is true
                            />
                        );
                    } else {
                        logger.warn(`[VibeContentRenderer] Icon component for "${iconKey}" not found. Rendering raw text.`);
                        parts.push(match[0]); // Render original text if icon not found
                    }
                    lastIndex = iconRegex.lastIndex;
                }

                // Add any remaining text after the last icon
                if (lastIndex < text.length) {
                    parts.push(text.substring(lastIndex));
                }
                return <>{parts}</>; // Return a fragment with all parts
            }

            // Handle standard HTML elements like <a> tags for Next.js Link
            if (domNode.type === 'tag' && domNode.name === 'a') {
                const props = attributesToProps(domNode.attribs);
                return (
                    <Link href={props.href || ''} {...props}>
                        {domToReact(domNode.children as Element[], options)}
                    </Link>
                );
            }
            // Standard parsing for other elements
            return undefined;
        },
    };

    return (
        <div className={cn('vibe-content-renderer', className)}>
            {parse(content, options)}
        </div>
    );
});