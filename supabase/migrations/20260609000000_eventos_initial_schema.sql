begin;

create extension if not exists pgcrypto with schema extensions;
create schema if not exists private;

revoke all on schema private from public;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  legacy_id text,
  name text not null,
  organizer_name text not null default '',
  contact_phone text not null default '',
  contact_email text not null default '',
  logo_path text,
  region text not null default 'India',
  default_currency varchar(3) not null default 'INR',
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workspaces_name_not_blank check (btrim(name) <> ''),
  constraint workspaces_currency_format check (default_currency ~ '^[A-Z]{3}$')
);

create table if not exists public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workspace_members_unique_user unique (workspace_id, user_id),
  constraint workspace_members_role_check check (role in ('owner', 'admin', 'member'))
);

create table if not exists public.workspace_settings (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null unique references public.workspaces(id) on delete cascade,
  accent_color text not null default '#3B82F6',
  compact_dashboard boolean not null default false,
  dark_theme boolean not null default true,
  daily_digest boolean not null default false,
  export_buttons boolean not null default true,
  local_storage_mode boolean not null default true,
  payment_reminders boolean not null default true,
  profit_updates boolean not null default true,
  sponsor_follow_ups boolean not null default true,
  preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workspace_settings_preferences_object check (jsonb_typeof(preferences) = 'object')
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  legacy_id text,
  name text not null,
  venue text not null,
  city text not null,
  event_date date not null,
  event_time time without time zone not null,
  event_type text not null,
  main_artist text not null default '',
  capacity integer not null default 0,
  status text not null default 'Planning',
  owner text not null default 'Event Ops',
  expected_revenue numeric(14,2) not null default 0,
  expected_expense numeric(14,2) not null default 0,
  archived boolean not null default false,
  notes text not null default '',
  legacy_tickets_sold integer not null default 0,
  legacy_ticket_price numeric(14,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint events_workspace_id_id_unique unique (workspace_id, id),
  constraint events_name_not_blank check (btrim(name) <> ''),
  constraint events_venue_not_blank check (btrim(venue) <> ''),
  constraint events_city_not_blank check (btrim(city) <> ''),
  constraint events_capacity_nonnegative check (capacity >= 0),
  constraint events_expected_revenue_nonnegative check (expected_revenue >= 0),
  constraint events_expected_expense_nonnegative check (expected_expense >= 0),
  constraint events_legacy_tickets_sold_nonnegative check (legacy_tickets_sold >= 0),
  constraint events_legacy_ticket_price_nonnegative check (legacy_ticket_price >= 0),
  constraint events_legacy_sales_within_capacity check (legacy_tickets_sold <= capacity),
  constraint events_type_check check (
    event_type in ('Comedy Show', 'Concert', 'Corporate Event', 'College Fest', 'Conference', 'Custom')
  ),
  constraint events_status_check check (
    status in ('Planning', 'Upcoming', 'Ongoing', 'Completed', 'Cancelled')
  )
);

create table if not exists public.sponsors (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  event_id uuid,
  legacy_id text,
  company_name text not null,
  contact_person text not null,
  phone text not null default '',
  email text not null default '',
  deal_amount numeric(14,2) not null default 0,
  amount_received numeric(14,2) not null default 0,
  stage text not null default 'Lead',
  notes text not null default '',
  next_follow_up date,
  agreement_uploaded boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sponsors_event_workspace_fk
    foreign key (workspace_id, event_id)
    references public.events(workspace_id, id)
    on delete cascade,
  constraint sponsors_company_not_blank check (btrim(company_name) <> ''),
  constraint sponsors_contact_not_blank check (btrim(contact_person) <> ''),
  constraint sponsors_deal_amount_nonnegative check (deal_amount >= 0),
  constraint sponsors_amount_received_nonnegative check (amount_received >= 0),
  constraint sponsors_amount_received_within_deal check (amount_received <= deal_amount),
  constraint sponsors_stage_check check (
    stage in ('Lead', 'Contacted', 'Proposal Sent', 'Negotiation', 'Closed Won', 'Closed Lost')
  )
);

create table if not exists public.artists (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  event_id uuid,
  legacy_id text,
  name text not null,
  profile text not null default '',
  performance_slot text not null default 'TBC',
  performance_fee numeric(14,2) not null default 0,
  travel_cost numeric(14,2) not null default 0,
  hotel_cost numeric(14,2) not null default 0,
  green_room_cost numeric(14,2) not null default 0,
  paid_amount numeric(14,2) not null default 0,
  technical_rider_status text not null default 'Pending',
  contract_status text not null default 'Draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  total_cost numeric(14,2) generated always as (
    performance_fee + travel_cost + hotel_cost + green_room_cost
  ) stored,
  remaining_amount numeric(14,2) generated always as (
    greatest(performance_fee + travel_cost + hotel_cost + green_room_cost - paid_amount, 0)
  ) stored,
  payment_status text generated always as (
    case
      when paid_amount <= 0 then 'Pending'
      when paid_amount >= performance_fee + travel_cost + hotel_cost + green_room_cost then 'Paid'
      else 'Partial'
    end
  ) stored,
  constraint artists_event_workspace_fk
    foreign key (workspace_id, event_id)
    references public.events(workspace_id, id)
    on delete cascade,
  constraint artists_name_not_blank check (btrim(name) <> ''),
  constraint artists_performance_fee_nonnegative check (performance_fee >= 0),
  constraint artists_travel_cost_nonnegative check (travel_cost >= 0),
  constraint artists_hotel_cost_nonnegative check (hotel_cost >= 0),
  constraint artists_green_room_cost_nonnegative check (green_room_cost >= 0),
  constraint artists_paid_amount_nonnegative check (paid_amount >= 0),
  constraint artists_paid_amount_within_total check (
    paid_amount <= performance_fee + travel_cost + hotel_cost + green_room_cost
  ),
  constraint artists_rider_status_check check (
    technical_rider_status in ('Pending', 'Received', 'Approved')
  ),
  constraint artists_contract_status_check check (
    contract_status in ('Draft', 'Sent', 'Signed', 'On Hold', 'Cancelled')
  )
);

