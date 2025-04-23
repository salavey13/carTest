"use server";
import { Octokit } from "@octokit/rest";
// Keep both imports, but use notifyAdmin for errors
import { notifyAdmins, notifyAdmin } from "@/app/actions"; // Assuming notifyAdmin exists for single errors
import { logger as console } from "@/lib/logger"; // Using aliased logger as console

// Interfaces
interface FileNode {
  path: string;
  content: string;
}
interface GitTreeFile {
    path: string;
    sha: string; // Blob SHA
    type: string; // 'blob', 'tree', etc.
    // Optional properties that might exist in the tree response
    mode?: string;
    size?: number;
    url?: string;
}
interface GitTreeResponseData {
    sha: string;
    url: string;
    tree: GitTreeFile[]; // Expect an array of tree items
    truncated: boolean; // Important flag for large repos
}
// Define SimplePullRequest based on usage in getOpenPullRequests
interface SimplePullRequest {
    id: number;
    number: number;
    title: string;
    html_url: string;
    user?: { login?: string }; // User can be optional
    head: { ref: string }; // Branch name
    updated_at: string;
}

// --- Constants for Batching ---
const BATCH_SIZE = 40; // Further reduced batch size
const DELAY_BETWEEN_BATCHES_MS = 600; // Further increased delay

// Utility: Delay Function
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// --- parseRepoUrl (From original) ---
function parseRepoUrl(repoUrl: string) {
  const match = repoUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
  if (!match) throw new Error("Invalid GitHub repo URL");
  // Ensure .git suffix is removed if present
  return { owner: match[1], repo: match[2].replace(/\.git$/, '') };
}

