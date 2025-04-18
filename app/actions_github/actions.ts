// /app/actions_github/actions.ts
"use server";
import { Octokit } from "@octokit/rest";
// Keep both imports, but use notifyAdmin for errors
import { notifyAdmins, notifyAdmin } from "@/app/actions";

// Interfaces
interface FileNode {
  path: string;
  content: string;
}

// Define a type for the items we get from the Git Tree API that we care about
interface GitTreeFile {
    path: string;
    sha: string; // Blob SHA
    type: string; // 'blob', 'tree', etc.
    // Optional properties that might exist in the tree response
    mode?: string;
    size?: number;
    url?: string;
}

// Define a more complete type for the Git Tree Response Data
// Based on Octokit docs/common responses
interface GitTreeResponseData {
    sha: string;
    url: string;
    tree: GitTreeFile[]; // Expect an array of tree items
    truncated: boolean; // Important flag for large repos
}


// --- Constants for Batching ---
const BATCH_SIZE = 69; // Number of blobs to fetch concurrently in one batch
const DELAY_BETWEEN_BATCHES_MS = 420; // Delay in milliseconds between batches

// Utility: Delay Function
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// --- Restore parseRepoUrl ---
function parseRepoUrl(repoUrl: string) {
  const match = repoUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
  if (!match) throw new Error("Invalid GitHub repo URL");
  return { owner: match[1], repo: match[2] };
}

