// /lib/codeUtils.ts
/**
 * Selects the start and end position (line-based) of a function/method definition
 * containing the given startIndex within the text. Handles comments and strings.
 * @param text The full source code text.
 * @param startIndex The index within the text to start searching from (usually the start of a relevant line).
 * @returns A tuple [startPosition, endPosition] or [-1, -1] if not found.
 */
export const selectFunctionDefinition = (text: string, startIndex: number): [number, number] => {
    const declarationLineStart = text.lastIndexOf('\n', startIndex - 1) + 1;
    let braceStart = -1;
    let searchPos = declarationLineStart;
    let inSingleLineComment = false;
    let inMultiLineComment = false;
    let inString: '"' | "'" | null = null;
    let parenDepth = 0;

    // Find the opening brace '{' that likely starts the function body
    while(searchPos < text.length) {
        const char = text[searchPos];
        const prevChar = searchPos > 0 ? text[searchPos - 1] : '';

        // Skip comments and strings
        if (inSingleLineComment) {
            if (char === '\n') inSingleLineComment = false;
        } else if (inMultiLineComment) {
            if (char === '/' && prevChar === '*') inMultiLineComment = false;
        } else if (inString) {
            if (char === inString && prevChar !== '\\') inString = null;
        } else if (char === '/' && prevChar === '/') {
            inSingleLineComment = true;
        } else if (char === '*' && prevChar === '/') {
            inMultiLineComment = true;
        } else if (char === '"' || char === "'") {
            inString = char;
        }
        // Track parenthesis depth for accurate function signature detection
        else if (char === '(') {
            parenDepth++;
        } else if (char === ')') {
            parenDepth--;
        }
        // Found a potential opening brace when not inside parenthesis
        else if (char === '{' && parenDepth === 0) {
            const precedingText = text.substring(declarationLineStart, searchPos).trim();
            // Check common patterns preceding a function body brace
            if (precedingText.endsWith(')') || precedingText.endsWith('=>') || precedingText.match(/[a-zA-Z0-9_$]\s*$/)) {
                braceStart = searchPos;
                break;
            }
            // Check for class/object method shorthand
            if (precedingText.match(/[a-zA-Z0-9_$]+\s*\([^)]*\)$/)) {
                braceStart = searchPos;
                break;
            }
        }

        // Optimization: If we hit a potential new top-level declaration on a new line,
        // and haven't found the opening brace yet, stop searching this potential block.
        if (char === '\n' && text.substring(searchPos + 1).match(/^\s*(?:async\s+|function\s+|const\s+|let\s+|var\s+|class\s+|get\s+|set\s+|[a-zA-Z0-9_$]+\s*\(|\/\/|\/\*)/)) {
             if (braceStart === -1) break;
        }
        searchPos++;
    }

    if (braceStart === -1) return [-1, -1]; // Opening brace not found

    // Find matching closing brace '}'
    let depth = 1;
    let pos = braceStart + 1;
    inSingleLineComment = false;
    inMultiLineComment = false;
    inString = null;

    while (pos < text.length && depth > 0) {
        const char = text[pos];
        const prevChar = pos > 0 ? text[pos - 1] : '';

        // Skip comments and strings
        if (inSingleLineComment) { if (char === '\n') inSingleLineComment = false; }
        else if (inMultiLineComment) { if (char === '/' && prevChar === '*') inMultiLineComment = false; }
        else if (inString) { if (char === inString && prevChar !== '\\') inString = null; }
        else if (char === '/' && prevChar === '/') { inSingleLineComment = true; }
        else if (char === '*' && prevChar === '/') { inMultiLineComment = true; }
        else if (char === '"' || char === "'") { inString = char; }
        // Track brace depth
        else if (char === '{') depth++;
        else if (char === '}') depth--;
        pos++;
    }

     if (depth !== 0) return [-1,-1]; // No matching closing brace found

     const closingBracePos = pos - 1;
     // Include the entire line where the closing brace is found for better replacement
     let closingLineEnd = text.indexOf('\n', closingBracePos);
     if (closingLineEnd === -1) closingLineEnd = text.length; // End of file

     return [declarationLineStart, closingLineEnd];
};

