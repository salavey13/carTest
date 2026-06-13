---
name: concat-files
description: >
  Bundle multiple source code files into a single "one file" deliverable with
  markdown code fences and first-line path comments. Use this skill whenever
  the user asks to "give files in one", "concatenate files", "one file output",
  "combine into single file", "patch file", "deliverable file", "the one file",
  or wants a copy-paste-ready bundle of multiple source files. Also triggers
  when the user says "fixed all files", "put it all together", or wants code
  review fixes packaged as a single downloadable artifact.
---

# Concat Files — The One File Deliverable

Bundle multiple source files into a single copy-paste-ready text file with
proper markdown code fencing. This is the standard way to deliver multi-file
code changes as a single artifact that developers can review, diff, and apply.

## When to Use

- After code review, when you need to deliver fixed files as a bundle
- When the user asks for a combined/concatenated file of multiple sources
- When delivering patch sets or change bundles
- Any time you'd otherwise give 2+ separate files for the user to download
- When the user says "the one file", "all in one", "give me one file"

## Output Format

The output file follows this exact structure:

```
================================================================
  <TITLE>
  <OPTIONAL DESCRIPTION LINE>
================================================================

FIXES APPLIED:
  <bullet list of what was changed and why>

================================================================

```<lang>
// /path/to/first/file.ext
<file contents>
```

```<lang>
// /path/to/second/file.ext
<file contents>
```
```

## Critical Formatting Rules

These rules are non-negotiable. Violating them breaks the file for consumers
who parse code fences or copy-paste blocks into their editor.

### Rule 1: Code fences must be on their own line

The opening ` ``` ` and closing ` ``` ` must each occupy their own line with
nothing else on that line. The opening fence may have a language hint after it
(like `tsx` or `python`), but the closing fence must be bare.

```
✅ CORRECT:
```tsx
// /app/components/Item.tsx
code here
```

❌ WRONG — closing fence not on own line:
```tsx
// /app/components/Item.tsx
code here```

❌ WRONG — content on same line as opening fence:
```tsx import React from "react"
// /app/components/Item.tsx
code here
```
```

This is the #1 formatting bug. The closing fence drifting onto the last line
of content silently breaks the block for anyone parsing the file. The concat
script prevents this by always appending a newline before the closing fence,
even if the source file doesn't end with one.

### Rule 2: First line inside code block is the path comment

The very first line after the opening ` ``` ` fence must be a single-line
comment with the full project-relative path, starting with `/`:

```
```tsx
// /app/franchize/components/CatalogClient.tsx
"use client";
...
```
```

Do NOT use any prefix before the path:

```
✅ CORRECT:  // /app/franchize/components/CatalogClient.tsx
❌ WRONG:    // FILE: /app/franchize/components/CatalogClient.tsx
❌ WRONG:    // FILE: app/franchize/components/CatalogClient.tsx
❌ WRONG:    // app/franchize/components/CatalogClient.tsx
```

The path must start with `/` and be project-relative (not the filesystem
absolute path like `/home/z/my-project/...`). This is the path the developer
sees in their project tree, so it should match what they'd see in their editor.

### Rule 3: No duplicate path comments

If the source file already has a first line that is a path comment matching
the expected `// /path/to/file` pattern, the concat script must detect this
and NOT add another one. A duplicate path comment line is confusing and
wastes space.

The script checks if the file's first line already matches the expected path
comment and skips adding one if so.

### Rule 4: Language hint on opening fence

Always include a language hint on the opening ` ``` ` based on the file
extension. This enables syntax highlighting in viewers and editors.

| Extension | Fence hint |
|-----------|-----------|
| `.tsx` | `tsx` |
| `.jsx` | `jsx` |
| `.ts` | `typescript` |
| `.js` | `javascript` |
| `.css` | `css` |
| `.html` | `html` |
| `.json` | `json` |
| `.py` | `python` |
| `.sh` | `bash` |
| `.md` | `markdown` |
| `.sql` | `sql` |
| `.yaml` / `.yml` | `yaml` |
| `.mjs` / `.cjs` | `javascript` |
| Other | Use the extension name, or omit if unclear |

### Rule 5: Blank line between code blocks

Always have exactly one blank line between the closing ` ``` ` of one file and
the opening ` ``` ` of the next file. This improves readability and ensures
no fence parsing ambiguity. No blank line between code blocks would cause
parsers to merge them.

### Rule 6: No blank line between opening fence and path comment

The first line after the opening ` ``` ` must be the path comment. No blank
line between them. This keeps the path comment visually attached to its fence.

### Rule 7: Header section

The header before the first code block should include:
- A clear title (e.g. `CATALOG-V3-FIXES`)
- Optional description line under the title
- A fixes/changes section listing what was modified

