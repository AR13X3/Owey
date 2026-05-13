-- ============================================================
-- SplitMate Database Schema
-- Run this entire file in your Supabase SQL Editor
-- ============================================================

-- ----------------------------------------------------------------
-- HOUSEHOLDS
-- ----------------------------------------------------------------
create table if not exists households (
  id          uuid primary key default gen_random_uuid(),
  name        text not null default 'Our Household',
  user1_id    uuid references auth.users(id) on delete set null,
  user2_id    uuid references auth.users(id) on delete set null,
  invite_code text unique not null default substring(md5(random()::text), 1, 8),
  created_at  timestamptz not null default now()
);

-- ----------------------------------------------------------------
-- PROFILES
-- ----------------------------------------------------------------
create table if not exists profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  avatar_color text not null default '#6366f1',
  household_id uuid references households(id) on delete set null,
  created_at   timestamptz not null default now()
);

-- ----------------------------------------------------------------
-- RECEIPTS
-- ----------------------------------------------------------------
create table if not exists receipts (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  uploaded_by  uuid not null references auth.users(id) on delete cascade,
  store_name   text not null,
  receipt_date date not null,
  raw_text     text,
  total_amount numeric(10,2) not null,
  split_mode   text not null default 'half'
                 check (split_mode in ('half', 'per_item', 'all_me', 'all_partner')),
  is_settled   boolean not null default false,
  created_at   timestamptz not null default now()
);

-- ----------------------------------------------------------------
-- RECEIPT ITEMS
-- ----------------------------------------------------------------
create table if not exists receipt_items (
  id          uuid primary key default gen_random_uuid(),
  receipt_id  uuid not null references receipts(id) on delete cascade,
  name        text not null,
  quantity    numeric(10,2) not null default 1,
  unit_price  numeric(10,2) not null,
  total_price numeric(10,2) generated always as (quantity * unit_price) stored,
  assigned_to text not null default 'shared'
                check (assigned_to in ('user1', 'user2', 'shared'))
);

-- ----------------------------------------------------------------
-- EXPENSES
-- ----------------------------------------------------------------
create table if not exists expenses (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  paid_by      uuid not null references auth.users(id) on delete cascade,
  expense_type text not null
                 check (expense_type in ('personal', 'shared', 'loan')),
  category     text not null,
  amount       numeric(10,2) not null,
  description  text not null,
  expense_date date not null,
  split_with   uuid references auth.users(id) on delete set null,
  loan_to      uuid references auth.users(id) on delete set null,
  is_settled   boolean not null default false,
  notes        text,
  created_at   timestamptz not null default now()
);

-- ----------------------------------------------------------------
-- SETTLEMENTS
-- ----------------------------------------------------------------
create table if not exists settlements (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  paid_by      uuid not null references auth.users(id) on delete cascade,
  paid_to      uuid not null references auth.users(id) on delete cascade,
  amount       numeric(10,2) not null,
  notes        text,
  settled_at   timestamptz not null default now()
);

-- ================================================================
-- ROW LEVEL SECURITY
-- ================================================================

alter table households    enable row level security;
alter table profiles      enable row level security;
alter table receipts      enable row level security;
alter table receipt_items enable row level security;
alter table expenses      enable row level security;
alter table settlements   enable row level security;

-- ----------------------------------------------------------------
-- HOUSEHOLDS policies
-- ----------------------------------------------------------------
create policy "households_select" on households
  for select using (
    user1_id = auth.uid() or user2_id = auth.uid()
  );

create policy "households_insert" on households
  for insert with check (user1_id = auth.uid());

create policy "households_update" on households
  for update using (
    user1_id = auth.uid() or user2_id = auth.uid()
  );

-- ----------------------------------------------------------------
-- PROFILES policies
-- ----------------------------------------------------------------
-- Users can insert/update their own profile
create policy "profiles_own_write" on profiles
  for all using (id = auth.uid())
  with check (id = auth.uid());

