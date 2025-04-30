import { FileNode, ImportCategory } from "@/contexts/RepoXmlPageContext"; // Assuming types are moved to context or a types file

// --- Helper Functions ---

/**
 * Determines the programming language based on file extension.
 */
export const getLanguage = (path: string): string => {
    const ext = path.split('.').pop()?.toLowerCase();
    switch (ext) {
        case 'ts': case 'tsx': return 'typescript';
        case 'js': case 'jsx': return 'javascript';
        case 'py': return 'python';
        case 'css': return 'css';
        case 'scss': case 'sass': return 'scss'; // Added scss/sass
        case 'html': return 'html';
        case 'json': return 'json';
        case 'md': return 'markdown';
        case 'sql': return 'sql';
        case 'php': return 'php';
        case 'rb': return 'ruby';
        case 'go': return 'go';
        case 'java': return 'java';
        case 'cs': return 'csharp';
        case 'sh': return 'bash';
        case 'yml': case 'yaml': return 'yaml';
        case 'toml': return 'toml'; // Added toml
        case 'xml': return 'xml'; // Added xml
        case 'env': return 'bash'; // Treat .env like bash for highlighting
        default: return 'plaintext';
    }
};

/**
 * Simple delay function.
 */
export const delay = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Categorizes a resolved file path based on common directory structures.
 */
export const categorizeResolvedPath = (resolvedPath: string): ImportCategory => {
    if (!resolvedPath) return 'other';
    const pL = resolvedPath.toLowerCase();
    // Order matters: more specific first
    if (pL.includes('/contexts/') || pL.startsWith('contexts/')) return 'context';
    if (pL.includes('/hooks/') || pL.startsWith('hooks/')) return 'hook';
    if (pL.includes('/lib/') || pL.startsWith('lib/')) return 'lib';
    // Ensure it's a component but not a UI primitive if that distinction is needed
    if ((pL.includes('/components/') || pL.startsWith('components/')) && !pL.includes('/components/ui/')) return 'component';
    // Add more categories if needed (e.g., 'utils', 'styles', 'services')
    return 'other';
};

/**
 * Extracts import/require paths from JS/TS code content.
 */