Keep the header concise — developers scan it quickly. Use `================================================================`
as separator lines (64 `=` chars).

## Using the Concat Script

For deterministic, error-free concatenation, use the bundled script:

```bash
bash /home/z/my-project/skills/concat-files/scripts/concat.sh \
  --output /home/z/my-project/download/DELIVERABLE.txt \
  --title "FIXED-ALL-FILES" \
  --header "All code review findings applied" \
  --changes "C1: Fixed buy CTA handler" \
  --changes "M2: Removed dead code" \
  --file "/app/lib/utils.ts:/home/z/my-project/download/utils.ts" \
  --file "/app/components/Catalog.tsx:/home/z/my-project/download/CatalogClient.tsx"
```

The script handles all formatting rules automatically:
- Fence placement (always on own line)
- Path comments (correct format, no duplicates)
- Language hints from file extension
- Blank line spacing between blocks
- Files without trailing newlines
- Project path validation (must start with `/`)

Prefer using the script over manual concatenation to avoid formatting mistakes.
The most common manual mistake is the closing fence drifting onto the last
line of content — the script prevents this by construction.

### Script Parameters

| Parameter | Required | Description |
|-----------|----------|-------------|
| `--output` | Yes | Output file path |
| `--title` | No | Title in header (default: `CONCATENATED-FILES`) |
| `--header` | No | Description line under title |
| `--changes` | No | One change description (repeat flag for multiple) |
| `--file` | Yes | Format: `project_path:filesystem_path` (repeat for each file) |
| `--dry-run` | No | Print output to stdout instead of writing to file |

Multiple `--changes` and `--file` flags can be repeated. The `--file` format
uses a colon to separate the project-relative path (what goes in the path
comment) from the filesystem path (where to read the file from).

### Project path validation

The script validates that every project path starts with `/`. If a path
doesn't start with `/`, the script exits with an error. This catches mistakes
like `app/components/Item.tsx` which should be `/app/components/Item.tsx`.

## Manual Concatenation Checklist

If you must concatenate manually (script unavailable), verify every item:

- [ ] Each opening ` ``` ` is on its own line with a language hint
- [ ] Each closing ` ``` ` is on its own line with nothing else on that line
- [ ] First line inside each code block is `// /path/to/file.ext`
- [ ] Path starts with `/` — no `FILE:` prefix, no bare relative path
- [ ] No duplicate path comment (check if file already has one)
- [ ] Exactly one blank line between code blocks
- [ ] No blank line between opening fence and path comment
- [ ] Source files that don't end with newline still get proper closing fence
- [ ] Header section present with title and changes list
- [ ] File saved to `/home/z/my-project/download/`

## Examples

### Minimal two-file concat

```
================================================================
  MY-FIXES
================================================================

FIXES APPLIED:
  Fixed null pointer crash in modal

================================================================

```tsx
// /app/components/Modal.tsx
"use client";
import { useState } from "react";
...
```

```typescript
// /app/lib/utils.ts
export const formatDate = (d: Date) => ...
```
```

### With multiple changes and header description

```
================================================================
  CATALOG-V3-FIXES
  Final code review findings applied
================================================================

FIXES APPLIED:
  C1  Buy CTA now uses handleBuyItem (was handleAddToCart)
  C2  Null guard added: item ? hasRentPrice(item) : false
  M1  Mobile-first grid: grid-cols-2 sm:grid-cols-3
  M2  Removed dead getVisiblePriceLines function
  M3  Extracted shared helpers into catalog-utils.ts
  m1  Russian plural: ruPluralDays(days) replaces inline ternary

================================================================

```typescript
// /app/franchize/lib/catalog-utils.ts
import type { CatalogItemVM } from "../actions";
export const hasRentPrice = (item: CatalogItemVM): boolean =>
  item.pricePerDay > 0;
...
```

```tsx
// /app/franchize/components/CatalogClient.tsx
"use client";
import { hasRentPrice, hasSalePrice } from "../lib/catalog-utils";
...
```

```tsx
// /app/franchize/modals/Item.tsx
"use client";
import { hasRentPrice, hasSalePrice, ruPluralDays } from "../lib/catalog-utils";
...
```
```

### File that already has a path comment as first line

If `catalog-utils.ts` already starts with `// /app/franchize/lib/catalog-utils.ts`,
the script detects this and does NOT add a duplicate. The output is:

```
```typescript
// /app/franchize/lib/catalog-utils.ts
import type { CatalogItemVM } from "../actions";
...
```
```

NOT:

```
```typescript                          ← WRONG: duplicate path comment
// /app/franchize/lib/catalog-utils.ts
// /app/franchize/lib/catalog-utils.ts
import type { CatalogItemVM } from "../actions";
...
```
```
