// /app/actions_github/actions.ts
"use server";
import { Octokit } from "@octokit/rest";

interface FileNode {
  path: string;
  content: string;
}

export async function createGitHubPullRequest(
  repoUrl: string,
  files: FileNode[],
  prTitle: string,
  prDescription: string
) {
  try {
    const token = process.env.GITHUB_TOKEN;
    if (!token) throw new Error("GitHub token missing");

    const { owner, repo } = parseRepoUrl(repoUrl);
    const octokit = new Octokit({ auth: token });

    // Get the default branch dynamically
    const { data: repoData } = await octokit.repos.get({ owner, repo });
    const defaultBranch = repoData.default_branch;

    const { data: refData } = await octokit.git.getRef({
      owner,
      repo,
      ref: `heads/${defaultBranch}`,
    });
    const baseSha = refData.object.sha;

    const branchName = `feature/coze-${Date.now()}`; // Back to no username
    await octokit.git.createRef({
      owner,
      repo,
      ref: `refs/heads/${branchName}`,
      sha: baseSha,
    });

    for (const file of files) {
      const content = Buffer.from(file.content).toString("base64");
      let sha: string | undefined;

      try {
        const { data: existingFile } = await octokit.repos.getContent({
          owner,
          repo,
          path: file.path,
          ref: branchName,
        });
        if (!Array.isArray(existingFile)) sha = existingFile.sha;
      } catch (err) {
        // File doesn’t exist, proceed with creation
      }

      await octokit.repos.createOrUpdateFileContents({
        owner,
        repo,
        path: file.path,
        message: `Add or update ${file.path} via CozeExecutor`,
        content,
        sha,
        branch: branchName,
      });
    }

    const { data: pr } = await octokit.pulls.create({
      owner,
      repo,
      title: prTitle,
      body: prDescription,
      head: branchName,
      base: defaultBranch,
    });

    return { success: true, prUrl: pr.html_url };
  } catch (error) {
    console.error("Error creating pull request:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

// Rest of the file (getOpenPullRequests, approvePullRequest, closePullRequest, parseRepoUrl) remains unchanged
function parseRepoUrl(url: string) {
  const match = url.match(/github\.com\/([^/]+)\/([^/]+)/);
  if (!match) throw new Error("Invalid GitHub URL");
  return { owner: match[1], repo: match[2] };
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
