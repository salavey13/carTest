"use server";
import { Octokit } from "@octokit/rest";
import { notifyAdmins, notifyAdmin } from "@/app/actions";
// Use standard console logging in server actions
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

// --- REVISED fetchRepoContents FUNCTION (Default Branch Fix) ---
export async function fetchRepoContents(repoUrl: string, customToken?: string, branchName?: string | null) {
  console.log(`[Action] Fetching repo contents for: ${repoUrl}${branchName ? ` on branch ${branchName}` : ' (default branch attempt)'}`);
  const startTime = Date.now();
  let owner: string | undefined, repo: string | undefined;
  let targetBranch = branchName;
  let isDefaultFetched = false; // Flag to track if we determined the default

  try {
    const token = customToken || process.env.GITHUB_TOKEN;
    if (!token) throw new Error("GitHub token is missing");
    const repoInfo = parseRepoUrl(repoUrl); owner = repoInfo.owner; repo = repoInfo.repo;
    const octokit = new Octokit({ auth: token });

    // --- Filtering Logic (Keep Balanced v3 as is) ---
    const allowedRootFiles = new Set([ 'package.json', 'tailwind.config.ts', 'tsconfig.json', 'next.config.js', 'next.config.mjs', 'vite.config.ts', 'vite.config.js', 'README.md', 'seed.sql', ]);
    const allowedPrefixes = [ 'app/', 'src/', 'components/', 'contexts/', 'hooks/', 'lib/', 'styles/', 'types/', 'utils/', 'data/', ];
    const excludedExactPaths = new Set([ ]);
    const excludedPrefixes = [ '.git/', 'node_modules/', '.next/', 'dist/', 'build/', 'out/', 'public/', 'supabase/migrations/', 'Configame/', 'components/ui/', '.vscode/', '.idea/', 'coverage/', 'storybook-static/', 'docs/', 'examples/', 'test/', 'tests/', '__tests__/', 'cypress/', 'prisma/migrations/', 'assets/', 'static/', 'images/', ];
    const excludedExtensions = [ '.pl', '.json', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.webp', '.avif', '.mp4', '.webm', '.mov', '.mp3', '.wav', '.ogg', '.pdf', '.woff', '.woff2', '.ttf', '.otf', '.eot', '.zip', '.gz', '.tar', '.rar', '.env', '.lock', '.log', '.DS_Store', '.md', '.csv', '.xlsx', '.xls', '.yaml', '.yml', '.bak', '.tmp', '.swp', '.map', '.dll', '.exe', '.so', '.dylib', ];
    // --- END Filtering ---

    // --- Branch and Commit Logic (Improved Default Branch Handling) ---
    let repoDefaultBranch: string | undefined = undefined;
    if (!targetBranch || targetBranch === 'default') { // Explicitly check for 'default' string too
        console.log("[Action] No specific branch or 'default' requested, fetching repository info...");
        try {
            const { data: repoData } = await octokit.repos.get({ owner, repo });
            repoDefaultBranch = repoData.default_branch;
            targetBranch = repoDefaultBranch; // Set targetBranch to the fetched default
            isDefaultFetched = true;
            console.log(`[Action] Default branch determined via repos.get: ${targetBranch}`);
        } catch (repoGetError: any) {
            console.error(`[Action] Failed to fetch default branch via repos.get:`, repoGetError);
            // Don't throw yet, maybe branchName 'default' was passed explicitly and exists?
             if (!branchName) { // Only throw if no branch name was passed *at all*
                 throw new Error(`Failed to determine default branch: ${repoGetError.message}`);
             }
             // If branchName was 'default', let the getRef below handle the 404
             targetBranch = 'default'; // Keep 'default' if it was explicitly passed
             console.warn("[Action] Could not fetch default branch info, proceeding with potentially explicit 'default' name.");
        }
    } else {
        console.log(`[Action] Using specified branch: ${targetBranch}`);
    }

    if (!targetBranch) { // Safety check if determination failed somehow
        throw new Error("Target branch could not be determined.");
    }

    let latestCommitSha: string;
    console.log(`[Action] Fetching ref/commit for effective target branch: ${targetBranch}...`);
    try {
        // Try fetching the ref first - most common way
        const { data: refData } = await octokit.git.getRef({ owner, repo, ref: `heads/${targetBranch}` });
        latestCommitSha = refData.object.sha;
        console.log(`[Action] Found latest commit SHA via getRef: ${latestCommitSha}`);
    } catch (refError: any) {
         // If ref fetch fails (e.g., 404), *especially* if we determined it was default,
         // try getting the commit SHA directly from the branch name (less common endpoint usage)
         if (refError.status === 404) {
             console.warn(`[Action] getRef failed for 'heads/${targetBranch}' (Status 404). Trying getCommit directly...`);
             try {
                 const { data: commitDataFallback } = await octokit.repos.getCommit({ owner, repo, ref: targetBranch });
                 latestCommitSha = commitDataFallback.sha;
                 console.log(`[Action] Found commit SHA via getCommit fallback: ${latestCommitSha}`);
             } catch (commitError: any) {
                 console.error(`[Action] Both getRef and getCommit failed for branch '${targetBranch}'. Final error:`, commitError);
                 // Provide a clearer error if it was the default branch that failed
                 const branchType = isDefaultFetched ? "default branch" : "branch";
                 throw new Error(`Could not find ${branchType} '${targetBranch}' (404). Check branch name and repository access. Final attempt error: ${commitError.message}`);
             }
         } else {
            // Other errors during getRef
            console.error(`[Action] Failed to get reference for branch '${targetBranch}':`, refError);
            throw new Error(`Failed to get git ref for branch '${targetBranch}': ${refError.message}`);
         }
    }

    // --- Tree Fetching (using latestCommitSha) ---
    const { data: commitData } = await octokit.git.getCommit({ owner, repo, commit_sha: latestCommitSha });
    const treeSha = commitData.tree.sha;
    console.log(`[Action] Tree SHA for commit ${latestCommitSha} on branch ${targetBranch}: ${treeSha}`);
    console.log(`[Action] Fetching recursive tree for tree SHA ${treeSha}...`);
    let treeData: GitTreeResponseData;
    try {
        const response = await octokit.git.getTree({ owner, repo, tree_sha: treeSha, recursive: '1' });
        treeData = response.data as GitTreeResponseData;
        if (treeData?.truncated) { /* Keep truncation warning */ console.warn("[Action] WARNING: Tree data truncated."); await notifyAdmin(`⚠️ Tree data truncated for ${owner}/${repo} branch ${targetBranch}.`); }
        if (!treeData || !Array.isArray(treeData.tree)) { /* Keep invalid structure check */ console.error("[Action] Invalid tree structure received:", treeData); throw new Error(`Invalid tree structure received. Truncated: ${treeData?.truncated ?? 'N/A'}`); }
        console.log(`[Action] Received tree with ${treeData.tree.length} items. Filtering...`);
    } catch (treeError: any) { console.error(`[Action] Failed during getTree API call`, treeError); throw new Error(`Failed getTree: ${treeError.message || treeError}`); }

    // --- Apply Filtering ---
    let filesToFetch = treeData.tree.filter((item): item is GitTreeFile => { /* Keep filtering logic */ if(item.type!=='blob'||!item.path||!item.sha) return false; const pL=item.path.toLowerCase(); if(excludedExactPaths.has(item.path)) return false; if(excludedPrefixes.some(p=>pL.startsWith(p))) return false; if(excludedExtensions.some(e=>pL.endsWith(e))) return item.path==='README.md'||allowedRootFiles.has(item.path); if(allowedRootFiles.has(item.path)) return true; if(allowedPrefixes.some(p=>pL.startsWith(p))) return true; return false; });
    console.log(`[Action] Filtered down to ${filesToFetch.length} relevant files.`);

    // --- File Limit Check (Warn & Truncate) ---
    const MAX_FILES_TO_FETCH = 500;
    if (filesToFetch.length > MAX_FILES_TO_FETCH) { /* Keep limit logic */ console.warn(`[Action] Warning: Count (${filesToFetch.length}) > limit (${MAX_FILES_TO_FETCH}). Truncating.`); await notifyAdmin(`⚠️ High file count (${filesToFetch.length}) for ${owner}/${repo} branch ${targetBranch}. Truncated.`); filesToFetch = filesToFetch.slice(0, MAX_FILES_TO_FETCH); }

    // --- Content Fetching Loop (Keep Resilient Logic) ---
    const allFiles: FileNode[] = []; const totalFiles = filesToFetch.length; if (totalFiles === 0) { console.warn("[Action] No relevant files found."); return { success: true, files: [] }; }
    console.log(`[Action] Starting content fetch for ${totalFiles} files...`);
    for (let i = 0; i < totalFiles; i += BATCH_SIZE) { /* Keep batch loop */ const batchFiles = filesToFetch.slice(i, i + BATCH_SIZE); const batchNumber = Math.floor(i / BATCH_SIZE) + 1; const totalBatches = Math.ceil(totalFiles / BATCH_SIZE); console.log(`[Action] Fetching batch ${batchNumber}/${totalBatches}...`); const batchPromises = batchFiles.map(async (fI) => { try { const { data: bD } = await octokit.git.getBlob({ owner: owner!, repo: repo!, file_sha: fI.sha }); if (typeof bD.content !== 'string' || typeof bD.encoding !== 'string') { console.warn(`[Action] Invalid blob ${fI.path}. Skip.`); return null; } let cnt: string; if (bD.encoding === 'base64') { cnt = Buffer.from(bD.content, 'base64').toString('utf-8'); } else if (bD.encoding === 'utf-8') { cnt = bD.content; } else { console.warn(`[Action] Unsup. encoding '${bD.encoding}' for ${fI.path}. Skip.`); return null; } const MAX_F_BYTES = 750 * 1024; if (Buffer.byteLength(cnt, 'utf8') > MAX_F_BYTES) { console.warn(`[Action] Skipping large file (${(Buffer.byteLength(cnt, 'utf8')/1024).toFixed(0)} KB): ${fI.path}`); return null; } let pC: string; const fE = fI.path.split('.').pop()?.toLowerCase()||''; switch(fE){ case 'ts': case 'tsx': case 'js': case 'jsx': pC=`// /${fI.path}`; break; case 'css': case 'scss': pC=`/* /${fI.path} */`; break; case 'sql': pC=`-- /${fI.path}`; break; case 'py': case 'rb': case 'sh': case 'yml': case 'yaml': case 'env': pC=`# /${fI.path}`; break; case 'html': case 'xml': case 'vue': case 'svelte': pC=`<!-- /${fI.path} -->`; break; case 'md': pC=`<!-- /${fI.path} -->`; break; default: pC=`// /${fI.path}`; } if(cnt.trim()&&!cnt.trimStart().startsWith(pC)){cnt=`${pC}\n${cnt}`;} else if(!cnt.trim()){cnt=pC;} return { path: fI.path, content: cnt }; } catch (fE: any) { console.error(`[Action] Err fetch blob ${fI.path}:`, fE.status?`${fE.message} (${fE.status})`:fE); return null; } }); const bR = await Promise.all(batchPromises); const vR = bR.filter((r): r is FileNode => r !== null); allFiles.push(...vR); if (vR.length < bR.length) { console.warn(`[Action] ${bR.length - vR.length} files in batch ${batchNumber} failed/skipped.`); } if (i + BATCH_SIZE < totalFiles) { console.log(`[Action] Wait ${DELAY_BETWEEN_BATCHES_MS}ms...`); await delay(DELAY_BETWEEN_BATCHES_MS); } }

    // --- Success Return ---
    const endTime = Date.now();
    console.log(`[Action] Success: Processed ${allFiles.length} files from branch '${targetBranch}' in ${(endTime - startTime) / 1000}s.`);
    return { success: true, files: allFiles };

  } catch (error: any) {
        // --- Error Handling ---
        const endTime = Date.now(); const repoIdentifier = owner && repo ? `${owner}/${repo}` : repoUrl; const branchInfo = targetBranch ? ` on branch '${targetBranch}'` : ''; console.error(`[Action] CRITICAL Error fetch contents ${repoIdentifier}${branchInfo}:`, error);
         if (error.status === 403 && error.message?.includes('rate limit exceeded')) { await notifyAdmin(`❌ Ошибка (Rate Limit) ${repoIdentifier}${branchInfo}.`); return { success: false, error: "GitHub API rate limit exceeded." }; }
         if (error.status === 404 || error.message?.includes('not found')) { await notifyAdmin(`❌ Ошибка (404 Not Found) ${repoIdentifier}${branchInfo}.`); return { success: false, error: `Repo, branch ('${targetBranch}'), or resource not found.` }; }
         if (error.status === 401 || error.status === 403) { await notifyAdmin(`❌ Ошибка (Auth ${error.status}) ${repoIdentifier}${branchInfo}.`); return { success: false, error: `GitHub Auth error (${error.status}).` }; }
         if (error.message?.startsWith('Too many files')) { await notifyAdmin(`❌ Ошибка: Много файлов ${repoIdentifier}${branchInfo}.`); return { success: false, error: error.message }; }
        await notifyAdmin(`❌ Ошибка извлечения ${repoIdentifier}${branchInfo}:\n${error.message}`); return { success: false, error: `Failed to fetch: ${error.message}` };
  }
}


// --- createGitHubPullRequest (Check if branch exists) ---
export async function createGitHubPullRequest( repoUrl: string, files: FileNode[], prTitle: string, prDescription: string, commitMessage: string, branchName?: string ) {
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
    if (encoder.encode(finalCommitMessage).length > MAX_SIZE_BYTES) { finalCommitMessage = finalCommitMessage.substring(0, 60000) + "...(truncated)"; console.warn(`[Action] Commit msg too long.`); }
    if (encoder.encode(finalPrDescription).length > MAX_SIZE_BYTES) { finalPrDescription = finalPrDescription.substring(0, 60000) + "\n\n...(truncated)"; console.warn(`[Action] PR desc too long.`); }
    const newBranch = branchName || `feature-aiassisted-onesitepls-${Date.now()}`;

    // *** CHECK IF BRANCH EXISTS ***
    let branchExists = false;
    try {
        await octokit.git.getRef({ owner, repo, ref: `heads/${newBranch}` });
        branchExists = true;
        console.warn(`[Action] Branch '${newBranch}' already exists. Will attempt to update PR instead of creating.`);
        // If branch exists, maybe we should *update* it instead?
        // For now, let's let the PR creation fail naturally if it already exists.
        // Or, alternatively, proceed to commit/update ref below, skipping createRef.
        // Let's skip createRef if it exists.
    } catch (error: any) {
        if (error.status === 404) {
            console.log(`[Action] Branch '${newBranch}' does not exist. Creating...`);
            branchExists = false;
        } else {
            // Unexpected error checking ref
            throw error;
        }
    }

    if (!branchExists) {
        console.log(`[Action] Creating NEW branch '${newBranch}' from ${baseBranch} (SHA: ${baseSha})`);
        await octokit.git.createRef({ owner, repo, ref: `refs/heads/${newBranch}`, sha: baseSha });
        console.log(`[Action] Branch '${newBranch}' created successfully.`);
    }
    // *** END CHECK ***

    // --- Create blobs, tree, commit, update ref, create PR ---
    // This part remains the same, but updateRef will now update the existing branch if branchExists=true
    const { data: baseCommitData } = await octokit.git.getCommit({ owner, repo, commit_sha: baseSha });
    const baseTree = baseCommitData.tree.sha; console.log(`[Action] Base tree SHA: ${baseTree}`);
    console.log(`[Action] Creating ${files.length} blobs...`);
    const tree = await Promise.all( files.map(async (file) => { try { const { data } = await octokit.git.createBlob({ owner: owner!, repo: repo!, content: file.content, encoding: "utf-8" }); return { path: file.path, mode: "100644" as const, type: "blob" as const, sha: data.sha }; } catch (e: any) { throw new Error(`Failed blob ${file.path}: ${e.message || e}`); } }) );
    console.log("[Action] Blobs created.");
    console.log(`[Action] Creating new tree with base ${baseTree}...`);
    const { data: newTree } = await octokit.git.createTree({ owner, repo, base_tree: baseTree, tree });
    console.log(`[Action] New tree created: ${newTree.sha}`);
    console.log(`[Action] Creating commit with tree ${newTree.sha}...`);
    // If updating, we need the *current* head of the target branch as parent, not baseSha
    const parentSha = branchExists ? (await octokit.git.getRef({ owner, repo, ref: `heads/${newBranch}` })).data.object.sha : baseSha;
    const { data: newCommit } = await octokit.git.createCommit({ owner, repo, message: finalCommitMessage, tree: newTree.sha, parents: [parentSha] });
    console.log(`[Action] New commit created: ${newCommit.sha}`);
    console.log(`[Action] Updating ref heads/${newBranch} to commit ${newCommit.sha}...`);
    await octokit.git.updateRef({ owner, repo, ref: `heads/${newBranch}`, sha: newCommit.sha, force: false }); // Use force=false unless conflicts are expected and overwrite is desired
    console.log(`[Action] Ref heads/${newBranch} updated.`);

    // --- PR Creation/Update ---
    let prNumber: number | undefined;
    let prUrl: string | undefined;
    if (!branchExists) {
        // Create a new PR if the branch was just created
        console.log(`[Action] Creating pull request: '${prTitle}' from ${newBranch} to ${baseBranch}...`);
        const { data: pr } = await octokit.pulls.create({ owner, repo, title: prTitle, body: finalPrDescription, head: newBranch, base: baseBranch });
        prNumber = pr.number;
        prUrl = pr.html_url;
        console.log(`[Action] Pull request created: ${prUrl}`);
        const changedFiles = files.map((file) => file.path).join(", ");
        const adminMessage = `🔔 Создан PR #${prNumber} в ${owner}/${repo}\nЧто меняем: ${prTitle}\nПодробности: ${finalPrDescription}\nФайлы: ${changedFiles}\n\n[Посмотреть](${prUrl})`;
        await notifyAdmins(adminMessage);
    } else {
        // Branch already existed, maybe find existing PR? (More complex)
        // For now, just notify that branch was updated. The user might need to create PR manually if it didn't exist.
        console.log(`[Action] Branch '${newBranch}' updated. If a PR exists, it reflects these changes.`);
        const changedFiles = files.map((file) => file.path).join(", ");
        const branchUrl = `https://github.com/${owner}/${repo}/tree/${newBranch}`;
        const adminMessage = `🔄 Существующая ветка '${newBranch}' в ${owner}/${repo} обновлена.\nCommit: ${finalCommitMessage.split('\n')[0]}\nFiles: ${changedFiles}\n\n[Посмотреть ветку](${branchUrl})`;
        await notifyAdmins(adminMessage);
        // Optionally try to find the PR number associated with this branch if needed for commenting etc.
        const { data: existingPrs } = await octokit.pulls.list({ owner, repo, head: `${owner}:${newBranch}`, state: 'open' });
        if (existingPrs.length > 0) {
            prNumber = existingPrs[0].number;
            prUrl = existingPrs[0].html_url;
            console.log(`[Action] Found existing open PR #${prNumber} for branch ${newBranch}.`);
        }
    }

    return { success: true, prUrl, branch: newBranch, prNumber }; // Return potentially undefined prUrl/prNumber if only updating branch

  } catch (error: any) {
        console.error("[Action] Error in create/update PR flow:", error);
        const repoIdentifier = owner && repo ? `${owner}/${repo}` : repoUrl; const attemptedBranch = branchName || `feature-aiassisted-...`; let errorMessage = error instanceof Error ? error.message : "Unknown error";
        if (error.status === 422 && error.message?.includes("No commit found for SHA")) { errorMessage = `Base branch '${baseBranch || 'unknown'}' might be empty or invalid.`; }
        else if (error.status === 404) { errorMessage = `Repo ${repoIdentifier} or base branch '${baseBranch || 'default'}' not found.`; }
        else if (error.status === 403) { errorMessage = `Permission denied in ${repoIdentifier}. Check token.`; }
        else if (error.status === 409 && error.message?.includes('conflict')) { errorMessage = `Update conflict on branch '${attemptedBranch}'. Needs rebase/merge?`; }
        await notifyAdmin(`❌ Ошибка при создании/обновлении PR для ${repoIdentifier}:\n${errorMessage}`); return { success: false, error: errorMessage };
  }
}

