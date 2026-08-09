# GitHub Fetcher Skill

## Description
Fetch files from the salavey13/carTest GitHub repository (public, open). Use when you need to read a file that wasn't provided in the conversation but exists in the repo.

## Usage
```bash
# Fetch a single file from main branch
curl -s "https://raw.githubusercontent.com/salavey13/carTest/refs/heads/main/<path>" 

# Example: fetch phone-utils.ts
curl -s "https://raw.githubusercontent.com/salavey13/carTest/refs/heads/main/app/franchize/lib/phone-utils.ts"

# List directory contents via API (needs token)
curl -s -H "Authorization: token <GH_TOKEN>" \
  "https://api.github.com/repos/salavey13/carTest/contents/<path>"

# Push a file to the repo (needs token)
curl -s -X PUT \
  -H "Authorization: token <GH_TOKEN>" \
  -H "Content-Type: application/json" \
  "https://api.github.com/repos/salavey13/carTest/contents/<path>" \
  -d '{"message":"commit message","content":"<base64>","branch":"main"}'
```

## Token
GitHub token is stored at `/home/z/my-project/upload/github_secret.txt`.

## Repository
- Owner: salavey13
- Name: carTest
- Branch: main
- Visibility: public (read access without token; write needs token)
- URL pattern: `https://raw.githubusercontent.com/salavey13/carTest/refs/heads/main/{filepath}`

## What you can do
1. **Read any file** — no token needed for public repo. Use `raw.githubusercontent.com`.
2. **List directories** — needs token. Use `api.github.com/repos/.../contents/{path}`.
3. **Push files** — needs token. Use `PUT api.github.com/repos/.../contents/{path}` with base64 content.
4. **Cherry-pick specific files** — fetch via raw URL, save locally, modify, push back.

## Common file paths
- `app/franchize/server-actions/leads.ts` — leads server action
- `app/franchize/[slug]/leads/LeadsClient.tsx` — leads client component
- `app/franchize/lib/phone-utils.ts` — canonical normalizePhone
- `supabase/migrations/` — SQL migration directory
- `lib/supabase-server.ts` — Supabase admin client
- `app/api/franchize/_auth.ts` — crew access verification