// --- fetchRepoContents (With branch logic and error notification change) ---
export async function fetchRepoContents(repoUrl: string, customToken?: string, branchName?: string | null) {
  console.log(`Fetching repo contents for: ${repoUrl}${branchName ? ` on branch ${branchName}` : ' (default branch)'} using Git Trees API`);
  const startTime = Date.now();
  let owner: string | undefined, repo: string | undefined;
  let targetBranch = branchName; // Use mutable variable for potentially fetching default

  try {
    const token = customToken || process.env.GITHUB_TOKEN;
    if (!token) throw new Error("GitHub token is missing");
    const repoInfo = parseRepoUrl(repoUrl); owner = repoInfo.owner; repo = repoInfo.repo;
    const octokit = new Octokit({ auth: token });
    const allowedExtensions = [".ts", ".tsx", ".css", ".sql"]; // excluded as per original comment
    const excludedPrefixes = ["supabase/", "components/ui/", "node_modules/", ".next/", "dist/", "build/", "Configame/"];

    let latestCommitSha: string;

    if (!targetBranch) {
        console.log("No branch specified, fetching repository info for default branch...");
        const { data: repoData } = await octokit.repos.get({ owner, repo });
        targetBranch = repoData.default_branch;
        console.log(`Default branch determined: ${targetBranch}`);
    } else {
        console.log(`Fetching content for specified branch: ${targetBranch}`);
    }

    console.log(`Fetching ref for branch ${targetBranch}...`);
    try {
        const { data: refData } = await octokit.git.getRef({ owner, repo, ref: `heads/${targetBranch}` });
        latestCommitSha = refData.object.sha;
        console.log(`Latest commit SHA on ${targetBranch}: ${latestCommitSha}`);
    } catch (refError: any) {
         if (refError.status === 404) {
             console.error(`Branch '${targetBranch}' not found (404).`);
             throw new Error(`Branch '${targetBranch}' not found (404).`);
         }
         console.error(`Failed to get reference for branch '${targetBranch}':`, refError);
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
        // .. VITAL DEBUG LOGGING (Uncomment if needed)
        // .. console.log("Raw treeData received:", JSON.stringify(treeData, null, 2).substring(0, 500) + '...');
        if (treeData?.truncated) {
            console.warn("WARNING: GitHub API reported the tree data was truncated. File list may be incomplete.");
            // .. Decide if you want to notify admin about truncation
            // .. await notifyAdmin(`⚠️ Tree data truncated for ${owner}/${repo} on branch ${targetBranch}. File list might be incomplete.`);
        }
        if (!treeData || !Array.isArray(treeData.tree)) {
            console.error("Invalid tree structure received. Expected an object with a 'tree' array property, but got:", treeData);
            throw new Error(`Failed to fetch repository tree: API response did not contain the expected 'tree' array structure. Truncated status: ${treeData?.truncated ?? 'N/A'}`);
        }
        console.log(`Received tree with ${treeData.tree.length} items. Filtering...`);
    } catch (treeError: any) {
        const status = treeError.status ? ` (Status: ${treeError.status})` : '';
        throw new Error(`Failed during getTree API call${status}: ${treeError.message || treeError}`);
    }

    const filesToFetch: GitTreeFile[] = treeData.tree.filter((item): item is GitTreeFile => {
        if (item.type !== 'blob' || typeof item.path !== 'string' || !item.path || typeof item.sha !== 'string' || !item.sha) {
            return false;
        }
        if (excludedPrefixes.some(prefix => item.path!.startsWith(prefix))) {
            return false;
        }
        if (!allowedExtensions.some(ext => item.path!.endsWith(ext))) {
            return false;
        }
        return true;
    });
    console.log(`Found ${filesToFetch.length} files matching criteria.`);

    const allFiles: FileNode[] = [];
    const totalFiles = filesToFetch.length;
    if (totalFiles === 0) { console.warn("No files matched the filtering criteria. Returning empty list."); return { success: true, files: [] }; }

    for (let i = 0; i < totalFiles; i += BATCH_SIZE) {
        const batchFiles = filesToFetch.slice(i, i + BATCH_SIZE);
        const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(totalFiles / BATCH_SIZE);
        console.log(`Fetching content batch ${batchNumber}/${totalBatches} (Files ${i + 1} to ${Math.min(i + BATCH_SIZE, totalFiles)})`);
        const batchPromises = batchFiles.map(async (fileInfo) => {
             try {
                 const { data: blobData } = await octokit.git.getBlob({ owner: owner!, repo: repo!, file_sha: fileInfo.sha });
                 if (typeof blobData.content !== 'string' || typeof blobData.encoding !== 'string') {
                     console.error(`Invalid blob structure for ${fileInfo.path} (SHA: ${fileInfo.sha}): Missing content or encoding.`, blobData);
                     throw new Error(`Invalid blob data received for ${fileInfo.path}`);
                 }
                 let content: string;
                 if (blobData.encoding === 'base64') {
                     content = Buffer.from(blobData.content, 'base64').toString('utf-8');
                 } else if (blobData.encoding === 'utf-8') {
                     content = blobData.content;
                     // .. console.warn(`Received non-base64 encoding ('${blobData.encoding}') for blob ${fileInfo.path}. Using content directly.`);
                 } else {
                     console.error(`Unsupported blob encoding for ${fileInfo.path}: ${blobData.encoding}. Cannot decode.`);
                     throw new Error(`Unsupported encoding '${blobData.encoding}' for file ${fileInfo.path}`);
                 }
                 const contentLines = content.split("\n");
                 let pathComment: string;
                 if (fileInfo.path.endsWith(".ts") || fileInfo.path.endsWith(".tsx")) { pathComment = `// /${fileInfo.path}`; }
                 else if (fileInfo.path.endsWith(".css")) { pathComment = `/* /${fileInfo.path} */`; }
                 else if (fileInfo.path.endsWith(".sql")) { pathComment = `-- /${fileInfo.path}`; }
                 else { pathComment = `# /${fileInfo.path}`; } // Default

                 const firstLineTrimmed = contentLines[0]?.trimStart();
                 // .. Only replace if the first line LOOKS like a comment already
                 if (firstLineTrimmed?.match(/^(--|\/\/|\/\*|#)/)) {
                    contentLines[0] = pathComment;
                 } else { // .. Otherwise, prepend
                    contentLines.unshift(pathComment);
                 }
                 return { path: fileInfo.path, content: contentLines.join("\n") };
             } catch (fetchError: any) {
                  console.error(`Error fetching blob content for ${fileInfo.path} (SHA: ${fileInfo.sha}):`, fetchError.status ? `${fetchError.message} (Status: ${fetchError.status})` : fetchError);
                  throw new Error(`Failed to fetch blob ${fileInfo.path}: ${fetchError.message || fetchError}`);
             }
        });
        try {
            const batchResults = await Promise.all(batchPromises); allFiles.push(...batchResults);
            // .. console.log(`Batch ${batchNumber}/${totalBatches} completed.`);
        } catch (batchError) {
             console.error(`Error processing content batch ${batchNumber}/${totalBatches}:`, batchError);
             // .. Throw to indicate the overall fetch failed if any batch fails.
             // .. It already includes the specific file error message from the inner catch
             throw new Error(`Failed to fetch files in batch ${batchNumber}. Error: ${batchError instanceof Error ? batchError.message : batchError}`);
        }
        if (i + BATCH_SIZE < totalFiles) {
           console.log(`Waiting ${DELAY_BETWEEN_BATCHES_MS}ms before next batch...`);
           await delay(DELAY_BETWEEN_BATCHES_MS);
        }
    }

    const endTime = Date.now();
    console.log(`Successfully fetched content for ${allFiles.length} files from branch '${targetBranch}' in ${(endTime - startTime) / 1000} seconds.`);
    return { success: true, files: allFiles };

  } catch (error: any) {
        const endTime = Date.now();
        const repoIdentifier = owner && repo ? `${owner}/${repo}` : repoUrl;
        // Use targetBranch (which might be the fetched default) in error messages
        const branchInfo = targetBranch ? ` on branch '${targetBranch}'` : ' (default branch)';
        console.error(`Error fetching repo contents for ${repoIdentifier}${branchInfo} after ${(endTime - startTime) / 1000} seconds:`, error);
         // Use notifyAdmin for error notifications
         if (error.status === 403 && error.message?.includes('rate limit exceeded')) {
            console.error("GitHub API rate limit exceeded.");
            await notifyAdmin(`❌ Ошибка (Rate Limit) при извлечении файлов из репозитория ${repoIdentifier}${branchInfo}. Попробуйте позже.`);
            return { success: false, error: "GitHub API rate limit exceeded. Please try again later." };
         }
         if (error.status === 404 || error.message?.includes('not found')) {
            console.error("Repository, branch, or resource not found.");
             await notifyAdmin(`❌ Ошибка (404 Not Found) при извлечении файлов из репозитория ${repoIdentifier}${branchInfo}. Проверьте URL, права доступа к токену и существование ветки/коммита.`);
            return { success: false, error: `Repository, branch ('${targetBranch}'), or required resource not found (404). Check URL, token permissions, and branch/commit existence.` };
         }
         if (error.status === 401 || error.status === 403) {
             console.error(`GitHub API Authentication/Authorization error (Status: ${error.status})`);
             await notifyAdmin(`❌ Ошибка (Auth ${error.status}) при извлечении файлов из репозитория ${repoIdentifier}${branchInfo}. Проверьте токен и его права доступа.`);
            return { success: false, error: `GitHub API Authentication/Authorization error (Status: ${error.status}). Check token and permissions.` };
         }
        // Generic error
        await notifyAdmin(`❌ Ошибка при извлечении файлов из репозитория ${repoIdentifier}${branchInfo}:\n${error instanceof Error ? error.message : String(error)}`);
        return { success: false, error: `Failed to fetch contents${branchInfo}: ${error instanceof Error ? error.message : "Unknown error occurred"}` };
  }
}


// --- createGitHubPullRequest (Creates NEW branch/PR, uses notifyAdmin for errors) ---
export async function createGitHubPullRequest(
  repoUrl: string,
  files: FileNode[],
  prTitle: string,
  prDescription: string,
  commitMessage: string,
  branchName?: string // Optional suggested new branch name
) {
  let owner: string | undefined, repo: string | undefined, baseBranch: string | undefined;
  try {
    const token = process.env.GITHUB_TOKEN; if (!token) throw new Error("GitHub token missing");
    const repoInfo = parseRepoUrl(repoUrl); owner = repoInfo.owner; repo = repoInfo.repo;
    const octokit = new Octokit({ auth: token });

    const { data: repoData } = await octokit.repos.get({ owner, repo });
    baseBranch = repoData.default_branch; // Base for NEW branch

    const { data: refData } = await octokit.git.getRef({ owner, repo, ref: `heads/${baseBranch}` });
    const baseSha = refData.object.sha;

    // Truncate messages if needed
    const MAX_SIZE_BYTES = 65000; let finalCommitMessage = commitMessage, finalPrDescription = prDescription;
    const encoder = new TextEncoder();
    if (encoder.encode(finalCommitMessage).length > MAX_SIZE_BYTES) { finalCommitMessage = finalCommitMessage.substring(0, 60000) + "... (truncated)"; console.warn(`Commit message too long, truncating.`); }
    if (encoder.encode(finalPrDescription).length > MAX_SIZE_BYTES) { finalPrDescription = finalPrDescription.substring(0, 60000) + "\n\n... (truncated)"; console.warn(`PR description too long, truncating.`); }

    const newBranch = branchName || `feature-aiassisted-onesitepls-${Date.now()}`;
    console.log(`Creating NEW branch '${newBranch}' from ${baseBranch} (SHA: ${baseSha})`);
    // This will FAIL if branch already exists, which is desired for this function
    await octokit.git.createRef({ owner, repo, ref: `refs/heads/${newBranch}`, sha: baseSha });
    console.log(`Branch '${newBranch}' created successfully.`);

    // --- Create blobs, tree, commit, update NEW ref, create PR ---
    const { data: baseCommitData } = await octokit.git.getCommit({ owner, repo, commit_sha: baseSha });
    const baseTree = baseCommitData.tree.sha; console.log(`Base tree SHA: ${baseTree}`);
    console.log(`Creating ${files.length} blobs...`);
    const tree = await Promise.all( files.map(async (file) => { try { const { data } = await octokit.git.createBlob({ owner: owner!, repo: repo!, content: file.content, encoding: "utf-8" }); return { path: file.path, mode: "100644" as const, type: "blob" as const, sha: data.sha }; } catch (e: any) { throw new Error(`Failed to create blob for ${file.path}: ${e.message || e}`); } }) );
    console.log("Blobs created.");
    console.log(`Creating new tree with base ${baseTree}...`);
    const { data: newTree } = await octokit.git.createTree({ owner, repo, base_tree: baseTree, tree });
    console.log(`New tree created: ${newTree.sha}`);
    console.log(`Creating commit with tree ${newTree.sha}...`);
    const { data: newCommit } = await octokit.git.createCommit({ owner, repo, message: finalCommitMessage, tree: newTree.sha, parents: [baseSha] });
    console.log(`New commit created: ${newCommit.sha}`);
    console.log(`Updating ref heads/${newBranch} to commit ${newCommit.sha}...`);
    await octokit.git.updateRef({ owner, repo, ref: `heads/${newBranch}`, sha: newCommit.sha, force: false }); // force should generally be false
    console.log(`Ref heads/${newBranch} updated.`);
    const changedFiles = files.map((file) => file.path).join(", ");
    console.log(`Creating pull request: '${prTitle}' from ${newBranch} to ${baseBranch}...`);
    const { data: pr } = await octokit.pulls.create({ owner, repo, title: prTitle, body: finalPrDescription, head: newBranch, base: baseBranch });
    console.log(`Pull request created: ${pr.html_url}`);
    // --- Notify (Success) ---
    const adminMessage = `🔔 Созданы новые изменения в проекте!\nЧто меняем: ${prTitle}\nПодробности: ${finalPrDescription}\nФайлы: ${changedFiles}\n\n[Посмотреть и одобрить на GitHub](https://github.com/${owner}/${repo}/pull/${pr.number})`;
    await notifyAdmins(adminMessage); // Use notifyAdmins for success broadcasts
    return { success: true, prUrl: pr.html_url, branch: newBranch };

  } catch (error: any) {
        console.error("Error creating pull request:", error);
        const repoIdentifier = owner && repo ? `${owner}/${repo}` : repoUrl;
        const attemptedBranch = branchName || `feature-aiassisted-...`;
        let errorMessage = error instanceof Error ? error.message : "Unknown error occurred creating PR";
        // Specific error handling
        if (error.status === 422 && error.message?.includes("Reference already exists")) {
           errorMessage = `Branch '${attemptedBranch}' already exists. Please use a different branch name or delete the existing one.`;
            console.error(errorMessage);
        } else if (error.status === 404 && error.message?.includes("Not Found")) {
            errorMessage = `Repository ${repoIdentifier} or base branch '${baseBranch || 'default'}' not found (404). Check URL and permissions.`;
            console.error(errorMessage);
        } else if (error.status === 403) {
             errorMessage = `Permission denied (403) when trying to create PR/branch/commit in ${repoIdentifier}. Check token permissions.`;
             console.error(errorMessage);
        }
        // Notify Admin on Error
        await notifyAdmin(`❌ Ошибка при создании НОВОГО PR для ${repoIdentifier}:\n${errorMessage}\n${error.stack || ''}`);
        return { success: false, error: errorMessage };
  }
}


// --- NEW: updateBranch (Uses notifyAdmin for errors) ---
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
        if (refError.status === 404) {
            console.error(`Branch '${branchName}' not found. Cannot update.`);
            throw new Error(`Branch '${branchName}' not found. Cannot update.`);
        }
        console.error(`Failed to get ref for ${branchName}:`, refError);
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
    console.log(`Updating ref heads/${branchName} to commit ${newCommit.sha}...`);
    await octokit.git.updateRef({
        owner,
        repo,
        ref: `heads/${branchName}`,
        sha: newCommit.sha,
        force: false // Set true ONLY if necessary and you understand implications
    });
    console.log(`Ref heads/${branchName} updated successfully.`);

    // Notify Admins (Success)
    const changedFiles = files.map((file) => file.path).join(", ");
    const branchUrl = `https://github.com/${owner}/${repo}/tree/${branchName}`;
    const adminMessage = `🔄 Ветка '${branchName}' обновлена!\nCommit: ${finalCommitMessage.split('\n')[0]}\nFiles: ${changedFiles}\n\n[Посмотреть ветку](${branchUrl})`;
    await notifyAdmins(adminMessage); // Use notifyAdmins for success broadcasts

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

    // Notify Admin on Error
    await notifyAdmin(`❌ Ошибка при обновлении ветки '${branchName}' в ${repoIdentifier}:\n${errorMessage}`);
    return { success: false, error: errorMessage };
  }
}


