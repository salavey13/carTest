"use server";
import { Octokit } from "@octokit/rest";
import { notifyAdmins, notifyAdmin } from "@/app/actions";
// Removed aliased logger import - Use standard console in server actions

// Interfaces (Keep existing: FileNode, GitTreeFile, GitTreeResponseData, SimplePullRequest)
interface FileNode { path: string; content: string; }
interface GitTreeFile { path: string; sha: string; type: string; mode?: string; size?: number; url?: string; }
interface GitTreeResponseData { sha: string; url: string; tree: GitTreeFile[]; truncated: boolean; }
interface SimplePullRequest { id: number; number: number; title: string; html_url: string; user?: { login?: string }; head: { ref: string }; updated_at: string; }

// --- Constants for Batching ---
const BATCH_SIZE = 40;
const DELAY_BETWEEN_BATCHES_MS = 600;

// Utility: Delay Function
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// --- parseRepoUrl ---
function parseRepoUrl(repoUrl: string) {
  const match = repoUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
  if (!match) throw new Error("Invalid GitHub repo URL");
  return { owner: match[1], repo: match[2].replace(/\.git$/, '') };
}

// --- REVISED fetchRepoContents FUNCTION (Standard Console Logging) ---
export async function fetchRepoContents(repoUrl: string, customToken?: string, branchName?: string | null) {
  // Use standard console logging within the server action
  console.log(`[Action] Fetching repo contents for: ${repoUrl}${branchName ? ` on branch ${branchName}` : ' (default branch)'}`);
  const startTime = Date.now();
  let owner: string | undefined, repo: string | undefined;
  let targetBranch = branchName;

  try {
    const token = customToken || process.env.GITHUB_TOKEN;
    if (!token) throw new Error("GitHub token is missing");
    const repoInfo = parseRepoUrl(repoUrl); owner = repoInfo.owner; repo = repoInfo.repo;
    const octokit = new Octokit({ auth: token });

    // --- START: BALANCED Filtering Logic v3 (Keep as is) ---
    const allowedRootFiles = new Set([ 'package.json', 'tailwind.config.ts', 'tsconfig.json', 'next.config.js', 'next.config.mjs', 'vite.config.ts', 'vite.config.js', 'README.md', 'seed.sql', ]);
    const allowedPrefixes = [ 'app/', 'src/', 'components/', 'contexts/', 'hooks/', 'lib/', 'styles/', 'types/', 'utils/', 'data/', ];
    const excludedExactPaths = new Set([ ]);
    const excludedPrefixes = [ '.git/', 'node_modules/', '.next/', 'dist/', 'build/', 'out/', 'public/', 'supabase/migrations/', 'Configame/', 'components/ui/', '.vscode/', '.idea/', 'coverage/', 'storybook-static/', 'docs/', 'examples/', 'test/', 'tests/', '__tests__/', 'cypress/', 'prisma/migrations/', 'assets/', 'static/', 'images/', ];
    const excludedExtensions = [ '.pl', '.json', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.webp', '.avif', '.mp4', '.webm', '.mov', '.mp3', '.wav', '.ogg', '.pdf', '.woff', '.woff2', '.ttf', '.otf', '.eot', '.zip', '.gz', '.tar', '.rar', '.env', '.lock', '.log', '.DS_Store', '.md', '.csv', '.xlsx', '.xls', '.yaml', '.yml', '.bak', '.tmp', '.swp', '.map', '.dll', '.exe', '.so', '.dylib', ];
    // --- END: BALANCED Filtering Logic v3 ---

    // --- Branch and Commit Logic ---
    if (!targetBranch) {
        console.log("[Action] No branch specified, fetching default branch...");
        const { data: repoData } = await octokit.repos.get({ owner, repo });
        targetBranch = repoData.default_branch;
        console.log(`[Action] Default branch determined: ${targetBranch}`);
    } else {
        console.log(`[Action] Using specified branch: ${targetBranch}`);
    }
    let latestCommitSha: string;
    console.log(`[Action] Fetching ref for branch ${targetBranch}...`);
    try {
        const { data: refData } = await octokit.git.getRef({ owner, repo, ref: `heads/${targetBranch}` });
        latestCommitSha = refData.object.sha;
        console.log(`[Action] Latest commit SHA on ${targetBranch}: ${latestCommitSha}`);
    } catch (refError: any) {
         if (refError.status === 404) { console.error(`[Action] Branch '${targetBranch}' not found (404).`); throw new Error(`Branch '${targetBranch}' not found (404).`); }
         console.error(`[Action] Failed to get ref for branch '${targetBranch}':`, refError); throw new Error(`Failed to get ref for branch '${targetBranch}': ${refError.message}`);
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
            console.warn("[Action] WARNING: GitHub API reported tree data truncated.");
            await notifyAdmin(`⚠️ Tree data truncated for ${owner}/${repo} branch ${targetBranch}.`);
        }
        if (!treeData || !Array.isArray(treeData.tree)) {
            console.error("[Action] Invalid tree structure received:", treeData);
            throw new Error(`Failed to fetch repository tree: Invalid structure. Truncated: ${treeData?.truncated ?? 'N/A'}`);
        }
        console.log(`[Action] Received tree with ${treeData.tree.length} items. Filtering...`);
    } catch (treeError: any) {
        console.error(`[Action] Failed during getTree API call`, treeError);
        throw new Error(`Failed during getTree API call: ${treeError.message || treeError}`);
    }

    // --- Apply Filtering ---
    let filesToFetch = treeData.tree.filter((item): item is GitTreeFile => {
        if (item.type !== 'blob' || typeof item.path !== 'string' || !item.path || typeof item.sha !== 'string' || !item.sha) return false;
        const pathLower = item.path.toLowerCase();
        if (excludedExactPaths.has(item.path)) return false;
        if (excludedPrefixes.some(prefix => pathLower.startsWith(prefix))) return false;
        if (excludedExtensions.some(ext => pathLower.endsWith(ext))) { return item.path === 'README.md' || allowedRootFiles.has(item.path); }
        if (allowedRootFiles.has(item.path)) return true;
        if (allowedPrefixes.some(prefix => pathLower.startsWith(prefix))) return true;
        return false;
    });
    console.log(`[Action] Filtered down to ${filesToFetch.length} relevant files.`);

    // --- File Limit Check (Warn & Truncate) ---
    const MAX_FILES_TO_FETCH = 500;
    if (filesToFetch.length > MAX_FILES_TO_FETCH) {
        console.warn(`[Action] Warning: Filtered file count (${filesToFetch.length}) exceeds limit (${MAX_FILES_TO_FETCH}). Truncating list.`);
        await notifyAdmin(`⚠️ High file count (${filesToFetch.length}) for ${owner}/${repo} branch ${targetBranch}. Truncated to ${MAX_FILES_TO_FETCH}.`);
        filesToFetch = filesToFetch.slice(0, MAX_FILES_TO_FETCH);
    }

    // --- Content Fetching Loop (Resilient) ---
    const allFiles: FileNode[] = [];
    const totalFiles = filesToFetch.length;
    if (totalFiles === 0) { console.warn("[Action] No relevant files found after filtering."); return { success: true, files: [] }; }
    console.log(`[Action] Starting content fetch for ${totalFiles} files in batches of ${BATCH_SIZE}...`);
    for (let i = 0; i < totalFiles; i += BATCH_SIZE) {
        const batchFiles = filesToFetch.slice(i, i + BATCH_SIZE);
        const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(totalFiles / BATCH_SIZE);
        console.log(`[Action] Fetching content batch ${batchNumber}/${totalBatches}...`);
        const batchPromises = batchFiles.map(async (fileInfo) => {
             try {
                 const { data: blobData } = await octokit.git.getBlob({ owner: owner!, repo: repo!, file_sha: fileInfo.sha });
                 if (typeof blobData.content !== 'string' || typeof blobData.encoding !== 'string') { console.warn(`[Action] Invalid blob for ${fileInfo.path}. Skipping.`); return null; }
                 let content: string;
                 if (blobData.encoding === 'base64') { content = Buffer.from(blobData.content, 'base64').toString('utf-8'); }
                 else if (blobData.encoding === 'utf-8') { content = blobData.content; }
                 else { console.warn(`[Action] Unsupported encoding '${blobData.encoding}' for ${fileInfo.path}. Skipping.`); return null; }
                 const MAX_FILE_SIZE_BYTES = 750 * 1024;
                 if (Buffer.byteLength(content, 'utf8') > MAX_FILE_SIZE_BYTES) { console.warn(`[Action] Skipping large file (${(Buffer.byteLength(content, 'utf8') / 1024).toFixed(0)} KB): ${fileInfo.path}`); return null; }
                 // Path comment logic
                 let pathComment: string; const fileExt = fileInfo.path.split('.').pop()?.toLowerCase() || '';
                  switch(fileExt) { /* Cases */ case 'ts': case 'tsx': case 'js': case 'jsx': pathComment = `// /${fileInfo.path}`; break; case 'css': case 'scss': pathComment = `/* /${fileInfo.path} */`; break; case 'sql': pathComment = `-- /${fileInfo.path}`; break; case 'py': case 'rb': case 'sh': case 'yml': case 'yaml': case 'env': pathComment = `# /${fileInfo.path}`; break; case 'html': case 'xml': case 'vue': case 'svelte': pathComment = `<!-- /${fileInfo.path} -->`; break; case 'md': pathComment = `<!-- /${fileInfo.path} -->`; break; default: pathComment = `// /${fileInfo.path}`; }
                  if (content.trim() && !content.trimStart().startsWith(pathComment)) { content = `${pathComment}\n${content}`; } else if (!content.trim()) { content = pathComment; }
                 return { path: fileInfo.path, content: content };
             } catch (fetchError: any) { console.error(`[Action] Error fetching blob for ${fileInfo.path}:`, fetchError.status ? `${fetchError.message} (Status: ${fetchError.status})` : fetchError); return null; }
        });
        const batchResults = await Promise.all(batchPromises);
        const validResults = batchResults.filter((result): result is FileNode => result !== null);
        allFiles.push(...validResults);
        if (validResults.length < batchPromises.length) { console.warn(`[Action] ${batchPromises.length - validResults.length} files in batch ${batchNumber} failed/skipped.`); }
        if (i + BATCH_SIZE < totalFiles) { console.log(`[Action] Waiting ${DELAY_BETWEEN_BATCHES_MS}ms...`); await delay(DELAY_BETWEEN_BATCHES_MS); }
    }

    // --- Success Return ---
    const endTime = Date.now();
    console.log(`[Action] Successfully processed ${allFiles.length} files from branch '${targetBranch}' in ${(endTime - startTime) / 1000} seconds.`);
    return { success: true, files: allFiles };

  } catch (error: any) {
        // --- Error Handling ---
        const endTime = Date.now(); const repoIdentifier = owner && repo ? `${owner}/${repo}` : repoUrl; const branchInfo = targetBranch ? ` on branch '${targetBranch}'` : ''; console.error(`[Action] CRITICAL Error fetching repo contents for ${repoIdentifier}${branchInfo}:`, error);
         if (error.status === 403 && error.message?.includes('rate limit exceeded')) { await notifyAdmin(`❌ Ошибка (Rate Limit) при извлечении ${repoIdentifier}${branchInfo}.`); return { success: false, error: "GitHub API rate limit exceeded." }; }
         if (error.status === 404 || error.message?.includes('not found')) { await notifyAdmin(`❌ Ошибка (404 Not Found) при извлечении ${repoIdentifier}${branchInfo}.`); return { success: false, error: `Repo, branch ('${targetBranch}'), or resource not found.` }; }
         if (error.status === 401 || error.status === 403) { await notifyAdmin(`❌ Ошибка (Auth ${error.status}) при извлечении ${repoIdentifier}${branchInfo}.`); return { success: false, error: `GitHub Auth error (Status: ${error.status}).` }; }
         if (error.message?.startsWith('Too many files')) { await notifyAdmin(`❌ Ошибка: Слишком много файлов в ${repoIdentifier}${branchInfo}.`); return { success: false, error: error.message }; }
        await notifyAdmin(`❌ Ошибка при извлечении ${repoIdentifier}${branchInfo}:\n${error instanceof Error ? error.message : String(error)}`); return { success: false, error: `Failed to fetch contents${branchInfo}: ${error instanceof Error ? error.message : "Unknown error"}` };
  }
}


