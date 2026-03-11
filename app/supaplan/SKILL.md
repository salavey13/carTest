# SupaPlan Agent Skill

Agents must interact with SupaPlan through a minimal API.

---

## pick_task

Select next available task.

Input

capability

Output

task object

---

## update_status

Update task status.

Valid states

claimed  
running  
ready_for_pr

Agents cannot mark tasks as done.

---

## log_event

Record progress events.

Used for debugging and monitoring.

---

# Agent flow

1 pick_task  
2 claim task  
3 update_status running  
4 execute work  
5 update_status ready_for_pr