// --- deleteGitHubBranch (Uses notifyAdmin for errors) ---
export async function deleteGitHubBranch(repoUrl: string, branchName: string) {
    let owner: string | undefined;
    let repo: string | undefined;
    try {
      const token = process.env.GITHUB_TOKEN;
      if (!token) throw new Error("GitHub token missing");
      const repoInfo = parseRepoUrl(repoUrl);
      owner = repoInfo.owner;
      repo = repoInfo.repo;
      const octokit = new Octokit({ auth: token });

      console.log(`Attempting to delete branch 'refs/heads/${branchName}' in ${owner}/${repo}...`);
      await octokit.git.deleteRef({ owner, repo, ref: `heads/${branchName}` });
      console.log(`Delete request sent for branch ${branchName}. Verifying...`);

      // Add a slightly longer delay before checking
      await new Promise((resolve) => setTimeout(resolve, 2000)); // Increased delay to 2 seconds

      try {
        await octokit.git.getRef({ owner, repo, ref: `heads/${branchName}` });
        // If getRef succeeds, branch still exists (unexpected)
         console.error(`Verification failed: Branch ${branchName} still exists after deletion attempt in ${owner}/${repo}.`);
         // Notify Admin on verification failure
         await notifyAdmin(`⚠️ Не удалось подтвердить удаление ветки ${branchName} в репозитории ${owner}/${repo}. Возможно, она все еще существует.`);
         return { success: false, error: "Branch deletion verification failed. Branch might still exist." };
      } catch (err: any) {
         // If getRef fails with 404, deletion was successful
        if (err.status === 404) {
             console.log(`Verification successful: Branch ${branchName} was deleted.`);
            return { success: true };
        }
        // If getRef fails with another error during verification
        console.error(`Error during branch deletion verification for ${branchName} in ${owner}/${repo} (might be deleted anyway):`, err);
         // Notify Admin about verification error
         await notifyAdmin(`⚠️ Ошибка при проверке удаления ветки ${branchName} в ${owner}/${repo} (Status: ${err.status}): ${err.message}. Ветка может быть удалена.`);
         // Return success true here, as the delete *request* didn't fail, only the check
         return { success: true, warning: "Deletion request succeeded, but verification check failed." };
      }
    } catch (error: any) {
      console.error(`Error deleting branch ${branchName} in ${repoUrl}:`, error);
      const repoIdentifier = owner && repo ? `${owner}/${repo}` : repoUrl;
      let errorMessage = error instanceof Error ? error.message : "Failed to delete branch";
       if (error.status === 404 || error.status === 422) {
           errorMessage = `Branch '${branchName}' not found or couldn't be deleted (Status: ${error.status}). It might have been deleted already.`;
           console.warn(errorMessage);
           // Consider returning success: true if not found, as the desired state is achieved.
       } else if (error.status === 403) {
           errorMessage = `Permission denied (403) when trying to delete branch ${branchName} in ${repoIdentifier}. Check token permissions.`;
            console.error(errorMessage);
       }
       // Notify Admin on Error
       await notifyAdmin(`❌ Ошибка при удалении ветки ${branchName} в репозитории ${repoIdentifier}:\n${errorMessage}`);
      return { success: false, error: errorMessage };
    }
}

