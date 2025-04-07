"use server";
import { Octokit } from "@octokit/rest";
import { notifyAdmins } from "@/app/actions"; // Keep this import

// Interfaces
interface FileNode {
  path: string;
  content: string;
}

interface FileInfo {
  path: string;
  download_url: string;
}

// --- Constants for Batching ---
const BATCH_SIZE = 10; // Number of files to fetch concurrently in one batch
const DELAY_BETWEEN_BATCHES_MS = 1500; // Delay in milliseconds between batches

// Utility: Delay Function
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function parseRepoUrl(repoUrl: string) {
  const match = repoUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
  if (!match) throw new Error("Invalid GitHub repo URL");
  return { owner: match[1], repo: match[2] };
}

export async function fetchRepoContents(repoUrl: string, customToken?: string) {
  console.log(`Fetching repo contents for: ${repoUrl}`);
  try {
    const token = customToken || process.env.GITHUB_TOKEN;
    if (!token) throw new Error("GitHub token is missing");

    const { owner, repo } = parseRepoUrl(repoUrl);
    const octokit = new Octokit({ auth: token });

    // --- Define allowed extensions ---
    const allowedExtensions = [".ts", ".tsx", ".css"];//, ".sql"
    // --- Define excluded paths/folders ---
    const excludedPrefixes = ["supabase/", "components/ui/", "node_modules/", ".next/", "dist/", "build/"];

    async function collectFiles(path: string = ""): Promise<FileInfo[]> {
      console.log(`Collecting files in path: ${path || 'root'}`);
      const { data: contents } = await octokit.repos.getContent({
        owner,
        repo,
        path,
      });

      let fileInfos: FileInfo[] = [];

      for (const item of contents) {
        // Skip excluded paths
        if (excludedPrefixes.some(prefix => item.path.startsWith(prefix))) {
            console.log(`Skipping excluded path: ${item.path}`);
            continue;
        }

        if (
          item.type === "file" &&
          allowedExtensions.some((ext) => item.path.endsWith(ext))
        ) {
          if (item.download_url) { // Ensure download_url exists
            fileInfos.push({ path: item.path, download_url: item.download_url });
          } else {
            console.warn(`File item lacks download_url: ${item.path}`);
          }
        } else if (item.type === "dir") {
          // Add a small delay before recursing into directories to be extra cautious with rate limits
          await delay(150); // 50ms delay before fetching next directory content
          const subFiles = await collectFiles(item.path);
          fileInfos = fileInfos.concat(subFiles);
        }
      }
      return fileInfos;
    }

    const fileInfos = await collectFiles();
    console.log(`Collected ${fileInfos.length} file paths to fetch.`);

    const allFiles: FileNode[] = [];
    const totalFiles = fileInfos.length;

    // --- Batch Fetching Logic ---
    for (let i = 0; i < totalFiles; i += BATCH_SIZE) {
      const batchInfos = fileInfos.slice(i, i + BATCH_SIZE);
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(totalFiles / BATCH_SIZE);
      console.log(`Fetching batch ${batchNumber}/${totalBatches} (Files ${i + 1} to ${Math.min(i + BATCH_SIZE, totalFiles)})`);

      const batchPromises = batchInfos.map(async (fileInfo) => {
        try {
            const response = await fetch(fileInfo.download_url, {
                headers: { Authorization: `token ${token}` },
                // Add a timeout per request (e.g., 15 seconds)
                signal: AbortSignal.timeout(30000)
            });
            if (!response.ok) {
                throw new Error(`Failed to fetch ${fileInfo.path}: ${response.status} ${response.statusText}`);
            }
            const content = await response.text();
            const contentLines = content.split("\n");
            let pathComment: string;
            if (fileInfo.path.endsWith(".ts") || fileInfo.path.endsWith(".tsx")) {
                pathComment = `// /${fileInfo.path}`;
            } else if (fileInfo.path.endsWith(".css")) {
                pathComment = `/* /${fileInfo.path} */`;
            } else if (fileInfo.path.endsWith(".sql")) {
                pathComment = `-- /${fileInfo.path}`;
            } else {
                pathComment = `# /${fileInfo.path}`; // Default
                console.warn(`Unhandled extension for path comment: ${fileInfo.path}`);
            }

            // Check if the first line is already a comment (start of line, ignoring whitespace)
            const firstLineTrimmed = contentLines[0]?.trimStart();
            if (firstLineTrimmed?.match(/^(--|\/\/|\/\*|#)/)) {
                contentLines[0] = pathComment; // Replace existing comment
            } else {
                contentLines.unshift(pathComment); // Add new comment line
            }
            return { path: fileInfo.path, content: contentLines.join("\n") };
        } catch (fetchError) {
             // Log specific file fetch error and re-throw to fail the batch
             console.error(`Error fetching file content for ${fileInfo.path}:`, fetchError);
             // You could return a specific error object or null here if you want partial results
             // For now, we let the Promise.all fail the batch
             throw fetchError;
        }
      });

      // Wait for the current batch to complete
      try {
          const batchResults = await Promise.all(batchPromises);
          allFiles.push(...batchResults);
          console.log(`Batch ${batchNumber}/${totalBatches} completed successfully.`);
      } catch (batchError) {
           console.error(`Error processing batch ${batchNumber}/${totalBatches}:`, batchError);
           // Decide handling: throw to stop all, or log and continue?
           // Let's throw to indicate the overall fetch failed if any batch fails.
           throw new Error(`Failed to fetch files in batch ${batchNumber}. Error: ${batchError instanceof Error ? batchError.message : batchError}`);
      }


      // Add delay before the next batch, but not after the last one
      if (i + BATCH_SIZE < totalFiles) {
        console.log(`Waiting ${DELAY_BETWEEN_BATCHES_MS}ms before next batch...`);
        await delay(DELAY_BETWEEN_BATCHES_MS);
      }
    }
    // --- End Batch Fetching Logic ---

    console.log(`Successfully fetched content for ${allFiles.length} files.`);
    return { success: true, files: allFiles };

  } catch (error) {
    console.error("Error fetching repo contents:", error);
    // Notify admins on failure
    await notifyAdmins(`❌ Ошибка при извлечении файлов из репозитория ${repoUrl}:\n${error instanceof Error ? error.message : String(error)}`);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred during repository fetch",
    };
  }
}

// --- createGitHubPullRequest function (Keep as is) ---
export async function createGitHubPullRequest(
  repoUrl: string,
  files: FileNode[],
  prTitle: string,
  prDescription: string,
  commitMessage: string,
  branchName?: string
) {
  try {
    const token = process.env.GITHUB_TOKEN;
    if (!token) throw new Error("GitHub token missing");

    const { owner, repo } = parseRepoUrl(repoUrl);
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

    const commitMsgBlob = new Blob([finalCommitMessage]);
    if (commitMsgBlob.size > MAX_SIZE_BYTES) {
      console.warn(`Commit message too long (${commitMsgBlob.size} bytes), truncating.`);
      finalCommitMessage = finalCommitMessage.substring(0, 60000) + "... (truncated)";
    }

    const prDescBlob = new Blob([finalPrDescription]);
    if (prDescBlob.size > MAX_SIZE_BYTES) {
       console.warn(`PR description too long (${prDescBlob.size} bytes), truncating.`);
       finalPrDescription = finalPrDescription.substring(0, 60000) + "\n\n... (truncated)";
    }

    const branch = branchName || `feature-aiassisted-onesitepls-${Date.now()}`;
    await octokit.git.createRef({ owner, repo, ref: `refs/heads/${branch}`, sha: baseSha });

    const { data: commitData } = await octokit.git.getCommit({ owner, repo, commit_sha: baseSha });
    const baseTree = commitData.tree.sha;

    const tree = await Promise.all(
      files.map(async (file) => {
        const { data } = await octokit.git.createBlob({ owner, repo, content: file.content, encoding: "utf-8" });
        return { path: file.path, mode: "100644" as const, type: "blob" as const, sha: data.sha };
      })
    );

    const { data: newTree } = await octokit.git.createTree({ owner, repo, base_tree: baseTree, tree });
    const { data: newCommit } = await octokit.git.createCommit({ owner, repo, message: finalCommitMessage, tree: newTree.sha, parents: [baseSha] });
    await octokit.git.updateRef({ owner, repo, ref: `heads/${branch}`, sha: newCommit.sha, force: false });

    const changedFiles = files.map((file) => file.path).join(", ");
    const { data: pr } = await octokit.pulls.create({ owner, repo, title: prTitle, body: finalPrDescription, head: branch, base: defaultBranch });

    const adminMessage = `🔔 Созданы новые изменения в проекте!\nЧто меняем: ${prTitle}\nПодробности: ${prDescription}\nФайлы: ${changedFiles}\n\n[Посмотреть и одобрить на GitHub](https://github.com/${owner}/${repo}/pull/${pr.number})`;
    await notifyAdmins(adminMessage);

    return { success: true, prUrl: pr.html_url, branch };
  } catch (error) {
    console.error("Error creating pull request:", error);
    await notifyAdmins(`❌ Ошибка при создании PR для ${repoUrl}:\n${error instanceof Error ? error.message : String(error)}`);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error occurred creating PR" };
  }
}

// --- deleteGitHubBranch function (Keep as is) ---
export async function deleteGitHubBranch(repoUrl: string, branchName: string) {
    try {
      const token = process.env.GITHUB_TOKEN;
      if (!token) throw new Error("GitHub token missing");
      const { owner, repo } = parseRepoUrl(repoUrl);
      const octokit = new Octokit({ auth: token });
      await octokit.git.deleteRef({ owner, repo, ref: `heads/${branchName}` });
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Delay
      try {
        await octokit.git.getRef({ owner, repo, ref: `heads/${branchName}` });
        // If getRef succeeds, branch still exists (unexpected)
         console.error(`Branch ${branchName} still exists after deletion attempt in ${owner}/${repo}.`);
         await notifyAdmins(`⚠️ Не удалось удалить ветку ${branchName} в репозитории ${owner}/${repo} после мержа/закрытия PR.`);
         // Return success=false as the primary goal (deletion check) failed
         return { success: false, error: "Branch deletion verification failed. Branch might still exist." };
      } catch (err: any) {
         // If getRef fails with 404, deletion was successful
        if (err.status === 404) return { success: true };
        // If getRef fails with another error, re-throw it
        throw err;
      }
    } catch (error) {
      console.error("Error deleting branch:", error);
       await notifyAdmins(`❌ Ошибка при удалении ветки ${branchName} в репозитории ${repoUrl}:\n${error instanceof Error ? error.message : String(error)}`);
      return { success: false, error: error instanceof Error ? error.message : "Failed to delete branch" };
    }
}

// --- mergePullRequest function (Keep as is) ---
export async function mergePullRequest(repoUrl: string, pullNumber: number) {
  try {
    const token = process.env.GITHUB_TOKEN;
    if (!token) throw new Error("GitHub token missing");
    const { owner, repo } = parseRepoUrl(repoUrl);
    const octokit = new Octokit({ auth: token });
    await octokit.pulls.merge({ owner, repo, pull_number: pullNumber, merge_method: "squash" });
    const adminMessage = `🚀 Изменения #${pullNumber} в ${owner}/${repo} добавлены в проект!\n\n[Посмотреть на GitHub](https://github.com/${owner}/${repo}/pull/${pullNumber})`;
    await notifyAdmins(adminMessage);
    return { success: true };
  } catch (error) {
    console.error("Merge failed:", error);
    await notifyAdmins(`❌ Ошибка при мерже PR #${pullNumber} в ${owner}/${repo}:\n${error instanceof Error ? error.message : String(error)}`);
    return { success: false, error: error instanceof Error ? error.message : "Failed to merge changes" };
  }
}

// --- getOpenPullRequests function (Keep as is) ---
export async function getOpenPullRequests(repoUrl: string) {
  try {
    const token = process.env.GITHUB_TOKEN;
    if (!token) throw new Error("GitHub token is missing");
    const { owner, repo } = parseRepoUrl(repoUrl);
    const octokit = new Octokit({ auth: token });
    const { data } = await octokit.pulls.list({ owner, repo, state: "open" });
    return { success: true, pullRequests: data };
  } catch (error) {
    console.error("Error fetching PRs:", error);
    // Don't notify admin for simple reads usually
    return { success: false, error: error instanceof Error ? error.message : "Failed to fetch open pull requests" };
  }
}

// --- getGitHubUserProfile function (Keep as is) ---
export async function getGitHubUserProfile(username: string) {
  try {
    const token = process.env.GITHUB_TOKEN; // Keep using token if available
    const octokit = new Octokit({ auth: token });

    const { data: userProfile } = await octokit.users.getByUsername({ username });

    return {
      success: true,
      profile: {
        login: userProfile.login,
        avatar_url: userProfile.avatar_url,
        html_url: userProfile.html_url,
        name: userProfile.name,
      },
    };
  } catch (error) {
    if ((error as any).status === 404) {
        return { success: false, error: "GitHub user not found.", profile: null };
    }
    console.error(`Error fetching GitHub profile for ${username}:`, error);
    return { success: false, error: error instanceof Error ? error.message : "Failed to fetch GitHub profile", profile: null };
  }
}

// --- approvePullRequest function (Keep as is) ---
export async function approvePullRequest(repoUrl: string, pullNumber: number) {
  try {
    const token = process.env.GITHUB_TOKEN;
    if (!token) throw new Error("GitHub token is AWOL");
    const { owner, repo } = parseRepoUrl(repoUrl);
    const octokit = new Octokit({ auth: token });
    await octokit.pulls.createReview({ owner, repo, pull_number: pullNumber, event: "APPROVE", body: "Approved by CozeExecutor" });
    return { success: true };
  } catch (error) {
    console.error("Approval failed:", error);
     await notifyAdmins(`❌ Ошибка при одобрении PR #${pullNumber} в ${owner}/${repo}:\n${error instanceof Error ? error.message : String(error)}`);
    return { success: false, error: error instanceof Error ? error.message : "Failed to approve PR" };
  }
}

// --- closePullRequest function (Keep as is) ---
export async function closePullRequest(repoUrl: string, pullNumber: number) {
  try {
    const token = process.env.GITHUB_TOKEN;
    if (!token) throw new Error("GitHub token is missing");
    const { owner, repo } = parseRepoUrl(repoUrl);
    const octokit = new Octokit({ auth: token });
    await octokit.pulls.update({ owner, repo, pull_number: pullNumber, state: "closed" });
     await notifyAdmins(`☑️ PR #${pullNumber} в ${owner}/${repo} был закрыт без мержа.`);
    return { success: true };
  } catch (error) {
    console.error("Closing PR failed:", error);
     await notifyAdmins(`❌ Ошибка при закрытии PR #${pullNumber} в ${owner}/${repo}:\n${error instanceof Error ? error.message : String(error)}`);
    return { success: false, error: error instanceof Error ? error.message : "Failed to close PR" };
  }
}
