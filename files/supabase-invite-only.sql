-- Invite-only access support.
-- Run this in the Supabase SQL editor after your base profiles table exists.

create extension if not exists pgcrypto;

alter table public.profiles
  add column if not exists invite_code_id uuid,
  add column if not exists invite_accepted_at timestamptz;

create table if not exists public.invite_codes (
  id uuid primary key default gen_random_uuid(),
  code_hash bytea not null unique,
  code_encrypted bytea,
  label text,
  created_by uuid references auth.users(id) on delete set null,
  used_by uuid unique references auth.users(id) on delete set null,
  used_at timestamptz,
  revoked_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  check ((used_by is null and used_at is null) or (used_by is not null and used_at is not null))
);

alter table public.invite_codes
  add column if not exists expires_at timestamptz,
  add column if not exists code_encrypted bytea;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_invite_code_id_fkey'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_invite_code_id_fkey
      foreign key (invite_code_id) references public.invite_codes(id) on delete set null;
  end if;
end $$;

create index if not exists invite_codes_created_by_idx on public.invite_codes(created_by, created_at desc);
create index if not exists invite_codes_used_by_idx on public.invite_codes(used_by);
create index if not exists invite_codes_expires_at_idx on public.invite_codes(expires_at);
create index if not exists profiles_invite_code_id_idx on public.profiles(invite_code_id);

alter table public.invite_codes enable row level security;

drop policy if exists "invite_codes_no_direct_access" on public.invite_codes;
create policy "invite_codes_no_direct_access"
  on public.invite_codes
  for all
  using (false)
  with check (false);

create or replace function public.normalize_invite_code(code text)
returns text
language sql
immutable
as $$
  select lower(trim(coalesce(code, '')));
$$;

create or replace function public.invite_code_encryption_key()
returns text
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  select coalesce(
    nullif(current_setting('app.invite_code_secret', true), ''),
    nullif(current_setting('app.settings.jwt_secret', true), ''),
    'change-this-invite-code-secret-in-supabase'
  );
$$;