// --- createGitHubPullRequest (Keep Original) ---
export async function createGitHubPullRequest( repoUrl: string, files: FileNode[], prTitle: string, prDescription: string, commitMessage: string, branchName?: string ) {
  // Paste your original createGitHubPullRequest function code here
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
        const repoIdentifier = owner && repo ? `${owner}/${repo}` : repoUrl; const attemptedBranch = branchName || `feature-aiassisted-...`; let errorMessage = error instanceof Error ? error.message : "Unknown error creating PR";
        if (error.status === 422 && error.message?.includes("Reference already exists")) { errorMessage = `Branch '${attemptedBranch}' already exists.`; console.error(`[Action] ${errorMessage}`); }
        else if (error.status === 404 && error.message?.includes("Not Found")) { errorMessage = `Repo ${repoIdentifier} or base branch '${baseBranch || 'default'}' not found (404).`; console.error(`[Action] ${errorMessage}`); }
        else if (error.status === 403) { errorMessage = `Permission denied (403) creating PR/branch/commit in ${repoIdentifier}.`; console.error(`[Action] ${errorMessage}`); }
        await notifyAdmin(`❌ Ошибка при создании PR для ${repoIdentifier}:\n${errorMessage}`); return { success: false, error: errorMessage };
  }
}

// --- updateBranch (Keep Revised with Comment Debugging) ---
export async function updateBranch( repoUrl: string, files: FileNode[], commitMessage: string, branchName: string, prNumberToComment?: number | null, commentBody?: string | null ) {
  // Paste the REVISED updateBranch function from the previous response here
  let owner: string | undefined, repo: string | undefined;
  const repoIdentifierParsed = parseRepoUrl(repoUrl);
  owner = repoIdentifierParsed.owner; repo = repoIdentifierParsed.repo;
  const repoIdentifier = `${owner}/${repo}`;
  console.log(`[Action] updateBranch called for branch '${branchName}' in ${repoIdentifier}. PR Comment Target: ${prNumberToComment ?? 'None'}`);
  try {
    const token = process.env.GITHUB_TOKEN; if (!token) throw new Error("GitHub token missing"); if (!branchName) throw new Error("Branch name is required for update");
    const octokit = new Octokit({ auth: token });
    console.log(`[Action] Getting current HEAD for branch '${branchName}'...`);
    let baseSha: string;
    try { const { data: refData } = await octokit.git.getRef({ owner, repo, ref: `heads/${branchName}` }); baseSha = refData.object.sha; console.log(`[Action] Current HEAD SHA for ${branchName}: ${baseSha}`);
    } catch (refError: any) { if (refError.status === 404) { console.error(`[Action] Branch '${branchName}' not found in ${repoIdentifier}. Cannot update.`); throw new Error(`Branch '${branchName}' not found. Cannot update.`); } console.error(`[Action] Failed to get ref for ${branchName} in ${repoIdentifier}:`, refError); throw new Error(`Failed to get ref for ${branchName}: ${refError.message}`); }
    const { data: baseCommitData } = await octokit.git.getCommit({ owner, repo, commit_sha: baseSha }); const baseTree = baseCommitData.tree.sha; console.log(`[Action] Base tree SHA for commit ${baseSha}: ${baseTree}`);
    const MAX_SIZE_BYTES = 65000; let finalCommitMessage = commitMessage; const encoder = new TextEncoder(); if (encoder.encode(finalCommitMessage).length > MAX_SIZE_BYTES) { finalCommitMessage = finalCommitMessage.substring(0, 60000) + "..."; console.warn(`[Action] Commit msg truncated.`); }
    console.log(`[Action] Creating ${files.length} blobs...`);
    const tree = await Promise.all( files.map(async (file) => { try { const { data } = await octokit.git.createBlob({ owner: owner!, repo: repo!, content: file.content, encoding: "utf-8" }); return { path: file.path, mode: "100644" as const, type: "blob" as const, sha: data.sha }; } catch (blobError: any) { console.error(`[Action] Error creating blob for file ${file.path}:`, blobError); throw new Error(`Failed to create blob for ${file.path}: ${blobError.message || blobError}`); } }) );
    console.log("[Action] Blobs created.");
    console.log(`[Action] Creating new tree with base ${baseTree}...`); const { data: newTree } = await octokit.git.createTree({ owner, repo, base_tree: baseTree, tree }); console.log(`[Action] New tree created: ${newTree.sha}`);
    console.log(`[Action] Creating commit with tree ${newTree.sha}...`); const { data: newCommit } = await octokit.git.createCommit({ owner, repo, message: finalCommitMessage, tree: newTree.sha, parents: [baseSha] }); console.log(`[Action] New commit created: ${newCommit.sha}`);
    console.log(`[Action] Updating ref heads/${branchName} to commit ${newCommit.sha}...`); await octokit.git.updateRef({ owner, repo, ref: `heads/${branchName}`, sha: newCommit.sha, force: false }); console.log(`[Action] Ref heads/${branchName} updated successfully to ${newCommit.sha}.`);
    if (prNumberToComment && commentBody) {
        console.log(`[Action] Attempting to add comment to PR #${prNumberToComment} in ${repoIdentifier}. Body length: ${commentBody.length}. Starts with: "${commentBody.substring(0, 100)}..."`);
        try { let finalCommentBody = commentBody; if (encoder.encode(finalCommentBody).length > MAX_SIZE_BYTES) { finalCommentBody = finalCommentBody.substring(0, 60000) + "\n\n... (comment truncated)"; console.warn(`[Action] Comment body for PR #${prNumberToComment} too long, truncating.`); } await octokit.issues.createComment({ owner: owner!, repo: repo!, issue_number: prNumberToComment, body: finalCommentBody }); console.log(`[Action] Comment added successfully to PR #${prNumberToComment}.`); }
        catch (commentError: any) { console.error(`[Action] FAILED to add comment to PR #${prNumberToComment}:`, commentError); const status = commentError.status ? ` (Status: ${commentError.status})` : ''; let specificError = commentError.message || 'Unknown commenting error'; if (commentError.status === 403) { specificError += ' - Check GitHub Token permissions (issues:write / pull_requests:write)!'; } else if (commentError.status === 404) { specificError += ` - PR #${prNumberToComment} not found in ${repoIdentifier}.`; } else if (commentError.status === 422) { specificError += ` - Unprocessable Entity. Invalid comment content or state?`; } await notifyAdmin(`⚠️ Не удалось добавить коммент к PR #${prNumberToComment} в ${repoIdentifier} после обновления ветки${status}:\n${specificError}`); }
    } else { if (!prNumberToComment) console.log(`[Action] Skipping comment: prNumberToComment is null/undefined.`); if (!commentBody) console.log(`[Action] Skipping comment: commentBody is null/empty.`); }
    const changedFiles = files.map((file) => file.path).join(", "); const branchUrl = `https://github.com/${owner}/${repo}/tree/${branchName}`; const adminMessage = `🔄 Ветка '${branchName}' обновлена!\nCommit: ${finalCommitMessage.split('\n')[0]}\nFiles: ${changedFiles}\n\n[Посмотреть ветку](${branchUrl})`; await notifyAdmins(adminMessage); return { success: true, commitSha: newCommit.sha, branch: branchName };
  } catch (error: any) { console.error(`[Action] Error updating branch ${branchName} in ${repoIdentifier}:`, error); let errorMessage = error instanceof Error ? error.message : `Unknown error updating branch ${branchName}`; if (error.status === 404) { errorMessage = `Repo ${repoIdentifier} or branch ${branchName} not found (404).`; } else if (error.status === 403) { errorMessage = `Permission denied (403) updating branch ${branchName} in ${repoIdentifier}.`; } else if (error.status === 409) { errorMessage = `Conflict updating branch ${branchName} (409).`; } else if (error.status === 422) { errorMessage = `Unprocessable entity (422) updating branch ${branchName}: ${error.message}`; } await notifyAdmin(`❌ Ошибка при обновлении ветки '${branchName}' в ${repoIdentifier}:\n${errorMessage}`); return { success: false, error: errorMessage }; }
}