// --- updateBranch (Keep Revised with Comment Debugging) ---
export async function updateBranch( repoUrl: string, files: FileNode[], commitMessage: string, branchName: string, prNumberToComment?: number | null, commentBody?: string | null ) {
  let owner: string | undefined, repo: string | undefined; const repoIdentifierParsed = parseRepoUrl(repoUrl); owner = repoIdentifierParsed.owner; repo = repoIdentifierParsed.repo; const repoIdentifier = `${owner}/${repo}`; console.log(`[Action] updateBranch called for branch '${branchName}'. PR Comment Target: ${prNumberToComment ?? 'None'}`);
  try { const token = process.env.GITHUB_TOKEN; if (!token) throw new Error("GitHub token missing"); if (!branchName) throw new Error("Branch name required"); const octokit = new Octokit({ auth: token }); console.log(`[Action] Getting HEAD SHA for ${branchName}...`); let baseSha: string; try { const { data: refData } = await octokit.git.getRef({ owner, repo, ref: `heads/${branchName}` }); baseSha = refData.object.sha; console.log(`[Action] Current HEAD SHA ${branchName}: ${baseSha}`); } catch (refError: any) { if (refError.status === 404) { console.error(`[Action] Branch '${branchName}' not found.`); throw new Error(`Branch '${branchName}' not found.`); } console.error(`[Action] Failed get ref ${branchName}:`, refError); throw new Error(`Failed get ref ${branchName}: ${refError.message}`); } const { data: baseCommitData } = await octokit.git.getCommit({ owner, repo, commit_sha: baseSha }); const baseTree = baseCommitData.tree.sha; console.log(`[Action] Base tree SHA ${baseSha}: ${baseTree}`); const MAX_SIZE_BYTES = 65000; let finalCommitMessage = commitMessage; const encoder = new TextEncoder(); if (encoder.encode(finalCommitMessage).length > MAX_SIZE_BYTES) { finalCommitMessage = finalCommitMessage.substring(0, 60000) + "..."; console.warn(`[Action] Commit msg truncated.`); } console.log(`[Action] Creating ${files.length} blobs...`); const tree = await Promise.all( files.map(async (file) => { try { const { data } = await octokit.git.createBlob({ owner: owner!, repo: repo!, content: file.content, encoding: "utf-8" }); return { path: file.path, mode: "100644" as const, type: "blob" as const, sha: data.sha }; } catch (blobError: any) { console.error(`[Action] Error creating blob ${file.path}:`, blobError); throw new Error(`Failed blob ${file.path}: ${blobError.message || blobError}`); } }) ); console.log("[Action] Blobs created."); console.log(`[Action] Creating new tree with base ${baseTree}...`); const { data: newTree } = await octokit.git.createTree({ owner, repo, base_tree: baseTree, tree }); console.log(`[Action] New tree created: ${newTree.sha}`); console.log(`[Action] Creating commit with tree ${newTree.sha}...`); const { data: newCommit } = await octokit.git.createCommit({ owner, repo, message: finalCommitMessage, tree: newTree.sha, parents: [baseSha] }); console.log(`[Action] New commit created: ${newCommit.sha}`); console.log(`[Action] Updating ref heads/${branchName} to ${newCommit.sha}...`); await octokit.git.updateRef({ owner, repo, ref: `heads/${branchName}`, sha: newCommit.sha, force: false }); console.log(`[Action] Ref heads/${branchName} updated to ${newCommit.sha}.`);
    if (prNumberToComment && commentBody) { console.log(`[Action] Attempting comment PR #${prNumberToComment}. Len: ${commentBody.length}. Starts: "${commentBody.substring(0, 100)}..."`); try { let finalCommentBody = commentBody; if (encoder.encode(finalCommentBody).length > MAX_SIZE_BYTES) { finalCommentBody = finalCommentBody.substring(0, 60000) + "\n\n...(truncated)"; console.warn(`[Action] Comment body PR #${prNumberToComment} truncated.`); } await octokit.issues.createComment({ owner: owner!, repo: repo!, issue_number: prNumberToComment, body: finalCommentBody }); console.log(`[Action] Comment added PR #${prNumberToComment}.`); } catch (commentError: any) { console.error(`[Action] FAILED comment PR #${prNumberToComment}:`, commentError); const status = commentError.status ? ` (${commentError.status})` : ''; let specificError = commentError.message || 'Unknown comment error'; if (commentError.status === 403) { specificError += ' - Check Token permissions (issues:write)!'; } else if (commentError.status === 404) { specificError += ` - PR #${prNumberToComment} not found.`; } else if (commentError.status === 422) { specificError += ` - Unprocessable Entity.`; } await notifyAdmin(`⚠️ Не удалось добавить коммент к PR #${prNumberToComment}${status}:\n${specificError}`); } } else { if (!prNumberToComment) console.log(`[Action] Skip comment: no PR #.`); if (!commentBody) console.log(`[Action] Skip comment: no body.`); }
    const changedFiles = files.map((f) => f.path).join(", "); const branchUrl = `https://github.com/${owner}/${repo}/tree/${branchName}`; const adminMessage = `🔄 Ветка '${branchName}' обновлена!\nCommit: ${finalCommitMessage.split('\n')[0]}\nFiles: ${changedFiles}\n\n[Ветка](${branchUrl})`; await notifyAdmins(adminMessage); return { success: true, commitSha: newCommit.sha, branch: branchName };
  } catch (error: any) { console.error(`[Action] Error updating branch ${branchName}:`, error); let eM = error instanceof Error ? error.message : `Unknown error updating ${branchName}`; if (error.status === 404) eM=`Repo/branch ${branchName} not found (404).`; else if (error.status === 403) eM=`Permission denied (403) updating ${branchName}.`; else if (error.status === 409) eM=`Conflict updating ${branchName} (409).`; else if (error.status === 422) eM=`Unprocessable entity (422) updating ${branchName}: ${error.message}`; await notifyAdmin(`❌ Ошибка обновления ветки '${branchName}':\n${eM}`); return { success: false, error: eM }; }
}

