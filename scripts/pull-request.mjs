#!/usr/bin/env node
/**
 * pull-request.mjs
 * =================
 * Create GitHub pull requests from local changes.
 *
 * Usage:
 *   node scripts/pull-request.mjs create --title "Fix bug" --description "Description"
 *   node scripts/pull-request.mjs list --repo "https://github.com/owner/repo"
 */

import { readFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';
import { Octokit } from '@octokit/rest';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// --- Load .env file ---
function loadEnvFile() {
  const envPath = resolve(process.cwd(), '.env');
  if (!existsSync(envPath)) {
    return;
  }

  const envContent = readFileSync(envPath, 'utf-8');
  const lines = envContent.split('\n');

  for (const line of lines) {
    const trimmedLine = line.trim();
    // Skip comments and empty lines
    if (!trimmedLine || trimmedLine.startsWith('#')) {
      continue;
    }

    // Parse KEY=VALUE format
    const match = trimmedLine.match(/^([^=]+)=(.*)$/);
    if (match) {
      const [, key, value] = match;
      // Only set if not already in process.env (process.env takes precedence)
      if (process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  }
}

loadEnvFile();

// --- Configuration ---
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
if (!GITHUB_TOKEN) {
  console.error('❌ GITHUB_TOKEN not found in environment variables.');
  console.error('Please add GITHUB_TOKEN to your .env file.');
  process.exit(1);
}

// --- Argument Parsing ---
function getArg(name, fallback = undefined) {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1) return fallback;
  return process.argv[idx + 1];
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

const command = process.argv[2];

// --- Helper Functions ---

/**
 * Parse GitHub URL to extract owner and repo
 */
function parseRepoUrl(repoUrl) {
  if (!repoUrl || typeof repoUrl !== 'string') {
    throw new Error('Invalid GitHub URL: URL is empty or not a string.');
  }
  const match = repoUrl.match(/github\.com\/([^\/]+)\/([^\/]+?)(\.git)?\/?$/);
  if (!match || !match[1] || !match[2]) {
    throw new Error(`Invalid GitHub URL format: ${repoUrl}`);
  }
  return { owner: match[1], repo: match[2] };
}

/**
 * Get repo URL from git remote
 */
function getGitRemoteUrl() {
  try {
    const origin = execSync('git config --get remote.origin.url', { encoding: 'utf-8' }).trim();
    return origin;
  } catch {
    throw new Error('Could not determine git remote origin URL.');
  }
}

/**
 * Get current git branch name
 */
function getCurrentBranch() {
  try {
    return execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8' }).trim();
  } catch {
    throw new Error('Could not determine current git branch.');
  }
}

/**
 * Get files changed in working directory (staged and unstaged)
 */
function getChangedFiles() {
  try {
    // Get list of modified files
    const files = execSync('git diff --name-only HEAD', { encoding: 'utf-8' }).trim().split('\n').filter(Boolean);
    return files;
  } catch {
    return [];
  }
}

/**
 * Read file content from working directory
 */
function readFileContent(filePath) {
  try {
    return readFileSync(filePath, 'utf-8');
  } catch (error) {
    console.warn(`  ⚠️  Could not read file: ${filePath}`);
    return null;
  }
}

/**
 * Get default branch from remote
 */
async function getDefaultBranch(owner, repo) {
  const octokit = new Octokit({ auth: GITHUB_TOKEN });
  const { data: repoData } = await octokit.repos.get({ owner, repo });
  return repoData.default_branch;
}

/**
 * Create PR with file changes via GitHub API
 */
async function createPullRequest(options) {
  const {
    title,
    description,
    branch,
    repoUrl,
    base,
    files,
    commitMessage
  } = options;

  console.log(`\n🔧 Creating Pull Request...`);
  console.log(`   Title: ${title}`);
  console.log(`   Branch: ${branch}`);

  const repoInfo = parseRepoUrl(repoUrl);
  const owner = repoInfo.owner;
  const repo = repoInfo.repo;
  const octokit = new Octokit({ auth: GITHUB_TOKEN });

  // Get base branch if not specified
  const targetBase = base || await getDefaultBranch(owner, repo);
  console.log(`   Base: ${targetBase}`);

  // Check if branch exists on remote
  let branchExists = false;
  let existingHeadSha = null;
  try {
    const { data: refData } = await octokit.git.getRef({
      owner,
      repo,
      ref: `heads/${branch}`
    });
    branchExists = true;
    existingHeadSha = refData.object.sha;
    console.log(`  ℹ️  Branch '${branch}' already exists on remote.`);
  } catch (error) {
    if (error.status === 404) {
      console.log(`  ℹ️  Branch '${branch}' does not exist on remote. Will create.`);
    } else {
      throw error;
    }
  }

  // Get base branch SHA
  const { data: baseRef } = await octokit.git.getRef({
    owner,
    repo,
    ref: `heads/${targetBase}`
  });
  const baseSha = baseRef.object.sha;

  // Create new branch if it doesn't exist
  if (!branchExists) {
    console.log(`  📂 Creating branch '${branch}' from ${targetBase}...`);
    await octokit.git.createRef({
      owner,
      repo,
      ref: `refs/heads/${branch}`,
      sha: baseSha
    });
    console.log(`  ✅ Branch '${branch}' created.`);
  }

  // Prepare file nodes for GitHub
  const fileNodes = [];
  for (const filePath of files) {
    const content = readFileContent(filePath);
    if (content !== null) {
      fileNodes.push({ path: filePath, content });
      console.log(`  📄 Prepared: ${filePath}`);
    }
  }

  if (fileNodes.length === 0) {
    console.error(`  ❌ No valid files to commit.`);
    return { success: false, error: 'No valid files to commit' };
  }

  // Get base tree
  const baseTreeSha = branchExists && existingHeadSha
    ? (await octokit.git.getCommit({ owner, repo, commit_sha: existingHeadSha })).data.tree.sha
    : (await octokit.git.getCommit({ owner, repo, commit_sha: baseSha })).data.tree.sha;

  console.log(`  🌳 Base tree SHA: ${baseTreeSha}`);

  // Create blobs
  console.log(`  📦 Creating ${fileNodes.length} blobs...`);
  const tree = await Promise.all(
    fileNodes.map(async (f) => {
      try {
        const { data } = await octokit.git.createBlob({
          owner,
          repo,
          content: f.content,
          encoding: 'utf-8'
        });
        return {
          path: f.path,
          mode: '100644',
          type: 'blob',
          sha: data.sha
        };
      } catch (error) {
        throw new Error(`Failed to create blob for ${f.path}: ${error.message}`);
      }
    })
  );

  // Create tree
  console.log(`  🌲 Creating tree...`);
  const { data: newTree } = await octokit.git.createTree({
    owner,
    repo,
    base_tree: baseTreeSha,
    tree
  });

  // Create commit
  const finalCommitMsg = commitMessage || title;
  console.log(`  💾 Creating commit...`);
  const parentSha = branchExists ? existingHeadSha : baseSha;
  const { data: newCommit } = await octokit.git.createCommit({
    owner,
    repo,
    message: finalCommitMsg,
    tree: newTree.sha,
    parents: [parentSha]
  });

  // Update branch reference
  console.log(`  🔄 Updating branch reference...`);
  await octokit.git.updateRef({
    owner,
    repo,
    ref: `heads/${branch}`,
    sha: newCommit.sha,
    force: false
  });

  // Check for existing PR
  const { data: existingPrs } = await octokit.pulls.list({
    owner,
    repo,
    head: `${owner}:${branch}`,
    state: 'open'
  });

  let prNumber, prUrl;

  if (existingPrs.length > 0) {
    // Update existing PR
    prNumber = existingPrs[0].number;
    prUrl = existingPrs[0].html_url;
    console.log(`  🔄 Found existing PR #${prNumber}.`);

    // Update PR title and description
    await octokit.pulls.update({
      owner,
      repo,
      pull_number: prNumber,
      title,
      body: description
    });
    console.log(`  ✅ PR #${prNumber} updated.`);
  } else {
    // Create new PR
    console.log(`  🔔 Creating new PR...`);
    const { data: pr } = await octokit.pulls.create({
      owner,
      repo,
      title,
      body: description,
      head: branch,
      base: targetBase
    });
    prNumber = pr.number;
    prUrl = pr.html_url;
    console.log(`  ✅ PR created: ${prUrl}`);
  }

  return {
    success: true,
    prUrl,
    branch,
    prNumber
  };
}

/**
 * List open pull requests
 */
async function listPullRequests(options) {
  const { repoUrl } = options;
  const repoInfo = parseRepoUrl(repoUrl);
  const owner = repoInfo.owner;
  const repo = repoInfo.repo;
  const octokit = new Octokit({ auth: GITHUB_TOKEN });

  console.log(`\n📋 Open Pull Requests for ${owner}/${repo}:\n`);

  const { data: prs } = await octokit.pulls.list({
    owner,
    repo,
    state: 'open',
    sort: 'updated',
    direction: 'desc'
  });

  if (prs.length === 0) {
    console.log('  No open pull requests found.');
    return;
  }

  prs.forEach((pr) => {
    console.log(`  #${pr.number} - ${pr.title}`);
    console.log(`    Branch: ${pr.head.ref} → ${pr.base.ref}`);
    console.log(`    Updated: ${new Date(pr.updated_at).toLocaleString()}`);
    console.log(`    URL: ${pr.html_url}`);
    console.log('');
  });
}

// --- Command Handlers ---

async function handleCreate() {
  const title = getArg('title');
  const description = getArg('description');
  let branch = getArg('branch');
  let repoUrl = getArg('repo');
  const base = getArg('base');
  const commitMessage = getArg('commit-message');
  const filesArg = getArg('files');

  // Validate required arguments
  if (!title) {
    console.error('❌ --title is required');
    process.exit(1);
  }
  if (!description) {
    console.error('❌ --description is required');
    process.exit(1);
  }

  // Auto-detect repo URL if not provided
  if (!repoUrl) {
    try {
      repoUrl = getGitRemoteUrl();
      console.log(`ℹ️  Auto-detected repo: ${repoUrl}`);
    } catch (error) {
      console.error(`❌ ${error.message}`);
      console.error('Please provide --repo or ensure git remote origin is set.');
      process.exit(1);
    }
  }

  // Auto-detect current branch if not provided
  if (!branch) {
    try {
      branch = getCurrentBranch();
      console.log(`ℹ️  Using current branch: ${branch}`);
    } catch (error) {
      console.error(`❌ ${error.message}`);
      process.exit(1);
    }
  }

  // Get files to include
  let files = [];
  if (filesArg) {
    files = filesArg.split(',').map(f => f.trim());
  } else {
    // Get all changed files
    files = getChangedFiles();
    console.log(`ℹ️  Found ${files.length} changed files`);
  }

  if (files.length === 0) {
    console.error('❌ No files changed. Please commit your changes first.');
    process.exit(1);
  }

  const result = await createPullRequest({
    title,
    description,
    branch,
    repoUrl,
    base,
    files,
    commitMessage
  });

  if (result.success) {
    console.log(`\n✅ Pull Request created successfully!`);
    console.log(`   Branch: ${result.branch}`);
    console.log(`   PR: ${result.prUrl}`);
    console.log(`   #${result.prNumber}`);
  } else {
    console.error(`\n❌ Failed to create Pull Request: ${result.error}`);
    process.exit(1);
  }
}

async function handleList() {
  const repoUrl = getArg('repo');

  if (!repoUrl) {
    console.error('❌ --repo is required for list command');
    process.exit(1);
  }

  await listPullRequests({ repoUrl });
}

// --- Main ---

async function main() {
  console.log('🔧 Pull Request Tool\n');

  switch (command) {
    case 'create':
      await handleCreate();
      break;
    case 'list':
      await handleList();
      break;
    default:
      console.log('Usage:');
      console.log('  node scripts/pull-request.mjs create --title "Title" --description "Description"');
      console.log('  node scripts/pull-request.mjs list --repo "https://github.com/owner/repo"');
      console.log('\nOptions:');
      console.log('  --title <text>       PR title (required for create)');
      console.log('  --description <text> PR description (required for create)');
      console.log('  --branch <name>      Branch name (optional, auto-detected)');
      console.log('  --repo <url>         GitHub repo URL (optional, auto-detected)');
      console.log('  --base <branch>      Base branch to merge into (optional)');
      console.log('  --files <paths>      Comma-separated file paths (optional)');
      console.log('  --commit-message <text> Commit message (optional)');
      process.exit(1);
  }
}

main().catch((error) => {
  console.error('❌ Error:', error.message);
  console.error(error.stack);
  process.exit(1);
});