// --- mergePullRequest (Uses notifyAdmin for errors) ---
export async function mergePullRequest(repoUrl: string, pullNumber: number) {
  let owner: string | undefined;
  let repo: string | undefined;
  try {
    const token = process.env.GITHUB_TOKEN;
    if (!token) throw new Error("GitHub token missing");
    const repoInfo = parseRepoUrl(repoUrl);
    owner = repoInfo.owner;
    repo = repoInfo.repo;
    const octokit = new Octokit({ auth: token });

    console.log(`Attempting to merge PR #${pullNumber} in ${owner}/${repo}...`);
    const { data: prData } = await octokit.pulls.get({ owner, repo, pull_number: pullNumber });
    if (prData.state !== 'open') {
        throw new Error(`Pull request #${pullNumber} is not open (state: ${prData.state}). Cannot merge.`);
    }
    if (prData.merged) {
         console.warn(`Pull request #${pullNumber} is already merged.`);
         return { success: true, message: "Pull request already merged." };
    }
     if (!prData.mergeable) {
         console.warn(`Pull request #${pullNumber} is not mergeable (State: ${prData.mergeable_state}). Checking details...`);
         await delay(2000);
         const { data: prDataUpdated } = await octokit.pulls.get({ owner, repo, pull_number: pullNumber });
         if (!prDataUpdated.mergeable) {
            throw new Error(`Pull request #${pullNumber} is not mergeable (State: ${prDataUpdated.mergeable_state}). Please resolve conflicts or checks on GitHub.`);
         }
         console.log(`PR #${pullNumber} became mergeable after delay.`);
     }


    await octokit.pulls.merge({ owner, repo, pull_number: pullNumber, merge_method: "squash" });
    console.log(`PR #${pullNumber} merged successfully.`);

    // Notify Admins (Success)
    const adminMessage = `🚀 Изменения #${pullNumber} в ${owner}/${repo} добавлены в проект!\n\n[Посмотреть на GitHub](https://github.com/${owner}/${repo}/pull/${pullNumber})`;
    await notifyAdmins(adminMessage); // Use notifyAdmins for success broadcasts
    return { success: true };
  } catch (error: any) {
    console.error(`Merge failed for PR #${pullNumber} in ${repoUrl}:`, error);
    const repoIdentifier = owner && repo ? `${owner}/${repo}` : repoUrl;
    let errorMessage = error instanceof Error ? error.message : "Failed to merge changes";
    if (error.status === 405 && error.message?.includes('not mergeable')) {
        errorMessage = `Pull request #${pullNumber} is not mergeable (Status 405). Resolve conflicts or check branch protection rules.`;
         console.error(errorMessage, error.response?.data);
    } else if (error.status === 404) {
        errorMessage = `Pull request #${pullNumber} not found in ${repoIdentifier} (404).`;
         console.error(errorMessage);
    } else if (error.status === 403) {
         errorMessage = `Permission denied (403) to merge PR #${pullNumber} in ${repoIdentifier}. Check token permissions and branch protection rules.`;
          console.error(errorMessage);
    } else if (error.status === 409 && error.message?.includes('conflict')) {
         errorMessage = `Merge conflict detected for PR #${pullNumber} (Status 409). Please resolve conflicts on GitHub.`;
         console.error(errorMessage);
    }

    // Notify Admin on Error
    await notifyAdmin(`❌ Ошибка при мерже PR #${pullNumber} в ${repoIdentifier}:\n${errorMessage}`);
    return { success: false, error: errorMessage };
  }
}