// --- REVISED fetchRepoContents FUNCTION (Balanced Filtering + Resilience v3) ---
export async function fetchRepoContents(repoUrl: string, customToken?: string, branchName?: string | null) {
  console.log(`[Action] Fetching repo contents for: ${repoUrl}${branchName ? ` on branch ${branchName}` : ' (default branch)'}`);
  const startTime = Date.now();
  let owner: string | undefined, repo: string | undefined;
  let targetBranch = branchName; // Use mutable variable for potentially fetching default

  try {
    const token = customToken || process.env.GITHUB_TOKEN;
    if (!token) throw new Error("GitHub token is missing");
    const repoInfo = parseRepoUrl(repoUrl); owner = repoInfo.owner; repo = repoInfo.repo;
    const octokit = new Octokit({ auth: token });

    // --- START: BALANCED Filtering Logic v3 ---
    const allowedRootFiles = new Set([
        'package.json',
        'tailwind.config.ts', // Keep based on your context
        'tsconfig.json',
        'next.config.js',
        'next.config.mjs',
        'vite.config.ts',
        'vite.config.js',
        'README.md', // Keep README for context
        'seed.sql', // Keep specific SQL from your context
        // Add ONLY essential root config files (e.g., Dockerfile, vercel.json)
    ]);

    // Core code directories (adjust if your structure differs)
    const allowedPrefixes = [
        'app/',             // Includes pages, layout, api, actions etc.
        'src/',             // Alternative source root
        'components/',      // Reusable components (UI lib excluded below)
        'contexts/',
        'hooks/',
        'lib/',             // Core utilities, helpers
        'styles/',          // Global styles (e.g., globals.css)
        'types/',           // TypeScript type definitions
        'utils/',           // General utility functions
        'data/',            // Static data if relevant
        // 'scripts/',      // Often non-essential for runtime logic context
        // 'workers/',      // Exclude unless worker code is the direct target
    ];

    const excludedExactPaths = new Set([
         // e.g., 'lib/generated/do_not_include.ts'
    ]);

    // Aggressive exclusion list
    const excludedPrefixes = [
        '.git/',        'node_modules/', '.next/',    'dist/',    'build/',
        'out/',         'public/',       'supabase/migrations/', // User Request
        'Configame/',   // User Request
        'components/ui/', // Often large libraries, exclude implementation details
        '.vscode/',     '.idea/',        'coverage/', 'storybook-static/',
        'docs/',        'examples/',     'test/',     'tests/',    '__tests__/',
        'cypress/',     'prisma/migrations/', // Common DB migration folders
        'assets/',      'static/',       'images/',    // Common asset folders
        // Add other directories to exclude
    ];

    // Exclude non-code file types
    const excludedExtensions = [
        '.pl', // User Request
        '.json', // User Request (allowedRootFiles handles package.json etc.)
        // Images/Media
        '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.webp', '.avif',
        '.mp4', '.webm', '.mov', '.mp3', '.wav', '.ogg', '.pdf',
        // Fonts
        '.woff', '.woff2', '.ttf', '.otf', '.eot',
        // Archives/Data/Logs/Config
        '.zip', '.gz', '.tar', '.rar', '.env', '.lock', '.log', '.DS_Store',
        '.md', // Exclude markdown except root README
        '.csv', '.xlsx', '.xls', '.yaml', '.yml', // Exclude unless specifically needed
        '.bak', '.tmp', '.swp', '.map', // Temp/map files
        '.dll', '.exe', '.so', '.dylib', // Binaries
         // Add others as needed
    ];
    // --- END: BALANCED Filtering Logic v3 ---


    // --- Branch and Commit Logic ---
    if (!targetBranch) {
        console.log("[Action] No branch specified, fetching repository info for default branch...");
        const { data: repoData } = await octokit.repos.get({ owner, repo });
        targetBranch = repoData.default_branch;
        console.log(`[Action] Default branch determined: ${targetBranch}`);
    } else {
        console.log(`[Action] Fetching content for specified branch: ${targetBranch}`);
    }
    let latestCommitSha: string;
    console.log(`[Action] Fetching ref for branch ${targetBranch}...`);
    try {
        const { data: refData } = await octokit.git.getRef({ owner, repo, ref: `heads/${targetBranch}` });
        latestCommitSha = refData.object.sha;
        console.log(`[Action] Latest commit SHA on ${targetBranch}: ${latestCommitSha}`);
    } catch (refError: any) {
         if (refError.status === 404) {
             console.error(`[Action] Branch '${targetBranch}' not found (404).`);
             throw new Error(`Branch '${targetBranch}' not found (404).`);
         }
         console.error(`[Action] Failed to get reference for branch '${targetBranch}':`, refError);
         throw new Error(`Failed to get reference for branch '${targetBranch}': ${refError.message}`);
    }
    const { data: commitData } = await octokit.git.getCommit({ owner, repo, commit_sha: latestCommitSha });
    const treeSha = commitData.tree.sha;
    console.log(`[Action] Tree SHA for commit ${latestCommitSha}: ${treeSha}`);


    // --- Tree Fetching ---
    console.log(`[Action] Fetching recursive tree for tree SHA ${treeSha}...`);
    let treeData: GitTreeResponseData;
    try {
        const response = await octokit.git.getTree({ owner, repo, tree_sha: treeSha, recursive: '1' });
        treeData = response.data as GitTreeResponseData;
         if (treeData?.truncated) {
            console.warn("[Action] WARNING: GitHub API reported the tree data was truncated. File list may be incomplete.");
            await notifyAdmin(`⚠️ Tree data truncated for ${owner}/${repo} branch ${targetBranch}. File list might be incomplete.`);
        }
        if (!treeData || !Array.isArray(treeData.tree)) {
            console.error("[Action] Invalid tree structure received. Expected object with 'tree' array, got:", treeData);
            throw new Error(`Failed to fetch repository tree: API response missing 'tree' array. Truncated: ${treeData?.truncated ?? 'N/A'}`);
        }
        console.log(`[Action] Received tree with ${treeData.tree.length} items. Filtering...`);
    } catch (treeError: any) {
        const status = treeError.status ? ` (Status: ${treeError.status})` : '';
        console.error(`[Action] Failed during getTree API call${status}`, treeError);
        throw new Error(`Failed during getTree API call${status}: ${treeError.message || treeError}`);
    }


    // --- Apply Filtering ---
    let filesToFetch = treeData.tree.filter((item): item is GitTreeFile => {
        if (item.type !== 'blob' || typeof item.path !== 'string' || !item.path || typeof item.sha !== 'string' || !item.sha) return false;
        const pathLower = item.path.toLowerCase();
        if (excludedExactPaths.has(item.path)) return false;
        if (excludedPrefixes.some(prefix => pathLower.startsWith(prefix))) return false;
        if (excludedExtensions.some(ext => pathLower.endsWith(ext))) {
            return item.path === 'README.md' || allowedRootFiles.has(item.path);
        }
        if (allowedRootFiles.has(item.path)) return true;
        if (allowedPrefixes.some(prefix => pathLower.startsWith(prefix))) return true;
        return false;
    });
    // --- End Filtering ---

    console.log(`[Action] Filtered down to ${filesToFetch.length} relevant files.`);

    // --- File Limit Check (Warn & Truncate) ---
    const MAX_FILES_TO_FETCH = 500; // Adjust as needed
    if (filesToFetch.length > MAX_FILES_TO_FETCH) {
        console.warn(`[Action] Warning: Filtered file count (${filesToFetch.length}) exceeds limit (${MAX_FILES_TO_FETCH}). Truncating list. Context might be incomplete.`);
        await notifyAdmin(`⚠️ High file count (${filesToFetch.length}) for ${owner}/${repo} branch ${targetBranch}. Truncated to ${MAX_FILES_TO_FETCH}. Context may be incomplete.`);
        filesToFetch = filesToFetch.slice(0, MAX_FILES_TO_FETCH); // Truncate the list
    }


    // --- Content Fetching Loop (More Resilient) ---
    const allFiles: FileNode[] = [];
    const totalFiles = filesToFetch.length;
    if (totalFiles === 0) {
        console.warn("[Action] No relevant files found after filtering. Returning empty list.");
        return { success: true, files: [] };
    }
    console.log(`[Action] Starting content fetch for ${totalFiles} files in batches of ${BATCH_SIZE}...`);
    for (let i = 0; i < totalFiles; i += BATCH_SIZE) {
        const batchFiles = filesToFetch.slice(i, i + BATCH_SIZE);
        const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(totalFiles / BATCH_SIZE);
        console.log(`[Action] Fetching content batch ${batchNumber}/${totalBatches} (Files ${i + 1} to ${Math.min(i + BATCH_SIZE, totalFiles)})...`);

        const batchPromises = batchFiles.map(async (fileInfo) => {
             try {
                 const { data: blobData } = await octokit.git.getBlob({ owner: owner!, repo: repo!, file_sha: fileInfo.sha });
                 if (typeof blobData.content !== 'string' || typeof blobData.encoding !== 'string') {
                     console.warn(`[Action] Invalid blob structure for ${fileInfo.path} (SHA: ${fileInfo.sha}). Skipping.`);
                     return null;
                 }
                 let content: string;
                 if (blobData.encoding === 'base64') {
                     content = Buffer.from(blobData.content, 'base64').toString('utf-8');
                 } else if (blobData.encoding === 'utf-8') {
                     content = blobData.content;
                 } else {
                     console.warn(`[Action] Unsupported blob encoding '${blobData.encoding}' for ${fileInfo.path}. Skipping.`);
                     return null;
                 }
                 const MAX_FILE_SIZE_BYTES = 750 * 1024; // 750 KB limit
                 if (Buffer.byteLength(content, 'utf8') > MAX_FILE_SIZE_BYTES) {
                     console.warn(`[Action] Skipping large file (${(Buffer.byteLength(content, 'utf8') / 1024).toFixed(0)} KB): ${fileInfo.path}`);
                     return null;
                 }
                 // Path comment logic (Consistent)
                 let pathComment: string;
                 const fileExt = fileInfo.path.split('.').pop()?.toLowerCase() || '';
                  switch(fileExt) {
                      case 'ts': case 'tsx': case 'js': case 'jsx': pathComment = `// /${fileInfo.path}`; break;
                      case 'css': case 'scss': pathComment = `/* /${fileInfo.path} */`; break;
                      case 'sql': pathComment = `-- /${fileInfo.path}`; break;
                      case 'py': case 'rb': case 'sh': case 'yml': case 'yaml': case 'env': pathComment = `# /${fileInfo.path}`; break;
                      case 'html': case 'xml': case 'vue': case 'svelte': pathComment = `<!-- /${fileInfo.path} -->`; break;
                      case 'md': pathComment = `<!-- /${fileInfo.path} -->`; break;
                      default: pathComment = `// /${fileInfo.path}`;
                  }
                  if (content.trim() && !content.trimStart().startsWith(pathComment)) {
                       content = `${pathComment}\n${content}`;
                  } else if (!content.trim()) {
                      content = pathComment;
                  }
                 return { path: fileInfo.path, content: content };
             } catch (fetchError: any) {
                  console.error(`[Action] Error fetching blob content for ${fileInfo.path} (SHA: ${fileInfo.sha}):`, fetchError.status ? `${fetchError.message} (Status: ${fetchError.status})` : fetchError);
                  return null; // Skip file on error
             }
        });
        const batchResults = await Promise.all(batchPromises);
        const validResults = batchResults.filter((result): result is FileNode => result !== null);
        allFiles.push(...validResults);
        if (validResults.length < batchPromises.length) {
             console.warn(`[Action] ${batchPromises.length - validResults.length} files in batch ${batchNumber} failed to fetch or were skipped.`);
        }
        if (i + BATCH_SIZE < totalFiles) {
           console.log(`[Action] Waiting ${DELAY_BETWEEN_BATCHES_MS}ms before next batch...`);
           await delay(DELAY_BETWEEN_BATCHES_MS);
        }
    } // End batch loop

    // --- Success Return ---
    const endTime = Date.now();
    console.log(`[Action] Successfully processed ${allFiles.length} files (out of ${filesToFetch.length} filtered) from branch '${targetBranch}' in ${(endTime - startTime) / 1000} seconds.`);
    return { success: true, files: allFiles };

  } catch (error: any) {
        // --- Error Handling ---
        const endTime = Date.now();
        const repoIdentifier = owner && repo ? `${owner}/${repo}` : repoUrl;
        const branchInfo = targetBranch ? ` on branch '${targetBranch}'` : ' (default branch)';
        console.error(`[Action] CRITICAL Error fetching repo contents for ${repoIdentifier}${branchInfo} after ${(endTime - startTime) / 1000} seconds:`, error);
         if (error.status === 403 && error.message?.includes('rate limit exceeded')) {
            console.error("[Action] GitHub API rate limit exceeded.");
            await notifyAdmin(`❌ Ошибка (Rate Limit) при извлечении файлов из ${repoIdentifier}${branchInfo}. Попробуйте позже.`);
            return { success: false, error: "GitHub API rate limit exceeded. Please try again later." };
         }
         if (error.status === 404 || error.message?.includes('not found')) {
            console.error("[Action] Repository, branch, or resource not found.");
             await notifyAdmin(`❌ Ошибка (404 Not Found) при извлечении файлов из ${repoIdentifier}${branchInfo}. Проверьте URL/токен/ветку.`);
            return { success: false, error: `Repository, branch ('${targetBranch}'), or required resource not found (404). Check URL, token permissions, and branch/commit existence.` };
         }
         if (error.status === 401 || error.status === 403) {
             console.error(`[Action] GitHub API Authentication/Authorization error (Status: ${error.status})`);
             await notifyAdmin(`❌ Ошибка (Auth ${error.status}) при извлечении файлов из ${repoIdentifier}${branchInfo}. Проверьте токен.`);
            return { success: false, error: `GitHub API Authentication/Authorization error (Status: ${error.status}). Check token and permissions.` };
         }
        // Generic error notification
        await notifyAdmin(`❌ Ошибка при извлечении файлов из ${repoIdentifier}${branchInfo}:\n${error instanceof Error ? error.message : String(error)}`);
        return { success: false, error: `Failed to fetch contents${branchInfo}: ${error instanceof Error ? error.message : "Unknown error occurred"}` };
  }
}


