---
name: task-planner
description: |
  Research-driven task planner. Analyzes tasks, researches unknowns,
  decomposes into concrete subtasks with dependencies via TaskCreate.
  Invoke with /task-planner before any non-trivial implementation.
  Handles all tiers: Small, Medium, Large, Epic.
  Returns plan + TaskCreate calls. Does NOT write code.
---

# Task Planner — Research → Decompose → Schedule

**Announce at start:** "Using task-planner to research and decompose this task."

> **If invoked directly** (not via `/go`): run `superpowers:brainstorming` first.

---

## Behavioral Rules

- **Classify explicitly first.** State: "Task type: X. Complexity tier: Y."
- **List options before picking.** For every unknown: name 2-3 approaches, choose one with rationale.
- **Verify in codebase first.** Before recommending a pattern, confirm it exists with Grep/Glob.
- **One question max.** If requirements unclear, ask the single most-blocking question.
- **Evidence-based.** Every recommendation cites: file path, API doc URL, or user statement.
- **No hallucination.** If unsure about an API format, search it — don't guess.

---

## Phase 0: Codebase Check (always first)

Before searching the web, check what already exists:

**1. Task list** — avoid duplicates:
Call `TaskList`. Handle each case:
- **pending** tasks on same topic: note as "already queued"
- **in_progress** on same scope: do NOT duplicate
- **blocked**: check if current work unblocks them
- **completed**: use as context
- **empty**: proceed

**2. Codebase check** — verify existing patterns (Grep/Glob, not bash):
```
# Find HTTP client patterns:
Grep pattern="fetch|axios|ky|ofetch|aiohttp|httpx"

# Find cache implementations:
Grep pattern="cache|Cache|TTL|staleTime"

# List feature entry points:
Glob pattern="src/**/index.{ts,js}" OR Glob pattern="src/**/__init__.py"

# Find test structure:
Glob pattern="src/**/*.test.{ts,tsx}" OR Glob pattern="tests/**/*.py"
```

**Extract:**
- Which patterns exist and can be reused (cite file path)
- What modules are similar (use as template)
- Whether feature partially exists already

If codebase check answers all unknowns → **skip Phase 2**.

---

## Phase 1: Understand the Task

From the user's description, identify:

1. **Goal** — what should exist/work when done? (1 sentence)
2. **Domain** — API integration / UI / data processing / infra / etc.
3. **Unknowns** — what we NOT know yet? Tag: `[API]` / `[Library]` / `[Pattern]`
4. **Constraints** — existing code to integrate with, tech stack, limits

**State tier:** "Task type: [Domain]. Complexity tier: [Small / Medium / Large / Epic]."

If Unknowns list is empty after Phase 0 → skip Phase 2 entirely.

---

## Phase 2: Research (only for remaining unknowns)

Search depth by tier:

| Tier | Subtasks | Max searches |
|------|----------|-------------|
| Small | 5 (Merged) | 1-2 (or skip) |
| Medium | 6 (Variant A/B) | 3-4 |
| Large | 6 (Variant A/B) | 5-6 |
| Epic | 6 (Phase 1 only) | 6 |

**For `[API]` unknowns** — WebSearch:
```
"{api_name} {language} authentication 2026"
"{api_name} rate limits response format"
```

**For `[Library]` unknowns** — Context7 first, then WebSearch:
```
mcp__context7__resolve-library-id(libraryName="{library}")
mcp__context7__query-docs(context7CompatibleLibraryID="...", topic="...")
```

**For `[Pattern]` unknowns** — WebSearch:
```
"{pattern} {language} real example 2026"
"site:github.com {pattern} {language}"
```

**Output:** Key findings per Unknown (2-3 bullets), recommended approach, risks.

---

## Phase 3: Decompose into Subtasks

Each subtask must be:
- Completable in one focused session
- Independently verifiable
- Assigned to exactly one agent type

**Subtask template:**
```
ID: T{N}
Subject: [imperative verb] [what]
Agent: general-purpose | test-runner | code-reviewer | test-engineer | ...
Blocked by: [T{N}, ...] or none
Done when: [specific verifiable condition]
Files to create: [new files]
Files to modify: [existing files]
```

### Decomposition rules
- Small → Merged chain (5 tasks max)
- Medium/Large → Variant A or B (6 tasks)
- Max 6 subtasks per feature (more → split into phases)
- Tests are SEPARATE from implementation
- Review is always LAST

