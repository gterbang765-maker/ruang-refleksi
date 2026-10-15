-- Jalankan seluruh SQL ini di Supabase Dashboard > SQL Editor.
-- Kebijakan ini memungkinkan pengunjung mengirim feedback tanpa login,
-- tetapi hanya admin terdaftar yang bisa membaca/menghapus data.

create extension if not exists pgcrypto;

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Anonim' check (char_length(name) between 1 and 60),
  message text not null check (char_length(trim(message)) between 1 and 2000),
  created_at timestamptz not null default now()
);

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.feedback enable row level security;
alter table public.admin_users enable row level security;

-- Hapus policy bernama sama bila SQL dijalankan ulang.
drop policy if exists "Anyone can submit feedback" on public.feedback;
drop policy if exists "Admins can read feedback" on public.feedback;
drop policy if exists "Admins can delete feedback" on public.feedback;
drop policy if exists "Admins can view admin list" on public.admin_users;

create policy "Anyone can submit feedback"
on public.feedback for insert
to anon, authenticated
with check (
  char_length(name) between 1 and 60
  and char_length(trim(message)) between 1 and 2000
);

create policy "Admins can read feedback"
on public.feedback for select
to authenticated
using (
  exists (select 1 from public.admin_users a where a.user_id = (select auth.uid()))
);

create policy "Admins can delete feedback"
on public.feedback for delete
to authenticated
using (
  exists (select 1 from public.admin_users a where a.user_id = (select auth.uid()))
);

-- Hanya admin dapat melihat daftar admin. Pengunjung tidak bisa menambah diri
-- menjadi admin karena tidak ada policy INSERT/UPDATE/DELETE untuk client.
create policy "Admins can view admin list"
on public.admin_users for select
to authenticated
using (
  user_id = (select auth.uid())
);

grant usage on schema public to anon, authenticated;
grant insert on public.feedback to anon, authenticated;
grant select, delete on public.feedback to authenticated;
grant select on public.admin_users to authenticated;

-- Setelah membuat akun admin melalui Authentication > Users, jalankan:
-- insert into public.admin_users (user_id)
-- values ('GANTI_DENGAN_UUID_USER_ADMIN');
