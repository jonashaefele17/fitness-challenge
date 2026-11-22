-- Baustein 6c (habits, personal): when to be reminded of the check-in (morning, evening).
-- Reminder times of checklist items (supplements) live in the habit's options
-- ({key, label, remindAt: "08:00"}), versioned with the habit. Sending them is the
-- notifications module's job (it reads these; habits know nothing of notifications).

create table public.habit_reminders (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  morning_at time,
  evening_at time,
  updated_at timestamptz not null default now()
);

alter table public.habit_reminders enable row level security;
revoke all on public.habit_reminders from anon, authenticated;
grant select, insert, update, delete on public.habit_reminders to authenticated;

create policy "habit_reminders: own" on public.habit_reminders
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