### Decision tree
```
Implement + wire touch the same files?
  YES → Merged chain [Small: 5 tasks]
  NO  → Do tests need wired module importable?
    NO  → Variant A [6 tasks, wire ∥ tests after core]
    YES → Variant B [6 tasks, wire → tests sequential]
```

### Merged chain (Small)
```
T1: Core implementation + wiring  ← blockedBy: none
    [TDD: write failing test first, then implement]
T2: Write comprehensive tests     ← blockedBy: T1
T3: Run tests + fix failures      ← agent: test-runner, blockedBy: T2
T4: Coverage check                ← agent: test-engineer, blockedBy: T3  ┐ PARALLEL
T5: Code review                   ← agent: code-reviewer, blockedBy: T3  ┘
```

### Variant A (wire ∥ tests)
```
T1: Core implementation           ← blockedBy: none [TDD]
T2: Wire into existing code       ← blockedBy: T1  ┐ PARALLEL
T3: Write comprehensive tests     ← blockedBy: T1  ┘
T4: Run tests + fix failures      ← agent: test-runner, blockedBy: T2, T3
T5: Coverage check                ← agent: test-engineer, blockedBy: T4  ┐ PARALLEL
T6: Code review                   ← agent: code-reviewer, blockedBy: T4  ┘
```

### Variant B (wire → tests)
```
T1: Core implementation           ← blockedBy: none [TDD]
T2: Wire into existing code       ← blockedBy: T1
T3: Write comprehensive tests     ← blockedBy: T2
T4: Run tests + fix failures      ← agent: test-runner, blockedBy: T3
T5: Coverage check                ← agent: test-engineer, blockedBy: T4  ┐ PARALLEL
T6: Code review                   ← agent: code-reviewer, blockedBy: T4  ┘
```

---

## Phase 4: Create Tasks

For each subtask, call TaskCreate:

**Implementation task:**
```
TaskCreate:
  subject: "[imperative verb] [what]"
  description: |
    [Context from research]
    Files to create: [list]
    Files to modify: [list]
    Pattern source: [file path to copy pattern from]
    Workflow: invoke superpowers:test-driven-development
    Done when: [verifiable condition]
```

**Test task:**
```
TaskCreate:
  subject: "Write [levels] tests for [module]"
  description: |
    Test levels: [unit / integration / smoke / E2E]
    Files to create: [test file path]
    Pattern source: [closest existing test file]
    Done when: test runner passes for [module]
```

**Self-check after all TaskCreate:**
- [ ] Every piece of work has a task
- [ ] Every task has blockedBy or "none"
- [ ] Test task blocked by impl task
- [ ] Test-runner blocked by test task AND wire task
- [ ] Review is last, blocked by test-runner
- [ ] No two tasks modify same file without dependency
- [ ] No blockedBy pointing to non-existent task

---

## Phase 5: Output the Plan

```
## Plan: [Task Name]

### Codebase Findings
[Reusable patterns, similar modules, partial implementations]

### Research Summary
*(skip if Phase 2 was skipped)*
- [Finding 1]
- [Finding 2]

### Recommended Approach
[1 paragraph: what + why + key decisions]

### Subtasks ({N} total, Variant A/B/Merged)
T1 [general-purpose] — Subject          ← blockedBy: none
T2 [general-purpose] — Subject          ← blockedBy: T1
...
T5 [test-engineer]   — Coverage check   ← blockedBy: T4  ┐ PARALLEL
T6 [code-reviewer]   — Code review      ← blockedBy: T4  ┘

### Risks
- [Risk 1]: [mitigation]

### Ready to execute
Tasks created. Next: `superpowers:executing-plans`

Start with T1:
  OBJECTIVE: [goal]
  INPUT CONTEXT: [key findings]
  SCOPE: [file paths]
  OUTPUT FORMAT: [what to return]
  DONE WHEN: [verifiable condition]
```

---

## Complexity Tiers

| Tier | Subtasks | Max searches | Example |
|------|----------|-------------|---------|
| **Small** | 5 (Merged) | 1-2 | Add field to existing model |
| **Medium** | 6 (A or B) | 3-4 | New API integration |
| **Large** | 6 (A or B) | 5-6 | Multiple new modules |
| **Epic** | 6 (Phase 1) | 6 | Full subsystem, multi-phase |

**When in doubt → go one tier up.**
