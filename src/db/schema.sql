-- ============================================================================
-- ACTIZO CRM — Supabase / PostgreSQL schema
-- Run in the Supabase SQL editor (or: npm run db:push).
-- ============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$ begin
  create type user_role        as enum ('admin', 'branch_manager', 'staff');
  create type user_status      as enum ('active', 'inactive');
  create type lead_status      as enum ('New Lead','Assigned','Contacted','Follow-Up','Negotiation','Won','Lost');
  create type lead_priority    as enum ('High','Medium','Low');
  create type followup_type    as enum ('Call','Email','Meeting','WhatsApp','Site Visit');
  create type followup_status  as enum ('Scheduled','Completed','Missed');
  create type product_status   as enum ('Active','Inactive');
  create type sale_status      as enum ('Completed','Pending','Refunded');
  create type payment_status   as enum ('Pending','Partial','Paid');
  create type target_status    as enum ('Active','Completed','Pending','Overachieved','Expired');
  create type incentive_status as enum ('Paid','Pending');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- updated_at trigger helper
-- ---------------------------------------------------------------------------
create or replace function set_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

-- ---------------------------------------------------------------------------
-- Branches
-- ---------------------------------------------------------------------------
create table if not exists branches (
  id                 uuid primary key default gen_random_uuid(),
  code               text unique not null,
  name               text not null,
  city               text,
  region             text,
  manager            text,
  phone              text,
  email              text,
  address            text,
  established        text,
  status             text default 'active',
  accent             text,
  color              text,
  monthly_target     numeric default 0,
  monthly_achieved   numeric default 0,
  conversion_rate    numeric default 0,
  monthly_revenue    numeric default 0,
  total_revenue      numeric default 0,
  target_revenue     numeric default 0,
  target_achievement numeric default 0,
  created_at         timestamptz default now(),
  updated_at         timestamptz default now()
);

-- ---------------------------------------------------------------------------
-- Users (admins, branch managers, sales staff)
-- ---------------------------------------------------------------------------
create table if not exists users (
  id                uuid primary key default gen_random_uuid(),
  employee_id       text unique,
  name              text not null,
  email             text unique,
  phone             text,
  role              user_role not null default 'staff',
  pin_hash          text,                       -- 6-digit PIN (bcrypt-hashed, used for login)
  pin               text,                       -- plaintext PIN (admin-viewable on cards)
  branch_id         uuid references branches(id) on delete set null,
  avatar_color      text,
  status            user_status not null default 'active',
  -- denormalized performance metrics (mirrors the frontend staff cards)
  assigned_leads    int default 0,
  won_leads         int default 0,
  conversion_rate   numeric default 0,
  revenue           numeric default 0,
  target            numeric default 0,
  achievement       numeric default 0,
  incentive_earned  numeric default 0,
  performance_score numeric default 0,
  rating            numeric default 0,
  join_date         date default current_date,
  last_login        timestamptz,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);
create index if not exists idx_users_branch on users(branch_id);
create index if not exists idx_users_role on users(role);

-- ---------------------------------------------------------------------------
-- Products
-- ---------------------------------------------------------------------------
create table if not exists products (
  id           uuid primary key default gen_random_uuid(),
  code         text unique not null,
  name         text not null,
  brand        text,
  category     text not null,
  unit         text default 'PCS',
  price        numeric not null default 0,
  sold         int default 0,
  growth       numeric default 0,
  status       product_status not null default 'Active',
  type         text default 'General',          -- General | Special
  description  text,
  created_date date default current_date,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);
create index if not exists idx_products_category on products(category);

-- ---------------------------------------------------------------------------
-- Leads
-- ---------------------------------------------------------------------------
create table if not exists leads (
  id                 uuid primary key default gen_random_uuid(),
  ref_code           text unique,               -- human ref e.g. LD-1001
  name               text not null,
  company            text,
  mobile             text,
  email              text,
  location           text,
  product_id         uuid references products(id) on delete set null,
  source             text,
  branch_id          uuid references branches(id) on delete set null,
  staff_id           uuid references users(id) on delete set null,
  status             lead_status not null default 'New Lead',
  priority           lead_priority default 'Medium',
  value              numeric default 0,
  score              int default 50,
  expected_close_date date,
  next_follow_up     date,
  notes              text,
  tags               text[] default '{}',
  created_date       date default current_date,
  last_activity      timestamptz default now(),
  created_at         timestamptz default now(),
  updated_at         timestamptz default now()
);
create index if not exists idx_leads_branch on leads(branch_id);
create index if not exists idx_leads_staff on leads(staff_id);
create index if not exists idx_leads_status on leads(status);