create table if not exists public.vendors (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  event_id uuid,
  legacy_id text,
  name text not null,
  category text not null,
  owner text not null default 'Ops',
  amount numeric(14,2) not null default 0,
  paid_amount numeric(14,2) not null default 0,
  due_date date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  remaining_amount numeric(14,2) generated always as (
    greatest(amount - paid_amount, 0)
  ) stored,
  payment_status text generated always as (
    case
      when paid_amount <= 0 then 'Pending'
      when paid_amount >= amount then 'Paid'
      else 'Partial'
    end
  ) stored,
  constraint vendors_workspace_id_id_unique unique (workspace_id, id),
  constraint vendors_event_workspace_fk
    foreign key (workspace_id, event_id)
    references public.events(workspace_id, id)
    on delete cascade,
  constraint vendors_name_not_blank check (btrim(name) <> ''),
  constraint vendors_category_not_blank check (btrim(category) <> ''),
  constraint vendors_amount_nonnegative check (amount >= 0),
  constraint vendors_paid_amount_nonnegative check (paid_amount >= 0),
  constraint vendors_paid_amount_within_total check (paid_amount <= amount)
);

create table if not exists public.ticket_categories (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  event_id uuid not null,
  legacy_id text,
  name text not null,
  price numeric(14,2) not null default 0,
  inventory integer not null default 0,
  sold integer not null default 0,
  checked_in integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  available integer generated always as (greatest(inventory - sold, 0)) stored,
  revenue numeric(14,2) generated always as (sold * price) stored,
  status text generated always as (
    case
      when sold <= 0 then 'Not Started'
      when inventory - sold <= 0 then 'Sold Out'
      when inventory > 0 and (inventory - sold)::numeric / inventory <= 0.20 then 'Low Stock'
      else 'Active'
    end
  ) stored,
  constraint ticket_categories_event_workspace_fk
    foreign key (workspace_id, event_id)
    references public.events(workspace_id, id)
    on delete cascade,
  constraint ticket_categories_name_not_blank check (btrim(name) <> ''),
  constraint ticket_categories_price_nonnegative check (price >= 0),
  constraint ticket_categories_inventory_nonnegative check (inventory >= 0),
  constraint ticket_categories_sold_nonnegative check (sold >= 0),
  constraint ticket_categories_checked_in_nonnegative check (checked_in >= 0),
  constraint ticket_categories_sold_within_inventory check (sold <= inventory),
  constraint ticket_categories_checked_in_within_sold check (checked_in <= sold)
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  event_id uuid,
  vendor_id uuid,
  legacy_id text,
  category text not null,
  description text not null,
  amount numeric(14,2) not null,
  expense_date date not null,
  payment_status text not null default 'Pending',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint expenses_event_workspace_fk
    foreign key (workspace_id, event_id)
    references public.events(workspace_id, id)
    on delete cascade,
  constraint expenses_vendor_workspace_fk
    foreign key (workspace_id, vendor_id)
    references public.vendors(workspace_id, id)
    on delete set null (vendor_id),
  constraint expenses_category_not_blank check (btrim(category) <> ''),
  constraint expenses_description_not_blank check (btrim(description) <> ''),
  constraint expenses_amount_positive check (amount > 0),
  constraint expenses_payment_status_check check (
    payment_status in ('Paid', 'Partial', 'Pending')
  )
);

