# SupaPlan

SupaPlan is an orchestration layer for AI agents working inside a GitHub repository.

It allows multiple agents to coordinate work without conflicting.

The system is intentionally minimal.

Supabase stores tasks.

GitHub stores code.

Agents operate through a defined contract.

---

# Core ideas

Agent execution should not depend on repository state.

Agents should coordinate through a shared system.

This prevents merge conflicts and duplicated work.

---

# Responsibilities

Supabase

task storage  
claim locking  
event logging  

GitHub

code history  
PR reviews  
human approval  

Agents

task execution  
status updates  

Humans

PR merge