-- Users can read their partner's profile (needed for balance display)
create policy "profiles_household_read" on profiles
  for select using (
    household_id in (
      select id from households
      where user1_id = auth.uid() or user2_id = auth.uid()
    )
  );

-- ----------------------------------------------------------------
-- RECEIPTS policies
-- ----------------------------------------------------------------
create policy "receipts_household" on receipts
  for all using (
    household_id in (
      select id from households
      where user1_id = auth.uid() or user2_id = auth.uid()
    )
  )
  with check (
    household_id in (
      select id from households
      where user1_id = auth.uid() or user2_id = auth.uid()
    )
  );

-- ----------------------------------------------------------------
-- RECEIPT_ITEMS policies
-- ----------------------------------------------------------------
create policy "receipt_items_household" on receipt_items
  for all using (
    receipt_id in (
      select r.id from receipts r
      join households h on h.id = r.household_id
      where h.user1_id = auth.uid() or h.user2_id = auth.uid()
    )
  )
  with check (
    receipt_id in (
      select r.id from receipts r
      join households h on h.id = r.household_id
      where h.user1_id = auth.uid() or h.user2_id = auth.uid()
    )
  );

-- ----------------------------------------------------------------
-- EXPENSES policies
-- ----------------------------------------------------------------
create policy "expenses_household" on expenses
  for all using (
    household_id in (
      select id from households
      where user1_id = auth.uid() or user2_id = auth.uid()
    )
  )
  with check (
    household_id in (
      select id from households
      where user1_id = auth.uid() or user2_id = auth.uid()
    )
  );

-- ----------------------------------------------------------------
-- SETTLEMENTS policies
-- ----------------------------------------------------------------
create policy "settlements_household" on settlements
  for all using (
    household_id in (
      select id from households
      where user1_id = auth.uid() or user2_id = auth.uid()
    )
  )
  with check (
    household_id in (
      select id from households
      where user1_id = auth.uid() or user2_id = auth.uid()
    )
  );

-- ================================================================
-- TRIGGER: auto-create profile on user signup
-- ================================================================

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into profiles (id, display_name, avatar_color)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    '#6366f1'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ================================================================
-- RPC: join_household (row-locked to prevent race conditions)
-- ================================================================

create or replace function join_household(p_invite_code text)
returns json
language plpgsql
security definer set search_path = public
as $$
declare
  v_household households%rowtype;
begin
  -- Lock the row to prevent two users joining simultaneously
  select * into v_household
  from households
  where invite_code = p_invite_code
  for update;

  if not found then
    return json_build_object('error', 'Invalid invite code');
  end if;

  if v_household.user1_id = auth.uid() then
    return json_build_object('error', 'You created this household');
  end if;

  if v_household.user2_id is not null and v_household.user2_id <> auth.uid() then
    return json_build_object('error', 'Household is already full');
  end if;

  -- Join the household
  update households
  set user2_id = auth.uid()
  where id = v_household.id;

  -- Link profile to household
  update profiles
  set household_id = v_household.id
  where id = auth.uid();

  return json_build_object('household_id', v_household.id, 'name', v_household.name);
end;
$$;

-- ================================================================
-- RPC: get_household_balance (single source of truth for balances)
-- ================================================================

create or replace function get_household_balance(
  p_household_id uuid,
  p_user_id      uuid
)
returns json
language plpgsql
security definer set search_path = public
as $$
declare
  v_shared_owed    numeric := 0;  -- partner owes me (I paid shared expenses)
  v_shared_owing   numeric := 0;  -- I owe partner (partner paid shared expenses)
  v_loan_out       numeric := 0;  -- I lent to partner
  v_loan_in        numeric := 0;  -- Partner lent to me
  v_receipt_owed   numeric := 0;  -- From receipt splits: partner owes me
  v_receipt_owing  numeric := 0;  -- From receipt splits: I owe partner
  v_net            numeric := 0;