create table if not exists public.finance_transactions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  event_id uuid,
  legacy_id text,
  transaction_date date not null,
  transaction_type text not null,
  source text not null,
  amount numeric(14,2) not null,
  payment_mode text not null,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint finance_transactions_event_workspace_fk
    foreign key (workspace_id, event_id)
    references public.events(workspace_id, id)
    on delete cascade,
  constraint finance_transactions_amount_nonnegative check (amount >= 0),
  constraint finance_transactions_type_check check (
    transaction_type in ('Income', 'Expense')
  ),
  constraint finance_transactions_source_check check (
    source in ('Ticket', 'Sponsor', 'Vendor', 'Artist', 'Other')
  ),
  constraint finance_transactions_payment_mode_check check (
    payment_mode in ('Cash', 'UPI', 'Bank Transfer', 'Cheque', 'Other')
  )
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  event_id uuid not null,
  legacy_id text,
  title text not null,
  owner text not null default 'Ops',
  due_date date not null,
  priority text not null default 'Medium',
  status text not null default 'Open',
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tasks_event_workspace_fk
    foreign key (workspace_id, event_id)
    references public.events(workspace_id, id)
    on delete cascade,
  constraint tasks_title_not_blank check (btrim(title) <> ''),
  constraint tasks_priority_check check (priority in ('High', 'Medium', 'Low')),
  constraint tasks_status_check check (status in ('Open', 'In Progress', 'Blocked', 'Done')),
  constraint tasks_completed_state_check check (
    (status = 'Done' and completed_at is not null)
    or (status <> 'Done')
  )
);

create table if not exists public.event_files (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  event_id uuid not null,
  legacy_id text,
  file_name text not null,
  file_type text not null,
  storage_bucket text not null default 'event-files',
  storage_path text,
  file_size bigint,
  uploaded_at timestamptz not null default now(),
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_files_event_workspace_fk
    foreign key (workspace_id, event_id)
    references public.events(workspace_id, id)
    on delete cascade,
  constraint event_files_name_not_blank check (btrim(file_name) <> ''),
  constraint event_files_type_not_blank check (btrim(file_type) <> ''),
  constraint event_files_size_nonnegative check (file_size is null or file_size >= 0)
);