// --- createGitHubPullRequest (From Original - with prNumber return) ---
export async function createGitHubPullRequest(
  repoUrl: string,
  files: FileNode[],
  prTitle: string,
  prDescription: string,
  commitMessage: string,
  branchName?: string // Optional suggested new branch name
) {
  console.log("[Action] createGitHubPullRequest called...");
  let owner: string | undefined, repo: string | undefined, baseBranch: string | undefined;
  try {
    const token = process.env.GITHUB_TOKEN; if (!token) throw new Error("GitHub token missing");
    const repoInfo = parseRepoUrl(repoUrl); owner = repoInfo.owner; repo = repoInfo.repo;
    const octokit = new Octokit({ auth: token });
    const { data: repoData } = await octokit.repos.get({ owner, repo });
    baseBranch = repoData.default_branch;
    const { data: refData } = await octokit.git.getRef({ owner, repo, ref: `heads/${baseBranch}` });
    const baseSha = refData.object.sha;
    const MAX_SIZE_BYTES = 65000; let finalCommitMessage = commitMessage, finalPrDescription = prDescription;
    const encoder = new TextEncoder();
    if (encoder.encode(finalCommitMessage).length > MAX_SIZE_BYTES) { finalCommitMessage = finalCommitMessage.substring(0, 60000) + "... (truncated)"; console.warn(`[Action] Commit message too long, truncating.`); }
    if (encoder.encode(finalPrDescription).length > MAX_SIZE_BYTES) { finalPrDescription = finalPrDescription.substring(0, 60000) + "\n\n... (truncated)"; console.warn(`[Action] PR description too long, truncating.`); }
    const newBranch = branchName || `feature-aiassisted-onesitepls-${Date.now()}`;
    console.log(`[Action] Creating NEW branch '${newBranch}' from ${baseBranch} (SHA: ${baseSha})`);
    await octokit.git.createRef({ owner, repo, ref: `refs/heads/${newBranch}`, sha: baseSha });
    console.log(`[Action] Branch '${newBranch}' created successfully.`);
    const { data: baseCommitData } = await octokit.git.getCommit({ owner, repo, commit_sha: baseSha });
    const baseTree = baseCommitData.tree.sha; console.log(`[Action] Base tree SHA: ${baseTree}`);
    console.log(`[Action] Creating ${files.length} blobs...`);
    const tree = await Promise.all( files.map(async (file) => { try { const { data } = await octokit.git.createBlob({ owner: owner!, repo: repo!, content: file.content, encoding: "utf-8" }); return { path: file.path, mode: "100644" as const, type: "blob" as const, sha: data.sha }; } catch (e: any) { throw new Error(`Failed to create blob for ${file.path}: ${e.message || e}`); } }) );
    console.log("[Action] Blobs created.");
    console.log(`[Action] Creating new tree with base ${baseTree}...`);
    const { data: newTree } = await octokit.git.createTree({ owner, repo, base_tree: baseTree, tree });
    console.log(`[Action] New tree created: ${newTree.sha}`);
    console.log(`[Action] Creating commit with tree ${newTree.sha}...`);
    const { data: newCommit } = await octokit.git.createCommit({ owner, repo, message: finalCommitMessage, tree: newTree.sha, parents: [baseSha] });
    console.log(`[Action] New commit created: ${newCommit.sha}`);
    console.log(`[Action] Updating ref heads/${newBranch} to commit ${newCommit.sha}...`);
    await octokit.git.updateRef({ owner, repo, ref: `heads/${newBranch}`, sha: newCommit.sha, force: false });
    console.log(`[Action] Ref heads/${newBranch} updated.`);
    const changedFiles = files.map((file) => file.path).join(", ");
    console.log(`[Action] Creating pull request: '${prTitle}' from ${newBranch} to ${baseBranch}...`);
    const { data: pr } = await octokit.pulls.create({ owner, repo, title: prTitle, body: finalPrDescription, head: newBranch, base: baseBranch });
    console.log(`[Action] Pull request created: ${pr.html_url}`);
    const adminMessage = `🔔 Созданы новые изменения в проекте!\nЧто меняем: ${prTitle}\nПодробности: ${finalPrDescription}\nФайлы: ${changedFiles}\n\n[Посмотреть и одобрить на GitHub](https://github.com/${owner}/${repo}/pull/${pr.number})`;
    await notifyAdmins(adminMessage);
    return { success: true, prUrl: pr.html_url, branch: newBranch, prNumber: pr.number };
  } catch (error: any) {
        console.error("[Action] Error creating pull request:", error);
        const repoIdentifier = owner && repo ? `${owner}/${repo}` : repoUrl;
        const attemptedBranch = branchName || `feature-aiassisted-...`;
        let errorMessage = error instanceof Error ? error.message : "Unknown error occurred creating PR";
        if (error.status === 422 && error.message?.includes("Reference already exists")) { errorMessage = `Branch '${attemptedBranch}' already exists. Please use a different branch name or delete the existing one.`; console.error(`[Action] ${errorMessage}`); }
        else if (error.status === 404 && error.message?.includes("Not Found")) { errorMessage = `Repository ${repoIdentifier} or base branch '${baseBranch || 'default'}' not found (404). Check URL and permissions.`; console.error(`[Action] ${errorMessage}`); }
        else if (error.status === 403) { errorMessage = `Permission denied (403) when trying to create PR/branch/commit in ${repoIdentifier}. Check token permissions.`; console.error(`[Action] ${errorMessage}`); }
        await notifyAdmin(`❌ Ошибка при создании НОВОГО PR для ${repoIdentifier}:\n${errorMessage}\n${error.stack || ''}`);
        return { success: false, error: errorMessage };
  }
}


