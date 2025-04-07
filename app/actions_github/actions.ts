// /app/actions_github/actions.ts
"use server";
import { Octokit } from "@octokit/rest";
import { notifyAdmins } from "@/app/actions"; // Keep this import

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

function parseRepoUrl(repoUrl: string) {
  const match = repoUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
  if (!match) throw new Error("Invalid GitHub repo URL");
  return { owner: match[1], repo: match[2] };
}

// --- NEW: Improved fetchRepoContents using Git Trees/Blobs ---
export async function fetchRepoContents(repoUrl: string, customToken?: string) {
  console.log(`Fetching repo contents for: ${repoUrl} using Git Trees API`);
  const startTime = Date.now();
  let owner: string | undefined; // Define owner/repo outside try for error reporting
  let repo: string | undefined;

  try {
    const token = customToken || process.env.GITHUB_TOKEN;
    if (!token) throw new Error("GitHub token is missing");

    const repoInfo = parseRepoUrl(repoUrl);
    owner = repoInfo.owner; // Assign owner/repo here
    repo = repoInfo.repo;
    const octokit = new Octokit({ auth: token });

    // --- Define allowed extensions & excluded paths ---
    const allowedExtensions = [".ts", ".tsx", ".css"]; // ".sql" excluded as per original comment
    const excludedPrefixes = ["supabase/", "components/ui/", "node_modules/", ".next/", "dist/", "build/", "Configame/"];

    // 1. Get the default branch
    console.log("Fetching repository info...");
    const { data: repoData } = await octokit.repos.get({ owner, repo });
    const defaultBranch = repoData.default_branch;
    console.log(`Default branch: ${defaultBranch}`);

    // 2. Get the SHA of the latest commit on the default branch
    console.log(`Fetching ref for branch ${defaultBranch}...`);
    const { data: refData } = await octokit.git.getRef({
      owner,
      repo,
      ref: `heads/${defaultBranch}`,
    });
    const latestCommitSha = refData.object.sha;
    console.log(`Latest commit SHA: ${latestCommitSha}`);

    // 3. Get the tree SHA for the latest commit
     const { data: commitData } = await octokit.git.getCommit({
        owner,
        repo,
        commit_sha: latestCommitSha,
     });
     const treeSha = commitData.tree.sha;
     console.log(`Tree SHA: ${treeSha}`);


    // 4. Fetch the entire repository tree recursively
    console.log("Fetching recursive tree...");
    let treeData: GitTreeResponseData; // Define treeData outside the try block

    try { // Add specific try/catch around the getTree call
        const response = await octokit.git.getTree({
            owner,
            repo,
            tree_sha: treeSha,
            recursive: '1', // Use string '1' as per some Octokit versions/docs
        });
        treeData = response.data as GitTreeResponseData; // Assert the type expected

        // --- VITAL DEBUG LOGGING ---
        // Log the raw structure received from the API before attempting to access properties
        console.log("Raw treeData received from octokit.git.getTree:", JSON.stringify(treeData, null, 2));
        // Log if truncated - important for large repos
        if (treeData && typeof treeData.truncated === 'boolean') {
            console.log(`Tree data truncated status from API: ${treeData.truncated}`);
            if (treeData.truncated) {
                console.warn("WARNING: GitHub API reported the tree data was truncated. File list may be incomplete.");
                // Decide if you want to throw an error here or proceed with potentially partial data
                // throw new Error("Repository tree data is truncated, cannot guarantee completeness.");
            }
        }
        // --- END DEBUG LOGGING ---

        // Check the structure *after* logging and *before* accessing treeData.tree
        // Use Array.isArray for a more robust check
        if (!treeData || !Array.isArray(treeData.tree)) {
            console.error("Invalid tree structure received. Expected an object with a 'tree' array property, but got:", treeData);
            throw new Error(`Failed to fetch repository tree: API response did not contain the expected 'tree' array structure. Truncated status: ${treeData?.truncated ?? 'N/A'}`);
        }

        console.log(`Received tree with ${treeData.tree.length} items. Filtering...`);

    } catch (treeError: any) {
        console.error(`Error during octokit.git.getTree API call for sha ${treeSha}:`, treeError);
        // Include status code if available, helpful for diagnosing API issues (rate limits, permissions etc.)
        const status = treeError.status ? ` (Status: ${treeError.status})` : '';
        throw new Error(`Failed during getTree API call${status}: ${treeError.message || treeError}`);
    }


    // 5. Filter the tree to get only desired file blobs
    const filesToFetch: GitTreeFile[] = treeData.tree.filter((item): item is GitTreeFile => {
        // Ensure item has path and sha, and is a blob
        // Adding extra checks for robustness based on potential API response variations
        if (item.type !== 'blob' || typeof item.path !== 'string' || !item.path || typeof item.sha !== 'string' || !item.sha) {
            // console.log(`Excluding item due to missing properties or wrong type: ${JSON.stringify(item)}`); // Optional verbose log
            return false;
        }
        // Check against excluded prefixes
        if (excludedPrefixes.some(prefix => item.path!.startsWith(prefix))) {
            // console.log(`Excluding by prefix: ${item.path}`); // Optional: verbose logging
            return false;
        }
        // Check against allowed extensions
        if (!allowedExtensions.some(ext => item.path!.endsWith(ext))) {
            // console.log(`Excluding by extension: ${item.path}`); // Optional: verbose logging
            return false;
        }
        return true;
    });

    console.log(`Found ${filesToFetch.length} files matching criteria to fetch content for.`);

    // 6. Batch fetch blob contents
    const allFiles: FileNode[] = [];
    const totalFiles = filesToFetch.length;

    if (totalFiles === 0) {
        console.warn("No files matched the filtering criteria. Returning empty list.");
        return { success: true, files: [] }; // Return success with empty files if none matched
    }


    for (let i = 0; i < totalFiles; i += BATCH_SIZE) {
      const batchFiles = filesToFetch.slice(i, i + BATCH_SIZE);
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(totalFiles / BATCH_SIZE);
      console.log(`Fetching content batch ${batchNumber}/${totalBatches} (Files ${i + 1} to ${Math.min(i + BATCH_SIZE, totalFiles)})`);

      const batchPromises = batchFiles.map(async (fileInfo) => {
        try {
            // Fetch blob content using its SHA
            const { data: blobData } = await octokit.git.getBlob({
                owner: owner!, // Use non-null assertion as owner/repo are checked earlier
                repo: repo!,
                file_sha: fileInfo.sha,
            });

            // --- DEBUG: Log blob structure ---
            // console.log(`Blob data for ${fileInfo.path}:`, JSON.stringify(blobData, null, 2));
            // ---

            // Check encoding BEFORE attempting to decode
            if (typeof blobData.content !== 'string' || typeof blobData.encoding !== 'string') {
                 console.error(`Invalid blob structure for ${fileInfo.path} (SHA: ${fileInfo.sha}): Missing content or encoding.`, blobData);
                 throw new Error(`Invalid blob data received for ${fileInfo.path}`);
            }

            let content: string;
            if (blobData.encoding === 'base64') {
                // Decode base64 content
                content = Buffer.from(blobData.content, 'base64').toString('utf-8');
            } else if (blobData.encoding === 'utf-8') {
                // Sometimes GitHub might return utf-8 directly, though base64 is typical for getBlob
                content = blobData.content;
                console.warn(`Received non-base64 encoding ('${blobData.encoding}') for blob ${fileInfo.path}. Using content directly.`);
            }
             else {
                console.error(`Unsupported blob encoding for ${fileInfo.path}: ${blobData.encoding}. Cannot decode.`);
                throw new Error(`Unsupported encoding '${blobData.encoding}' for file ${fileInfo.path}`);
            }


            // Add path comment (same logic as before)
            const contentLines = content.split("\n");
            let pathComment: string;
            if (fileInfo.path.endsWith(".ts") || fileInfo.path.endsWith(".tsx")) {
                pathComment = `// /${fileInfo.path}`;
            } else if (fileInfo.path.endsWith(".css")) {
                pathComment = `/* /${fileInfo.path} */`;
            } else if (fileInfo.path.endsWith(".sql")) { // Re-added just in case
                pathComment = `-- /${fileInfo.path}`;
            } else {
                pathComment = `# /${fileInfo.path}`; // Default
            }

            const firstLineTrimmed = contentLines[0]?.trimStart();
            if (firstLineTrimmed?.match(/^(--|\/\/|\/\*|#)/)) {
                contentLines[0] = pathComment; // Replace existing comment
            } else {
                contentLines.unshift(pathComment); // Add new comment line
            }

            return { path: fileInfo.path, content: contentLines.join("\n") };

        } catch (fetchError: any) {
             console.error(`Error fetching blob content for ${fileInfo.path} (SHA: ${fileInfo.sha}):`, fetchError.status ? `${fetchError.message} (Status: ${fetchError.status})` : fetchError);
             // Re-throw to fail the batch
             throw new Error(`Failed to fetch blob ${fileInfo.path}: ${fetchError.message || fetchError}`);
        }
      });

      // Wait for the current batch to complete
      try {
          const batchResults = await Promise.all(batchPromises);
          allFiles.push(...batchResults);
          console.log(`Batch ${batchNumber}/${totalBatches} completed successfully.`);
      } catch (batchError) {
           console.error(`Error processing content batch ${batchNumber}/${totalBatches}:`, batchError);
           // Throw to indicate the overall fetch failed if any batch fails.
           // It already includes the specific file error message from the inner catch
           throw new Error(`Failed to fetch files in batch ${batchNumber}. Error: ${batchError instanceof Error ? batchError.message : batchError}`);
      }

      // Add delay before the next batch, but not after the last one
      if (i + BATCH_SIZE < totalFiles) {
        console.log(`Waiting ${DELAY_BETWEEN_BATCHES_MS}ms before next batch...`);
        await delay(DELAY_BETWEEN_BATCHES_MS);
      }
    }
    // --- End Batch Fetching Logic ---

    const endTime = Date.now();
    console.log(`Successfully fetched content for ${allFiles.length} files in ${(endTime - startTime) / 1000} seconds.`);
    return { success: true, files: allFiles };

  } catch (error: any) {
    const endTime = Date.now();
    // Ensure owner/repo are defined for the error message, even if parsing failed early
    const repoIdentifier = owner && repo ? `${owner}/${repo}` : repoUrl;
    console.error(`Error fetching repo contents for ${repoIdentifier} after ${(endTime - startTime) / 1000} seconds:`, error);
     // Check for specific GitHub API errors if possible
     if (error.status === 403 && error.message?.includes('rate limit exceeded')) {
        console.error("GitHub API rate limit exceeded.");
        await notifyAdmins(`❌ Ошибка (Rate Limit) при извлечении файлов из репозитория ${repoIdentifier}. Попробуйте позже.`);
        return { success: false, error: "GitHub API rate limit exceeded. Please try again later." };
     }
     if (error.status === 404) {
        console.error("Repository or resource not found.");
         await notifyAdmins(`❌ Ошибка (404 Not Found) при извлечении файлов из репозитория ${repoIdentifier}. Проверьте URL, права доступа к токену и существование ветки/коммита.`);
        return { success: false, error: "Repository or required resource not found (404). Check URL, token permissions, and branch/commit existence." };
     }
     if (error.status === 401 || error.status === 403) {
         console.error(`GitHub API Authentication/Authorization error (Status: ${error.status})`);
         await notifyAdmins(`❌ Ошибка (Auth ${error.status}) при извлечении файлов из репозитория ${repoIdentifier}. Проверьте токен и его права доступа.`);
        return { success: false, error: `GitHub API Authentication/Authorization error (Status: ${error.status}). Check token and permissions.` };
     }
    // Generic error
    await notifyAdmins(`❌ Ошибка при извлечении файлов из репозитория ${repoIdentifier}:\n${error instanceof Error ? error.message : String(error)}`);
    return {
      success: false,
      error: `Failed to fetch repository contents: ${error instanceof Error ? error.message : "Unknown error occurred"}`, // Make error message more specific
    };
  }
}



// --- createGitHubPullRequest function (Keep as is, slight improvement on error message) ---
export async function createGitHubPullRequest(
  repoUrl: string,
  files: FileNode[],
  prTitle: string,
  prDescription: string,
  commitMessage: string,
  branchName?: string
) {
  let owner: string | undefined;
  let repo: string | undefined;
  try {
    const token = process.env.GITHUB_TOKEN;
    if (!token) throw new Error("GitHub token missing");

    const repoInfo = parseRepoUrl(repoUrl);
    owner = repoInfo.owner;
    repo = repoInfo.repo;
    const octokit = new Octokit({ auth: token });

    const { data: repoData } = await octokit.repos.get({ owner, repo });
    const defaultBranch = repoData.default_branch;

    const { data: refData } = await octokit.git.getRef({
      owner,
      repo,
      ref: `heads/${defaultBranch}`,
    });
    const baseSha = refData.object.sha;

    const MAX_SIZE_BYTES = 65000;
    let finalCommitMessage = commitMessage;
    let finalPrDescription = prDescription;

    // Use TextEncoder for potentially more accurate byte size calculation
    const encoder = new TextEncoder();
    if (encoder.encode(finalCommitMessage).length > MAX_SIZE_BYTES) {
      console.warn(`Commit message too long (${encoder.encode(finalCommitMessage).length} bytes), truncating.`);
      // Truncate based on characters, assuming roughly 1 byte per char for safety
      finalCommitMessage = finalCommitMessage.substring(0, 60000) + "... (truncated)";
    }

    if (encoder.encode(finalPrDescription).length > MAX_SIZE_BYTES) {
       console.warn(`PR description too long (${encoder.encode(finalPrDescription).length} bytes), truncating.`);
       finalPrDescription = finalPrDescription.substring(0, 60000) + "\n\n... (truncated)";
    }

    const branch = branchName || `feature-aiassisted-onesitepls-${Date.now()}`;
    console.log(`Creating branch '${branch}' from ${defaultBranch} (SHA: ${baseSha})`);
    await octokit.git.createRef({ owner, repo, ref: `refs/heads/${branch}`, sha: baseSha });
    console.log(`Branch '${branch}' created successfully.`);

    // No need to get the base commit again, we already have baseSha and can get its tree
    // const { data: commitData } = await octokit.git.getCommit({ owner, repo, commit_sha: baseSha });
    // const baseTree = commitData.tree.sha;
     const { data: baseCommitData } = await octokit.git.getCommit({ owner, repo, commit_sha: baseSha });
     const baseTree = baseCommitData.tree.sha;
     console.log(`Base tree SHA: ${baseTree}`);


    console.log(`Creating ${files.length} blobs...`);
    const tree = await Promise.all(
      files.map(async (file) => {
        try {
            // console.log(`Creating blob for: ${file.path}`); // Verbose log if needed
            const { data } = await octokit.git.createBlob({ owner: owner!, repo: repo!, content: file.content, encoding: "utf-8" });
            // console.log(`Blob created for ${file.path}: ${data.sha}`); // Verbose log if needed
            return { path: file.path, mode: "100644" as const, type: "blob" as const, sha: data.sha };
        } catch (blobError: any) {
             console.error(`Error creating blob for file ${file.path}:`, blobError);
             throw new Error(`Failed to create blob for ${file.path}: ${blobError.message || blobError}`);
        }
      })
    );
     console.log("Blobs created.");

    console.log(`Creating new tree with base ${baseTree}...`);
    const { data: newTree } = await octokit.git.createTree({ owner, repo, base_tree: baseTree, tree });
    console.log(`New tree created: ${newTree.sha}`);

    console.log(`Creating commit with tree ${newTree.sha}...`);
    const { data: newCommit } = await octokit.git.createCommit({ owner, repo, message: finalCommitMessage, tree: newTree.sha, parents: [baseSha] });
    console.log(`New commit created: ${newCommit.sha}`);

    console.log(`Updating ref heads/${branch} to commit ${newCommit.sha}...`);
    await octokit.git.updateRef({ owner, repo, ref: `heads/${branch}`, sha: newCommit.sha, force: false }); // force should generally be false
    console.log(`Ref heads/${branch} updated.`);

    const changedFiles = files.map((file) => file.path).join(", ");
    console.log(`Creating pull request: '${prTitle}' from ${branch} to ${defaultBranch}...`);
    const { data: pr } = await octokit.pulls.create({ owner, repo, title: prTitle, body: finalPrDescription, head: branch, base: defaultBranch });
    console.log(`Pull request created: ${pr.html_url}`);


    const adminMessage = `🔔 Созданы новые изменения в проекте!\nЧто меняем: ${prTitle}\nПодробности: ${prDescription}\nФайлы: ${changedFiles}\n\n[Посмотреть и одобрить на GitHub](https://github.com/${owner}/${repo}/pull/${pr.number})`;
    await notifyAdmins(adminMessage);

    return { success: true, prUrl: pr.html_url, branch };
  } catch (error: any) {
    console.error("Error creating pull request:", error);
    const repoIdentifier = owner && repo ? `${owner}/${repo}` : repoUrl;
    // Check for specific common errors
    let errorMessage = error instanceof Error ? error.message : "Unknown error occurred creating PR";
    if (error.status === 422 && error.message?.includes("Reference already exists")) {
       errorMessage = `Branch '${error.request?.ref || branchName}' already exists. Please use a different branch name or delete the existing one.`;
        console.error(errorMessage);
    } else if (error.status === 404 && error.message?.includes("Not Found")) {
        errorMessage = `Repository ${repoIdentifier} or base branch not found (404). Check URL and permissions.`;
        console.error(errorMessage);
    } else if (error.status === 403) {
         errorMessage = `Permission denied (403) when trying to create PR/branch/commit in ${repoIdentifier}. Check token permissions.`;
         console.error(errorMessage);
    }

    await notifyAdmins(`❌ Ошибка при создании PR для ${repoIdentifier}:\n${errorMessage}\n${error.stack || ''}`);
    return { success: false, error: errorMessage };
  }
}

// --- deleteGitHubBranch function (Keep as is, slight improvement on error message) ---
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

      // Add a slightly longer delay before checking, GitHub ref deletion can have eventual consistency
      await new Promise((resolve) => setTimeout(resolve, 2000)); // Increased delay to 2 seconds

      try {
        await octokit.git.getRef({ owner, repo, ref: `heads/${branchName}` });
        // If getRef succeeds, branch still exists (unexpected)
         console.error(`Verification failed: Branch ${branchName} still exists after deletion attempt in ${owner}/${repo}.`);
         await notifyAdmins(`⚠️ Не удалось подтвердить удаление ветки ${branchName} в репозитории ${owner}/${repo}. Возможно, она все еще существует.`);
         // Return success=false as the primary goal (deletion check) failed
         return { success: false, error: "Branch deletion verification failed. Branch might still exist." };
      } catch (err: any) {
         // If getRef fails with 404, deletion was successful
        if (err.status === 404) {
             console.log(`Verification successful: Branch ${branchName} was deleted.`);
            return { success: true };
        }
        // If getRef fails with another error during verification, log it but consider the deletion attempt potentially successful initially
        console.error(`Error during branch deletion verification for ${branchName} in ${owner}/${repo} (might be deleted anyway):`, err);
         await notifyAdmins(`⚠️ Ошибка при проверке удаления ветки ${branchName} в ${owner}/${repo} (Status: ${err.status}): ${err.message}. Ветка может быть удалена.`);
         // Let's return success true here, as the delete *request* didn't fail, only the check
         // Adjust this if strict confirmation is required.
         return { success: true, warning: "Deletion request succeeded, but verification check failed." };

        // --- OR --- if strict verification is needed:
        // throw new Error(`Verification check failed after delete request: ${err.message}`);
      }
    } catch (error: any) {
      console.error(`Error deleting branch ${branchName} in ${repoUrl}:`, error);
      const repoIdentifier = owner && repo ? `${owner}/${repo}` : repoUrl;
      let errorMessage = error instanceof Error ? error.message : "Failed to delete branch";
       if (error.status === 404 || error.status === 422) { // 422 Unprocessable Entity if ref format is wrong or sometimes if it doesn't exist
           errorMessage = `Branch '${branchName}' not found or couldn't be deleted (Status: ${error.status}). It might have been deleted already.`;
           console.warn(errorMessage);
           // If it's not found, maybe treat it as success? Depends on desired behavior.
           // return { success: true };
       } else if (error.status === 403) {
           errorMessage = `Permission denied (403) when trying to delete branch ${branchName} in ${repoIdentifier}. Check token permissions.`;
            console.error(errorMessage);
       }
       await notifyAdmins(`❌ Ошибка при удалении ветки ${branchName} в репозитории ${repoIdentifier}:\n${errorMessage}`);
      return { success: false, error: errorMessage };
    }
}