create table if not exists public.event_timeline_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  event_id uuid not null,
  legacy_id text,
  title text not null,
  description text not null default '',
  timeline_date date not null,
  status text not null default 'Upcoming',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_timeline_event_workspace_fk
    foreign key (workspace_id, event_id)
    references public.events(workspace_id, id)
    on delete cascade,
  constraint event_timeline_title_not_blank check (btrim(title) <> ''),
  constraint event_timeline_status_check check (status in ('Done', 'Active', 'Upcoming'))
);

create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  event_id uuid,
  legacy_id text,
  entity_type text not null,
  entity_id uuid,
  message text not null,
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint activities_event_workspace_fk
    foreign key (workspace_id, event_id)
    references public.events(workspace_id, id)
    on delete set null (event_id),
  constraint activities_entity_type_check check (
    entity_type in ('Event', 'Sponsor', 'Artist', 'Vendor', 'Finance', 'Ticketing', 'Task', 'File')
  ),
  constraint activities_message_not_blank check (btrim(message) <> ''),
  constraint activities_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create table if not exists public.revenue_forecasts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  event_id uuid,
  legacy_id text,
  period_month date not null,
  forecast_amount numeric(14,2) not null default 0,
  actual_amount numeric(14,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint revenue_forecasts_event_workspace_fk
    foreign key (workspace_id, event_id)
    references public.events(workspace_id, id)
    on delete cascade,
  constraint revenue_forecasts_month_start check (
    extract(day from period_month) = 1
  ),
  constraint revenue_forecasts_forecast_nonnegative check (forecast_amount >= 0),
  constraint revenue_forecasts_actual_nonnegative check (actual_amount >= 0)
);

create unique index if not exists workspaces_legacy_id_uidx
  on public.workspaces (legacy_id)
  where legacy_id is not null;

create index if not exists workspace_members_user_idx
  on public.workspace_members (user_id, workspace_id);

create index if not exists events_workspace_date_idx
  on public.events (workspace_id, event_date);
create index if not exists events_workspace_status_idx
  on public.events (workspace_id, status, archived);
create unique index if not exists events_workspace_legacy_id_uidx
  on public.events (workspace_id, legacy_id)
  where legacy_id is not null;

create index if not exists sponsors_workspace_stage_idx
  on public.sponsors (workspace_id, stage);
create index if not exists sponsors_event_idx
  on public.sponsors (event_id);
create index if not exists sponsors_follow_up_idx
  on public.sponsors (workspace_id, next_follow_up)
  where next_follow_up is not null;
create unique index if not exists sponsors_workspace_legacy_id_uidx
  on public.sponsors (workspace_id, legacy_id)
  where legacy_id is not null;

create index if not exists artists_event_contract_idx
  on public.artists (event_id, contract_status);
create index if not exists artists_workspace_name_idx
  on public.artists (workspace_id, lower(name));
create unique index if not exists artists_workspace_legacy_id_uidx
  on public.artists (workspace_id, legacy_id)
  where legacy_id is not null;

create index if not exists vendors_event_due_date_idx
  on public.vendors (event_id, due_date);
create index if not exists vendors_workspace_category_idx
  on public.vendors (workspace_id, category);
create unique index if not exists vendors_workspace_legacy_id_uidx
  on public.vendors (workspace_id, legacy_id)
  where legacy_id is not null;

create unique index if not exists ticket_categories_event_name_uidx
  on public.ticket_categories (event_id, lower(name));
create index if not exists ticket_categories_workspace_idx
  on public.ticket_categories (workspace_id, event_id);
create unique index if not exists ticket_categories_workspace_legacy_id_uidx
  on public.ticket_categories (workspace_id, legacy_id)
  where legacy_id is not null;

create index if not exists expenses_workspace_date_category_idx
  on public.expenses (workspace_id, expense_date, category);
create index if not exists expenses_event_idx
  on public.expenses (event_id);
create index if not exists expenses_vendor_idx
  on public.expenses (vendor_id)
  where vendor_id is not null;
create unique index if not exists expenses_workspace_legacy_id_uidx
  on public.expenses (workspace_id, legacy_id)
  where legacy_id is not null;

create index if not exists finance_transactions_workspace_date_type_idx
  on public.finance_transactions (workspace_id, transaction_date, transaction_type);