// --- deleteGitHubBranch (Keep Original) ---
export async function deleteGitHubBranch(repoUrl: string, branchName: string) {
  // Paste your original deleteGitHubBranch function code here
  console.log("[Action] deleteGitHubBranch called...");
  let owner: string | undefined; let repo: string | undefined; const repoIdentifierParsed = parseRepoUrl(repoUrl); owner = repoIdentifierParsed.owner; repo = repoIdentifierParsed.repo; const repoIdentifier = `${owner}/${repo}`; try { const token = process.env.GITHUB_TOKEN; if (!token) throw new Error("GitHub token missing"); const octokit = new Octokit({ auth: token }); console.log(`[Action] Attempting to delete branch 'refs/heads/${branchName}' in ${repoIdentifier}...`); await octokit.git.deleteRef({ owner, repo, ref: `heads/${branchName}` }); console.log(`[Action] Delete request sent for branch ${branchName}. Verifying...`); await delay(2000); try { await octokit.git.getRef({ owner, repo, ref: `heads/${branchName}` }); console.error(`[Action] Verification failed: Branch ${branchName} still exists after deletion attempt in ${repoIdentifier}.`); await notifyAdmin(`⚠️ Не удалось подтвердить удаление ветки ${branchName} в репозитории ${repoIdentifier}.`); return { success: false, error: "Branch deletion verification failed." }; } catch (err: any) { if (err.status === 404) { console.log(`[Action] Verification successful: Branch ${branchName} was deleted from ${repoIdentifier}.`); return { success: true }; } console.error(`[Action] Error during branch deletion verification for ${branchName} in ${repoIdentifier}:`, err); await notifyAdmin(`⚠️ Ошибка при проверке удаления ветки ${branchName} в ${repoIdentifier} (Status: ${err.status}): ${err.message}.`); return { success: true, warning: "Deletion request succeeded, but verification check failed." }; } } catch (error: any) { console.error(`[Action] Error deleting branch ${branchName} in ${repoIdentifier}:`, error); let errorMessage = error instanceof Error ? error.message : "Failed to delete branch"; if (error.status === 404 || error.status === 422) { errorMessage = `Branch '${branchName}' not found or couldn't be deleted (Status: ${error.status}).`; console.warn(`[Action] ${errorMessage}`); } else if (error.status === 403) { errorMessage = `Permission denied (403) deleting branch ${branchName} in ${repoIdentifier}.`; console.error(`[Action] ${errorMessage}`); } await notifyAdmin(`❌ Ошибка при удалении ветки ${branchName} в ${repoIdentifier}:\n${errorMessage}`); return { success: false, error: errorMessage }; }
}