create or replace function public.is_invite_owner(user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  select coalesce(
    exists (
      select 1
      from public.profiles p
      where p.id = user_id
        and (
          lower(coalesce(p.role::text, '')) like '%owner%'
          or lower(coalesce(p.role::text, '')) like '%founder%'
          or lower(coalesce(p.role::text, '')) like '%admin%'
        )
    ),
    false
  );
$$;

create or replace function public.is_invite_staff(user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  select coalesce(
    exists (
      select 1
      from public.profiles p
      where p.id = user_id
        and (
          lower(coalesce(p.role::text, '')) like '%owner%'
          or lower(coalesce(p.role::text, '')) like '%founder%'
          or lower(coalesce(p.role::text, '')) like '%admin%'
          or lower(coalesce(p.role::text, '')) like '%staff%'
          or lower(coalesce(p.role::text, '')) like '%moderator%'
          or lower(coalesce(p.role::text, '')) like '%mod%'
          or lower(coalesce(p.role::text, '')) like '%developer%'
          or lower(coalesce(p.role::text, '')) like '%dev%'
        )
    ),
    false
  );
$$;

create or replace function public.has_invite_access(user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  select user_id is not null and (
    public.is_invite_staff(user_id)
    or exists (
      select 1
      from public.profiles p
      where p.id = user_id
        and p.invite_accepted_at is not null
    )
    or exists (
      select 1
      from public.invite_codes ic
      where ic.used_by = user_id
        and ic.revoked_at is null
    )
  );
$$;

drop function if exists public.get_invite_permissions();
create function public.get_invite_permissions()
returns table (
  is_staff boolean,
  account_is_old_enough boolean,
  monthly_invites_used integer,
  monthly_invites_limit integer,
  monthly_invites_remaining integer,
  next_invite_at timestamptz,
  can_create boolean,
  reason text
)
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  with current_user_row as (
    select u.id, u.created_at
    from auth.users u
    where u.id = auth.uid()
  ),
  usage as (
    select
      count(*)::integer as invites_used,
      min(ic.created_at) filter (where ic.created_at >= now() - interval '1 month') as oldest_recent_invite
    from public.invite_codes ic
    where ic.created_by = auth.uid()
      and ic.created_at >= now() - interval '1 month'
  ),
  rules as (
    select
      public.is_invite_staff(auth.uid()) as is_staff,
      coalesce(cu.created_at <= now() - interval '1 month', false) as account_is_old_enough,
      coalesce(usage.invites_used, 0) as monthly_invites_used,
      case when public.is_invite_staff(auth.uid()) then 999 else 1 end as monthly_invites_limit,
      usage.oldest_recent_invite
    from current_user_row cu
    cross join usage
  )
  select
    rules.is_staff,
    rules.account_is_old_enough,
    rules.monthly_invites_used,
    rules.monthly_invites_limit,
    greatest(rules.monthly_invites_limit - rules.monthly_invites_used, 0),
    case
      when rules.is_staff or rules.monthly_invites_used = 0 then null
      else rules.oldest_recent_invite + interval '1 month'
    end,
    auth.uid() is not null
      and public.has_invite_access(auth.uid())
      and (rules.is_staff or (rules.account_is_old_enough and rules.monthly_invites_used < 1)),
    case
      when auth.uid() is null then 'Sign in first.'
      when not public.has_invite_access(auth.uid()) then 'Redeem an invite before creating one.'
      when rules.is_staff then null
      when not rules.account_is_old_enough then 'Your account must be older than one month before you can invite others.'
      when rules.monthly_invites_used >= 1 then 'You have already created your invite for this month.'
      else null
    end
  from rules;
$$;

drop function if exists public.create_invite_code(text);
create function public.create_invite_code(p_label text default null)
returns table (
  id uuid,
  code text,
  label text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  generated_code text;
  new_invite public.invite_codes%rowtype;
  permissions record;
begin
  if auth.uid() is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;

  select * into permissions from public.get_invite_permissions();

  if not coalesce(permissions.can_create, false) then
    raise exception '%', coalesce(permissions.reason, 'You cannot create an invite code right now.') using errcode = '42501';
  end if;

  loop
    generated_code := 'kotatsu_' || encode(gen_random_bytes(32), 'hex');

    begin
      insert into public.invite_codes (code_hash, code_encrypted, label, created_by)
      values (
        digest(public.normalize_invite_code(generated_code), 'sha256'),
        pgp_sym_encrypt(generated_code, public.invite_code_encryption_key(), 'compress-algo=1, cipher-algo=aes256'),
        nullif(trim(coalesce(p_label, '')), ''),
        auth.uid()
      )
      returning * into new_invite;
      exit;
    exception
      when unique_violation then
        -- 256-bit random collisions are effectively impossible, but retry anyway.
    end;
  end loop;

  return query
    select new_invite.id, generated_code, new_invite.label, new_invite.created_at;
end;
$$;

create or replace function public.redeem_invite_code(p_code text, p_display_name text default null)
returns boolean
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  invite public.invite_codes%rowtype;
  profile_name text;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to redeem an invite code' using errcode = '42501';
  end if;

  if public.has_invite_access(auth.uid()) then
    return true;
  end if;

  if public.normalize_invite_code(p_code) = '' then
    raise exception 'Invite code is required' using errcode = '22023';
  end if;

  select *
  into invite
  from public.invite_codes
  where code_hash = digest(public.normalize_invite_code(p_code), 'sha256')
  for update;

  if not found then
    raise exception 'Invalid invite code' using errcode = '22023';
  end if;

  if invite.revoked_at is not null then
    raise exception 'This invite code has been revoked' using errcode = '22023';
  end if;

  if invite.expires_at is not null and invite.expires_at <= now() then
    raise exception 'This invite code has expired' using errcode = '22023';
  end if;

  if invite.used_by is not null then
    raise exception 'This invite code has already been used' using errcode = '22023';
  end if;

  update public.invite_codes
  set used_by = auth.uid(),
      used_at = now()
  where id = invite.id;

  profile_name := nullif(trim(coalesce(p_display_name, '')), '');

  insert into public.profiles (id, display_name, invite_code_id, invite_accepted_at)
  values (auth.uid(), coalesce(profile_name, 'Member'), invite.id, now())
  on conflict (id) do update
    set invite_code_id = excluded.invite_code_id,
        invite_accepted_at = excluded.invite_accepted_at;

  return true;
end;
$$;

drop function if exists public.list_invite_codes();
create function public.list_invite_codes()
returns table (
  id uuid,
  label text,
  created_at timestamptz,
  used_at timestamptz,
  revoked_at timestamptz,
  expires_at timestamptz,
  created_by uuid,
  created_by_name text,
  used_by uuid,
  used_by_name text,
  used_by_avatar_url text,
  code text,
  can_manage boolean
)
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  select
    ic.id,
    ic.label,
    ic.created_at,
    ic.used_at,
    ic.revoked_at,
    ic.expires_at,
    ic.created_by,
    creator.display_name as created_by_name,
    ic.used_by,
    used_profile.display_name as used_by_name,
    used_profile.avatar_url as used_by_avatar_url,
    case
      when ic.code_encrypted is not null
        and (public.is_invite_staff(auth.uid()) or ic.created_by = auth.uid())
      then pgp_sym_decrypt(ic.code_encrypted, public.invite_code_encryption_key())
      else null
    end as code,
    public.is_invite_staff(auth.uid()) as can_manage
  from public.invite_codes ic
  left join public.profiles creator on creator.id = ic.created_by
  left join public.profiles used_profile on used_profile.id = ic.used_by
  where public.is_invite_staff(auth.uid())
     or ic.created_by = auth.uid()
  order by ic.created_at desc;
$$;

drop function if exists public.expire_invite_code(uuid);
create function public.expire_invite_code(p_invite_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  if auth.uid() is null or not public.is_invite_staff(auth.uid()) then
    raise exception 'Only staff can expire invite codes' using errcode = '42501';
  end if;

  update public.invite_codes
  set expires_at = now()
  where id = p_invite_id
    and used_by is null
    and revoked_at is null
    and (expires_at is null or expires_at > now());

  return found;
end;
$$;

drop function if exists public.delete_invite_code(uuid);
create function public.delete_invite_code(p_invite_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  if auth.uid() is null or not public.is_invite_staff(auth.uid()) then
    raise exception 'Only staff can remove invite codes' using errcode = '42501';
  end if;

  delete from public.invite_codes
  where id = p_invite_id
    and used_by is null;

  return found;
end;
$$;

drop function if exists public.revoke_invite_code(uuid);
create function public.revoke_invite_code(p_invite_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  if auth.uid() is null or not public.is_invite_staff(auth.uid()) then
    raise exception 'Only staff can revoke invite codes' using errcode = '42501';
  end if;

  update public.invite_codes
  set revoked_at = now()
  where id = p_invite_id
    and used_by is null
    and revoked_at is null;

  return found;
end;
$$;

revoke all on function public.create_invite_code(text) from public;
revoke all on function public.redeem_invite_code(text, text) from public;
revoke all on function public.list_invite_codes() from public;
revoke all on function public.expire_invite_code(uuid) from public;
revoke all on function public.delete_invite_code(uuid) from public;
revoke all on function public.revoke_invite_code(uuid) from public;
revoke all on function public.get_invite_permissions() from public;
revoke all on function public.has_invite_access(uuid) from public;
revoke all on function public.is_invite_staff(uuid) from public;

grant execute on function public.create_invite_code(text) to authenticated;
grant execute on function public.redeem_invite_code(text, text) to authenticated;
grant execute on function public.list_invite_codes() to authenticated;
grant execute on function public.expire_invite_code(uuid) to authenticated;
grant execute on function public.delete_invite_code(uuid) to authenticated;
grant execute on function public.revoke_invite_code(uuid) to authenticated;
grant execute on function public.get_invite_permissions() to authenticated;
grant execute on function public.has_invite_access(uuid) to authenticated;
grant execute on function public.is_invite_staff(uuid) to authenticated;