export const extractImports = (content: string): string[] => {
    // Regex for standard ES6 imports (covers default, named, namespace, side-effect)
    const importRegex = /import(?:(?:["'\s]*(?:[\w*{}\n\r\t, ]+)from\s*)?)(["']((?:@[/\w.-]+)|(?:[./]+[\w./-]+))["'])/g;
    // Regex for require() calls
    const requireRegex = /require\s*\(\s*(["']((?:@[/\w.-]+)|(?:[./]+[\w./-]+))["'])\s*\)/g;
    // Regex for dynamic imports import('...')
    const dynamicImportRegex = /import\s*\(\s*(["']((?:@[/\w.-]+)|(?:[./]+[\w./-]+))["'])\s*\)/g;

    const imports = new Set<string>();
    let match;

    while ((match = importRegex.exec(content)) !== null) {
        // match[2] is the path without quotes
        if (match[2] && match[2] !== '.') {
            imports.add(match[2]);
        }
    }

    while ((match = requireRegex.exec(content)) !== null) {
        // match[2] is the path without quotes
        if (match[2] && match[2] !== '.') {
            imports.add(match[2]);
        }
    }

     while ((match = dynamicImportRegex.exec(content)) !== null) {
        // match[2] is the path without quotes
        if (match[2] && match[2] !== '.') {
            imports.add(match[2]);
        }
    }

    return Array.from(imports);
};

/**
 * Tries to resolve an import path relative to a current file path within a list of all project files.
 * Handles relative paths, alias paths (@/), and some common root directory patterns.
 */
export const resolveImportPath = (
    importPath: string,
    currentFilePath: string,
    allFileNodes: FileNode[] // Expects { path: string; ... } objects
): string | null => {
    const allPaths = allFileNodes.map(f => f.path);
    // Standard extensions to check, order might matter slightly
    const standardExtensions = ['.ts', '.tsx', '.js', '.jsx', '.json', '.css', '.scss', '.sql', '.md'];

    // --- Internal Helper: tryPath ---
    // Tries to find a matching file path for a base path, checking extensions and index files.
    const tryPath = (basePath: string): string | null => {
        const pathsToTry: string[] = [];
        const hasExplicitExtension = /\.\w+$/.test(basePath);

        if (hasExplicitExtension) {
            pathsToTry.push(basePath); // Try the exact path first
        }

        // Always try adding standard extensions, even if one was provided (e.g., importing './styles.css' should resolve)
        standardExtensions.forEach(ext => pathsToTry.push(basePath + ext));
        // Try adding /index with standard extensions (common pattern)
        standardExtensions.forEach(ext => pathsToTry.push(`${basePath}/index${ext}`));

        // Create a unique set to avoid redundant checks
        const uniquePathsToTry = Array.from(new Set(pathsToTry));

        // Check if any of the generated paths exist in the project files
        for (const p of uniquePathsToTry) {
            if (allPaths.includes(p)) {
                return p; // Found a match
            }
        }
        return null; // No match found
    };

    // --- 1. Resolve Alias Paths (e.g., @/...) ---
    if (importPath.startsWith('@/')) {
        // Define possible base directories for aliases (adjust based on your tsconfig/jsconfig)
        const aliasBasePaths = ['src/', 'app/', './', '']; // Common locations, '' handles root-level alias
        const pathSegment = importPath.substring(2); // Remove '@/'

        for (const base of aliasBasePaths) {
            const resolved = tryPath(base + pathSegment);
            if (resolved) return resolved;
        }
        // Fallback check for specific common root directories if not found directly under src/ or app/
        const commonRootDirs = ['components/', 'lib/', 'utils/', 'hooks/', 'contexts/', 'styles/', 'services/'];
         for (const rootDir of commonRootDirs) {
             if (pathSegment.startsWith(rootDir)) {
                  // Try resolving assuming the alias points directly to these roots
                  const resolved = tryPath(pathSegment);
                  if (resolved) return resolved;
             }
         }
    }
    // --- 2. Resolve Relative Paths (e.g., ./ or ../) ---
    else if (importPath.startsWith('.')) {
        const currentDir = currentFilePath.includes('/') ? currentFilePath.substring(0, currentFilePath.lastIndexOf('/')) : '';
        // Combine current directory with relative path
        const combinedPath = (currentDir ? currentDir + '/' + importPath : importPath);

        // Normalize the path (handle '.', '..', multiple slashes)
        const pathParts = combinedPath.split('/');
        const resolvedParts: string[] = [];
        for (const part of pathParts) {
            if (part === '.' || part === '') continue; // Skip current dir refs or empty parts
            if (part === '..') {
                if (resolvedParts.length > 0) {
                    resolvedParts.pop(); // Go up one directory
                }
                // else: trying to go above root, ignore '..'
            } else {
                resolvedParts.push(part); // Add directory/file name
            }
        }
        const resolvedRelativeBase = resolvedParts.join('/');
        const resolved = tryPath(resolvedRelativeBase);
        if (resolved) return resolved;
    }
    // --- 3. Resolve Bare Imports (could be node_modules or implicitly root dirs) ---
    // This is a heuristic approach, as we don't have full node_modules resolution.
    // We prioritize common source directories within the project structure.
    else {
        // Check common source roots relative to the project root
        const commonSourceRoots = ['src/lib/', 'src/utils/', 'src/components/', 'src/hooks/', 'src/contexts/', 'src/styles/', 'src/services/', 'lib/', 'utils/', 'components/', 'hooks/', 'contexts/', 'styles/', 'services/'];
        for (const base of commonSourceRoots) {
            const resolved = tryPath(base + importPath);
            if (resolved) return resolved;
        }
         // Very basic check: if it looks like a file path (has extension or '/'), try resolving from root
         if (importPath.includes('/') || /\.\w+$/.test(importPath)) {
             const resolved = tryPath(importPath);
             if (resolved) return resolved;
         }
         // If it doesn't contain '/', doesn't start with '.', and wasn't found in common roots,
         // it's likely a node_module. We can't resolve that here, so return null.
    }

    // --- 4. Fallback ---
    // If no other resolution worked, try resolving directly from the root
    // (handles cases like importing 'package.json')
    const resolvedFromRoot = tryPath(importPath);
    if (resolvedFromRoot) return resolvedFromRoot;


    return null; // Path couldn't be resolved within the known project files using these heuristics
};


/**
 * Finds the corresponding file path (e.g., app/about/page.tsx) for a given Next.js route path (e.g., /about).
 * Handles static routes, dynamic routes ([slug]), and common file naming conventions (page.js/tsx, index.js/tsx).
 */
export const getPageFilePath = (
    routePath: string, // e.g., "/dashboard/settings", "/users/[id]"
    allPaths: string[] // List of all file paths in the project
): string | null => {
    // Normalize route path: remove leading/trailing slashes, handle root
    const cleanRoute = routePath.replace(/^\/|\/$/g, '');

    // --- Handle Root Path ---
    if (!cleanRoute) {
        const rootPageFiles = [
            'app/page.tsx', 'app/page.js',
            'src/app/page.tsx', 'src/app/page.js', // Check src/app too
             // Less common but possible: index files at root level
             'app/index.tsx', 'app/index.js',
             'src/app/index.tsx', 'src/app/index.js'
        ];
        for (const rp of rootPageFiles) {
            if (allPaths.includes(rp)) return rp;
        }
        return null; // No root page found
    }

    // --- Search Strategy ---
    // 1. Check for exact directory match with page.(js|tsx)
    // 2. Check for exact directory match with index.(js|tsx) (less common for app router pages)
    // 3. Check for dynamic route matches

    const routeSegments = cleanRoute.split('/');

    // Prioritize 'app/' directory, then 'src/app/'
    const basePrefixes = ['app/', 'src/app/'];

    for (const prefix of basePrefixes) {
        const basePath = prefix + cleanRoute; // e.g., "app/dashboard/settings"

        // --- Check 1 & 2: Static routes (page.* and index.*) ---
        const possibleStaticFiles = [
            `${basePath}/page.tsx`, `${basePath}/page.js`,
            `${basePath}/index.tsx`, `${basePath}/index.js`,
             // Check if the route itself points to a file directly (e.g., /about.tsx if routes are structured differently)
             `${prefix}${cleanRoute}.tsx`, `${prefix}${cleanRoute}.js`,
        ];
        for (const p of possibleStaticFiles) {
            if (allPaths.includes(p)) {
                return p;
            }
        }

         // --- Check 3: Dynamic routes ---
         const potentialDynamicPages = allPaths.filter(p =>
             p.startsWith(prefix) && // Must be in the current search prefix (app/ or src/app/)
             p.includes('[') && // Must contain dynamic segment markers
             (p.endsWith('/page.tsx') || p.endsWith('/page.js') || p.endsWith('/index.tsx') || p.endsWith('/index.js'))
         );

         for (const pagePath of potentialDynamicPages) {
             const suffix = ['/page.tsx', '/page.js', '/index.tsx', '/index.js'].find(s => pagePath.endsWith(s));
             if (!suffix) continue; // Should not happen based on filter

             // Extract the directory structure part of the potential page file path
             // e.g., "app/users/[id]/settings" from "app/users/[id]/settings/page.tsx"
             const pageDir = pagePath.substring(prefix.length, pagePath.length - suffix.length);
             const pageSegments = pageDir.split('/');

             // Compare segments count
             if (pageSegments.length !== routeSegments.length) continue;

             // Compare segments one by one
             let match = true;
             for (let i = 0; i < routeSegments.length; i++) {
                 const routeSeg = routeSegments[i];
                 const pageSeg = pageSegments[i];

                 // Allow mismatch only if the page segment is a dynamic placeholder
                 if (routeSeg !== pageSeg && !(pageSeg.startsWith('[') && pageSeg.endsWith(']'))) {
                     match = false;
                     break;
                 }
             }

             if (match) {
                 return pagePath; // Found a matching dynamic route page file
             }
         }

    } // End loop through prefixes (app/, src/app/)


    // --- Final Fallback (less likely for standard Next.js routing) ---
    // Check if the routePath directly matches a file path (e.g., if routePath was "app/some/file.tsx")
    if (allPaths.includes(routePath)) return routePath;
    if (allPaths.includes(`src/${routePath}`)) return `src/${routePath}`;


    return null; // No matching page file found
};