create index if not exists finance_transactions_event_idx
  on public.finance_transactions (event_id);
create unique index if not exists finance_transactions_workspace_legacy_id_uidx
  on public.finance_transactions (workspace_id, legacy_id)
  where legacy_id is not null;

create index if not exists tasks_event_due_status_idx
  on public.tasks (event_id, due_date, status);
create index if not exists tasks_workspace_status_idx
  on public.tasks (workspace_id, status);
create unique index if not exists tasks_workspace_legacy_id_uidx
  on public.tasks (workspace_id, legacy_id)
  where legacy_id is not null;

create index if not exists event_files_event_uploaded_idx
  on public.event_files (event_id, uploaded_at desc);
create unique index if not exists event_files_workspace_legacy_id_uidx
  on public.event_files (workspace_id, legacy_id)
  where legacy_id is not null;

create index if not exists event_timeline_event_date_idx
  on public.event_timeline_items (event_id, timeline_date);
create unique index if not exists event_timeline_workspace_legacy_id_uidx
  on public.event_timeline_items (workspace_id, legacy_id)
  where legacy_id is not null;

create index if not exists activities_workspace_occurred_idx
  on public.activities (workspace_id, occurred_at desc);
create index if not exists activities_event_occurred_idx
  on public.activities (event_id, occurred_at desc)
  where event_id is not null;
create unique index if not exists activities_workspace_legacy_id_uidx
  on public.activities (workspace_id, legacy_id)
  where legacy_id is not null;

create unique index if not exists revenue_forecasts_scope_month_uidx
  on public.revenue_forecasts (
    workspace_id,
    coalesce(event_id, '00000000-0000-0000-0000-000000000000'::uuid),
    period_month
  );
create unique index if not exists revenue_forecasts_workspace_legacy_id_uidx
  on public.revenue_forecasts (workspace_id, legacy_id)
  where legacy_id is not null;

create or replace function private.is_workspace_member(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select auth.uid()) is not null
    and (
      exists (
        select 1
        from public.workspaces w
        where w.id = target_workspace_id
          and w.created_by = (select auth.uid())
      )
      or exists (
        select 1
        from public.workspace_members wm
        where wm.workspace_id = target_workspace_id
          and wm.user_id = (select auth.uid())
      )
    );
$$;

create or replace function private.can_manage_workspace(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select auth.uid()) is not null
    and (
      exists (
        select 1
        from public.workspaces w
        where w.id = target_workspace_id
          and w.created_by = (select auth.uid())
      )
      or exists (
        select 1
        from public.workspace_members wm
        where wm.workspace_id = target_workspace_id
          and wm.user_id = (select auth.uid())
          and wm.role in ('owner', 'admin')
      )
    );
$$;

create or replace function private.is_workspace_owner(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select auth.uid()) is not null
    and (
      exists (
        select 1
        from public.workspaces w
        where w.id = target_workspace_id
          and w.created_by = (select auth.uid())
      )
      or exists (
        select 1
        from public.workspace_members wm
        where wm.workspace_id = target_workspace_id
          and wm.user_id = (select auth.uid())
          and wm.role = 'owner'
      )
    );
$$;

revoke all on function private.is_workspace_member(uuid) from public;
revoke all on function private.can_manage_workspace(uuid) from public;
revoke all on function private.is_workspace_owner(uuid) from public;
revoke all on function private.set_updated_at() from public;
grant usage on schema private to authenticated, service_role;
grant execute on function private.is_workspace_member(uuid) to authenticated;
grant execute on function private.can_manage_workspace(uuid) to authenticated;
grant execute on function private.is_workspace_owner(uuid) to authenticated;
grant execute on function private.set_updated_at() to authenticated, service_role;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'workspaces',
    'workspace_members',
    'workspace_settings',
    'events',
    'sponsors',
    'artists',
    'vendors',
    'ticket_categories',
    'expenses',
    'finance_transactions',
    'tasks',
    'event_files',
    'event_timeline_items',
    'activities',
    'revenue_forecasts'
  ]
  loop
    execute format('drop trigger if exists set_%I_updated_at on public.%I', table_name, table_name);
    execute format(
      'create trigger set_%I_updated_at before update on public.%I for each row execute function private.set_updated_at()',
      table_name,
      table_name
    );
  end loop;
