-- EventOS safe event deletion foundation.
-- Database records are deleted transactionally while Storage paths are queued
-- for a future server-side cleanup worker.

create table if not exists public.storage_cleanup_jobs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null
    references public.workspaces(id)
    on delete restrict,
  source_event_id uuid not null,
  storage_bucket text not null,
  storage_path text not null,
  original_file_name text,
  status text not null default 'pending',
  attempts integer not null default 0,
  last_error text,
  requested_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint storage_cleanup_jobs_bucket_not_blank
    check (btrim(storage_bucket) <> ''),
  constraint storage_cleanup_jobs_path_not_blank
    check (btrim(storage_path) <> ''),
  constraint storage_cleanup_jobs_status_check
    check (status in ('pending', 'processing', 'completed', 'failed')),
  constraint storage_cleanup_jobs_attempts_nonnegative
    check (attempts >= 0),
  constraint storage_cleanup_jobs_object_unique
    unique (storage_bucket, storage_path)
);

create index if not exists storage_cleanup_jobs_status_created_idx
  on public.storage_cleanup_jobs (status, created_at);

create index if not exists storage_cleanup_jobs_workspace_event_idx
  on public.storage_cleanup_jobs (workspace_id, source_event_id);

drop trigger if exists set_storage_cleanup_jobs_updated_at
  on public.storage_cleanup_jobs;
create trigger set_storage_cleanup_jobs_updated_at
before update on public.storage_cleanup_jobs
for each row
execute function private.set_updated_at();

alter table public.storage_cleanup_jobs enable row level security;

revoke all on public.storage_cleanup_jobs from anon, authenticated;
grant all on public.storage_cleanup_jobs to service_role;

create or replace function public.delete_event_safely(target_event_id uuid)
returns table (
  deleted_event_id uuid,
  queued_file_count integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  event_workspace_id uuid;
begin
  if current_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'Authentication is required.';
  end if;

  select event_record.workspace_id
  into event_workspace_id
  from public.events event_record
  where event_record.id = target_event_id
  for update;

  if event_workspace_id is null
    or not private.is_workspace_member(event_workspace_id) then
    raise exception using
      errcode = '42501',
      message = 'Event not found or access denied.';
  end if;

  select count(*)::integer
  into queued_file_count
  from public.event_files file_record
  where file_record.workspace_id = event_workspace_id
    and file_record.event_id = target_event_id
    and file_record.storage_path is not null
    and btrim(file_record.storage_path) <> '';

  insert into public.storage_cleanup_jobs (
    workspace_id,
    source_event_id,
    storage_bucket,
    storage_path,
    original_file_name,
    requested_by
  )
  select
    file_record.workspace_id,
    file_record.event_id,
    file_record.storage_bucket,
    file_record.storage_path,
    file_record.file_name,
    current_user_id
  from public.event_files file_record
  where file_record.workspace_id = event_workspace_id
    and file_record.event_id = target_event_id
    and file_record.storage_path is not null
    and btrim(file_record.storage_path) <> ''
  on conflict (storage_bucket, storage_path) do nothing;

  delete from public.events event_record
  where event_record.workspace_id = event_workspace_id
    and event_record.id = target_event_id;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'Event deletion did not complete.';
  end if;

  deleted_event_id := target_event_id;
  return next;
end;
$$;

revoke all on function public.delete_event_safely(uuid) from public;
grant execute on function public.delete_event_safely(uuid)
  to authenticated, service_role;

comment on table public.storage_cleanup_jobs is
  'Durable queue of private Storage objects awaiting server-side deletion after their owning event was deleted.';

comment on function public.delete_event_safely(uuid) is
  'Atomically queues event file paths and deletes an authorized workspace event. Physical Storage cleanup is deferred.';