-- Lead timeline (stage milestones)
create table if not exists lead_timeline (
  id          uuid primary key default gen_random_uuid(),
  lead_id     uuid not null references leads(id) on delete cascade,
  type        text,
  title       text,
  description text,
  date        date default current_date,
  by          text,
  created_at  timestamptz default now()
);
create index if not exists idx_timeline_lead on lead_timeline(lead_id);

-- Follow-ups
create table if not exists follow_ups (
  id         uuid primary key default gen_random_uuid(),
  lead_id    uuid not null references leads(id) on delete cascade,
  type       followup_type default 'Call',
  status     followup_status default 'Scheduled',
  date       date default current_date,
  next_date  date,
  remark     text,
  by         text,
  created_at timestamptz default now()
);
create index if not exists idx_followups_lead on follow_ups(lead_id);
create index if not exists idx_followups_status on follow_ups(status);

-- Lead activity log
create table if not exists lead_activities (
  id         uuid primary key default gen_random_uuid(),
  lead_id    uuid not null references leads(id) on delete cascade,
  action     text,
  detail     text,
  date       date default current_date,
  by         text,
  created_at timestamptz default now()
);
create index if not exists idx_leadact_lead on lead_activities(lead_id);

-- ---------------------------------------------------------------------------
-- Sales
-- ---------------------------------------------------------------------------
create table if not exists sales (
  id             uuid primary key default gen_random_uuid(),
  ref_code       text unique,                  -- e.g. SL-2001
  lead_id        uuid references leads(id) on delete set null,
  customer       text,
  product_id     uuid references products(id) on delete set null,
  category       text,
  branch_id      uuid references branches(id) on delete set null,
  staff_id       uuid references users(id) on delete set null,
  quantity       numeric default 1,
  unit           text,
  unit_price     numeric default 0,
  total_amount   numeric default 0,
  discount       numeric default 0,
  final_amount   numeric default 0,
  amount         numeric default 0,
  date           date default current_date,
  status         sale_status default 'Completed',
  payment_status payment_status default 'Paid',
  payment_method text default 'Cash',
  remarks        text,
  created_at     timestamptz default now()
);
create index if not exists idx_sales_branch on sales(branch_id);
create index if not exists idx_sales_staff on sales(staff_id);
create index if not exists idx_sales_product on sales(product_id);

-- ---------------------------------------------------------------------------
-- Targets — general / special / project
-- ---------------------------------------------------------------------------
create table if not exists general_targets (
  id            uuid primary key default gen_random_uuid(),
  parent_id     uuid references general_targets(id) on delete cascade, -- Product->Branch->Staff hierarchy
  product_id    uuid references products(id) on delete set null,
  scope         text default 'Admin',          -- Admin (product) | Branch | Staff
  branch_id     uuid references branches(id) on delete set null,
  staff_id      uuid references users(id) on delete set null,
  period        text default 'Monthly',
  target_qty    numeric default 0,
  achieved_qty  numeric default 0,
  completion    numeric default 0,
  start_date    date,
  end_date      date,
  incentive     numeric default 0,
  threshold     numeric default 100,
  allocations   jsonb default '{}',            -- { branchId: qty }
  status        target_status default 'Active',
  month         text,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- ===================== Flash Targets (time-boxed campaigns) =====================
-- Admin campaign -> Branch Manager requests -> Admin approves -> distribute to staff.
create table if not exists flash_targets (
  id           uuid primary key default gen_random_uuid(),
  product_id   uuid references products(id) on delete set null,
  total_qty    numeric default 0,
  start_date   date,
  end_date     date,
  description  text,
  status       text default 'Active',          -- Active | Expired | Completed
  created_by   uuid references users(id) on delete set null,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

-- Per-branch request + admin approval (one row per branch per flash target).
create table if not exists flash_branch_targets (
  id              uuid primary key default gen_random_uuid(),
  flash_target_id uuid references flash_targets(id) on delete cascade,
  branch_id       uuid references branches(id) on delete cascade,
  requested_by    uuid references users(id) on delete set null,
  requested_qty   numeric default 0,
  approved_qty    numeric,
  status          text default 'Pending',       -- Pending | Approved | Partially Approved | Rejected
  admin_response  text,
  resolved_by     uuid references users(id) on delete set null,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),
  unique (flash_target_id, branch_id)
);

-- Branch Manager distributes the approved branch quantity across staff.
create table if not exists flash_staff_targets (
  id              uuid primary key default gen_random_uuid(),
  flash_target_id uuid references flash_targets(id) on delete cascade,
  branch_id       uuid references branches(id) on delete set null,
  staff_id        uuid references users(id) on delete cascade,
  qty             numeric default 0,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),
  unique (flash_target_id, staff_id)
);