// --- REVISED: updateBranch (From Original + Comment Debugging) ---
export async function updateBranch(
  repoUrl: string,
  files: FileNode[],
  commitMessage: string,
  branchName: string, // Branch MUST exist
  prNumberToComment?: number | null, // Optional: PR number to add comment to
  commentBody?: string | null      // Optional: Body of the comment
) {
  let owner: string | undefined, repo: string | undefined;
  const repoIdentifierParsed = parseRepoUrl(repoUrl);
  owner = repoIdentifierParsed.owner; repo = repoIdentifierParsed.repo;
  const repoIdentifier = `${owner}/${repo}`;
  console.log(`[Action] updateBranch called for branch '${branchName}' in ${repoIdentifier}. PR Comment Target: ${prNumberToComment ?? 'None'}`);

  try {
    const token = process.env.GITHUB_TOKEN;
    if (!token) throw new Error("GitHub token missing");
    if (!branchName) throw new Error("Branch name is required for update");
    const octokit = new Octokit({ auth: token });
    console.log(`[Action] Getting current HEAD for branch '${branchName}'...`);
    let baseSha: string;
    try {
        const { data: refData } = await octokit.git.getRef({ owner, repo, ref: `heads/${branchName}` });
        baseSha = refData.object.sha;
        console.log(`[Action] Current HEAD SHA for ${branchName}: ${baseSha}`);
    } catch (refError: any) {
         if (refError.status === 404) { console.error(`[Action] Branch '${branchName}' not found in ${repoIdentifier}. Cannot update.`); throw new Error(`Branch '${branchName}' not found. Cannot update.`); }
         console.error(`[Action] Failed to get ref for ${branchName} in ${repoIdentifier}:`, refError); throw new Error(`Failed to get ref for ${branchName}: ${refError.message}`);
    }
    const { data: baseCommitData } = await octokit.git.getCommit({ owner, repo, commit_sha: baseSha });
    const baseTree = baseCommitData.tree.sha;
    console.log(`[Action] Base tree SHA for commit ${baseSha}: ${baseTree}`);
    const MAX_SIZE_BYTES = 65000; let finalCommitMessage = commitMessage;
    const encoder = new TextEncoder();
    if (encoder.encode(finalCommitMessage).length > MAX_SIZE_BYTES) { finalCommitMessage = finalCommitMessage.substring(0, 60000) + "..."; console.warn(`[Action] Commit msg truncated.`); }
    console.log(`[Action] Creating ${files.length} blobs...`);
    const tree = await Promise.all( files.map(async (file) => { try { const { data } = await octokit.git.createBlob({ owner: owner!, repo: repo!, content: file.content, encoding: "utf-8" }); return { path: file.path, mode: "100644" as const, type: "blob" as const, sha: data.sha }; } catch (blobError: any) { console.error(`[Action] Error creating blob for file ${file.path}:`, blobError); throw new Error(`Failed to create blob for ${file.path}: ${blobError.message || blobError}`); } }) );
    console.log("[Action] Blobs created.");
    console.log(`[Action] Creating new tree with base ${baseTree}...`);
    const { data: newTree } = await octokit.git.createTree({ owner, repo, base_tree: baseTree, tree });
    console.log(`[Action] New tree created: ${newTree.sha}`);
    console.log(`[Action] Creating commit with tree ${newTree.sha}...`);
    const { data: newCommit } = await octokit.git.createCommit({ owner, repo, message: finalCommitMessage, tree: newTree.sha, parents: [baseSha] });
    console.log(`[Action] New commit created: ${newCommit.sha}`);
    console.log(`[Action] Updating ref heads/${branchName} to commit ${newCommit.sha}...`);
    await octokit.git.updateRef({ owner, repo, ref: `heads/${branchName}`, sha: newCommit.sha, force: false });
    console.log(`[Action] Ref heads/${branchName} updated successfully to ${newCommit.sha}.`);

    // <<< Comment Logic with Debugging >>>
    if (prNumberToComment && commentBody) {
        console.log(`[Action] Attempting to add comment to PR #${prNumberToComment} in ${repoIdentifier}. Body length: ${commentBody.length}. Starts with: "${commentBody.substring(0, 100)}..."`);
        try {
            let finalCommentBody = commentBody;
            if (encoder.encode(finalCommentBody).length > MAX_SIZE_BYTES) {
                finalCommentBody = finalCommentBody.substring(0, 60000) + "\n\n... (comment truncated)";
                console.warn(`[Action] Comment body for PR #${prNumberToComment} too long, truncating.`);
            }
            await octokit.issues.createComment({ owner: owner!, repo: repo!, issue_number: prNumberToComment, body: finalCommentBody });
            console.log(`[Action] Comment added successfully to PR #${prNumberToComment}.`);
        } catch (commentError: any) {
            console.error(`[Action] FAILED to add comment to PR #${prNumberToComment}:`, commentError);
            const status = commentError.status ? ` (Status: ${commentError.status})` : '';
            let specificError = commentError.message || 'Unknown commenting error';
            if (commentError.status === 403) { specificError += ' - Check GitHub Token permissions (issues:write / pull_requests:write)!'; }
            else if (commentError.status === 404) { specificError += ` - PR #${prNumberToComment} not found in ${repoIdentifier}.`; }
            else if (commentError.status === 422) { specificError += ` - Unprocessable Entity. Invalid comment content or state?`; }
            await notifyAdmin(`⚠️ Не удалось добавить коммент к PR #${prNumberToComment} в ${repoIdentifier} после обновления ветки${status}:\n${specificError}`);
        }
    } else {
         if (!prNumberToComment) console.log(`[Action] Skipping comment: prNumberToComment is null/undefined.`);
         if (!commentBody) console.log(`[Action] Skipping comment: commentBody is null/empty.`);
    }
    // <<< End Comment Logic >>>

    const changedFiles = files.map((file) => file.path).join(", ");
    const branchUrl = `https://github.com/${owner}/${repo}/tree/${branchName}`;
    const adminMessage = `🔄 Ветка '${branchName}' обновлена!\nCommit: ${finalCommitMessage.split('\n')[0]}\nFiles: ${changedFiles}\n\n[Посмотреть ветку](${branchUrl})`;
    await notifyAdmins(adminMessage);
    return { success: true, commitSha: newCommit.sha, branch: branchName };
  } catch (error: any) {
    console.error(`[Action] Error updating branch ${branchName} in ${repoIdentifier}:`, error);
    let errorMessage = error instanceof Error ? error.message : `Unknown error occurred updating branch ${branchName}`;
     if (error.status === 404) { errorMessage = `Repository ${repoIdentifier} or branch ${branchName} not found (404).`; }
     else if (error.status === 403) { errorMessage = `Permission denied (403) updating branch ${branchName} in ${repoIdentifier}.`; }
     else if (error.status === 409) { errorMessage = `Conflict updating branch ${branchName} (409). Might require force push or rebase.`; }
     else if (error.status === 422) { errorMessage = `Unprocessable entity (422) updating branch ${branchName}: ${error.message}`; }
    await notifyAdmin(`❌ Ошибка при обновлении ветки '${branchName}' в ${repoIdentifier}:\n${errorMessage}`);
    return { success: false, error: errorMessage };
  }
}