// --- deleteGitHubBranch (Keep Original) ---
export async function deleteGitHubBranch(repoUrl: string, branchName: string) {
  console.log("[Action] deleteGitHubBranch called..."); let owner: string | undefined; let repo: string | undefined; const rIP=parseRepoUrl(repoUrl); owner=rIP.owner; repo=rIP.repo; const rId=`${owner}/${repo}`; try { const token = process.env.GITHUB_TOKEN; if (!token) throw new Error("GH token missing"); const octokit = new Octokit({ auth: token }); console.log(`[Action] Attempting delete branch 'refs/heads/${branchName}' in ${rId}...`); await octokit.git.deleteRef({ owner, repo, ref: `heads/${branchName}` }); console.log(`[Action] Delete request sent for ${branchName}. Verifying...`); await delay(2000); try { await octokit.git.getRef({ owner, repo, ref: `heads/${branchName}` }); console.error(`[Action] Verification failed: ${branchName} still exists.`); await notifyAdmin(`⚠️ Не удалось подтвердить удаление ветки ${branchName}.`); return { success: false, error: "Branch delete verification failed." }; } catch (err: any) { if (err.status === 404) { console.log(`[Action] Verification successful: ${branchName} deleted.`); return { success: true }; } console.error(`[Action] Error during delete verification ${branchName}:`, err); await notifyAdmin(`⚠️ Ошибка проверки удаления ${branchName} (Status: ${err.status}): ${err.message}.`); return { success: true, warning: "Delete OK, check failed." }; } } catch (error: any) { console.error(`[Action] Error deleting branch ${branchName}:`, error); let eM = error instanceof Error ? error.message : "Failed delete branch"; if (error.status === 404 || error.status === 422) { eM = `Branch '${branchName}' not found or unprocessable (${error.status}).`; console.warn(`[Action] ${eM}`); } else if (error.status === 403) { eM = `Permission denied (403) deleting ${branchName}.`; console.error(`[Action] ${eM}`); } await notifyAdmin(`❌ Ошибка удаления ветки ${branchName}:\n${eM}`); return { success: false, error: eM }; }
}

