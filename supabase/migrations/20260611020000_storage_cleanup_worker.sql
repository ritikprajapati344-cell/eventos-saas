-- EventOS Storage cleanup worker support.
-- Adds a concurrency-safe claim/retry lifecycle for server-side workers.

alter table public.storage_cleanup_jobs
  add column if not exists next_attempt_at timestamptz,
  add column if not exists processing_started_at timestamptz,
  add column if not exists completed_at timestamptz;

alter table public.storage_cleanup_jobs
  alter column next_attempt_at set default now();

update public.storage_cleanup_jobs
set next_attempt_at = created_at
where status = 'pending'
  and next_attempt_at is null;

create index if not exists storage_cleanup_jobs_ready_idx
  on public.storage_cleanup_jobs (status, next_attempt_at, created_at);

create index if not exists storage_cleanup_jobs_processing_idx
  on public.storage_cleanup_jobs (processing_started_at)
  where status = 'processing';

create or replace function public.claim_storage_cleanup_jobs(
  requested_batch_size integer default 25,
  requested_max_attempts integer default 5,
  stale_after_minutes integer default 10
)
returns table (
  id uuid,
  workspace_id uuid,
  source_event_id uuid,
  storage_bucket text,
  storage_path text,
  attempts integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  bounded_batch_size integer := greatest(1, least(coalesce(requested_batch_size, 25), 100));
  bounded_max_attempts integer := greatest(1, least(coalesce(requested_max_attempts, 5), 20));
  bounded_stale_minutes integer := greatest(1, least(coalesce(stale_after_minutes, 10), 1440));
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception using
      errcode = '42501',
      message = 'Storage cleanup worker access is required.';
  end if;

  update public.storage_cleanup_jobs job
  set
    status = 'failed',
    processing_started_at = null,
    next_attempt_at = null,
    completed_at = null,
    last_error = coalesce(job.last_error, 'Maximum cleanup attempts reached.')
  where job.attempts >= bounded_max_attempts
    and (
      (
        job.status = 'pending'
        and coalesce(job.next_attempt_at, job.created_at) <= now()
      )
      or (
        job.status = 'processing'
        and coalesce(job.processing_started_at, job.updated_at)
          <= now() - make_interval(mins => bounded_stale_minutes)
      )
    );

  return query
  with candidates as (
    select job.id
    from public.storage_cleanup_jobs job
    where job.attempts < bounded_max_attempts
      and (
        (
          job.status = 'pending'
          and coalesce(job.next_attempt_at, job.created_at) <= now()
        )
        or (
          job.status = 'processing'
          and coalesce(job.processing_started_at, job.updated_at)
            <= now() - make_interval(mins => bounded_stale_minutes)
        )
      )
    order by
      coalesce(job.next_attempt_at, job.processing_started_at, job.created_at),
      job.created_at
    for update skip locked
    limit bounded_batch_size
  ),
  claimed as (
    update public.storage_cleanup_jobs job
    set
      status = 'processing',
      attempts = job.attempts + 1,
      processing_started_at = now(),
      next_attempt_at = null,
      completed_at = null
    from candidates
    where job.id = candidates.id
    returning
      job.id,
      job.workspace_id,
      job.source_event_id,
      job.storage_bucket,
      job.storage_path,
      job.attempts
  )
  select
    claimed.id,
    claimed.workspace_id,
    claimed.source_event_id,
    claimed.storage_bucket,
    claimed.storage_path,
    claimed.attempts
  from claimed;
end;
$$;

create or replace function public.complete_storage_cleanup_job(
  target_job_id uuid,
  expected_attempt integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_status text;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception using
      errcode = '42501',
      message = 'Storage cleanup worker access is required.';
  end if;

  update public.storage_cleanup_jobs job
  set
    status = 'completed',
    processing_started_at = null,
    next_attempt_at = null,
    completed_at = now(),
    last_error = null
  where job.id = target_job_id
    and job.status = 'processing'
    and job.attempts = expected_attempt;

  if found then
    return true;
  end if;

  select job.status
  into current_status
  from public.storage_cleanup_jobs job
  where job.id = target_job_id;

  return current_status = 'completed';
end;
$$;

create or replace function public.fail_storage_cleanup_job(
  target_job_id uuid,
  failure_message text,
  expected_attempt integer,
  requested_max_attempts integer default 5
)
returns table (
  job_status text,
  next_attempt_at timestamptz,
  attempts integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  bounded_max_attempts integer := greatest(1, least(coalesce(requested_max_attempts, 5), 20));
  current_attempts integer;
  retry_delay interval;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception using
      errcode = '42501',
      message = 'Storage cleanup worker access is required.';
  end if;

  select job.attempts
  into current_attempts
  from public.storage_cleanup_jobs job
  where job.id = target_job_id
    and job.status = 'processing'
    and job.attempts = expected_attempt
  for update;

  if current_attempts is null then
    raise exception using
      errcode = 'P0002',
      message = 'Processing cleanup job was not found.';
  end if;

  retry_delay := case current_attempts
    when 1 then interval '1 minute'
    when 2 then interval '5 minutes'
    when 3 then interval '15 minutes'
    when 4 then interval '1 hour'
    else interval '6 hours'
  end;

  if current_attempts >= bounded_max_attempts then
    return query
    update public.storage_cleanup_jobs job
    set
      status = 'failed',
      processing_started_at = null,
      next_attempt_at = null,
      completed_at = null,
      last_error = left(coalesce(nullif(btrim(failure_message), ''), 'Storage cleanup failed.'), 1000)
    where job.id = target_job_id
    returning job.status, job.next_attempt_at, job.attempts;
  else
    return query
    update public.storage_cleanup_jobs job
    set
      status = 'pending',
      processing_started_at = null,
      next_attempt_at = now() + retry_delay,
      completed_at = null,
      last_error = left(coalesce(nullif(btrim(failure_message), ''), 'Storage cleanup failed.'), 1000)
    where job.id = target_job_id
    returning job.status, job.next_attempt_at, job.attempts;
  end if;
end;
$$;

revoke all on function public.claim_storage_cleanup_jobs(integer, integer, integer)
  from public, anon, authenticated;
revoke all on function public.complete_storage_cleanup_job(uuid, integer)
  from public, anon, authenticated;
revoke all on function public.fail_storage_cleanup_job(uuid, text, integer, integer)
  from public, anon, authenticated;

grant execute on function public.claim_storage_cleanup_jobs(integer, integer, integer)
  to service_role;
grant execute on function public.complete_storage_cleanup_job(uuid, integer)
  to service_role;
grant execute on function public.fail_storage_cleanup_job(uuid, text, integer, integer)
  to service_role;

comment on function public.claim_storage_cleanup_jobs(integer, integer, integer) is
  'Claims ready or stale Storage cleanup jobs using row locks and SKIP LOCKED.';

comment on function public.complete_storage_cleanup_job(uuid, integer) is
  'Marks a claimed Storage cleanup job completed after its object is removed.';

comment on function public.fail_storage_cleanup_job(uuid, text, integer, integer) is
  'Returns a claimed Storage cleanup job to the retry queue or marks it failed after the attempt limit.';