// --- deleteGitHubBranch (From Original) ---
export async function deleteGitHubBranch(repoUrl: string, branchName: string) {
    console.log("[Action] deleteGitHubBranch called...");
    let owner: string | undefined;
    let repo: string | undefined;
    const repoIdentifierParsed = parseRepoUrl(repoUrl);
    owner = repoIdentifierParsed.owner; repo = repoIdentifierParsed.repo;
    const repoIdentifier = `${owner}/${repo}`;
    try {
      const token = process.env.GITHUB_TOKEN;
      if (!token) throw new Error("GitHub token missing");
      const octokit = new Octokit({ auth: token });
      console.log(`[Action] Attempting to delete branch 'refs/heads/${branchName}' in ${repoIdentifier}...`);
      await octokit.git.deleteRef({ owner, repo, ref: `heads/${branchName}` });
      console.log(`[Action] Delete request sent for branch ${branchName}. Verifying...`);
      await delay(2000);
      try {
        await octokit.git.getRef({ owner, repo, ref: `heads/${branchName}` });
         console.error(`[Action] Verification failed: Branch ${branchName} still exists after deletion attempt in ${repoIdentifier}.`);
         await notifyAdmin(`⚠️ Не удалось подтвердить удаление ветки ${branchName} в репозитории ${repoIdentifier}. Возможно, она все еще существует.`);
         return { success: false, error: "Branch deletion verification failed. Branch might still exist." };
      } catch (err: any) {
        if (err.status === 404) {
             console.log(`[Action] Verification successful: Branch ${branchName} was deleted from ${repoIdentifier}.`);
            return { success: true };
        }
        console.error(`[Action] Error during branch deletion verification for ${branchName} in ${repoIdentifier} (might be deleted anyway):`, err);
         await notifyAdmin(`⚠️ Ошибка при проверке удаления ветки ${branchName} в ${repoIdentifier} (Status: ${err.status}): ${err.message}. Ветка может быть удалена.`);
         return { success: true, warning: "Deletion request succeeded, but verification check failed." };
      }
    } catch (error: any) {
      console.error(`[Action] Error deleting branch ${branchName} in ${repoIdentifier}:`, error);
      let errorMessage = error instanceof Error ? error.message : "Failed to delete branch";
       if (error.status === 404 || error.status === 422) { errorMessage = `Branch '${branchName}' not found or couldn't be deleted (Status: ${error.status}). It might have been deleted already.`; console.warn(`[Action] ${errorMessage}`); }
       else if (error.status === 403) { errorMessage = `Permission denied (403) when trying to delete branch ${branchName} in ${repoIdentifier}. Check token permissions.`; console.error(`[Action] ${errorMessage}`); }
       await notifyAdmin(`❌ Ошибка при удалении ветки ${branchName} в репозитории ${repoIdentifier}:\n${errorMessage}`);
      return { success: false, error: errorMessage };
    }
}