// --- mergePullRequest (Keep Original) ---
export async function mergePullRequest(repoUrl: string, pullNumber: number) {
  // Paste your original mergePullRequest function code here
  console.log("[Action] mergePullRequest called...");
  let owner: string | undefined; let repo: string | undefined; const repoIdentifierParsed = parseRepoUrl(repoUrl); owner = repoIdentifierParsed.owner; repo = repoIdentifierParsed.repo; const repoIdentifier = `${owner}/${repo}`; try { const token = process.env.GITHUB_TOKEN; if (!token) throw new Error("GitHub token missing"); const octokit = new Octokit({ auth: token }); console.log(`[Action] Attempting to merge PR #${pullNumber} in ${repoIdentifier}...`); const { data: prData } = await octokit.pulls.get({ owner, repo, pull_number: pullNumber }); if (prData.state !== 'open') { console.warn(`[Action] PR #${pullNumber} not open (state: ${prData.state}).`); throw new Error(`PR #${pullNumber} not open (state: ${prData.state}).`); } if (prData.merged) { console.warn(`[Action] PR #${pullNumber} already merged.`); return { success: true, message: "Pull request already merged." }; } if (!prData.mergeable) { console.warn(`[Action] PR #${pullNumber} not mergeable (State: ${prData.mergeable_state}). Checking after delay...`); await delay(2000); const { data: prDataUpdated } = await octokit.pulls.get({ owner, repo, pull_number: pullNumber }); if (!prDataUpdated.mergeable) { console.error(`[Action] PR #${pullNumber} still not mergeable (State: ${prDataUpdated.mergeable_state}).`); throw new Error(`PR #${pullNumber} not mergeable (State: ${prDataUpdated.mergeable_state}).`); } console.log(`[Action] PR #${pullNumber} became mergeable.`); } await octokit.pulls.merge({ owner, repo, pull_number: pullNumber, merge_method: "squash" }); console.log(`[Action] PR #${pullNumber} merged successfully in ${repoIdentifier}.`); const adminMessage = `🚀 Изменения #${pullNumber} в ${repoIdentifier} добавлены в проект!\n\n[Посмотреть на GitHub](https://github.com/${owner}/${repo}/pull/${pullNumber})`; await notifyAdmins(adminMessage); return { success: true }; } catch (error: any) { console.error(`[Action] Merge failed for PR #${pullNumber} in ${repoIdentifier}:`, error); let errorMessage = error instanceof Error ? error.message : "Failed to merge changes"; if (error.status === 405 && error.message?.includes('not mergeable')) { errorMessage = `PR #${pullNumber} not mergeable (405). Resolve conflicts/checks.`; console.error(`[Action] ${errorMessage}`, error.response?.data); } else if (error.status === 404) { errorMessage = `PR #${pullNumber} not found in ${repoIdentifier} (404).`; console.error(`[Action] ${errorMessage}`); } else if (error.status === 403) { errorMessage = `Permission denied (403) to merge PR #${pullNumber} in ${repoIdentifier}.`; console.error(`[Action] ${errorMessage}`); } else if (error.status === 409 && error.message?.includes('conflict')) { errorMessage = `Merge conflict for PR #${pullNumber} (409).`; console.error(`[Action] ${errorMessage}`); } await notifyAdmin(`❌ Ошибка при мерже PR #${pullNumber} в ${repoIdentifier}:\n${errorMessage}`); return { success: false, error: errorMessage }; }
}

