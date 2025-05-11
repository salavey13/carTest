import type { FileNode, ImageReplaceTask, ImportCategory, FetchedRepoFile } from '@/contexts/RepoXmlPageContext';
import { debugLogger as logger } from './debugLogger';

// --- Tree Structure Generation ---
export interface TreeNode {
  name: string;
  path: string;
  type: 'file' | 'folder';
  children?: TreeNode[];
}

export function buildFileTree(files: FileNode[] | FetchedRepoFile[]): TreeNode[] {
  const root: TreeNode = { name: 'root', path: '', type: 'folder', children: [] };

  for (const file of files) {
    const parts = file.path.split('/');
    let currentNode = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLastPart = i === parts.length - 1;

      let childNode = currentNode.children?.find(child => child.name === part);

      if (!childNode) {
        childNode = {
          name: part,
          path: parts.slice(0, i + 1).join('/'),
          type: isLastPart ? 'file' : 'folder',
          children: isLastPart ? undefined : [],
        };
        if (!currentNode.children) {
            currentNode.children = []; // Should not happen if initialized with []
        }
        currentNode.children.push(childNode);
      }
      // If it's a folder and we thought it was a file, or vice versa (shouldn't happen with clean data)
      if (!isLastPart && childNode.type === 'file') {
        childNode.type = 'folder';
        childNode.children = childNode.children || [];
      }
      currentNode = childNode;
    }
  }
  return root.children || [];
}

export function generateTreeString(nodes: TreeNode[], indent = 0, maxDepth = 10): string {
  let treeString = '';
  const indentStr = '  '.repeat(indent); // Two spaces for indentation

  nodes.sort((a, b) => { // Sort: folders first, then by name
    if (a.type === 'folder' && b.type === 'file') return -1;
    if (a.type === 'file' && b.type === 'folder') return 1;
    return a.name.localeCompare(b.name);
  });

  for (const node of nodes) {
    treeString += `${indentStr}${node.type === 'folder' ? '📁' : '📄'} ${node.name}\n`;
    if (node.type === 'folder' && node.children && indent < maxDepth -1) {
      treeString += generateTreeString(node.children, indent + 1, maxDepth);
    }
  }
  return treeString;
}

// --- Import Path Classification ---
const importPatterns: Record<ImportCategory, RegExp[]> = {
  component: [
    /\/components?\//i,
    /\.(?:tsx|jsx)$/i, // More specific to UI components
  ],
  context: [
    /\/contexts?\//i,
    /Context\.tsx?$/i,
  ],
  hook: [
    /\/hooks?\//i,
    /^use[A-Z].*\.tsx?$/i, // Starts with 'use' and capital letter
  ],
  lib: [
    /\/lib\//i,
    /\/utils?\//i,
    /\/helpers?\//i,
  ],
  other: [], // Default category
};

export function classifyImportPath(path: string): ImportCategory {
  for (const category in importPatterns) {
    if (category === 'other') continue; // Skip 'other' for explicit matching
    const patterns = importPatterns[category as ImportCategory];
    if (patterns.some(pattern => pattern.test(path))) {
      return category as ImportCategory;
    }
  }
  return 'other';
}

// --- GitHub URL Parsing ---
export interface GitHubRepoInfo {
  owner: string;
  repo: string;
  branch?: string;
  filePath?: string;
  error?: string;
}

export function parseGitHubUrl(url: string): GitHubRepoInfo {
  if (!url) return { error: "URL is empty", owner: "", repo: "" };
  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.hostname !== "github.com") {
      return { error: "Not a GitHub URL", owner: "", repo: "" };
    }

    const pathParts = parsedUrl.pathname.split('/').filter(part => part.length > 0);
    if (pathParts.length < 2) {
      return { error: "Invalid GitHub URL path (missing owner/repo)", owner: "", repo: "" };
    }

    const owner = pathParts[0];
    const repo = pathParts[1];
    let branch: string | undefined;
    let filePath: string | undefined;

    if (pathParts.length > 3 && (pathParts[2] === "blob" || pathParts[2] === "tree")) {
      branch = pathParts[3];
      if (pathParts.length > 4) {
        filePath = pathParts.slice(4).join('/');
      }
    }
    return { owner, repo, branch, filePath };
  } catch (e: any) {
    logger.error("Error parsing GitHub URL:", e, "URL:", url);
    return { error: e.message || "Failed to parse URL", owner: "", repo: "" };
  }
}