// --- mergePullRequest (From Original) ---
export async function mergePullRequest(repoUrl: string, pullNumber: number) {
  console.log("[Action] mergePullRequest called...");
  let owner: string | undefined;
  let repo: string | undefined;
  const repoIdentifierParsed = parseRepoUrl(repoUrl);
  owner = repoIdentifierParsed.owner; repo = repoIdentifierParsed.repo;
  const repoIdentifier = `${owner}/${repo}`;
  try {
    const token = process.env.GITHUB_TOKEN;
    if (!token) throw new Error("GitHub token missing");
    const octokit = new Octokit({ auth: token });
    console.log(`[Action] Attempting to merge PR #${pullNumber} in ${repoIdentifier}...`);
    const { data: prData } = await octokit.pulls.get({ owner, repo, pull_number: pullNumber });
    if (prData.state !== 'open') { console.warn(`[Action] Pull request #${pullNumber} is not open (state: ${prData.state}). Cannot merge.`); throw new Error(`Pull request #${pullNumber} is not open (state: ${prData.state}). Cannot merge.`); }
    if (prData.merged) { console.warn(`[Action] Pull request #${pullNumber} is already merged.`); return { success: true, message: "Pull request already merged." }; }
     if (!prData.mergeable) {
         console.warn(`[Action] Pull request #${pullNumber} is not mergeable (State: ${prData.mergeable_state}). Checking details after delay...`);
         await delay(2000);
         const { data: prDataUpdated } = await octokit.pulls.get({ owner, repo, pull_number: pullNumber });
         if (!prDataUpdated.mergeable) { console.error(`[Action] Pull request #${pullNumber} is still not mergeable (State: ${prDataUpdated.mergeable_state}). Please resolve conflicts or checks on GitHub.`); throw new Error(`Pull request #${pullNumber} is not mergeable (State: ${prDataUpdated.mergeable_state}). Please resolve conflicts or checks on GitHub.`); }
         console.log(`[Action] PR #${pullNumber} became mergeable after delay.`);
     }
    await octokit.pulls.merge({ owner, repo, pull_number: pullNumber, merge_method: "squash" });
    console.log(`[Action] PR #${pullNumber} merged successfully in ${repoIdentifier}.`);
    const adminMessage = `🚀 Изменения #${pullNumber} в ${repoIdentifier} добавлены в проект!\n\n[Посмотреть на GitHub](https://github.com/${owner}/${repo}/pull/${pullNumber})`;
    await notifyAdmins(adminMessage);
    return { success: true };
  } catch (error: any) {
    console.error(`[Action] Merge failed for PR #${pullNumber} in ${repoIdentifier}:`, error);
    let errorMessage = error instanceof Error ? error.message : "Failed to merge changes";
    if (error.status === 405 && error.message?.includes('not mergeable')) { errorMessage = `Pull request #${pullNumber} is not mergeable (Status 405). Resolve conflicts or check branch protection rules.`; console.error(`[Action] ${errorMessage}`, error.response?.data); }
    else if (error.status === 404) { errorMessage = `Pull request #${pullNumber} not found in ${repoIdentifier} (404).`; console.error(`[Action] ${errorMessage}`); }
    else if (error.status === 403) { errorMessage = `Permission denied (403) to merge PR #${pullNumber} in ${repoIdentifier}. Check token permissions and branch protection rules.`; console.error(`[Action] ${errorMessage}`); }
    else if (error.status === 409 && error.message?.includes('conflict')) { errorMessage = `Merge conflict detected for PR #${pullNumber} (Status 409). Please resolve conflicts on GitHub.`; console.error(`[Action] ${errorMessage}`); }
    await notifyAdmin(`❌ Ошибка при мерже PR #${pullNumber} в ${repoIdentifier}:\n${errorMessage}`);
    return { success: false, error: errorMessage };
  }
}