// --- getOpenPullRequests (Uses notifyAdmin for critical errors, otherwise just logs) ---
export async function getOpenPullRequests(repoUrl: string) {
  let owner: string | undefined, repo: string | undefined;
  try {
    const token = process.env.GITHUB_TOKEN;
    if (!token) throw new Error("GitHub token is missing");
    const repoInfo = parseRepoUrl(repoUrl);
    owner = repoInfo.owner;
    repo = repoInfo.repo;
    const octokit = new Octokit({ auth: token });
    // console.log(`Fetching open PRs for ${owner}/${repo}...`);
    const { data } = await octokit.pulls.list({ owner, repo, state: "open" });
    // console.log(`Found ${data.length} open PRs.`);
    // Ensure essential data is present
    const cleanData = data.map(pr => ({
        id: pr.id,
        number: pr.number,
        title: pr.title || 'Untitled PR',
        html_url: pr.html_url || '#',
        user: { login: pr.user?.login || 'unknown' },
        head: { ref: pr.head?.ref || 'unknown-branch' }, // Important: Ensure branch name is included
        updated_at: pr.updated_at || new Date().toISOString(),
    }));

    return { success: true, pullRequests: cleanData };
  } catch (error: any) {
    console.error("Error fetching open PRs:", error);
    const repoIdentifier = owner && repo ? `${owner}/${repo}` : repoUrl;
    let errorMessage = error instanceof Error ? error.message : "Failed to fetch open pull requests";
     if (error.status === 404) {
        errorMessage = `Repository ${repoIdentifier} not found (404) when fetching PRs.`;
        // Notify Admin on critical access error (repo not found)
        await notifyAdmin(`❌ Ошибка 404 при получении списка PR для ${repoIdentifier}. Проверьте URL.`);
     } else if (error.status === 403 || error.status === 401) {
         errorMessage = `Permission denied (Status ${error.status}) when fetching PRs for ${repoIdentifier}. Check token permissions.`;
         // Notify Admin on critical access error (permissions)
         await notifyAdmin(`❌ Ошибка ${error.status} при получении списка PR для ${repoIdentifier}. Проверьте права токена.`);
     } else {
        // Generic error, maybe less critical, decide if notifyAdmin is needed
        // await notifyAdmin(`❌ Ошибка при получении списка PR для ${repoIdentifier}: ${errorMessage}`);
        console.error(`Non-critical error fetching PRs for ${repoIdentifier}: ${errorMessage}`);
     }
    return { success: false, error: errorMessage };
  }
}

