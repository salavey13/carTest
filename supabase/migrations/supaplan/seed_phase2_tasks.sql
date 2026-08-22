insert into supaplan_tasks
(title, body, plugin, capability, status, created_by)
values

(
'Codex skill contract',
'Define supaplan.pick_task supaplan.update_status supaplan.log_event APIs',
'supaplan',
'agent',
'open',
'seed'
),

(
'Agent heartbeat',
'Implement claim heartbeat and automatic claim release',
'supaplan',
'agent',
'open',
'seed'
),

(
'Task progress events',
'Allow agents to log progress into supaplan_events',
'supaplan',
'observability',
'open',
'seed'
),

(
'GitHub merge workflow',
'Create workflow that marks task done on PR merge',
'supaplan',
'github',
'open',
'seed'
),

(
'ready_for_pr state',
'Agents must move tasks to ready_for_pr before PR creation',
'supaplan',
'workflow',
'open',
'seed'
),

(
'Telegram notifications',
'Send task updates to Telegram',
'supaplan',
'notifications',
'open',
'seed'
),

(
'Markdown export',
'Export task list into markdown snapshot',
'supaplan',
'export',
'open',
'seed'
),

(
'Advanced dashboards',
'Create analytics dashboards for agent activity',
'supaplan',
'observability',
'open',
'seed'
);