// --- mergePullRequest function (Keep as is, slight improvement on error message) ---
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
    // Check PR state first? Optional but can prevent errors.
    const { data: prData } = await octokit.pulls.get({ owner, repo, pull_number: pullNumber });
    if (prData.state !== 'open') {
        throw new Error(`Pull request #${pullNumber} is not open (state: ${prData.state}). Cannot merge.`);
    }
    if (prData.merged) {
         console.warn(`Pull request #${pullNumber} is already merged.`);
         // Optionally return success if already merged
         return { success: true, message: "Pull request already merged." };
    }
     if (!prData.mergeable) {
         // Check mergeable_state for more details if needed (e.g., 'dirty', 'blocked')
         console.warn(`Pull request #${pullNumber} is not mergeable (State: ${prData.mergeable_state}). Checking details...`);
         // Give GitHub a moment to calculate mergeability if it was just created/updated
         await delay(2000);
         const { data: prDataUpdated } = await octokit.pulls.get({ owner, repo, pull_number: pullNumber });
         if (!prDataUpdated.mergeable) {
            throw new Error(`Pull request #${pullNumber} is not mergeable (State: ${prDataUpdated.mergeable_state}). Please resolve conflicts or checks on GitHub.`);
         }
         console.log(`PR #${pullNumber} became mergeable after delay.`);
     }


    await octokit.pulls.merge({ owner, repo, pull_number: pullNumber, merge_method: "squash" });
    console.log(`PR #${pullNumber} merged successfully.`);

    const adminMessage = `🚀 Изменения #${pullNumber} в ${owner}/${repo} добавлены в проект!\n\n[Посмотреть на GitHub](https://github.com/${owner}/${repo}/pull/${pullNumber})`;
    await notifyAdmins(adminMessage);
    return { success: true };
  } catch (error: any) {
    console.error(`Merge failed for PR #${pullNumber} in ${repoUrl}:`, error);
    const repoIdentifier = owner && repo ? `${owner}/${repo}` : repoUrl;
    let errorMessage = error instanceof Error ? error.message : "Failed to merge changes";
    if (error.status === 405 && error.message?.includes('not mergeable')) {
        errorMessage = `Pull request #${pullNumber} is not mergeable (Status 405). Resolve conflicts or check branch protection rules.`;
         console.error(errorMessage, error.response?.data); // Log details if available
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

    await notifyAdmins(`❌ Ошибка при мерже PR #${pullNumber} в ${repoIdentifier}:\n${errorMessage}`);
    return { success: false, error: errorMessage };
  }
}