/**
 * Extracts a potential function or method name from a line of code.
 * @param line The line of code to check.
 * @returns The extracted name or null if not found.
 */
export const extractFunctionName = (line: string): string | null => {
    // Match common function/variable declarations (including async)
    const funcMatch = line.match(/(?:export\s+)?(?:async\s+)?(?:function\s+|const\s+|let\s+|var\s+)?\s*([a-zA-Z0-9_$]+)\s*(?:[:=(]|\s*=>)/);
    if (funcMatch && funcMatch[1]) return funcMatch[1];

    // Match method definitions (class or object literal, including async, get, set)
    const methodMatch = line.match(/^\s*(?:async\s+)?(?:get\s+|set\s+)?([a-zA-Z0-9_$]+)\s*\(/);
    // Exclude common control flow keywords that look like method calls
    if (methodMatch && methodMatch[1] && !['if', 'for', 'while', 'switch', 'catch', 'constructor'].includes(methodMatch[1])) return methodMatch[1];

    return null;
};

/**
 * Extracts the file extension from a path string.
 * @param filePath The path to the file.
 * @returns The file extension (e.g., "tsx", "js") or an empty string if no extension is found.
 */
export const getFileExtension = (filePath: string): string => {
    if (!filePath || typeof filePath !== 'string') return '';
    // Handle paths that might be just an extension like ".github" by checking if it's the only part
    const parts = filePath.split('/');
    const lastPart = parts[parts.length - 1];
    
    const lastDotIndex = lastPart.lastIndexOf('.');
    // If no dot, or dot is at the beginning of the last part (e.g., ".gitignore"), no traditional extension.
    if (lastDotIndex === -1 || lastDotIndex === 0) {
        // If the whole path is just something like ".github", it's not an extension but a name.
        if (filePath.startsWith('.') && !filePath.includes('/', 1) && lastDotIndex === 0) return '';
        return '';
    }
    return lastPart.substring(lastDotIndex + 1).toLowerCase();
};

/**
 * Detects potential file paths mentioned in a text, typically in comments or AI descriptions.
 * This is a heuristic and might not be 100% accurate.
 * @param text The text to search for file paths.
 * @returns An array of detected file path strings.
 */
export const detectFilePaths = (text: string): string[] => {
    const paths = new Set<string>();
    // Regex to find typical file paths, including those starting with './', '../', '@/', or just a name.
    // It also looks for paths ending with common extensions.
    // And paths that might be in comments like // path/to/file.tsx or /* path/to/file.tsx */
    const pathRegex = /(?:\/\/|\/\*|\b(?:File(?::)?|Path(?::)?)\s*)?([@./\w-]+(?:[/\\][.\w-]+)*\.(?:tsx|ts|js|jsx|css|scss|json|md|py|html|yml|yaml|env|toml|xml|sh|sql|java|kt|go|rb|php|swift|c|cpp|h|hpp))/gi;
    let match;
    while ((match = pathRegex.exec(text)) !== null) {
        // Normalize path: replace backslashes, remove leading/trailing junk
        let normalizedPath = match[1].replace(/\\/g, '/').trim();
        // Remove potential leading comment markers if they were accidentally included by a greedy part of regex
        normalizedPath = normalizedPath.replace(/^(\/\/|\/\*|#|--)\s*/, '');
        // Remove trailing comment markers
        normalizedPath = normalizedPath.replace(/\s*\*\/$/, '').trim();
        
        // Basic validation to avoid overly generic matches
        if (normalizedPath.includes('.') && normalizedPath.length > 3) { 
            paths.add(normalizedPath);
        }
    }
    return Array.from(paths);
};