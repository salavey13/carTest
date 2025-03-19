//app/actions_github/actions.ts
import { Octokit } from "@octokit/rest";

// Interface for files to be committed
interface FileNode {
  path: string;
  content: string;
}

/**
 * Creates a pull request on GitHub with the provided files using a secure token from the server environment.
 * @param repoUrl - The GitHub repository URL (e.g., https://github.com/user/repo)
 * @param files - Array of files to commit (path and content)
 * @param prTitle - Title of the pull request
 * @param prDescription - Description of the pull request
 * @returns Object indicating success or failure with the PR URL or error message
 */
export async function createGitHubPullRequest(
  repoUrl: string,
  files: FileNode[],
  prTitle: string,
  prDescription: string
) {
  try {
    // Retrieve the GitHub token from environment variables
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      throw new Error("GitHub token is not configured in the server environment");
    }

    // Parse the repository URL
    const { owner, repo } = parseRepoUrl(repoUrl);

    // Initialize Octokit with the secure token
    const octokit = new Octokit({ auth: token });

    // Get the SHA of the latest commit on the main branch
    const { data: refData } = await octokit.git.getRef({
      owner,
      repo,
      ref: "heads/main",
    });
    const baseSha = refData.object.sha;

    // Create a new branch
    const branchName = `feature/coze-${Date.now()}`;
    await octokit.git.createRef({
      owner,
      repo,
      ref: `refs/heads/${branchName}`,
      sha: baseSha,
    });

    // Commit each file to the new branch
    for (const file of files) {
      const content = Buffer.from(file.content).toString("base64");
      let sha: string | undefined;

      // Check if the file already exists to update it
      try {
        const { data: existingFile } = await octokit.repos.getContent({
          owner,
          repo,
          path: file.path,
          ref: branchName,
        });
        if (!Array.isArray(existingFile)) {
          sha = existingFile.sha;
        }
      } catch (err) {
        // File doesn't exist, proceed with creation
      }

      await octokit.repos.createOrUpdateFileContents({
        owner,
        repo,
        path: file.path,
        message: `Add or update ${file.path} via CozeExecutor`,
        content,
        sha, // Undefined if new file
        branch: branchName,
      });
    }

    // Create the pull request
    const { data: pr } = await octokit.pulls.create({
      owner,
      repo,
      title: prTitle,
      body: prDescription,
      head: branchName,
      base: "main",
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

/**
 * Parses a GitHub repository URL to extract owner and repo names.
 * @param url - The GitHub URL
 * @returns Object with owner and repo properties
 */
function parseRepoUrl(url: string) {
  const match = url.match(/github\.com\/([^/]+)\/([^/]+)/);
  if (!match) throw new Error("Invalid GitHub URL");
  return { owner: match[1], repo: match[2] };
}

export async function getOpenPullRequests(repoUrl: string) {
  try {
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      throw new Error("GitHub token is missing, dumbass");
    }
    const { owner, repo } = parseRepoUrl(repoUrl);
    const octokit = new Octokit({ auth: token });
    const { data } = await octokit.pulls.list({
      owner,
      repo,
      state: 'open',
    });
    return { success: true, pullRequests: data };
  } catch (error) {
    console.error("Shit hit the fan fetching PRs:", error);
    return { success: false, error: error instanceof Error ? error.message : "Fuck knows what went wrong" };
  }
}

export async function approvePullRequest(repoUrl: string, pullNumber: number) {
  try {
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      throw new Error("GitHub token is AWOL");
    }
    const { owner, repo } = parseRepoUrl(repoUrl);
    const octokit = new Octokit({ auth: token });
    await octokit.pulls.createReview({
      owner,
      repo,
      pull_number: pullNumber,
      event: 'APPROVE',
      body: 'Approved by CozeExecutor - fuck yeah!',
    });
    return { success: true };
  } catch (error) {
    console.error("Approval fucked up:", error);
    return { success: false, error: error instanceof Error ? error.message : "Something’s borked" };
  }
}