// --- getOpenPullRequests function (Keep as is) ---
export async function getOpenPullRequests(repoUrl: string) {
  try {
    const token = process.env.GITHUB_TOKEN;
    if (!token) throw new Error("GitHub token is missing");
    const { owner, repo } = parseRepoUrl(repoUrl);
    const octokit = new Octokit({ auth: token });
    // console.log(`Fetching open PRs for ${owner}/${repo}...`); // Optional log
    const { data } = await octokit.pulls.list({ owner, repo, state: "open" });
    // console.log(`Found ${data.length} open PRs.`); // Optional log
    return { success: true, pullRequests: data };
  } catch (error: any) {
    console.error("Error fetching open PRs:", error);
    const repoIdentifier = parseRepoUrl(repoUrl) ? `${parseRepoUrl(repoUrl).owner}/${parseRepoUrl(repoUrl).repo}` : repoUrl;
    let errorMessage = error instanceof Error ? error.message : "Failed to fetch open pull requests";
     if (error.status === 404) {
        errorMessage = `Repository ${repoIdentifier} not found (404) when fetching PRs.`;
     } else if (error.status === 403 || error.status === 401) {
         errorMessage = `Permission denied (Status ${error.status}) when fetching PRs for ${repoIdentifier}. Check token permissions.`;
     }
    // Don't notify admin for simple reads usually, unless it's critical
    return { success: false, error: errorMessage };
  }
}

