-- Seed that mirrors main todo entries from core/greenbox/franchize/supaplan
INSERT INTO supaplan_tasks (id, title, body, todo_path, plugin, capability, status, created_by)
VALUES
  (gen_random_uuid(), 'Extract actions → /app/core', 'Split monolith actions into /app/core/* modules per /app/core/todo.md', '/app/core/todo.md#Extract', 'app/core', 'core.refactor', 'open', 'seed'),
  (gen_random_uuid(), 'Create supabaseAdmin factory', 'Implement /infrastructure/supabase client factory', '/infrastructure/supabase/todo.md#Implement', 'infrastructure/supabase', 'infra.db', 'open', 'seed'),
  (gen_random_uuid(), 'Gateway telegram sendMessage', 'Create /gateway/telegram/sendMessage.ts and webhook thin handler', '/gateway/telegram/todo.md#Create', 'gateway/telegram', 'gateway.telegram', 'open', 'seed'),
  (gen_random_uuid(), 'Formalize franchize as plugin', 'Add plugin.ts, hydration.md, CONTRACT.md for franchize', '/app/franchize/todo.md#Formalize', 'app/franchize', 'meta.plugin', 'open', 'seed'),
  (gen_random_uuid(), 'Create greenbox plugin basics', 'Create plugin.ts, CONTRACT.md, onboarding page for greenbox', '/app/greenbox/todo.md#Create greenbox plugin basics', 'app/greenbox', 'simulation.plants', 'open', 'seed'),
  (gen_random_uuid(), 'SupaPlan migration + claim RPC', 'Apply supaplan init and create claim RPC', '/app/supaplan/todo.md#Migration', 'app/supaplan', 'agent', 'open', 'seed'),
  (gen_random_uuid(), 'SupaPlan UI page', 'Implement /app/supaplan/page.tsx and StatusClient.tsx', '/app/supaplan/todo.md#UI', 'app/supaplan', 'ui.dashboard', 'open', 'seed'),
  (gen_random_uuid(), 'Codex skill contract', 'Document and implement minimal supaplan skill (pick/update/log)', '/app/supaplan/SKILL.md#Codex', 'app/supaplan', 'agent', 'open', 'seed');