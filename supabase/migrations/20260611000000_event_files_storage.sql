-- EventOS event file storage foundation.
-- This migration creates a private bucket and tenant-scoped object policies.

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'event-files',
  'event-files',
  false,
  10485760,
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]::text[]
)
on conflict (id) do update
set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function private.can_access_event_file_object(object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  path_parts text[];
  path_workspace_id uuid;
  path_event_id uuid;
  path_file_id uuid;
begin
  if object_name is null then
    return false;
  end if;

  path_parts := string_to_array(object_name, '/');

  if coalesce(array_length(path_parts, 1), 0) <> 4
    or btrim(path_parts[4]) = '' then
    return false;
  end if;

  begin
    path_workspace_id := path_parts[1]::uuid;
    path_event_id := path_parts[2]::uuid;
    path_file_id := path_parts[3]::uuid;
  exception
    when invalid_text_representation then
      return false;
  end;

  if path_file_id is null then
    return false;
  end if;

  return
    private.is_workspace_member(path_workspace_id)
    and exists (
      select 1
      from public.events event_record
      where event_record.workspace_id = path_workspace_id
        and event_record.id = path_event_id
    );
end;
$$;

revoke all on function private.can_access_event_file_object(text) from public;
grant execute on function private.can_access_event_file_object(text)
  to authenticated, service_role;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Event files workspace members can read'
  ) then
    create policy "Event files workspace members can read"
    on storage.objects
    for select
    to authenticated
    using (
      bucket_id = 'event-files'
      and private.can_access_event_file_object(name)
    );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Event files workspace members can upload'
  ) then
    create policy "Event files workspace members can upload"
    on storage.objects
    for insert
    to authenticated
    with check (
      bucket_id = 'event-files'
      and private.can_access_event_file_object(name)
    );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Event files workspace members can delete'
  ) then
    create policy "Event files workspace members can delete"
    on storage.objects
    for delete
    to authenticated
    using (
      bucket_id = 'event-files'
      and private.can_access_event_file_object(name)
    );
  end if;
end;
$$;