// --- getOpenPullRequests (From Original + Defined Interface) ---
export async function getOpenPullRequests(repoUrl: string): Promise<{ success: boolean; pullRequests?: SimplePullRequest[]; error?: string }> {
  let owner: string | undefined, repo: string | undefined;
  const repoIdentifierParsed = parseRepoUrl(repoUrl);
  owner = repoIdentifierParsed.owner; repo = repoIdentifierParsed.repo;
  const repoIdentifier = `${owner}/${repo}`;
  try {
    const token = process.env.GITHUB_TOKEN;
    if (!token) throw new Error("GitHub token is missing");
    const octokit = new Octokit({ auth: token });
    // console.log(`[Action] Fetching open PRs for ${repoIdentifier}...`);
    const { data } = await octokit.pulls.list({ owner, repo, state: "open" });
    // console.log(`[Action] Found ${data.length} open PRs for ${repoIdentifier}.`);
    const cleanData: SimplePullRequest[] = data.map(pr => ({
        id: pr.id, number: pr.number, title: pr.title || 'Untitled PR', html_url: pr.html_url || '#',
        user: pr.user ? { login: pr.user.login } : undefined,
        head: { ref: pr.head?.ref || 'unknown-branch' }, updated_at: pr.updated_at || new Date().toISOString(),
    }));
    return { success: true, pullRequests: cleanData };
  } catch (error: any) {
    console.error(`[Action] Error fetching open PRs for ${repoIdentifier}:`, error);
    let errorMessage = error instanceof Error ? error.message : "Failed to fetch open pull requests";
     if (error.status === 404) { errorMessage = `Repository ${repoIdentifier} not found (404) when fetching PRs.`; await notifyAdmin(`❌ Ошибка 404 при получении списка PR для ${repoIdentifier}. Проверьте URL.`); }
     else if (error.status === 403 || error.status === 401) { errorMessage = `Permission denied (Status ${error.status}) when fetching PRs for ${repoIdentifier}. Check token permissions.`; await notifyAdmin(`❌ Ошибка ${error.status} при получении списка PR для ${repoIdentifier}. Проверьте права токена.`); }
     else { console.error(`[Action] Non-critical error fetching PRs for ${repoIdentifier}: ${errorMessage}`); }
    return { success: false, error: errorMessage };
  }
}