// --- mergePullRequest (Keep Original) ---
export async function mergePullRequest(repoUrl: string, pullNumber: number) {
  console.log("[Action] mergePullRequest called..."); let owner: string | undefined; let repo: string | undefined; const rIP=parseRepoUrl(repoUrl); owner=rIP.owner; repo=rIP.repo; const rId=`${owner}/${repo}`; try { const token=process.env.GITHUB_TOKEN; if(!token) throw new Error("GH token missing"); const octokit = new Octokit({ auth: token }); console.log(`[Action] Attempting merge PR #${pullNumber} in ${rId}...`); const { data: prData } = await octokit.pulls.get({ owner, repo, pull_number: pullNumber }); if (prData.state !== 'open') { console.warn(`[Action] PR #${pullNumber} not open (${prData.state}).`); throw new Error(`PR #${pullNumber} not open (${prData.state}).`); } if (prData.merged) { console.warn(`[Action] PR #${pullNumber} already merged.`); return { success: true, message: "PR already merged." }; } if (!prData.mergeable) { console.warn(`[Action] PR #${pullNumber} not mergeable (${prData.mergeable_state}). Checking delay...`); await delay(2000); const { data: prUpd } = await octokit.pulls.get({ owner, repo, pull_number: pullNumber }); if (!prUpd.mergeable) { console.error(`[Action] PR #${pullNumber} still not mergeable (${prUpd.mergeable_state}).`); throw new Error(`PR #${pullNumber} still not mergeable (${prUpd.mergeable_state}).`); } console.log(`[Action] PR #${pullNumber} became mergeable.`); } await octokit.pulls.merge({ owner, repo, pull_number: pullNumber, merge_method: "squash" }); console.log(`[Action] PR #${pullNumber} merged in ${rId}.`); const adminMsg = `🚀 Изменения #${pullNumber} в ${rId} смержены!\n\n[GitHub](https://github.com/${owner}/${repo}/pull/${pullNumber})`; await notifyAdmins(adminMsg); return { success: true }; } catch (error: any) { console.error(`[Action] Merge failed PR #${pullNumber} in ${rId}:`, error); let eM = error instanceof Error ? error.message : "Merge failed"; if (error.status === 405) { eM = `PR #${pullNumber} not mergeable (405).`; console.error(`[Action] ${eM}`, error.response?.data); } else if (error.status === 404) { eM = `PR #${pullNumber} not found (404).`; console.error(`[Action] ${eM}`); } else if (error.status === 403) { eM = `Permission denied (403) merging PR #${pullNumber}.`; console.error(`[Action] ${eM}`); } else if (error.status === 409) { eM = `Merge conflict PR #${pullNumber} (409).`; console.error(`[Action] ${eM}`); } await notifyAdmin(`❌ Ошибка мержа PR #${pullNumber} в ${rId}:\n${eM}`); return { success: false, error: eM }; }
}