// --- getGitHubUserProfile (No error notification needed usually) ---
export async function getGitHubUserProfile(username: string) {
  try {
    const token = process.env.GITHUB_TOKEN; // Keep using token if available for rate limits
    const octokit = new Octokit({ auth: token });
    // console.log(`Fetching profile for user ${username}...`);

    const { data: userProfile } = await octokit.users.getByUsername({ username });

    return {
      success: true,
      profile: {
        login: userProfile.login,
        avatar_url: userProfile.avatar_url,
        html_url: userProfile.html_url,
        name: userProfile.name, // Can be null
      },
    };
  } catch (error: any) {
    if (error.status === 404) {
        console.log(`GitHub user '${username}' not found.`);
        return { success: false, error: "GitHub user not found.", profile: null };
    }
    console.error(`Error fetching GitHub profile for ${username}:`, error);
    // Generally no need to notify admin for profile fetch errors
    return { success: false, error: error instanceof Error ? error.message : "Failed to fetch GitHub profile", profile: null };
  }
}

// --- approvePullRequest (Uses notifyAdmin for errors) ---
export async function approvePullRequest(repoUrl: string, pullNumber: number) {
  let owner: string | undefined;
  let repo: string | undefined;
  try {
    const token = process.env.GITHUB_TOKEN;
    if (!token) throw new Error("GitHub token is missing (AWOL)");
    const repoInfo = parseRepoUrl(repoUrl);
    owner = repoInfo.owner;
    repo = repoInfo.repo;
    const octokit = new Octokit({ auth: token });

    console.log(`Attempting to approve PR #${pullNumber} in ${owner}/${repo}...`);
    await octokit.pulls.createReview({
        owner,
        repo,
        pull_number: pullNumber,
        event: "APPROVE",
        body: "Approved by automated process."
    });
    console.log(`PR #${pullNumber} approved successfully.`);
    // Maybe notifyAdmins on success if needed?
    // await notifyAdmins(`✅ PR #${pullNumber} в ${owner}/${repo} одобрен.`);
    return { success: true };
  } catch (error: any) {
    console.error(`Approval failed for PR #${pullNumber} in ${repoUrl}:`, error);
     const repoIdentifier = owner && repo ? `${owner}/${repo}` : repoUrl;
     let errorMessage = error instanceof Error ? error.message : "Failed to approve PR";
      if (error.status === 404) {
          errorMessage = `Pull request #${pullNumber} not found in ${repoIdentifier} (404).`;
      } else if (error.status === 403) {
          errorMessage = `Permission denied (403) to approve PR #${pullNumber} in ${repoIdentifier}. Check token permissions.`;
      } else if (error.status === 422 && error.message?.includes("review cannot be submitted")) {
           console.warn(`Could not approve PR #${pullNumber}, possibly already approved or another issue: ${error.message}`);
           errorMessage = `Could not approve PR #${pullNumber}: ${error.message}`;
           // Don't notify admin if it's likely already approved.
           return { success: false, error: errorMessage }; // Return error, but don't notify admin
      }
     // Notify Admin on Error
     await notifyAdmin(`❌ Ошибка при одобрении PR #${pullNumber} в ${repoIdentifier}:\n${errorMessage}`);
    return { success: false, error: errorMessage };
  }
}