begin
  -- Shared expenses: I paid, partner owes me half
  select coalesce(sum(amount / 2), 0) into v_shared_owed
  from expenses
  where household_id = p_household_id
    and paid_by = p_user_id
    and expense_type = 'shared'
    and split_with is not null
    and is_settled = false;

  -- Shared expenses: partner paid, I owe half
  select coalesce(sum(amount / 2), 0) into v_shared_owing
  from expenses
  where household_id = p_household_id
    and paid_by <> p_user_id
    and expense_type = 'shared'
    and split_with = p_user_id
    and is_settled = false;

  -- Loans I gave
  select coalesce(sum(amount), 0) into v_loan_out
  from expenses
  where household_id = p_household_id
    and paid_by = p_user_id
    and expense_type = 'loan'
    and loan_to <> p_user_id
    and is_settled = false;

  -- Loans I received
  select coalesce(sum(amount), 0) into v_loan_in
  from expenses
  where household_id = p_household_id
    and paid_by <> p_user_id
    and expense_type = 'loan'
    and loan_to = p_user_id
    and is_settled = false;

  -- Receipt splits where I uploaded (partner owes me their share)
  select coalesce(sum(
    case r.split_mode
      when 'half'        then r.total_amount / 2
      when 'all_partner' then r.total_amount
      when 'per_item'    then (
        select coalesce(sum(ri.total_price), 0)
        from receipt_items ri
        where ri.receipt_id = r.id and ri.assigned_to = 'user2'
      ) + (
        select coalesce(sum(ri.total_price / 2), 0)
        from receipt_items ri
        where ri.receipt_id = r.id and ri.assigned_to = 'shared'
      )
      else 0
    end
  ), 0) into v_receipt_owed
  from receipts r
  where r.household_id = p_household_id
    and r.uploaded_by = p_user_id
    and r.is_settled = false
    and r.split_mode <> 'all_me';

  -- Receipt splits where partner uploaded (I owe them my share)
  select coalesce(sum(
    case r.split_mode
      when 'half'    then r.total_amount / 2
      when 'all_me'  then r.total_amount
      when 'per_item' then (
        select coalesce(sum(ri.total_price), 0)
        from receipt_items ri
        where ri.receipt_id = r.id and ri.assigned_to = 'user1'
      ) + (
        select coalesce(sum(ri.total_price / 2), 0)
        from receipt_items ri
        where ri.receipt_id = r.id and ri.assigned_to = 'shared'
      )
      else 0
    end
  ), 0) into v_receipt_owing
  from receipts r
  where r.household_id = p_household_id
    and r.uploaded_by <> p_user_id
    and r.is_settled = false
    and r.split_mode <> 'all_partner';

  v_net := (v_shared_owed + v_loan_out + v_receipt_owed)
         - (v_shared_owing + v_loan_in + v_receipt_owing);

  return json_build_object(
    'you_are_owed',  round(v_shared_owed + v_loan_out + v_receipt_owed, 2),
    'you_owe',       round(v_shared_owing + v_loan_in + v_receipt_owing, 2),
    'net',           round(v_net, 2)
  );
end;
$$;

-- ================================================================
-- RPC: create_receipt_with_items (atomic insert)
-- ================================================================

create or replace function create_receipt_with_items(
  p_household_id uuid,
  p_store_name   text,
  p_receipt_date date,
  p_raw_text     text,
  p_total_amount numeric,
  p_split_mode   text,
  p_items        json
)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_receipt_id uuid;
  v_item       json;
begin
  insert into receipts (household_id, uploaded_by, store_name, receipt_date, raw_text, total_amount, split_mode)
  values (p_household_id, auth.uid(), p_store_name, p_receipt_date, p_raw_text, p_total_amount, p_split_mode)
  returning id into v_receipt_id;

  for v_item in select * from json_array_elements(p_items) loop
    insert into receipt_items (receipt_id, name, quantity, unit_price, assigned_to)
    values (
      v_receipt_id,
      v_item->>'name',
      (v_item->>'quantity')::numeric,
      (v_item->>'unit_price')::numeric,
      coalesce(v_item->>'assigned_to', 'shared')
    );
  end loop;

  return v_receipt_id;
end;
$$;
