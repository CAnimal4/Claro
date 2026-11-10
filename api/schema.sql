-- Run once in the Supabase SQL editor for Claro 2.0.
create table if not exists public.claro_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('teacher','admin')),
  display_name text not null default '',
  email text not null default '',
  email_requests boolean not null default true,
  email_announcements boolean not null default true,
  email_status_changes boolean not null default false,
  email_new_modules boolean not null default false,
  created_at timestamptz not null default now()
);
create table if not exists public.claro_classes (
  id text primary key check (id in ('spanish1a','spanish1b','spanish2')),
  label text not null,
  is_published boolean not null default true
);
insert into public.claro_classes(id,label) values
 ('spanish1a','Spanish 1A'),('spanish1b','Spanish 1B'),('spanish2','Spanish 2 Honors')
on conflict(id) do update set label=excluded.label;
create table if not exists public.claro_teacher_classes (
  user_id uuid not null references public.claro_profiles(user_id) on delete cascade,
  class_id text not null references public.claro_classes(id),
  primary key(user_id,class_id)
);
create table if not exists public.claro_module_requests (
  id uuid primary key default gen_random_uuid(),
  class_id text not null references public.claro_classes(id),
  title text not null,
  description text not null,
  source text not null check (source in ('student','teacher','admin')),
  request_type text not null default 'module' check (request_type in ('module','curriculum')),
  requester_id uuid references public.claro_profiles(user_id) on delete set null,
  student_name text,
  receipt_email text,
  receipt_token_hash text,
  status text not null default 'requested' check (status in ('requested','in_review','approved','created','tested','published')),
  teacher_approved_at timestamptz,
  teacher_declined_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.claro_request_events (
  id bigint generated always as identity primary key,
  request_id uuid not null references public.claro_module_requests(id) on delete cascade,
  actor_id uuid references public.claro_profiles(user_id) on delete set null,
  event_type text not null,
  status text,
  note text,
  created_at timestamptz not null default now()
);
create table if not exists public.claro_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.claro_profiles(user_id) on delete cascade,
  class_id text references public.claro_classes(id),
  kind text not null check (kind in ('request','status','announcement','module')),
  title text not null,
  body text not null,
  href text,
  read_at timestamptz,
  dismissed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists claro_requests_class_status on public.claro_module_requests(class_id,status,created_at desc);
create index if not exists claro_notifications_user_date on public.claro_notifications(user_id,created_at desc);
alter table public.claro_profiles enable row level security;
alter table public.claro_classes enable row level security;
alter table public.claro_teacher_classes enable row level security;
alter table public.claro_module_requests enable row level security;
alter table public.claro_request_events enable row level security;
alter table public.claro_notifications enable row level security;
-- No browser-access policies are granted. Vercel API functions use the service role
-- only after validating the user's Supabase session and server-side class assignment.

create table if not exists public.claro_modules (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  class_id text not null references public.claro_classes(id),
  title text not null,
  summary text not null default '',
  content jsonb not null default '{"schemaVersion":1,"items":[]}'::jsonb,
  status text not null default 'draft' check(status in ('draft','published')),
  created_by uuid references public.claro_profiles(user_id) on delete set null,
  source_request_id uuid references public.claro_module_requests(id) on delete set null,
  created_at timestamptz not null default now(),
  published_at timestamptz,
  unique(class_id,slug)
);
create index if not exists claro_modules_class_status on public.claro_modules(class_id,status);
alter table public.claro_modules enable row level security;
