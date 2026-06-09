begin;

create or replace function public.ensure_user_workspace()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  existing_workspace_id uuid;
  new_workspace_id uuid;
begin
  if current_user_id is null then
    raise exception 'Authentication required'
      using errcode = '42501';
  end if;

  -- Serialize first-workspace creation for this user.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(current_user_id::text, 0)
  );

  select wm.workspace_id
  into existing_workspace_id
  from public.workspace_members wm
  where wm.user_id = current_user_id
  order by wm.created_at asc, wm.id asc
  limit 1;

  if existing_workspace_id is not null then
    return existing_workspace_id;
  end if;

  insert into public.workspaces (
    name,
    organizer_name,
    created_by
  )
  values (
    'My EventOS Workspace',
    '',
    current_user_id
  )
  returning id into new_workspace_id;

  insert into public.workspace_members (
    workspace_id,
    user_id,
    role
  )
  values (
    new_workspace_id,
    current_user_id,
    'owner'
  );

  insert into public.workspace_settings (
    workspace_id
  )
  values (
    new_workspace_id
  );

  return new_workspace_id;
end;
$$;

revoke all on function public.ensure_user_workspace() from public;
revoke all on function public.ensure_user_workspace() from anon;
grant execute on function public.ensure_user_workspace() to authenticated;

comment on function public.ensure_user_workspace() is
  'Returns the authenticated user''s earliest workspace membership, or atomically creates one empty workspace with owner membership and default settings.';

commit;
