// /app/actions_github/actions.ts
"use server";
import { Octokit } from "@octokit/rest";
import { notifyAdmins } from "@/app/actions";

// Interfaces (keep existing)
interface FileNode { path: string; content: string; }
interface GitTreeFile { path: string; sha: string; type: string; mode?: string; size?: number; url?: string; }
interface GitTreeResponseData { sha: string; url: string; tree: GitTreeFile[]; truncated: boolean; }

// Constants & Utils (keep existing)
const BATCH_SIZE = 69;
const DELAY_BETWEEN_BATCHES_MS = 420;
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
function parseRepoUrl(repoUrl: string) { /* ... keep existing ... */ }

// --- fetchRepoContents (Keep existing, verified branch logic is sound) ---
export async function fetchRepoContents(repoUrl: string, customToken?: string, branchName?: string | null) {
  console.log(`Fetching repo contents for: ${repoUrl}${branchName ? ` on branch ${branchName}` : ' (default branch)'} using Git Trees API`);
  const startTime = Date.now();
  let owner: string | undefined, repo: string | undefined;

  try {
    const token = customToken || process.env.GITHUB_TOKEN;
    if (!token) throw new Error("GitHub token is missing");
    const repoInfo = parseRepoUrl(repoUrl); owner = repoInfo.owner; repo = repoInfo.repo;
    const octokit = new Octokit({ auth: token });
    const allowedExtensions = [".ts", ".tsx", ".css"];
    const excludedPrefixes = ["supabase/", "components/ui/", "node_modules/", ".next/", "dist/", "build/", "Configame/"];

    let targetBranch = branchName;
    let latestCommitSha: string;

    if (!targetBranch) {
        console.log("Fetching repository info for default branch...");
        const { data: repoData } = await octokit.repos.get({ owner, repo });
        targetBranch = repoData.default_branch;
        console.log(`Default branch determined: ${targetBranch}`);
    } else {
        console.log(`Using specified branch: ${targetBranch}`);
    }

    console.log(`Fetching ref for branch ${targetBranch}...`);
    try {
        const { data: refData } = await octokit.git.getRef({ owner, repo, ref: `heads/${targetBranch}` });
        latestCommitSha = refData.object.sha;
        console.log(`Latest commit SHA on ${targetBranch}: ${latestCommitSha}`);
    } catch (refError: any) {
         if (refError.status === 404) throw new Error(`Branch '${targetBranch}' not found (404).`);
         throw new Error(`Failed to get reference for branch '${targetBranch}': ${refError.message}`);
    }

    const { data: commitData } = await octokit.git.getCommit({ owner, repo, commit_sha: latestCommitSha });
    const treeSha = commitData.tree.sha;
    console.log(`Tree SHA for commit ${latestCommitSha}: ${treeSha}`);

    console.log(`Fetching recursive tree for tree SHA ${treeSha}...`);
    let treeData: GitTreeResponseData;
    try {
        const response = await octokit.git.getTree({ owner, repo, tree_sha: treeSha, recursive: '1' });
        treeData = response.data as GitTreeResponseData;
        // --- VITAL DEBUG LOGGING ---
        // console.log("Raw treeData received:", JSON.stringify(treeData, null, 2).substring(0, 500) + '...');
        if (treeData?.truncated) console.warn("WARNING: GitHub API reported the tree data was truncated.");
        if (!treeData || !Array.isArray(treeData.tree)) throw new Error(`Invalid tree structure. Truncated: ${treeData?.truncated ?? 'N/A'}`);
        console.log(`Received tree with ${treeData.tree.length} items. Filtering...`);
    } catch (treeError: any) {
        const status = treeError.status ? ` (Status: ${treeError.status})` : '';
        throw new Error(`Failed during getTree API call${status}: ${treeError.message || treeError}`);
    }

    const filesToFetch: GitTreeFile[] = treeData.tree.filter((item): item is GitTreeFile =>
        item.type === 'blob' && !!item.path && !!item.sha &&
        !excludedPrefixes.some(prefix => item.path!.startsWith(prefix)) &&
        allowedExtensions.some(ext => item.path!.endsWith(ext))
    );
    console.log(`Found ${filesToFetch.length} files matching criteria.`);

    const allFiles: FileNode[] = [];
    const totalFiles = filesToFetch.length;
    if (totalFiles === 0) { console.warn("No files matched criteria."); return { success: true, files: [] }; }

    for (let i = 0; i < totalFiles; i += BATCH_SIZE) {
      // ... (batch fetching logic - keep existing) ...
        const batchFiles = filesToFetch.slice(i, i + BATCH_SIZE);
        const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(totalFiles / BATCH_SIZE);
        // console.log(`Fetching content batch ${batchNumber}/${totalBatches}`);
        const batchPromises = batchFiles.map(async (fileInfo) => {
             try {
                 const { data: blobData } = await octokit.git.getBlob({ owner: owner!, repo: repo!, file_sha: fileInfo.sha });
                 if (typeof blobData.content !== 'string' || typeof blobData.encoding !== 'string') throw new Error(`Invalid blob data received for ${fileInfo.path}`);
                 let content: string;
                 if (blobData.encoding === 'base64') content = Buffer.from(blobData.content, 'base64').toString('utf-8');
                 else if (blobData.encoding === 'utf-8') { content = blobData.content; console.warn(`Non-base64 encoding ('${blobData.encoding}') for ${fileInfo.path}.`); }
                 else throw new Error(`Unsupported encoding '${blobData.encoding}' for file ${fileInfo.path}`);
                 const contentLines = content.split("\n"); let pathComment: string;
                 if (fileInfo.path.endsWith(".ts") || fileInfo.path.endsWith(".tsx")) pathComment = `// /${fileInfo.path}`;
                 else if (fileInfo.path.endsWith(".css")) pathComment = `/* /${fileInfo.path} */`;
                 else pathComment = `# /${fileInfo.path}`;
                 const firstLineTrimmed = contentLines[0]?.trimStart();
                 if (firstLineTrimmed?.match(/^(--|\/\/|\/\*|#)/)) contentLines[0] = pathComment; else contentLines.unshift(pathComment);
                 return { path: fileInfo.path, content: contentLines.join("\n") };
             } catch (fetchError: any) {
                  console.error(`Error fetching blob ${fileInfo.path}:`, fetchError);
                  throw new Error(`Failed to fetch blob ${fileInfo.path}: ${fetchError.message || fetchError}`);
             }
        });
        try {
            const batchResults = await Promise.all(batchPromises); allFiles.push(...batchResults);
            // console.log(`Batch ${batchNumber}/${totalBatches} completed.`);
        } catch (batchError) {
             console.error(`Error processing content batch ${batchNumber}/${totalBatches}:`, batchError);
             throw new Error(`Failed in batch ${batchNumber}. Error: ${batchError instanceof Error ? batchError.message : batchError}`);
        }
        if (i + BATCH_SIZE < totalFiles) await delay(DELAY_BETWEEN_BATCHES_MS);
    }

    const endTime = Date.now();
    console.log(`Successfully fetched ${allFiles.length} files from branch '${targetBranch}' in ${(endTime - startTime) / 1000}s.`);
    return { success: true, files: allFiles };

  } catch (error: any) {
    // ... (keep existing detailed error handling) ...
        const endTime = Date.now();
        const repoIdentifier = owner && repo ? `${owner}/${repo}` : repoUrl;
        const branchInfo = branchName ? ` on branch '${branchName}'` : ' on default branch';
        console.error(`Error fetching repo contents for ${repoIdentifier}${branchInfo} after ${(endTime - startTime) / 1000} seconds:`, error);
         if (error.status === 403 && error.message?.includes('rate limit exceeded')) { await notifyAdmins(`❌ Rate Limit error fetching ${repoIdentifier}${branchInfo}.`); return { success: false, error: "GitHub API rate limit exceeded." }; }
         if (error.status === 404 || error.message?.includes('not found')) { await notifyAdmins(`❌ 404 Not Found error fetching ${repoIdentifier}${branchInfo}. Check URL/branch/token.`); return { success: false, error: `Repository or branch not found (404). Check URL/token/branch.` }; }
         if (error.status === 401 || error.status === 403) { await notifyAdmins(`❌ Auth ${error.status} error fetching ${repoIdentifier}${branchInfo}. Check token.`); return { success: false, error: `GitHub API Auth error (Status: ${error.status}). Check token.` }; }
        await notifyAdmins(`❌ Error fetching ${repoIdentifier}${branchInfo}:\n${error instanceof Error ? error.message : String(error)}`);
        return { success: false, error: `Failed to fetch contents${branchInfo}: ${error instanceof Error ? error.message : "Unknown error"}` };
  }
}


// --- createGitHubPullRequest (Keep existing - creates NEW branch/PR) ---
export async function createGitHubPullRequest(
  repoUrl: string, files: FileNode[], prTitle: string, prDescription: string, commitMessage: string,
  branchName?: string // Optional suggested new branch name
) {
  let owner: string | undefined, repo: string | undefined, baseBranch: string;
  try {
    const token = process.env.GITHUB_TOKEN; if (!token) throw new Error("GitHub token missing");
    const repoInfo = parseRepoUrl(repoUrl); owner = repoInfo.owner; repo = repoInfo.repo;
    const octokit = new Octokit({ auth: token });

    const { data: repoData } = await octokit.repos.get({ owner, repo });
    baseBranch = repoData.default_branch; // Base for NEW branch

    const { data: refData } = await octokit.git.getRef({ owner, repo, ref: `heads/${baseBranch}` });
    const baseSha = refData.object.sha;

    // Truncate messages if needed (keep existing logic)
    const MAX_SIZE_BYTES = 65000; let finalCommitMessage = commitMessage, finalPrDescription = prDescription;
    const encoder = new TextEncoder();
    if (encoder.encode(finalCommitMessage).length > MAX_SIZE_BYTES) { finalCommitMessage = finalCommitMessage.substring(0, 60000) + "..."; console.warn(`Commit msg truncated.`); }
    if (encoder.encode(finalPrDescription).length > MAX_SIZE_BYTES) { finalPrDescription = finalPrDescription.substring(0, 60000) + "\n\n..."; console.warn(`PR desc truncated.`); }

    const newBranch = branchName || `feature-aiassisted-${Date.now()}`;
    console.log(`Creating NEW branch '${newBranch}' from ${baseBranch} (SHA: ${baseSha})`);
    // This will FAIL if branch already exists, which is desired for this function
    await octokit.git.createRef({ owner, repo, ref: `refs/heads/${newBranch}`, sha: baseSha });
    console.log(`Branch '${newBranch}' created.`);

    // --- Create blobs, tree, commit, update NEW ref, create PR ---
    const { data: baseCommitData } = await octokit.git.getCommit({ owner, repo, commit_sha: baseSha });
    const baseTree = baseCommitData.tree.sha; console.log(`Base tree SHA: ${baseTree}`);
    console.log(`Creating ${files.length} blobs...`);
    const tree = await Promise.all( files.map(async (file) => { try { const { data } = await octokit.git.createBlob({ owner: owner!, repo: repo!, content: file.content, encoding: "utf-8" }); return { path: file.path, mode: "100644" as const, type: "blob" as const, sha: data.sha }; } catch (e: any) { throw new Error(`Blob fail ${file.path}: ${e.message}`); } }) );
    console.log("Blobs created.");
    console.log(`Creating new tree with base ${baseTree}...`);
    const { data: newTree } = await octokit.git.createTree({ owner, repo, base_tree: baseTree, tree });
    console.log(`New tree created: ${newTree.sha}`);
    console.log(`Creating commit with tree ${newTree.sha}...`);
    const { data: newCommit } = await octokit.git.createCommit({ owner, repo, message: finalCommitMessage, tree: newTree.sha, parents: [baseSha] });
    console.log(`New commit created: ${newCommit.sha}`);
    console.log(`Updating ref heads/${newBranch} to commit ${newCommit.sha}...`);
    await octokit.git.updateRef({ owner, repo, ref: `heads/${newBranch}`, sha: newCommit.sha, force: false });
    console.log(`Ref heads/${newBranch} updated.`);
    const changedFiles = files.map((file) => file.path).join(", ");
    console.log(`Creating pull request: '${prTitle}' from ${newBranch} to ${baseBranch}...`);
    const { data: pr } = await octokit.pulls.create({ owner, repo, title: prTitle, body: finalPrDescription, head: newBranch, base: baseBranch });
    console.log(`Pull request created: ${pr.html_url}`);
    // --- Notify ---
    const adminMessage = `🔔 Создан НОВЫЙ PR!\nTitle: ${prTitle}\nBranch: ${newBranch}\nFiles: ${changedFiles}\n\n[Посмотреть](${pr.html_url})`;
    await notifyAdmins(adminMessage);
    return { success: true, prUrl: pr.html_url, branch: newBranch };

  } catch (error: any) {
    // ... (keep existing detailed error handling for create PR) ...
        console.error("Error creating pull request:", error);
        const repoIdentifier = owner && repo ? `${owner}/${repo}` : repoUrl;
        const attemptedBranch = branchName || `feature-aiassisted-...`;
        let errorMessage = error instanceof Error ? error.message : "Unknown error occurred creating PR";
        if (error.status === 422 && error.message?.includes("Reference already exists")) { errorMessage = `Branch '${attemptedBranch}' already exists. Use 'Update PR' or delete branch.`; }
        else if (error.status === 404 && error.message?.includes("Not Found")) { errorMessage = `Repo ${repoIdentifier} or base branch '${baseBranch || 'default'}' not found (404).`; }
        else if (error.status === 403) { errorMessage = `Permission denied (403) creating PR/branch in ${repoIdentifier}.`; }
        await notifyAdmins(`❌ Ошибка при создании НОВОГО PR для ${repoIdentifier}:\n${errorMessage}`);
        return { success: false, error: errorMessage };
  }
}


// --- NEW: updateBranch ---
// This function commits changes to an EXISTING branch.
export async function updateBranch(
  repoUrl: string,
  files: FileNode[],
  commitMessage: string,
  branchName: string // Branch MUST exist
) {
  let owner: string | undefined, repo: string | undefined;
  try {
    const token = process.env.GITHUB_TOKEN;
    if (!token) throw new Error("GitHub token missing");
    if (!branchName) throw new Error("Branch name is required for update");

    const repoInfo = parseRepoUrl(repoUrl);
    owner = repoInfo.owner;
    repo = repoInfo.repo;
    const octokit = new Octokit({ auth: token });

    // 1. Get the SHA of the branch's current HEAD
    console.log(`Getting current HEAD for branch '${branchName}'...`);
    let baseSha: string;
    try {
        const { data: refData } = await octokit.git.getRef({ owner, repo, ref: `heads/${branchName}` });
        baseSha = refData.object.sha;
        console.log(`Current HEAD SHA for ${branchName}: ${baseSha}`);
    } catch (refError: any) {
        if (refError.status === 404) throw new Error(`Branch '${branchName}' not found. Cannot update.`);
        throw new Error(`Failed to get ref for ${branchName}: ${refError.message}`);
    }

    // 2. Get the base tree SHA from the current HEAD commit
    const { data: baseCommitData } = await octokit.git.getCommit({ owner, repo, commit_sha: baseSha });
    const baseTree = baseCommitData.tree.sha;
    console.log(`Base tree SHA: ${baseTree}`);

    // Truncate commit message if needed
    const MAX_SIZE_BYTES = 65000; let finalCommitMessage = commitMessage;
    const encoder = new TextEncoder();
    if (encoder.encode(finalCommitMessage).length > MAX_SIZE_BYTES) { finalCommitMessage = finalCommitMessage.substring(0, 60000) + "..."; console.warn(`Commit msg truncated.`); }


    // 3. Create blobs for new/updated files
    console.log(`Creating ${files.length} blobs...`);
    const tree = await Promise.all(
      files.map(async (file) => {
        try {
            const { data } = await octokit.git.createBlob({ owner: owner!, repo: repo!, content: file.content, encoding: "utf-8" });
            return { path: file.path, mode: "100644" as const, type: "blob" as const, sha: data.sha };
        } catch (blobError: any) {
             console.error(`Error creating blob for file ${file.path}:`, blobError);
             throw new Error(`Failed to create blob for ${file.path}: ${blobError.message || blobError}`);
        }
      })
    );
     console.log("Blobs created.");

    // 4. Create a new tree based on the existing tree + new blobs
    console.log(`Creating new tree with base ${baseTree}...`);
    // Note: If a path in `tree` matches a path in `base_tree`, the new one takes precedence.
    // This handles both adding new files and updating existing ones.
    // To DELETE a file, you'd need to add it to the `tree` array with `sha: null`. We are not doing deletions here.
    const { data: newTree } = await octokit.git.createTree({ owner, repo, base_tree: baseTree, tree });
    console.log(`New tree created: ${newTree.sha}`);

    // 5. Create a new commit pointing to the new tree, with the old commit as parent
    console.log(`Creating commit with tree ${newTree.sha}...`);
    const { data: newCommit } = await octokit.git.createCommit({
        owner,
        repo,
        message: finalCommitMessage,
        tree: newTree.sha,
        parents: [baseSha] // Link to the previous commit on the branch
    });
    console.log(`New commit created: ${newCommit.sha}`);

    // 6. Update the branch reference to point to the new commit
    // Use force: true if necessary, but often direct updates work if based on HEAD
    // Consider potential race conditions if branch updated elsewhere concurrently
    console.log(`Updating ref heads/${branchName} to commit ${newCommit.sha}...`);
    await octokit.git.updateRef({
        owner,
        repo,
        ref: `heads/${branchName}`,
        sha: newCommit.sha,
        force: false // Set true ONLY if necessary and you understand implications
    });
    console.log(`Ref heads/${branchName} updated successfully.`);

    // Notify Admins
    const changedFiles = files.map((file) => file.path).join(", ");
    // We don't have the PR URL here easily, link to the branch instead
    const branchUrl = `https://github.com/${owner}/${repo}/tree/${branchName}`;
    const adminMessage = `🔄 Ветка '${branchName}' обновлена!\nCommit: ${finalCommitMessage.split('\n')[0]}\nFiles: ${changedFiles}\n\n[Посмотреть ветку](${branchUrl})`;
    await notifyAdmins(adminMessage);

    return { success: true, commitSha: newCommit.sha, branch: branchName };

  } catch (error: any) {
    console.error(`Error updating branch ${branchName}:`, error);
    const repoIdentifier = owner && repo ? `${owner}/${repo}` : repoUrl;
    let errorMessage = error instanceof Error ? error.message : `Unknown error occurred updating branch ${branchName}`;
     if (error.status === 404) {
        errorMessage = `Repository ${repoIdentifier} or branch ${branchName} not found (404).`;
    } else if (error.status === 403) {
         errorMessage = `Permission denied (403) updating branch ${branchName} in ${repoIdentifier}.`;
    } else if (error.status === 409) { // Conflict, e.g., non-fast-forward update if force: false
        errorMessage = `Conflict updating branch ${branchName} (409). Might require force push or rebase.`;
    } else if (error.status === 422) { // Unprocessable Entity, e.g. bad commit data
         errorMessage = `Unprocessable entity (422) updating branch ${branchName}: ${error.message}`;
    }

    await notifyAdmins(`❌ Ошибка при обновлении ветки '${branchName}' в ${repoIdentifier}:\n${errorMessage}`);
    return { success: false, error: errorMessage };
  }
}


// --- deleteGitHubBranch (Keep existing) ---
export async function deleteGitHubBranch(repoUrl: string, branchName: string) { /* ... keep existing ... */ }
// --- mergePullRequest (Keep existing) ---
export async function mergePullRequest(repoUrl: string, pullNumber: number) { /* ... keep existing ... */ }
// --- getOpenPullRequests (Keep existing) ---
export async function getOpenPullRequests(repoUrl: string) { /* ... keep existing ... */ }
// --- getGitHubUserProfile (Keep existing) ---
export async function getGitHubUserProfile(username: string) { /* ... keep existing ... */ }
// --- approvePullRequest (Keep existing) ---
export async function approvePullRequest(repoUrl: string, pullNumber: number) { /* ... keep existing ... */ }
// --- closePullRequest (Keep existing) ---
export async function closePullRequest(repoUrl: string, pullNumber: number) { /* ... keep existing ... */ }