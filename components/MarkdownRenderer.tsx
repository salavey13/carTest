import React from 'react';

interface MarkdownRendererProps {
  text: string;
  className?: string; // Allow passing additional class names
}

/**
 * Renders a string containing simple markdown bold syntax (**bold text**)
 * into React elements with <strong> tags.
 */
const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ text, className }) => {
  // Split the text by the bold markdown pattern, keeping the delimiters
  const parts = text.split(/(\*\*.*?\*\*)/g);

  return (
    <p className={className}>
      {parts.map((part, index) => {
        // Check if the part matches the bold pattern
        if (part.startsWith('**') && part.endsWith('**')) {
          // Remove the asterisks and wrap the content in <strong>
          return <strong key={index}>{part.slice(2, -2)}</strong>;
        }
        // Return the plain text part
        // Using React.Fragment for keys when returning strings directly is good practice
        return <React.Fragment key={index}>{part}</React.Fragment>;
      })}
    </p>
  );
};

export default MarkdownRenderer;