end;
$$;

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.workspace_settings enable row level security;
alter table public.events enable row level security;
alter table public.sponsors enable row level security;
alter table public.artists enable row level security;
alter table public.vendors enable row level security;
alter table public.ticket_categories enable row level security;
alter table public.expenses enable row level security;
alter table public.finance_transactions enable row level security;
alter table public.tasks enable row level security;
alter table public.event_files enable row level security;
alter table public.event_timeline_items enable row level security;
alter table public.activities enable row level security;
alter table public.revenue_forecasts enable row level security;

drop policy if exists "Members can view workspaces" on public.workspaces;
create policy "Members can view workspaces"
on public.workspaces
for select
to authenticated
using (private.is_workspace_member(id));

drop policy if exists "Authenticated users can create workspaces" on public.workspaces;
create policy "Authenticated users can create workspaces"
on public.workspaces
for insert
to authenticated
with check (
  (select auth.uid()) is not null
  and created_by = (select auth.uid())
);

drop policy if exists "Managers can update workspaces" on public.workspaces;
create policy "Managers can update workspaces"
on public.workspaces
for update
to authenticated
using (private.can_manage_workspace(id))
with check (private.can_manage_workspace(id));

drop policy if exists "Owners can delete workspaces" on public.workspaces;
create policy "Owners can delete workspaces"
on public.workspaces
for delete
to authenticated
using (private.is_workspace_owner(id));

drop policy if exists "Members can view workspace membership" on public.workspace_members;
create policy "Members can view workspace membership"
on public.workspace_members
for select
to authenticated
using (private.is_workspace_member(workspace_id));

drop policy if exists "Managers can add workspace members" on public.workspace_members;
create policy "Managers can add workspace members"
on public.workspace_members
for insert
to authenticated
with check (private.can_manage_workspace(workspace_id));

drop policy if exists "Managers can update workspace members" on public.workspace_members;
create policy "Managers can update workspace members"
on public.workspace_members
for update
to authenticated
using (private.can_manage_workspace(workspace_id))
with check (private.can_manage_workspace(workspace_id));

drop policy if exists "Managers can remove workspace members" on public.workspace_members;
create policy "Managers can remove workspace members"
on public.workspace_members
for delete
to authenticated
using (private.can_manage_workspace(workspace_id));

drop policy if exists "Members can view workspace settings" on public.workspace_settings;
create policy "Members can view workspace settings"
on public.workspace_settings
for select
to authenticated
using (private.is_workspace_member(workspace_id));

drop policy if exists "Managers can insert workspace settings" on public.workspace_settings;
create policy "Managers can insert workspace settings"
on public.workspace_settings
for insert
to authenticated
with check (private.can_manage_workspace(workspace_id));

drop policy if exists "Managers can update workspace settings" on public.workspace_settings;
create policy "Managers can update workspace settings"
on public.workspace_settings
for update
to authenticated
using (private.can_manage_workspace(workspace_id))
with check (private.can_manage_workspace(workspace_id));

drop policy if exists "Managers can delete workspace settings" on public.workspace_settings;
create policy "Managers can delete workspace settings"
on public.workspace_settings
for delete
to authenticated
using (private.can_manage_workspace(workspace_id));

do $$
declare
  table_name text;
  policy_name text;
begin
  foreach table_name in array array[
    'events',
    'sponsors',
    'artists',
    'vendors',
    'ticket_categories',
    'expenses',
    'finance_transactions',
    'tasks',
    'event_files',
    'event_timeline_items',
    'activities',
    'revenue_forecasts'
  ]
  loop
    policy_name := format('Workspace members can manage %s', replace(table_name, '_', ' '));
    execute format('drop policy if exists %I on public.%I', policy_name, table_name);
    execute format(
      'create policy %I on public.%I for all to authenticated using (private.is_workspace_member(workspace_id)) with check (private.is_workspace_member(workspace_id))',
      policy_name,
      table_name
    );
  end loop;
