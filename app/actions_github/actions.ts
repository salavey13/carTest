"use server";
import { Octokit } from "@octokit/rest";
import { notifyAdmins } from "@/app/actions"; // Keep this import

// Restore Interfaces from context (~5, ~6)
interface FileNode {
  path: string;
  content: string;
}

interface FileInfo {
  path: string;
  download_url: string;
}

function parseRepoUrl(repoUrl: string) {
  const match = repoUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
  if (!match) throw new Error("Invalid GitHub repo URL");
  return { owner: match[1], repo: match[2] };
}

// fetchRepoContents function structure restored from context
export async function fetchRepoContents(repoUrl: string, customToken?: string) {
  try {
    const token = customToken || process.env.GITHUB_TOKEN;
    if (!token) throw new Error("GitHub token is missing");

    const { owner, repo } = parseRepoUrl(repoUrl);
    const octokit = new Octokit({ auth: token });

    const allowedExtensions = [".ts", ".tsx", ".css"];

    // Restore inner collectFiles function structure from context (~47)
    async function collectFiles(path: string = ""): Promise<FileInfo[]> {
      const { data: contents } = await octokit.repos.getContent({
        owner,
        repo,
        path,
      });

      let fileInfos: FileInfo[] = [];

      for (const item of contents) {
        if (
          item.type === "file" &&
          allowedExtensions.some((ext) => item.path.endsWith(ext)) &&
          !item.path.startsWith("components/ui/") &&
          !item.path.endsWith(".sql") // Keep this condition
        ) {
          fileInfos.push({ path: item.path, download_url: item.download_url });
        } else if (item.type === "dir") {
          const subFiles = await collectFiles(item.path);
          fileInfos = fileInfos.concat(subFiles);
        }
      }
      return fileInfos;
    }

    const fileInfos = await collectFiles();

    const files: FileNode[] = await Promise.all(
      fileInfos.map(async (fileInfo) => {
        const response = await fetch(fileInfo.download_url, {
          headers: { Authorization: `token ${token}` },
        });
        if (!response.ok) throw new Error(`Failed to fetch ${fileInfo.path}: ${response.statusText}`);
        const content = await response.text();
        const contentLines = content.split("\n");
        let pathComment: string;
        if (fileInfo.path.endsWith(".ts") || fileInfo.path.endsWith(".tsx")) {
          pathComment = `// /${fileInfo.path}`;
        } else if (fileInfo.path.endsWith(".css")) {
          pathComment = `/* /${fileInfo.path} */`;
        } else {
          pathComment = `# /${fileInfo.path}`;
        }
        // Keep path comment logic
        if (contentLines[0] && contentLines[0].match(/^(\/\/|\/\*|#)/)) {
          contentLines[0] = pathComment;
        } else {
          contentLines.unshift(pathComment);
        }
        return { path: fileInfo.path, content: contentLines.join("\n") };
      })
    );

    return { success: true, files };
  } catch (error) {
    console.error("Error fetching repo contents:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

// --- createGitHubPullRequest function (Keep as is from context) ---
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
        const { data } = await octokit.git.createBlob({ owner, repo, content: file.content, encoding: "utf-8" }); // Use utf-8 directly if possible, otherwise keep base64 from prev
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
    return { success: false, error: error instanceof Error ? error.message : "Unknown error occurred" };
  }
}

// --- deleteGitHubBranch function (Keep as is from context) ---
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
        throw new Error("Branch still exists after deletion attempt");
      } catch (err) {
        if ((err as any).status === 404) return { success: true };
        throw err;
      }
    } catch (error) {
      console.error("Error deleting branch:", error);
      return { success: false, error: error instanceof Error ? error.message : "Failed to delete branch" };
    }
}

// --- mergePullRequest function (Keep as is from context) ---
export async function mergePullRequest(repoUrl: string, pullNumber: number) {
  try {
    const token = process.env.GITHUB_TOKEN;
    if (!token) throw new Error("GitHub token missing");
    const { owner, repo } = parseRepoUrl(repoUrl);
    const octokit = new Octokit({ auth: token });
    await octokit.pulls.merge({ owner, repo, pull_number: pullNumber, merge_method: "squash" });
    const adminMessage = `🚀 Изменения #${pullNumber} добавлены в проект!\n\n[Посмотреть на GitHub](https://github.com/salavey13/cartest/pull/${pullNumber})`; // Assuming specific repo, adjust if needed
    await notifyAdmins(adminMessage);
    return { success: true };
  } catch (error) {
    console.error("Merge failed:", error);
    return { success: false, error: error instanceof Error ? error.message : "Failed to merge changes" };
  }
}

// --- getOpenPullRequests function (Keep as is from context) ---
export async function getOpenPullRequests(repoUrl: string) {
  try {
    const token = process.env.GITHUB_TOKEN;
    if (!token) throw new Error("GitHub token is missing, dumbass");
    const { owner, repo } = parseRepoUrl(repoUrl);
    const octokit = new Octokit({ auth: token });
    const { data } = await octokit.pulls.list({ owner, repo, state: "open" });
    return { success: true, pullRequests: data };
  } catch (error) {
    console.error("Shit hit the fan fetching PRs:", error);
    return { success: false, error: error instanceof Error ? error.message : "Fuck knows what went wrong" };
  }
}

// --- NEW: Function to get GitHub User Profile (Keep from previous response) ---
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

// --- approvePullRequest function (Keep as is from context) ---
export async function approvePullRequest(repoUrl: string, pullNumber: number) {
  try {
    const token = process.env.GITHUB_TOKEN;
    if (!token) throw new Error("GitHub token is AWOL");
    const { owner, repo } = parseRepoUrl(repoUrl);
    const octokit = new Octokit({ auth: token });
    await octokit.pulls.createReview({ owner, repo, pull_number: pullNumber, event: "APPROVE", body: "Approved by CozeExecutor - fuck yeah!" });
    return { success: true };
  } catch (error) {
    console.error("Approval fucked up:", error);
    return { success: false, error: error instanceof Error ? error.message : "Something’s borked" };
  }
}

// --- closePullRequest function (Keep as is from context) ---
export async function closePullRequest(repoUrl: string, pullNumber: number) {
  try {
    const token = process.env.GITHUB_TOKEN;
    if (!token) throw new Error("GitHub token is missing, you fuck");
    const { owner, repo } = parseRepoUrl(repoUrl);
    const octokit = new Octokit({ auth: token });
    await octokit.pulls.update({ owner, repo, pull_number: pullNumber, state: "closed" });
    return { success: true };
  } catch (error) {
    console.error("Closing PR fucked up:", error);
    return { success: false, error: error instanceof Error ? error.message : "Shit went sideways" };
  }
}