export function isValidGitHubRepoUrl(url: string): boolean {
  const info = parseGitHubUrl(url);
  return !info.error && !!info.owner && !!info.repo;
}

// --- Text Processing ---
export function getHumanReadableSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export function extractFileExtension(filename: string): string | null {
    if (!filename || typeof filename !== 'string') return null;
    const lastDotIndex = filename.lastIndexOf('.');
    if (lastDotIndex === -1 || lastDotIndex === 0 || lastDotIndex === filename.length - 1) {
      return null; // No extension or hidden file
    }
    return filename.substring(lastDotIndex + 1).toLowerCase();
}

// --- Image Replace Task Parsing ---
export function parseImageReplaceIdea(ideaString: string, targetPath: string | null): ImageReplaceTask | null {
    logger.debug(`[parseImageReplaceIdea] Attempting to parse: "${ideaString}" with targetPath: "${targetPath}"`);
    if (!ideaString || !ideaString.startsWith('ImageReplace|') || !targetPath) {
        logger.warn(`[parseImageReplaceIdea] Invalid input: ideaString or targetPath missing/invalid.`);
        return null;
    }
    try {
        // Remove "ImageReplace|" prefix and replace remaining "|" with "&" for URLSearchParams
        const paramsString = ideaString.substring('ImageReplace|'.length).replace(/\|/g, '&');
        const params = new URLSearchParams(paramsString);
        
        const oldUrlEncoded = params.get('OldURL');
        const newUrlEncoded = params.get('NewURL');

        if (!oldUrlEncoded || !newUrlEncoded) {
            logger.warn(`[parseImageReplaceIdea] Missing OldURL or NewURL in paramsString: "${paramsString}"`);
            return null;
        }

        const oldUrl = decodeURIComponent(oldUrlEncoded);
        const newUrl = decodeURIComponent(newUrlEncoded);

        logger.info(`[parseImageReplaceIdea] Successfully parsed: targetPath=${targetPath}, oldUrl=${oldUrl.substring(0,50)}..., newUrl=${newUrl.substring(0,50)}...`);
        return {
            targetPath: targetPath,
            oldUrl: oldUrl,
            newUrl: newUrl,
        };
    } catch (error) {
        logger.error(`[parseImageReplaceIdea] Error parsing ideaString: "${ideaString}"`, error);
        return null;
    }
}

/**
 * Extracts a "repository slug" (e.g., "owner/repo") from a GitHub URL.
 * Handles various GitHub URL formats including blob, tree, and base repo URLs.
 */
export function getRepoSlug(githubUrl: string): string | null {
  if (!githubUrl) return null;
  try {
    const url = new URL(githubUrl);
    if (url.hostname !== 'github.com') {
      return null;
    }
    const pathParts = url.pathname.split('/').filter(Boolean); // Remove empty parts
    if (pathParts.length >= 2) {
      return `${pathParts[0]}/${pathParts[1]}`;
    }
    return null;
  } catch (e) {
    logger.warn(`[getRepoSlug] Failed to parse URL: ${githubUrl}`, e);
    return null;
  }
}

export function extractRepoName(githubUrl: string): string | null {
    if (!githubUrl) return null;
    try {
        const parsed = new URL(githubUrl);
        if (parsed.hostname === 'github.com') {
            const pathParts = parsed.pathname.split('/').filter(part => part.length > 0);
            if (pathParts.length >= 2) {
                return pathParts[1]; // The repository name
            }
        }
    } catch (error) {
        logger.error("Failed to extract repo name from URL:", githubUrl, error);
    }
    return null; // Return null if parsing fails or not a valid GitHub repo URL
}