end;
$$;

create or replace view public.event_financial_summary
with (security_invoker = true)
as
with ticket_totals as (
  select
    tc.event_id,
    sum(tc.inventory * tc.price)::numeric(14,2) as expected_ticket_revenue,
    sum(tc.revenue)::numeric(14,2) as ticket_revenue,
    sum(tc.inventory)::bigint as ticket_inventory,
    sum(tc.sold)::bigint as tickets_sold,
    sum(tc.checked_in)::bigint as tickets_checked_in
  from public.ticket_categories tc
  group by tc.event_id
),
sponsor_totals as (
  select
    s.event_id,
    sum(s.deal_amount) filter (where s.stage <> 'Closed Lost')::numeric(14,2) as expected_sponsor_revenue,
    sum(s.amount_received)::numeric(14,2) as sponsor_revenue,
    sum(greatest(s.deal_amount - s.amount_received, 0))::numeric(14,2) as sponsor_receivable
  from public.sponsors s
  where s.event_id is not null
  group by s.event_id
),
artist_totals as (
  select
    a.event_id,
    sum(a.total_cost)::numeric(14,2) as artist_committed_cost,
    sum(a.paid_amount)::numeric(14,2) as artist_paid,
    sum(a.remaining_amount)::numeric(14,2) as artist_payable
  from public.artists a
  where a.event_id is not null
  group by a.event_id
),
vendor_totals as (
  select
    v.event_id,
    sum(v.amount)::numeric(14,2) as vendor_committed_cost,
    sum(v.paid_amount)::numeric(14,2) as vendor_paid,
    sum(v.remaining_amount)::numeric(14,2) as vendor_payable
  from public.vendors v
  where v.event_id is not null
  group by v.event_id
),
expense_totals as (
  select
    x.event_id,
    sum(x.amount)::numeric(14,2) as recorded_expenses
  from public.expenses x
  where x.event_id is not null
  group by x.event_id
),
ledger_totals as (
  select
    ft.event_id,
    sum(ft.amount) filter (where ft.transaction_type = 'Income')::numeric(14,2) as ledger_income,
    sum(ft.amount) filter (where ft.transaction_type = 'Expense')::numeric(14,2) as ledger_expense
  from public.finance_transactions ft
  where ft.event_id is not null
  group by ft.event_id
)
select
  e.id as event_id,
  e.workspace_id,
  e.name as event_name,
  e.expected_revenue as planned_revenue,
  e.expected_expense as planned_expense,
  coalesce(tt.expected_ticket_revenue, 0)::numeric(14,2) as expected_ticket_revenue,
  coalesce(st.expected_sponsor_revenue, 0)::numeric(14,2) as expected_sponsor_revenue,
  coalesce(tt.ticket_revenue, 0)::numeric(14,2) as ticket_revenue,
  coalesce(st.sponsor_revenue, 0)::numeric(14,2) as sponsor_revenue,
  coalesce(lt.ledger_income, 0)::numeric(14,2) as ledger_income,
  (
    coalesce(tt.ticket_revenue, 0)
    + coalesce(st.sponsor_revenue, 0)
    + coalesce(lt.ledger_income, 0)
  )::numeric(14,2) as actual_revenue,
  coalesce(at.artist_committed_cost, 0)::numeric(14,2) as artist_committed_cost,
  coalesce(vt.vendor_committed_cost, 0)::numeric(14,2) as vendor_committed_cost,
  coalesce(xt.recorded_expenses, 0)::numeric(14,2) as recorded_expenses,
  coalesce(at.artist_paid, 0)::numeric(14,2) as artist_paid,
  coalesce(vt.vendor_paid, 0)::numeric(14,2) as vendor_paid,
  coalesce(lt.ledger_expense, 0)::numeric(14,2) as ledger_expense,
  (
    coalesce(xt.recorded_expenses, 0)
    + coalesce(at.artist_paid, 0)
    + coalesce(vt.vendor_paid, 0)
    + coalesce(lt.ledger_expense, 0)
  )::numeric(14,2) as actual_expense,
  (
    e.expected_revenue - e.expected_expense
  )::numeric(14,2) as expected_profit,
  (
    coalesce(tt.ticket_revenue, 0)
    + coalesce(st.sponsor_revenue, 0)
    + coalesce(lt.ledger_income, 0)
    - coalesce(xt.recorded_expenses, 0)
    - coalesce(at.artist_paid, 0)
    - coalesce(vt.vendor_paid, 0)
    - coalesce(lt.ledger_expense, 0)
  )::numeric(14,2) as actual_profit,
  case
    when (
      coalesce(tt.ticket_revenue, 0)
      + coalesce(st.sponsor_revenue, 0)
      + coalesce(lt.ledger_income, 0)
    ) > 0
    then round(
      (
        coalesce(tt.ticket_revenue, 0)
        + coalesce(st.sponsor_revenue, 0)
        + coalesce(lt.ledger_income, 0)
        - coalesce(xt.recorded_expenses, 0)
        - coalesce(at.artist_paid, 0)
        - coalesce(vt.vendor_paid, 0)
        - coalesce(lt.ledger_expense, 0)
      )
      / (
        coalesce(tt.ticket_revenue, 0)
        + coalesce(st.sponsor_revenue, 0)
        + coalesce(lt.ledger_income, 0)
      ) * 100,
      2
    )
    else 0
  end as profit_margin_percent,
  coalesce(st.sponsor_receivable, 0)::numeric(14,2) as sponsor_receivable,
  coalesce(at.artist_payable, 0)::numeric(14,2) as artist_payable,
  coalesce(vt.vendor_payable, 0)::numeric(14,2) as vendor_payable,
  coalesce(tt.ticket_inventory, 0) as ticket_inventory,
  coalesce(tt.tickets_sold, 0) as tickets_sold,
  coalesce(tt.tickets_checked_in, 0) as tickets_checked_in