// --- getOpenPullRequests (Keep Original) ---
export async function getOpenPullRequests(repoUrl: string): Promise<{ success: boolean; pullRequests?: SimplePullRequest[]; error?: string }> {
  // Paste your original getOpenPullRequests function code here
  let owner: string | undefined, repo: string | undefined; const repoIdentifierParsed = parseRepoUrl(repoUrl); owner = repoIdentifierParsed.owner; repo = repoIdentifierParsed.repo; const repoIdentifier = `${owner}/${repo}`; try { const token = process.env.GITHUB_TOKEN; if (!token) throw new Error("GitHub token missing"); const octokit = new Octokit({ auth: token }); const { data } = await octokit.pulls.list({ owner, repo, state: "open" }); const cleanData: SimplePullRequest[] = data.map(pr => ({ id: pr.id, number: pr.number, title: pr.title || 'Untitled PR', html_url: pr.html_url || '#', user: pr.user ? { login: pr.user.login } : undefined, head: { ref: pr.head?.ref || 'unknown-branch' }, updated_at: pr.updated_at || new Date().toISOString(), })); return { success: true, pullRequests: cleanData }; } catch (error: any) { console.error(`[Action] Error fetching open PRs for ${repoIdentifier}:`, error); let errorMessage = error instanceof Error ? error.message : "Failed to fetch open PRs"; if (error.status === 404) { errorMessage = `Repo ${repoIdentifier} not found (404) fetching PRs.`; await notifyAdmin(`❌ Ошибка 404 при получении PR для ${repoIdentifier}.`); } else if (error.status === 403 || error.status === 401) { errorMessage = `Permission denied (Status ${error.status}) fetching PRs for ${repoIdentifier}.`; await notifyAdmin(`❌ Ошибка ${error.status} при получении PR для ${repoIdentifier}.`); } else { console.error(`[Action] Non-critical error fetching PRs for ${repoIdentifier}: ${errorMessage}`); } return { success: false, error: errorMessage }; }
}