// --- closePullRequest (Uses notifyAdmin for errors) ---
export async function closePullRequest(repoUrl: string, pullNumber: number) {
   let owner: string | undefined;
   let repo: string | undefined;
  try {
    const token = process.env.GITHUB_TOKEN;
    if (!token) throw new Error("GitHub token is missing");
    const repoInfo = parseRepoUrl(repoUrl);
    owner = repoInfo.owner;
    repo = repoInfo.repo;
    const octokit = new Octokit({ auth: token });

    console.log(`Attempting to close PR #${pullNumber} in ${owner}/${repo}...`);
    const { data: prData } = await octokit.pulls.get({ owner, repo, pull_number: pullNumber });
    if (prData.state === 'closed') {
        console.warn(`Pull request #${pullNumber} is already closed.`);
        return { success: true, message: "Pull request already closed." };
    }

    await octokit.pulls.update({ owner, repo, pull_number: pullNumber, state: "closed" });
    console.log(`PR #${pullNumber} closed successfully.`);
     // Notify Admins (Success)
     await notifyAdmins(`☑️ PR #${pullNumber} в ${owner}/${repo} был закрыт без мержа.`); // Use notifyAdmins for success broadcasts
    return { success: true };
  } catch (error: any) {
    console.error(`Closing PR #${pullNumber} in ${repoUrl} failed:`, error);
     const repoIdentifier = owner && repo ? `${owner}/${repo}` : repoUrl;
     let errorMessage = error instanceof Error ? error.message : "Failed to close PR";
      if (error.status === 404) {
          errorMessage = `Pull request #${pullNumber} not found in ${repoIdentifier} (404).`;
      } else if (error.status === 403) {
          errorMessage = `Permission denied (403) to close PR #${pullNumber} in ${repoIdentifier}. Check token permissions.`;
      }
     // Notify Admin on Error
     await notifyAdmin(`❌ Ошибка при закрытии PR #${pullNumber} в ${repoIdentifier}:\n${errorMessage}`);
    return { success: false, error: errorMessage };
  }
}