// --- getOpenPullRequests (Keep Original) ---
export async function getOpenPullRequests(repoUrl: string): Promise<{ success: boolean; pullRequests?: SimplePullRequest[]; error?: string }> {
  let owner: string|undefined, repo: string|undefined; const rIP=parseRepoUrl(repoUrl); owner=rIP.owner; repo=rIP.repo; const rId=`${owner}/${repo}`; try { const token=process.env.GITHUB_TOKEN; if(!token) throw new Error("GH token missing"); const octokit=new Octokit({ auth: token }); const { data } = await octokit.pulls.list({ owner, repo, state: "open" }); const cleanData: SimplePullRequest[] = data.map(pr => ({ id: pr.id, number: pr.number, title: pr.title||'Untitled', html_url: pr.html_url||'#', user: pr.user?{login:pr.user.login}:undefined, head: { ref: pr.head?.ref||'unknown' }, updated_at: pr.updated_at||new Date().toISOString(), })); return { success: true, pullRequests: cleanData }; } catch (error: any) { console.error(`[Action] Error fetching PRs for ${rId}:`, error); let eM=error instanceof Error?error.message:"Failed fetch PRs"; if (error.status===404){eM=`Repo ${rId} not found (404).`; await notifyAdmin(`❌ Ошибка 404 при получении PR ${rId}.`);} else if (error.status===403||error.status===401){eM=`Permission denied (${error.status}) fetching PRs for ${rId}.`; await notifyAdmin(`❌ Ошибка ${error.status} при получении PR ${rId}.`);} else {console.error(`[Action] Non-critical error fetching PRs ${rId}: ${eM}`);} return { success: false, error: eM }; }
}