// --- getGitHubUserProfile (Keep Original) ---
export async function getGitHubUserProfile(username: string) {
  // Paste your original getGitHubUserProfile function code here
  try { const token = process.env.GITHUB_TOKEN; const octokit = new Octokit({ auth: token }); const { data: userProfile } = await octokit.users.getByUsername({ username }); return { success: true, profile: { login: userProfile.login, avatar_url: userProfile.avatar_url, html_url: userProfile.html_url, name: userProfile.name, }, }; } catch (error: any) { if (error.status === 404) { console.log(`[Action] GitHub user '${username}' not found.`); return { success: false, error: "GitHub user not found.", profile: null }; } console.error(`[Action] Error fetching GitHub profile for ${username}:`, error); return { success: false, error: error instanceof Error ? error.message : "Failed to fetch GitHub profile", profile: null }; }
}

// --- approvePullRequest (Keep Original) ---
export async function approvePullRequest(repoUrl: string, pullNumber: number) {
  // Paste your original approvePullRequest function code here
  console.log("[Action] approvePullRequest called...");
  let owner: string | undefined; let repo: string | undefined; const repoIdentifierParsed = parseRepoUrl(repoUrl); owner = repoIdentifierParsed.owner; repo = repoIdentifierParsed.repo; const repoIdentifier = `${owner}/${repo}`; try { const token = process.env.GITHUB_TOKEN; if (!token) throw new Error("GitHub token missing (AWOL)"); const octokit = new Octokit({ auth: token }); console.log(`[Action] Attempting to approve PR #${pullNumber} in ${repoIdentifier}...`); await octokit.pulls.createReview({ owner, repo, pull_number: pullNumber, event: "APPROVE", body: "Approved by automated process." }); console.log(`[Action] PR #${pullNumber} approved successfully in ${repoIdentifier}.`); return { success: true }; } catch (error: any) { console.error(`[Action] Approval failed for PR #${pullNumber} in ${repoIdentifier}:`, error); let errorMessage = error instanceof Error ? error.message : "Failed to approve PR"; if (error.status === 404) { errorMessage = `PR #${pullNumber} not found in ${repoIdentifier} (404).`; } else if (error.status === 403) { errorMessage = `Permission denied (403) to approve PR #${pullNumber} in ${repoIdentifier}.`; } else if (error.status === 422 && error.message?.includes("review cannot be submitted")) { console.warn(`[Action] Could not approve PR #${pullNumber}: ${error.message}`); errorMessage = `Could not approve PR #${pullNumber}: ${error.message}`; return { success: false, error: errorMessage }; } await notifyAdmin(`❌ Ошибка при одобрении PR #${pullNumber} в ${repoIdentifier}:\n${errorMessage}`); return { success: false, error: errorMessage }; }
}

