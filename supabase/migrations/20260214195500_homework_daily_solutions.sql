create table if not exists public.homework_daily_solutions (
  id uuid primary key default gen_random_uuid(),
  homework_date date not null default (now()::date),
  solution_key text not null,
  subject text,
  topic text not null,
  given text not null,
  steps jsonb not null default '[]'::jsonb,
  answer text not null,
  solution_markdown text,
  full_solution_rich text,
  rewrite_for_notebook text,
  source_hints jsonb not null default '[]'::jsonb,
  screenshot_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (homework_date, solution_key)
);

alter table public.homework_daily_solutions
  add column if not exists solution_markdown text;

alter table public.homework_daily_solutions
  add column if not exists full_solution_rich text;

create index if not exists homework_daily_solutions_date_idx
  on public.homework_daily_solutions (homework_date desc);

create index if not exists homework_daily_solutions_key_idx
  on public.homework_daily_solutions (solution_key);

create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_homework_daily_solutions_updated_at on public.homework_daily_solutions;
create trigger set_homework_daily_solutions_updated_at
before update on public.homework_daily_solutions
for each row
execute function public.update_updated_at_column();

insert into public.homework_daily_solutions (
  homework_date,
  solution_key,
  subject,
  topic,
  given,
  steps,
  answer,
  solution_markdown,
  full_solution_rich,
  rewrite_for_notebook,
  source_hints
)
values (
  date '2026-02-13',
  '13-02-final',
  'algebra',
  'Алгебра 7 класс: степень с натуральным показателем (№444, №451)',
  'ДЗ из скрина: выучить пункт 20, решить №444 и №451.',
  '[
    "Пункт 20: используем свойства (ab)^n = a^n b^n и (a^m)^n = a^(mn), а также правило знака: четная степень убирает минус, нечетная сохраняет.",
    "№444: поочередно возводим в степень каждый множитель и числовой коэффициент (например, (-3y)^4 = 81y^4, (-2ax)^3 = -8a^3x^3).",
    "№451: сворачиваем произведения одинаковых степеней в одну степень ((bx)^3, (ay)^7, (xyz)^2, (-ab)^3, (2a)^5).",
    "Для пункта е) №451: 0,027m^3 = (0,3^3)m^3 = (0,3m)^3."
  ]'::jsonb,
  '№444: а) m^5n^5; б) x^2y^2z^2; в) 81y^4; г) -8a^3x^3; д) 100x^2y^2; е) 16a^4b^4x^4; ж) -a^3m^3; з) x^4n^4. №451: а) (bx)^3; б) (ay)^7; в) (xyz)^2; г) (-ab)^3; д) (2a)^5; е) (0,3m)^3.',
  '## Что дано\nНужно выучить пункт 20 по теме степеней и решить упражнения №444 и №451.\n\n## Решение №444\nа) (mn)^5 = m^5n^5\nб) (xyz)^2 = x^2y^2z^2\nв) (-3y)^4 = 81y^4\nг) (-2ax)^3 = -8a^3x^3\nд) (10xy)^2 = 100x^2y^2\nе) (-2abx)^4 = 16a^4b^4x^4\nж) (-am)^3 = -a^3m^3\nз) (-xn)^4 = x^4n^4\n\n## Решение №451\nа) b^3x^3 = (bx)^3\nб) a^7y^7 = (ay)^7\nв) x^2y^2z^2 = (xyz)^2\nг) (-a)^3b^3 = (-ab)^3\nд) 2^5a^5 = (2a)^5\nе) 0,027m^3 = (0,3m)^3\n\n## Ответ\nВсе пункты №444 и №451 решены полностью.',
  '## Что дано\nНужно выучить пункт 20 по теме степеней и решить упражнения №444 и №451.\n\n## Решение №444\nа) (mn)^5 = m^5n^5\nб) (xyz)^2 = x^2y^2z^2\nв) (-3y)^4 = 81y^4\nг) (-2ax)^3 = -8a^3x^3\nд) (10xy)^2 = 100x^2y^2\nе) (-2abx)^4 = 16a^4b^4x^4\nж) (-am)^3 = -a^3m^3\nз) (-xn)^4 = x^4n^4\n\n## Решение №451\nа) b^3x^3 = (bx)^3\nб) a^7y^7 = (ay)^7\nв) x^2y^2z^2 = (xyz)^2\nг) (-a)^3b^3 = (-ab)^3\nд) 2^5a^5 = (2a)^5\nе) 0,027m^3 = (0,3m)^3\n\n## Ответ\nВсе пункты №444 и №451 решены полностью.',
  'Что дано: №444, №451 (тема степеней). Решение: применяем (ab)^n=a^n*b^n и (a^m)^n=a^(mn), учитываем знак при четной/нечетной степени. Ответ: №444 и №451 как в итоговой строке.',
  '[
    {"book":"alg.pdf","page":"107","exercise":"444","chunkLabel":"near-ex-444"},
    {"book":"alg.pdf","page":"108","exercise":"451","chunkLabel":"near-ex-451"}
  ]'::jsonb
)
on conflict (homework_date, solution_key)
do update set
  subject = excluded.subject,
  topic = excluded.topic,
  given = excluded.given,
  steps = excluded.steps,
  answer = excluded.answer,
  solution_markdown = excluded.solution_markdown,
  full_solution_rich = excluded.full_solution_rich,
  rewrite_for_notebook = excluded.rewrite_for_notebook,
  source_hints = excluded.source_hints,
  updated_at = now();