from public.events e
left join ticket_totals tt on tt.event_id = e.id
left join sponsor_totals st on st.event_id = e.id
left join artist_totals at on at.event_id = e.id
left join vendor_totals vt on vt.event_id = e.id
left join expense_totals xt on xt.event_id = e.id
left join ledger_totals lt on lt.event_id = e.id;

revoke all on
  public.workspaces,
  public.workspace_members,
  public.workspace_settings,
  public.events,
  public.sponsors,
  public.artists,
  public.vendors,
  public.ticket_categories,
  public.expenses,
  public.finance_transactions,
  public.tasks,
  public.event_files,
  public.event_timeline_items,
  public.activities,
  public.revenue_forecasts,
  public.event_financial_summary
from anon;
grant select, insert, update, delete on
  public.workspaces,
  public.workspace_members,
  public.workspace_settings,
  public.events,
  public.sponsors,
  public.artists,
  public.vendors,
  public.ticket_categories,
  public.expenses,
  public.finance_transactions,
  public.tasks,
  public.event_files,
  public.event_timeline_items,
  public.activities,
  public.revenue_forecasts
to authenticated;

grant select on public.event_financial_summary to authenticated;

grant all on
  public.workspaces,
  public.workspace_members,
  public.workspace_settings,
  public.events,
  public.sponsors,
  public.artists,
  public.vendors,
  public.ticket_categories,
  public.expenses,
  public.finance_transactions,
  public.tasks,
  public.event_files,
  public.event_timeline_items,
  public.activities,
  public.revenue_forecasts
to service_role;

grant select on public.event_financial_summary to service_role;

comment on view public.event_financial_summary is
  'Event-level planned and actual revenue, expense, profit, receivable and payable totals. This security-invoker view respects RLS on its source tables.';

commit;
