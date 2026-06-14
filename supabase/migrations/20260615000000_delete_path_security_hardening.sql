-- EventOS deletion-path security hardening.
--
-- This migration:
-- 1. Makes delete_event_safely(uuid) the only authenticated event deletion path.
-- 2. Prevents authenticated clients from deleting workspaces directly.
-- 3. Queues Storage cleanup before event_files metadata can be deleted.
-- 4. Prevents authenticated clients from changing event file ownership/path metadata.
--
-- The migration is additive, contains no data deletion, and is safe to rerun.

begin;

-- Replace the broad events policy with operation-specific policies that do not
-- include DELETE. The security-definer delete_event_safely(uuid) RPC retains
-- its own workspace-membership authorization and can still delete events.
drop policy if exists "Workspace members can manage events" on public.events;

drop policy if exists "Workspace members can view events" on public.events;
create policy "Workspace members can view events"
on public.events
for select
to authenticated
using (private.is_workspace_member(workspace_id));

drop policy if exists "Workspace members can create events" on public.events;
create policy "Workspace members can create events"
on public.events
for insert
to authenticated
with check (private.is_workspace_member(workspace_id));

drop policy if exists "Workspace members can update events" on public.events;
create policy "Workspace members can update events"
on public.events
for update
to authenticated
using (private.is_workspace_member(workspace_id))
with check (private.is_workspace_member(workspace_id));

revoke delete on table public.events from authenticated;

-- Workspace deletion is intentionally unavailable in V1. A future
-- delete_workspace_safely RPC must queue every Storage object before this
-- capability can be re-enabled.
drop policy if exists "Owners can delete workspaces" on public.workspaces;
revoke delete on table public.workspaces from authenticated;

-- Queue a private Storage object before its metadata row is removed. This
-- protects both individual file deletion and event-file cascade deletion.
create or replace function private.enqueue_event_file_cleanup_before_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  expected_path_prefix text;
begin
  if old.storage_path is null or btrim(old.storage_path) = '' then
    return old;
  end if;

  if old.storage_bucket <> 'event-files' then
    raise exception using
      errcode = '23514',
      message = 'Event file deletion blocked: unsupported Storage bucket.';
  end if;

  expected_path_prefix :=
    old.workspace_id::text || '/'
    || old.event_id::text || '/'
    || old.id::text || '/';

  if left(old.storage_path, length(expected_path_prefix)) <> expected_path_prefix
    or length(old.storage_path) <= length(expected_path_prefix) then
    raise exception using
      errcode = '23514',
      message = 'Event file deletion blocked: invalid Storage object path.';
  end if;

  insert into public.storage_cleanup_jobs (
    workspace_id,
    source_event_id,
    storage_bucket,
    storage_path,
    original_file_name,
    requested_by
  )
  values (
    old.workspace_id,
    old.event_id,
    old.storage_bucket,
    old.storage_path,
    old.file_name,
    (select auth.uid())
  )
  on conflict (storage_bucket, storage_path) do nothing;

  return old;
end;
$$;

revoke all on function private.enqueue_event_file_cleanup_before_delete()
  from public, anon, authenticated;

drop trigger if exists enqueue_event_file_cleanup_before_delete
  on public.event_files;
create trigger enqueue_event_file_cleanup_before_delete
before delete on public.event_files
for each row
execute function private.enqueue_event_file_cleanup_before_delete();

-- The current application never updates event_files metadata after upload.
-- Blocking direct UPDATE prevents an authenticated client from replacing a
-- Storage path and then deleting only the new path's metadata.
drop policy if exists "Workspace members can manage event files"
  on public.event_files;

drop policy if exists "Workspace members can view event files"
  on public.event_files;
create policy "Workspace members can view event files"
on public.event_files
for select
to authenticated
using (private.is_workspace_member(workspace_id));

drop policy if exists "Workspace members can create event files"
  on public.event_files;
create policy "Workspace members can create event files"
on public.event_files
for insert
to authenticated
with check (private.is_workspace_member(workspace_id));

drop policy if exists "Workspace members can delete event files"
  on public.event_files;
create policy "Workspace members can delete event files"
on public.event_files
for delete
to authenticated
using (private.is_workspace_member(workspace_id));

revoke update on table public.event_files from authenticated;

comment on function private.enqueue_event_file_cleanup_before_delete() is
  'Queues a validated event-files Storage object before its event_files metadata row is deleted.';

comment on trigger enqueue_event_file_cleanup_before_delete
  on public.event_files is
  'Prevents event file metadata deletion from orphaning its private Storage object.';

-- Fail the migration if a later grant accidentally leaves either protected
-- direct-delete path available to the authenticated role.
do $$
begin
  if has_table_privilege('authenticated', 'public.events', 'DELETE') then
    raise exception 'Security hardening failed: authenticated can still delete events directly.';
  end if;

  if has_table_privilege('authenticated', 'public.workspaces', 'DELETE') then
    raise exception 'Security hardening failed: authenticated can still delete workspaces directly.';
  end if;

  if has_table_privilege('authenticated', 'public.event_files', 'UPDATE') then
    raise exception 'Security hardening failed: authenticated can still update event file paths.';
  end if;
end;
$$;

commit;

-- Storage cleanup scheduling guidance (not executed by this migration):
--
-- Keep process-storage-cleanup private behind x-storage-cleanup-secret.
-- Schedule one POST every 5 minutes only after:
--   1. process-storage-cleanup is deployed and ACTIVE;
--   2. STORAGE_CLEANUP_WORKER_SECRET is configured for the Edge Function;
--   3. the same secret is stored in Supabase Vault for the scheduler;
--   4. one authorized manual invocation has succeeded.
--
-- Prefer the Supabase Dashboard Cron integration or a dedicated pg_cron
-- migration that reads the secret from Vault. Never embed the worker secret,
-- service-role key, or any other credential in migration source.
