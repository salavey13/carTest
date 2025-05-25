"use client";

import React from 'react';
import parse, { HTMLReactParserOptions, Element, attributesToProps, domToReact } from 'html-react-parser';
import Link from 'next/link';
import * as Fa6Icons from "react-icons/fa6";
import { debugLogger as logger } from "@/lib/debugLogger";
import { cn } from '@/lib/utils'; 

// Full Icon Name Map (Lowercase or common names to PascalCase from react-icons/fa6)
// This map helps resolve various text representations to actual Fa6 icon component names.
const iconNameMap: { [key: string]: keyof typeof Fa6Icons } = {
  // Common icons used across the app (minimal set as per initial prompt context)
  faspinner: 'FaSpinner',
  falanguage: 'FaLanguage',
  // Specific icons for toppdf page
  fawandmagicsparkles: 'FaWandMagicSparkles',
  faarrowupfrombracket: 'FaArrowUpFromBracket',
  fafileexcel: 'FaFileExcel',
  fabrain: 'FaBrain',
  facopy: 'FaCopy',
  faexternallinkalt: 'FaExternalLinkAlt',
  fafilepdf: 'FaFilePdf',
  fapaperplane: 'FaPaperPlane',
  facheckcircle: 'FaCircleCheck', 
  fatriangleexclamation: 'FaTriangleExclamation',
  
  // As per original provided code context, adding placeholders or assuming usage
  fatools: 'FaToolbox', 
};

// Helper function to get the icon component by its name
const getIconComponent = (name: string): React.ComponentType<any> | undefined => {
  const normalizedName = name.toLowerCase(); 
  if (iconNameMap[normalizedName]) {
    return Fa6Icons[iconNameMap[normalizedName] as keyof typeof Fa6Icons];
  }
  // Fallback to direct PascalCase check if not in map
  if (Fa6Icons[name as keyof typeof Fa6Icons]) {
      return Fa6Icons[name as keyof typeof Fa6Icons];
  }
  logger.warn(`[VibeContentRenderer] Icon component for "${name}" not found in Fa6Icons or map.`);
  return undefined; 
};


interface VibeContentRendererProps {
  content: string | null | undefined;
  className?: string;
  spin?: boolean; 
}

// Changed to ONLY default export. This is the standard way to export a single component.
const VibeContentRenderer: React.FC<VibeContentRendererProps> = React.memo(({ content, className, spin }) => {
    if (typeof content !== 'string' || !content.trim()) {
        return null; 
    }

    const options: HTMLReactParserOptions = {
        replace: (domNode) => {
            if (domNode.type === 'text') {
                const text = domNode.data || '';
                const iconRegex = /::(Fa[A-Za-z0-9]+)::/g; 
                const parts: (string | React.ReactNode)[] = [];
                let lastIndex = 0;
                let match;

                while ((match = iconRegex.exec(text)) !== null) {
                    const iconKey = match[1]; 
                    const IconComponent = getIconComponent(iconKey);

                    if (match.index > lastIndex) {
                        parts.push(text.substring(lastIndex, match.index));
                    }

                    if (IconComponent) {
                        parts.push(
                            <IconComponent
                                key={iconKey + match.index} 
                                className={cn(className, spin && 'animate-spin')} 
                            />
                        );
                    } else {
                        logger.warn(`[VibeContentRenderer] Icon component for "${iconKey}" not found. Rendering raw text.`);
                        parts.push(match[0]); 
                    }
                    lastIndex = iconRegex.lastIndex;
                }

                if (lastIndex < text.length) {
                    parts.push(text.substring(lastIndex));
                }
                return <>{parts}</>; 
            }

            if (domNode.type === 'tag' && domNode.name === 'a') {
                const props = attributesToProps(domNode.attribs);
                return (
                    <Link href={props.href || ''} {...props}>
                        {domToReact(domNode.children as Element[], options)}
                    </Link>
                );
            }
            return undefined;
        },
    };

    return (
        <div className={cn('vibe-content-renderer', className)}>
            {parse(content, options)}
        </div>
    );
});

export default VibeContentRenderer;