-- Link a sale to a flash campaign (only flash-linked sales drive flash progress).
alter table sales add column if not exists flash_target_id uuid references flash_targets(id) on delete set null;

create table if not exists special_targets (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  type           text,                          -- Festival | Seasonal | Product Launch | Flash Sale
  branch_id      uuid references branches(id) on delete set null,
  staff_id       uuid references users(id) on delete set null,
  start_date     date,
  end_date       date,
  target_value   numeric default 0,
  achieved_value numeric default 0,
  incentive      numeric default 0,
  completion     numeric default 0,
  status         target_status default 'Active',
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

create table if not exists project_targets (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  type             text,                        -- Villa | Apartment | Commercial | Interior
  location         text,
  project_value    numeric default 0,
  revenue_target   numeric default 0,
  revenue_achieved numeric default 0,
  qty_target       numeric default 0,
  qty_achieved     numeric default 0,
  branch_id        uuid references branches(id) on delete set null,
  staff_id         uuid references users(id) on delete set null,
  start_date       date,
  end_date         date,
  completion       numeric default 0,
  status           target_status default 'Active',
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);

-- ---------------------------------------------------------------------------
-- Incentives (current + history, keyed by month)
-- ---------------------------------------------------------------------------
create table if not exists incentives (
  id             uuid primary key default gen_random_uuid(),
  staff_id       uuid references users(id) on delete cascade,
  branch_id      uuid references branches(id) on delete set null,
  month          text,                          -- e.g. "Jun 2026"
  base_sales     numeric default 0,
  incentive_rate numeric default 0,
  amount         numeric default 0,
  bonus          numeric default 0,
  total          numeric default 0,
  type           text default 'Monthly',
  status         incentive_status default 'Pending',
  created_at     timestamptz default now()
);
create index if not exists idx_incentives_staff on incentives(staff_id);

-- ---------------------------------------------------------------------------
-- Finance
-- ---------------------------------------------------------------------------
create table if not exists finance_monthly (
  id       uuid primary key default gen_random_uuid(),
  month    text not null,                        -- "Jan".."Dec"
  year     int default 2026,
  revenue  numeric default 0,
  expense  numeric default 0,
  profit   numeric default 0,
  inflow   numeric default 0,
  outflow  numeric default 0
);

create table if not exists expenses (
  id       uuid primary key default gen_random_uuid(),
  category text not null,
  amount   numeric default 0,
  share    numeric default 0,                    -- percentage of total
  month    text
);

create table if not exists receivables (
  id      uuid primary key default gen_random_uuid(),
  bucket  text not null,                          -- "0–30 days" etc.
  amount  numeric default 0
);

-- ---------------------------------------------------------------------------
-- Activities (global feed) & Notifications
-- ---------------------------------------------------------------------------
create table if not exists activities (
  id          uuid primary key default gen_random_uuid(),
  type        text,
  icon        text,
  color       text,
  title       text,
  description text,
  user_id     uuid references users(id) on delete set null,
  time        timestamptz default now(),
  created_at  timestamptz default now()
);

create table if not exists notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references users(id) on delete cascade,
  type       text,
  title      text,
  message    text,
  read       boolean default false,
  time       timestamptz default now(),
  created_at timestamptz default now()
);
create index if not exists idx_notifications_user on notifications(user_id);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['branches','users','products','leads','general_targets','special_targets','project_targets']
  loop
    execute format('drop trigger if exists trg_%1$s_updated on %1$s;', t);
    execute format('create trigger trg_%1$s_updated before update on %1$s for each row execute function set_updated_at();', t);
  end loop;
end $$;