// --- getGitHubUserProfile (From Original) ---
export async function getGitHubUserProfile(username: string) {
  // console.log(`[Action] getGitHubUserProfile called for ${username}...`);
  try {
    const token = process.env.GITHUB_TOKEN;
    const octokit = new Octokit({ auth: token });
    const { data: userProfile } = await octokit.users.getByUsername({ username });
    return { success: true, profile: { login: userProfile.login, avatar_url: userProfile.avatar_url, html_url: userProfile.html_url, name: userProfile.name, }, };
  } catch (error: any) {
    if (error.status === 404) { console.log(`[Action] GitHub user '${username}' not found.`); return { success: false, error: "GitHub user not found.", profile: null }; }
    console.error(`[Action] Error fetching GitHub profile for ${username}:`, error);
    return { success: false, error: error instanceof Error ? error.message : "Failed to fetch GitHub profile", profile: null };
  }
}

// --- approvePullRequest (From Original) ---
export async function approvePullRequest(repoUrl: string, pullNumber: number) {
  console.log("[Action] approvePullRequest called...");
  let owner: string | undefined;
  let repo: string | undefined;
  const repoIdentifierParsed = parseRepoUrl(repoUrl);
  owner = repoIdentifierParsed.owner; repo = repoIdentifierParsed.repo;
  const repoIdentifier = `${owner}/${repo}`;
  try {
    const token = process.env.GITHUB_TOKEN;
    if (!token) throw new Error("GitHub token is missing (AWOL)");
    const octokit = new Octokit({ auth: token });
    console.log(`[Action] Attempting to approve PR #${pullNumber} in ${repoIdentifier}...`);
    await octokit.pulls.createReview({ owner, repo, pull_number: pullNumber, event: "APPROVE", body: "Approved by automated process." });
    console.log(`[Action] PR #${pullNumber} approved successfully in ${repoIdentifier}.`);
    return { success: true };
  } catch (error: any) {
    console.error(`[Action] Approval failed for PR #${pullNumber} in ${repoIdentifier}:`, error);
     let errorMessage = error instanceof Error ? error.message : "Failed to approve PR";
      if (error.status === 404) { errorMessage = `Pull request #${pullNumber} not found in ${repoIdentifier} (404).`; }
      else if (error.status === 403) { errorMessage = `Permission denied (403) to approve PR #${pullNumber} in ${repoIdentifier}. Check token permissions (needs pull_requests:write).`; }
      else if (error.status === 422 && error.message?.includes("review cannot be submitted")) { console.warn(`[Action] Could not approve PR #${pullNumber}, possibly already approved or another issue: ${error.message}`); errorMessage = `Could not approve PR #${pullNumber}: ${error.message}`; return { success: false, error: errorMessage }; }
     await notifyAdmin(`❌ Ошибка при одобрении PR #${pullNumber} в ${repoIdentifier}:\n${errorMessage}`);
    return { success: false, error: errorMessage };
  }
}

// --- closePullRequest (From Original) ---
export async function closePullRequest(repoUrl: string, pullNumber: number) {
   console.log("[Action] closePullRequest called...");
   let owner: string | undefined;
   let repo: string | undefined;
   const repoIdentifierParsed = parseRepoUrl(repoUrl);
   owner = repoIdentifierParsed.owner; repo = repoIdentifierParsed.repo;
   const repoIdentifier = `${owner}/${repo}`;
  try {
    const token = process.env.GITHUB_TOKEN;
    if (!token) throw new Error("GitHub token missing");
    const octokit = new Octokit({ auth: token });
    console.log(`[Action] Attempting to close PR #${pullNumber} in ${repoIdentifier}...`);
    const { data: prData } = await octokit.pulls.get({ owner, repo, pull_number: pullNumber });
    if (prData.state === 'closed') { console.warn(`[Action] Pull request #${pullNumber} is already closed in ${repoIdentifier}.`); return { success: true, message: "Pull request already closed." }; }
    await octokit.pulls.update({ owner, repo, pull_number: pullNumber, state: "closed" });
    console.log(`[Action] PR #${pullNumber} closed successfully in ${repoIdentifier}.`);
     await notifyAdmins(`☑️ PR #${pullNumber} в ${repoIdentifier} был закрыт без мержа.`);
    return { success: true };
  } catch (error: any) {
    console.error(`[Action] Closing PR #${pullNumber} in ${repoIdentifier} failed:`, error);
     let errorMessage = error instanceof Error ? error.message : "Failed to close PR";
      if (error.status === 404) { errorMessage = `Pull request #${pullNumber} not found in ${repoIdentifier} (404).`; }
      else if (error.status === 403) { errorMessage = `Permission denied (403) to close PR #${pullNumber} in ${repoIdentifier}. Check token permissions (needs pull_requests:write).`; }
     await notifyAdmin(`❌ Ошибка при закрытии PR #${pullNumber} в ${repoIdentifier}:\n${errorMessage}`);
    return { success: false, error: errorMessage };
  }
}