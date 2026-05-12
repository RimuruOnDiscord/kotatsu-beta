-- Social/friends feature support.
-- Run this in Supabase SQL editor before relying on profile privacy or full watch history.

alter table public.profiles
  add column if not exists profile_visibility text not null default 'public'
    check (profile_visibility in ('public', 'friends', 'private')),
  add column if not exists activity_visibility text not null default 'public'
    check (activity_visibility in ('public', 'friends', 'private')),
  add column if not exists watching_status_visibility text not null default 'public'
    check (watching_status_visibility in ('public', 'friends', 'private')),
  add column if not exists status_state text,
  add column if not exists status_text text,
  add column if not exists last_active_at timestamptz;

create table if not exists public.anime_watch_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  anime_id text not null,
  episode_id text not null,
  anime_title text not null,
  anime_cover text,
  episode_title text,
  episode_number numeric,
  episode_image text,
  href text,
  progress_time numeric,
  duration numeric,
  created_at timestamptz not null default now()
);

create index if not exists anime_watch_events_user_created_idx
  on public.anime_watch_events(user_id, created_at desc);

create index if not exists anime_watch_events_user_anime_episode_idx
  on public.anime_watch_events(user_id, anime_id, episode_id, created_at desc);

alter table public.anime_watch_events enable row level security;

drop policy if exists "watch_events_insert_own" on public.anime_watch_events;
create policy "watch_events_insert_own"
  on public.anime_watch_events
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "watch_events_read_own" on public.anime_watch_events;
create policy "watch_events_read_own"
  on public.anime_watch_events
  for select
  using (auth.uid() = user_id);

drop policy if exists "watch_events_read_public" on public.anime_watch_events;
create policy "watch_events_read_public"
  on public.anime_watch_events
  for select
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = anime_watch_events.user_id
        and p.activity_visibility = 'public'
    )
  );

drop policy if exists "watch_events_read_friends" on public.anime_watch_events;
create policy "watch_events_read_friends"
  on public.anime_watch_events
  for select
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = anime_watch_events.user_id
        and p.activity_visibility = 'friends'
        and exists (
          select 1
          from public.friendships f
          where f.status = 'accepted'
            and (
              (f.user_id = auth.uid() and f.friend_id = anime_watch_events.user_id) or
              (f.friend_id = auth.uid() and f.user_id = anime_watch_events.user_id)
            )
        )
    )
  );

