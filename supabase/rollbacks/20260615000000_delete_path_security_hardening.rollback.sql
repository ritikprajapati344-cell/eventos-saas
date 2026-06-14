-- ROLLBACK ONLY: EventOS deletion-path security hardening.
--
-- WARNING:
-- Applying this rollback restores the direct-delete paths that the forward
-- migration intentionally closes. Use only to recover from a confirmed
-- compatibility problem, and restore hardening immediately afterward.

begin;

drop trigger if exists enqueue_event_file_cleanup_before_delete
  on public.event_files;
drop function if exists private.enqueue_event_file_cleanup_before_delete();

drop policy if exists "Workspace members can view events" on public.events;
drop policy if exists "Workspace members can create events" on public.events;
drop policy if exists "Workspace members can update events" on public.events;
drop policy if exists "Workspace members can manage events" on public.events;
create policy "Workspace members can manage events"
on public.events
for all
to authenticated
using (private.is_workspace_member(workspace_id))
with check (private.is_workspace_member(workspace_id));

grant delete on table public.events to authenticated;

drop policy if exists "Owners can delete workspaces" on public.workspaces;
create policy "Owners can delete workspaces"
on public.workspaces
for delete
to authenticated
using (private.is_workspace_owner(id));

grant delete on table public.workspaces to authenticated;

drop policy if exists "Workspace members can view event files"
  on public.event_files;
drop policy if exists "Workspace members can create event files"
  on public.event_files;
drop policy if exists "Workspace members can delete event files"
  on public.event_files;
drop policy if exists "Workspace members can manage event files"
  on public.event_files;
create policy "Workspace members can manage event files"
on public.event_files
for all
to authenticated
using (private.is_workspace_member(workspace_id))
with check (private.is_workspace_member(workspace_id));

grant update on table public.event_files to authenticated;

commit;
