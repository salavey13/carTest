# Artificial General Iterator (project-wide, SupaPlan-backed)

Goal
Run Karpathy-style autoresearch across the entire repo using SupaPlan as coordination layer.

How it works
1. User says “Codex, новый уровень: …” or clicks any genie-lamp fake door.
2. Iterator calls supaplan.pick_task(capability) → claims task atomically.
3. Executes the task (creates/updates files, runs code, opens PR).
4. Updates status → ready_for_pr.
5. GitHub Action on merge sets status → done and releases claim.

Bathroom test (for user-facing UX only):
If the user cannot feel the magic moment or complete the UX flow in the time it takes to take a shit, that UX task fails the test.

Agent tasks in SupaPlan are the technical implementation steps — they are separate and never subject to the bathroom test.

Works for any domain
Mention any plugin name or fake door → iterator automatically picks the matching task from SupaPlan.

This is the final boss for our distributed task hydra.