// --- getGitHubUserProfile function (Keep as is) ---
export async function getGitHubUserProfile(username: string) {
  try {
    const token = process.env.GITHUB_TOKEN; // Keep using token if available for rate limits
    const octokit = new Octokit({ auth: token });
    // console.log(`Fetching profile for user ${username}...`); // Optional log

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
    return { success: false, error: error instanceof Error ? error.message : "Failed to fetch GitHub profile", profile: null };
  }
}

// --- approvePullRequest function (Keep as is, slight improvement on error message) ---
export async function approvePullRequest(repoUrl: string, pullNumber: number) {
  let owner: string | undefined;
  let repo: string | undefined;
  try {
    const token = process.env.GITHUB_TOKEN;
    if (!token) throw new Error("GitHub token is missing (AWOL)"); // Keep the flavor :)
    const repoInfo = parseRepoUrl(repoUrl);
    owner = repoInfo.owner;
    repo = repoInfo.repo;
    const octokit = new Octokit({ auth: token });

    console.log(`Attempting to approve PR #${pullNumber} in ${owner}/${repo}...`);
    // Optional: Check if already approved by this user/token? More complex.
    await octokit.pulls.createReview({
        owner,
        repo,
        pull_number: pullNumber,
        event: "APPROVE",
        body: "Approved by automated process." // More descriptive body
    });
    console.log(`PR #${pullNumber} approved successfully.`);
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
           // e.g., "Review cannot be submitted since reviewer has already approved this pull request"
           console.warn(`Could not approve PR #${pullNumber}, possibly already approved or another issue: ${error.message}`);
           errorMessage = `Could not approve PR #${pullNumber}: ${error.message}`;
           // Depending on requirements, maybe return success if already approved?
           // return { success: true, message: "PR likely already approved." };
      }
     await notifyAdmins(`❌ Ошибка при одобрении PR #${pullNumber} в ${repoIdentifier}:\n${errorMessage}`);
    return { success: false, error: errorMessage };
  }
}

// --- closePullRequest function (Keep as is, slight improvement on error message) ---
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
    // Optional: Check if already closed
    const { data: prData } = await octokit.pulls.get({ owner, repo, pull_number: pullNumber });
    if (prData.state === 'closed') {
        console.warn(`Pull request #${pullNumber} is already closed.`);
        return { success: true, message: "Pull request already closed." };
    }

    await octokit.pulls.update({ owner, repo, pull_number: pullNumber, state: "closed" });
    console.log(`PR #${pullNumber} closed successfully.`);
     await notifyAdmins(`☑️ PR #${pullNumber} в ${owner}/${repo} был закрыт без мержа.`);
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
     await notifyAdmins(`❌ Ошибка при закрытии PR #${pullNumber} в ${repoIdentifier}:\n${errorMessage}`);
    return { success: false, error: errorMessage };
  }
}
