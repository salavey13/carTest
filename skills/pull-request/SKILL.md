---
name: pull-request
description: Create GitHub pull requests from local changes using GitHub token from .env
---

# Pull Request Creation Skill

Use this skill to create GitHub pull requests from local file changes.

## Prerequisites
- `GITHUB_TOKEN` must be set in `.env` with repo write permissions
- Git must be initialized and have a remote origin configured
- Changes should be committed to a local branch

## Usage

```bash
# Basic PR creation from current branch
node scripts/pull-request.mjs create \
  --title "fix: Telegram WebApp version checks" \
  --description "Fix runtime errors by adding version checks for Telegram API methods"

# Create PR with custom branch name
node scripts/pull-request.mjs create \
  --title "feat: add avatar fallback" \
  --description "Show first letter when avatar image fails to load" \
  --branch "feat/avatar-fallback"

# Create PR from repo URL (for remote repos)
node scripts/pull-request.mjs create \
  --repo "https://github.com/owner/repo" \
  --title "fix: resolve lint errors" \
  --description "Fixed 12 missing imports in VipBikeRentalClient-integration"
```

## Options
- `--title <text>` - PR title (required)
- `--description <text>` - PR description (required)
- `--branch <name>` - Branch name (optional, defaults to current branch)
- `--repo <url>` - GitHub repo URL (optional, auto-detected from git remote)
- `--base <branch>` - Base branch to merge into (optional, defaults to main)
- `--files <paths>` - Comma-separated file paths to include (optional, includes all staged changes)
- `--commit-message <text>` - Commit message (optional, uses title if not provided)

## Implementation Notes
This skill uses `app/actions_github/actions.ts` functions:
- `createGitHubPullRequest()` - Creates branch and PR with file changes
- `getOpenPullRequests()` - Checks for existing PRs
- `parseRepoUrl()` - Validates GitHub URL format

## Example Output
```
✅ PR created successfully!
Branch: fix/telegram-version-checks
PR: https://github.com/owner/repo/pull/123
```
