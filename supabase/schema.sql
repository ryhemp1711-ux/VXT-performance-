-- VXT Performance: run once in your Supabase SQL Editor.
begin;
create table if not exists public.vxt_workspaces (
 user_id uuid primary key references auth.users(id) on delete cascade,
 payload jsonb not null,
 revision bigint not null default 1,
 updated_at timestamptz not null default now()
);
alter table public.vxt_workspaces enable row level security;
revoke all on public.vxt_workspaces from anon, authenticated;
grant select on public.vxt_workspaces to authenticated;
drop policy if exists "Read own workspace" on public.vxt_workspaces;
create policy "Read own workspace" on public.vxt_workspaces
 for select to authenticated using ((select auth.uid()) = user_id);

-- Atomic compare-and-swap prevents another device's concurrent save being lost.
-- Writes are available only through this function, bound to the signed-in user.
create or replace function public.vxt_save_workspace(p_payload jsonb, p_expected_revision bigint)
returns bigint language plpgsql security definer set search_path = '' as $$
declare v_user uuid := auth.uid(); v_revision bigint;
begin
 if v_user is null then raise exception 'Sign in first'; end if;
 if p_expected_revision is null or p_expected_revision < 0 then raise exception 'Invalid revision'; end if;
 if p_payload is null or jsonb_typeof(p_payload) is distinct from 'object'
   or p_payload->>'version' is distinct from '1'
   or jsonb_typeof(p_payload->'athletes') is distinct from 'array'
   or jsonb_typeof(p_payload->'results') is distinct from 'array'
   or jsonb_typeof(p_payload->'predictions') is distinct from 'array'
   or octet_length(p_payload::text) > 20971520 then
   raise exception 'Invalid or oversized VXT backup';
 end if;
 if p_expected_revision = 0 then
   insert into public.vxt_workspaces(user_id,payload) values(v_user,p_payload)
   on conflict (user_id) do nothing returning revision into v_revision;
 else
   update public.vxt_workspaces set payload=p_payload,revision=revision+1,updated_at=now()
   where user_id=v_user and revision=p_expected_revision returning revision into v_revision;
 end if;
 if v_revision is null then raise exception 'Cloud changed on another device. Download the latest cloud copy or review and retry your upload.'; end if;
 return v_revision;
end $$;
revoke all on function public.vxt_save_workspace(jsonb,bigint) from public, anon;
grant execute on function public.vxt_save_workspace(jsonb,bigint) to authenticated;
commit;
