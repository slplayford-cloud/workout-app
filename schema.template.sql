-- =====================================================================
--  Workout tracker — Supabase schema
--  Paste this whole file into Supabase > SQL Editor > New query > Run.
--  Safe to re-run (idempotent).
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------- Reference taxonomy (shared, read-only) ----------
create table if not exists public.muscle_groups (
  id        text primary key,                  -- e.g. 'back'
  name      text not null,
  region    text not null check (region in ('upper','lower','either')),
  position  int  not null
);

create table if not exists public.sub_groups (
  id        text primary key,                  -- e.g. 'back.lats'
  group_id  text not null references public.muscle_groups(id) on delete cascade,
  name      text not null,
  position  int  not null
);

-- ---------- User data ----------
create table if not exists public.exercises (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name        text not null,
  notes       text,                             -- cue, e.g. "elbows flared 70–90°"
  archived    boolean not null default false,
  created_at  timestamptz not null default now()
);

-- An exercise maps to one or more group/sub-group targets.
-- is_primary=false targets count as a half set in muscle-distribution stats.
create table if not exists public.exercise_targets (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  exercise_id   uuid not null references public.exercises(id) on delete cascade,
  group_id      text not null references public.muscle_groups(id),
  sub_group_id  text references public.sub_groups(id),
  is_primary    boolean not null default true
);

create table if not exists public.routines (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name        text not null,
  notes       text,
  position    int not null default 0,
  archived    boolean not null default false,
  created_at  timestamptz not null default now()
);

-- A slot is a muscle target + set count, NOT a fixed exercise.
create table if not exists public.routine_slots (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  routine_id    uuid not null references public.routines(id) on delete cascade,
  position      int not null,
  group_id      text not null references public.muscle_groups(id),
  sub_group_id  text references public.sub_groups(id),
  sets          int not null default 3 check (sets between 1 and 20),
  label         text                             -- optional hint, e.g. "Paused shrug"
);

create table if not exists public.workouts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  routine_id  uuid references public.routines(id) on delete set null,
  name        text not null,
  started_at  timestamptz not null default now(),
  ended_at    timestamptz,
  notes       text
);

create table if not exists public.workout_exercises (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users(id) on delete cascade,
  workout_id       uuid not null references public.workouts(id) on delete cascade,
  exercise_id      uuid not null references public.exercises(id) on delete restrict,
  routine_slot_id  uuid references public.routine_slots(id) on delete set null,
  slot_group_id    text references public.muscle_groups(id),   -- snapshot of the slot's target
  slot_sub_group_id text references public.sub_groups(id),
  slot_label       text,
  position         int not null,
  notes            text
);

create table if not exists public.sets (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null default auth.uid() references auth.users(id) on delete cascade,
  workout_exercise_id  uuid not null references public.workout_exercises(id) on delete cascade,
  position             int not null,
  weight_lb            numeric(7,2),
  reps                 int,
  rpe                  numeric(3,1) check (rpe is null or (rpe between 1 and 10)),
  set_type             text not null default 'normal' check (set_type in ('normal','warmup','drop','failure')),
  done                 boolean not null default false,
  completed_at         timestamptz
);

create table if not exists public.user_settings (
  user_id         uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  rest_seconds    int not null default 90,
  target_min      int not null default 10,     -- default weekly hard-set target range per group
  target_max      int not null default 20,
  group_targets   jsonb not null default '{}'::jsonb,  -- per-group overrides: {"back": {"min": 12, "max": 22}}
  updated_at      timestamptz not null default now()
);

-- ---------- Indexes ----------
create index if not exists idx_exercises_user         on public.exercises(user_id);
create index if not exists idx_exercise_targets_ex    on public.exercise_targets(exercise_id);
create index if not exists idx_routines_user          on public.routines(user_id);
create index if not exists idx_routine_slots_routine  on public.routine_slots(routine_id);
create index if not exists idx_workouts_user_started  on public.workouts(user_id, started_at desc);
create index if not exists idx_wex_workout            on public.workout_exercises(workout_id);
create index if not exists idx_wex_exercise           on public.workout_exercises(exercise_id);
create index if not exists idx_sets_wex               on public.sets(workout_exercise_id);

-- ---------- De-duplicate seed data, then guarantee uniqueness ----------
-- If the first-run seed ever ran twice for an account (e.g. the app was opened on
-- two devices at once), merge duplicates: keep the oldest row per (user, name),
-- repoint any history to it, delete the rest. Safe to run repeatedly.
with ranked as (
  select id,
         first_value(id) over (partition by user_id, name order by created_at, id) as keep_id,
         row_number()    over (partition by user_id, name order by created_at, id) as rn
  from public.exercises)
update public.workout_exercises w set exercise_id = r.keep_id
from ranked r where w.exercise_id = r.id and r.rn > 1;

with ranked as (
  select id, row_number() over (partition by user_id, name order by created_at, id) as rn
  from public.exercises)
delete from public.exercises e using ranked r where e.id = r.id and r.rn > 1;

with ranked as (
  select id,
         first_value(id) over (partition by user_id, name order by created_at, id) as keep_id,
         row_number()    over (partition by user_id, name order by created_at, id) as rn
  from public.routines)
update public.workouts w set routine_id = r.keep_id
from ranked r where w.routine_id = r.id and r.rn > 1;

with ranked as (
  select id, row_number() over (partition by user_id, name order by created_at, id) as rn
  from public.routines)
delete from public.routines x using ranked r where x.id = r.id and r.rn > 1;

-- Exercise names are unique per user; a concurrent second seed now fails cleanly
-- instead of doubling the list (the app treats that as "already seeded").
create unique index if not exists uq_exercises_user_name on public.exercises(user_id, name);

-- ---------- Row Level Security ----------
alter table public.muscle_groups     enable row level security;
alter table public.sub_groups        enable row level security;
alter table public.exercises         enable row level security;
alter table public.exercise_targets  enable row level security;
alter table public.routines          enable row level security;
alter table public.routine_slots     enable row level security;
alter table public.workouts          enable row level security;
alter table public.workout_exercises enable row level security;
alter table public.sets              enable row level security;
alter table public.user_settings     enable row level security;

-- Taxonomy: any signed-in user can read; nobody writes through the API.
drop policy if exists "taxonomy read" on public.muscle_groups;
create policy "taxonomy read" on public.muscle_groups for select to authenticated using (true);
drop policy if exists "taxonomy read" on public.sub_groups;
create policy "taxonomy read" on public.sub_groups for select to authenticated using (true);

-- Everything else: owner only.
do $$
declare t text;
begin
  foreach t in array array['exercises','exercise_targets','routines','routine_slots',
                           'workouts','workout_exercises','sets','user_settings'] loop
    execute format('drop policy if exists "owner all" on public.%I', t);
    execute format(
      'create policy "owner all" on public.%I for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)', t);
  end loop;
end $$;

-- ---------- Taxonomy seed (generated from seed-data.js) ----------
-- {{TAXONOMY_SEED}}

-- ---------- Optional: lock sign-ups to a single user ----------
-- After you have created YOUR account, run this to block anyone else from
-- registering (Supabase Auth > Providers > Email also lets you disable sign-ups
-- in the dashboard, which is the simpler route):
--
-- create or replace function public.block_new_signups()
-- returns trigger language plpgsql security definer as $$
-- begin
--   if (select count(*) from auth.users) > 1 then
--     raise exception 'Sign-ups are closed';
--   end if;
--   return new;
-- end $$;
-- drop trigger if exists block_signups on auth.users;
-- create trigger block_signups after insert on auth.users
--   for each row execute function public.block_new_signups();
