---
name: artificial-general-iterator
description: Karpathy-style autoresearch loop for the entire repo, powered by SupaPlan. Zero GPU. Bathroom-test speed.
---

# Artificial General Iterator

Use this when any “новый уровень” or genie-lamp fake door is triggered.

## Goal
Run autonomous iteration across the whole repository using SupaPlan as the single source of truth.

## How it works
1. User triggers → supaplan.pick_task(capability)
2. Iterator claims task atomically
3. Executes (creates/updates files, runs code, opens PR)
4. Updates status → ready_for_pr
5. GitHub Action on merge sets status → done

## Bathroom Test (user-facing UX only)
If the user cannot feel the magic moment or complete the UX flow in the time it takes to take a shit, that UX task fails the test.

Agent tasks in SupaPlan are the technical implementation steps and are never subject to the bathroom test.

## Works for any domain
Mention any plugin name or fake door anywhere → iterator automatically picks the matching SupaPlan task.

This is the final boss for our distributed task hydra.