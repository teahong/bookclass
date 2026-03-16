-- Run this in Supabase SQL Editor (new project)

create extension if not exists pgcrypto;

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  age int,
  pin text,
  avatar_icon text,
  avatar_color text,
  created_at timestamptz not null default now()
);

alter table public.users add column if not exists avatar_icon text;
alter table public.users add column if not exists avatar_color text;

create table if not exists public.books (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  author text,
  publisher text,
  cover_url text,
  rating int default 5,
  review_content text,
  review_word_count int default 0,
  recommend_to text,
  read_date date,
  link text,
  user_id text not null,
  keywords text[],
  book_letter text,
  teacher_comment text,
  teacher_commented_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.books add column if not exists teacher_comment text;
alter table public.books add column if not exists teacher_commented_at timestamptz;

create table if not exists public.ai_analysis (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  level text,
  interest text,
  recommendations jsonb,
  updated_at timestamptz not null default now(),
  unique (user_id)
);

create table if not exists public.app_settings (
  key text primary key,
  value text
);

alter table public.users enable row level security;
alter table public.books enable row level security;
alter table public.ai_analysis enable row level security;
alter table public.app_settings enable row level security;

drop policy if exists "open_users_all" on public.users;
drop policy if exists "open_books_all" on public.books;
drop policy if exists "open_ai_analysis_all" on public.ai_analysis;
drop policy if exists "open_app_settings_all" on public.app_settings;

create policy "open_users_all" on public.users for all using (true) with check (true);
create policy "open_books_all" on public.books for all using (true) with check (true);
create policy "open_ai_analysis_all" on public.ai_analysis for all using (true) with check (true);
create policy "open_app_settings_all" on public.app_settings for all using (true) with check (true);

create or replace function public.verify_pin(user_id uuid, input_pin text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists(
    select 1
    from public.users
    where id = user_id and pin = input_pin
  );
$$;

grant execute on function public.verify_pin(uuid, text) to anon, authenticated;