// --- getGitHubUserProfile (Keep Original) ---
export async function getGitHubUserProfile(username: string) {
  try { const token=process.env.GITHUB_TOKEN; const octokit=new Octokit({auth:token}); const {data:userProfile}=await octokit.users.getByUsername({username}); return { success: true, profile:{ login:userProfile.login, avatar_url:userProfile.avatar_url, html_url:userProfile.html_url, name:userProfile.name, }, }; } catch (error: any) { if (error.status===404){ console.log(`[Action] User '${username}' not found.`); return { success:false, error:"User not found.", profile:null }; } console.error(`[Action] Error fetch profile ${username}:`, error); return { success:false, error:error instanceof Error?error.message:"Failed fetch profile", profile:null }; }
}

// --- approvePullRequest (Keep Original) ---
export async function approvePullRequest(repoUrl: string, pullNumber: number) {
  console.log("[Action] approvePullRequest called..."); let owner:string|undefined; let repo:string|undefined; const rIP=parseRepoUrl(repoUrl); owner=rIP.owner; repo=rIP.repo; const rId=`${owner}/${repo}`; try { const token=process.env.GITHUB_TOKEN; if(!token) throw new Error("GH token missing"); const octokit=new Octokit({auth:token}); console.log(`[Action] Approving PR #${pullNumber} in ${rId}...`); await octokit.pulls.createReview({owner,repo,pull_number:pullNumber,event:"APPROVE",body:"Approved."}); console.log(`[Action] PR #${pullNumber} approved in ${rId}.`); return {success:true}; } catch (error: any) { console.error(`[Action] Approve failed PR #${pullNumber} in ${rId}:`, error); let eM = error instanceof Error ? error.message : "Approve fail"; if(error.status===404){eM=`PR #${pullNumber} not found (404).`;} else if(error.status===403){eM=`Permission denied (403) approving PR #${pullNumber}.`;} else if(error.status===422&&error.message?.includes("review cannot be submitted")){console.warn(`[Action] Cannot approve PR #${pullNumber}: ${error.message}`); eM=`Cannot approve PR #${pullNumber}: ${error.message}`; return {success:false, error:eM};} await notifyAdmin(`❌ Ошибка одобрения PR #${pullNumber} в ${rId}:\n${eM}`); return {success:false, error:eM}; }
}

