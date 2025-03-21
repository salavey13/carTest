// /app/actions_github/actions.ts
"use server";
import { Octokit } from "@octokit/rest";
import { notifyAdmins } from "@/app/actions";

interface FileNode {
  path: string;
  content: string;
}

function parseRepoUrl(repoUrl: string) {
  const match = repoUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
  if (!match) throw new Error("Invalid GitHub repo URL");
  return { owner: match[1], repo: match[2] };
}

export async function createGitHubPullRequest(
  repoUrl: string,
  files: FileNode[],
  prTitle: string,
  prDescription: string,
  branchName?: string // Optional custom branch name
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

    const branch = branchName || `feature/coze-${Date.now()}`;
    await octokit.git.createRef({
      owner,
      repo,
      ref: `refs/heads/${branch}`,
      sha: baseSha,
    });

    // Get the latest commit on the branch
    const { data: commitData } = await octokit.git.getCommit({
      owner,
      repo,
      commit_sha: baseSha,
    });
    const baseTree = commitData.tree.sha;

    // Create a new tree with all file changes
    const tree = await Promise.all(
      files.map(async (file) => {
        const content = Buffer.from(file.content).toString("base64");
        const { data } = await octokit.git.createBlob({
          owner,
          repo,
          content,
          encoding: "base64",
        });
        return {
          path: file.path,
          mode: "100644" as const, // Standard file mode
          type: "blob" as const,
          sha: data.sha,
        };
      })
    );

    const { data: newTree } = await octokit.git.createTree({
      owner,
      repo,
      base_tree: baseTree,
      tree,
    });

    const { data: newCommit } = await octokit.git.createCommit({
      owner,
      repo,
      message: `Update files via CozeExecutor: ${prTitle}`,
      tree: newTree.sha,
      parents: [baseSha],
    });

    await octokit.git.updateRef({
      owner,
      repo,
      ref: `heads/${branch}`,
      sha: newCommit.sha,
    });

    const changedFiles = files.map((file) => file.path).join(", ");
    const fullPrDescription = `${prDescription}\n\n**Измененные файлы:** ${changedFiles}`;

    const { data: pr } = await octokit.pulls.create({
      owner,
      repo,
      title: prTitle,
      body: fullPrDescription,
      head: branch,
      base: defaultBranch,
    });

    const adminMessage = `🔔 Созданы новые изменения в проекте!\nЧто меняем: ${prTitle}\nПодробности: ${prDescription}\nФайлы: ${changedFiles}\n\n[Посмотреть и одобрить на GitHub](https://github.com/${owner}/${repo}/pull/${pr.number})`;
    await notifyAdmins(adminMessage);

    return { success: true, prUrl: pr.html_url, branch };
  } catch (error) {
    console.error("Error creating pull request:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

export async function deleteGitHubBranch(repoUrl: string, branchName: string) {
  try {
    const token = process.env.GITHUB_TOKEN;
    if (!token) throw new Error("GitHub token missing");

    const { owner, repo } = parseRepoUrl(repoUrl);
    const octokit = new Octokit({ auth: token });

    await octokit.git.deleteRef({
      owner,
      repo,
      ref: `heads/${branchName}`,
    });

    // Verify deletion with a delay to avoid race conditions
    await new Promise((resolve) => setTimeout(resolve, 1000));
    try {
      await octokit.git.getRef({
        owner,
        repo,
        ref: `heads/${branchName}`,
      });
      throw new Error("Branch still exists after deletion attempt");
    } catch (err) {
      if (err.status === 404) return { success: true }; // Expected: branch is gone
      throw err;
    }
  } catch (error) {
    console.error("Error deleting branch:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete branch",
    };
  }
}

export async function mergePullRequest(repoUrl: string, pullNumber: number) {
  try {
    const token = process.env.GITHUB_TOKEN;
    if (!token) throw new Error("GitHub token missing");
    const { owner, repo } = parseRepoUrl(repoUrl);
    const octokit = new Octokit({ auth: token });

    await octokit.pulls.merge({
      owner,
      repo,
      pull_number: pullNumber,
      merge_method: "squash", // Keeps history clean; change to "merge" or "rebase" if preferred
    });

    // Polished Russian notification with GitHub link
    const adminMessage = `🚀 Изменения #${pullNumber} добавлены в проект!\n\n[Посмотреть на GitHub](https://github.com/salavey13/cartest/pull/${pullNumber})`;
    await notifyAdmins(adminMessage);

    return { success: true };
  } catch (error) {
    console.error("Merge failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to merge changes",
    };
  }
}



export async function getOpenPullRequests(repoUrl: string) {
  try {
    const token = process.env.GITHUB_TOKEN;
    if (!token) throw new Error("GitHub token is missing, dumbass");
    const { owner, repo } = parseRepoUrl(repoUrl);
    const octokit = new Octokit({ auth: token });
    const { data } = await octokit.pulls.list({
      owner,
      repo,
      state: "open",
    });
    return { success: true, pullRequests: data };
  } catch (error) {
    console.error("Shit hit the fan fetching PRs:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Fuck knows what went wrong",
    };
  }
}

export async function approvePullRequest(repoUrl: string, pullNumber: number) {
  try {
    const token = process.env.GITHUB_TOKEN;
    if (!token) throw new Error("GitHub token is AWOL");
    const { owner, repo } = parseRepoUrl(repoUrl);
    const octokit = new Octokit({ auth: token });
    await octokit.pulls.createReview({
      owner,
      repo,
      pull_number: pullNumber,
      event: "APPROVE",
      body: "Approved by CozeExecutor - fuck yeah!",
    });
    return { success: true };
  } catch (error) {
    console.error("Approval fucked up:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Something’s borked",
    };
  }
}

export async function closePullRequest(repoUrl: string, pullNumber: number) {
  try {
    const token = process.env.GITHUB_TOKEN;
    if (!token) throw new Error("GitHub token is missing, you fuck");
    const { owner, repo } = parseRepoUrl(repoUrl);
    const octokit = new Octokit({ auth: token });
    await octokit.pulls.update({
      owner,
      repo,
      pull_number: pullNumber,
      state: "closed",
    });
    return { success: true };
  } catch (error) {
    console.error("Closing PR fucked up:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Shit went sideways",
    };
  }
}