// --- closePullRequest (Keep Original) ---
export async function closePullRequest(repoUrl: string, pullNumber: number) {
   // Paste your original closePullRequest function code here
   console.log("[Action] closePullRequest called...");
   let owner: string | undefined; let repo: string | undefined; const repoIdentifierParsed = parseRepoUrl(repoUrl); owner = repoIdentifierParsed.owner; repo = repoIdentifierParsed.repo; const repoIdentifier = `${owner}/${repo}`; try { const token = process.env.GITHUB_TOKEN; if (!token) throw new Error("GitHub token missing"); const octokit = new Octokit({ auth: token }); console.log(`[Action] Attempting to close PR #${pullNumber} in ${repoIdentifier}...`); const { data: prData } = await octokit.pulls.get({ owner, repo, pull_number: pullNumber }); if (prData.state === 'closed') { console.warn(`[Action] PR #${pullNumber} already closed in ${repoIdentifier}.`); return { success: true, message: "Pull request already closed." }; } await octokit.pulls.update({ owner, repo, pull_number: pullNumber, state: "closed" }); console.log(`[Action] PR #${pullNumber} closed successfully in ${repoIdentifier}.`); await notifyAdmins(`☑️ PR #${pullNumber} в ${repoIdentifier} был закрыт без мержа.`); return { success: true }; } catch (error: any) { console.error(`[Action] Closing PR #${pullNumber} in ${repoIdentifier} failed:`, error); let errorMessage = error instanceof Error ? error.message : "Failed to close PR"; if (error.status === 404) { errorMessage = `PR #${pullNumber} not found in ${repoIdentifier} (404).`; } else if (error.status === 403) { errorMessage = `Permission denied (403) to close PR #${pullNumber} in ${repoIdentifier}.`; } await notifyAdmin(`❌ Ошибка при закрытии PR #${pullNumber} в ${repoIdentifier}:\n${errorMessage}`); return { success: false, error: errorMessage }; }
}