// --- closePullRequest (Keep Original) ---
export async function closePullRequest(repoUrl: string, pullNumber: number) {
   console.log("[Action] closePullRequest called..."); let owner:string|undefined; let repo:string|undefined; const rIP=parseRepoUrl(repoUrl); owner=rIP.owner; repo=rIP.repo; const rId=`${owner}/${repo}`; try { const token=process.env.GITHUB_TOKEN; if(!token) throw new Error("GH token missing"); const octokit=new Octokit({auth:token}); console.log(`[Action] Closing PR #${pullNumber} in ${rId}...`); const { data: prData } = await octokit.pulls.get({ owner, repo, pull_number: pullNumber }); if (prData.state === 'closed') { console.warn(`[Action] PR #${pullNumber} already closed.`); return { success: true, message: "PR already closed." }; } await octokit.pulls.update({ owner, repo, pull_number: pullNumber, state: "closed" }); console.log(`[Action] PR #${pullNumber} closed in ${rId}.`); await notifyAdmins(`☑️ PR #${pullNumber} в ${rId} закрыт.`); return { success: true }; } catch (error: any) { console.error(`[Action] Closing PR #${pullNumber} failed:`, error); let eM = error instanceof Error ? error.message : "Failed close PR"; if(error.status===404){eM=`PR #${pullNumber} not found (404).`;} else if(error.status===403){eM=`Permission denied (403) closing PR #${pullNumber}.`;} await notifyAdmin(`❌ Ошибка закрытия PR #${pullNumber} в ${rId}:\n${eM}`); return { success: false, error: eM }; }
}