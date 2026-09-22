-- AppFinanza: esquema compartido, RLS y auditoría.
-- Ejecutar una sola vez en un proyecto Supabase nuevo mediante la CLI o SQL Editor.

create extension if not exists pgcrypto;
create schema if not exists private;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create or replace function private.enforce_finance_allowlist()
returns trigger language plpgsql security definer set search_path = pg_catalog as $$
begin
  if lower(coalesce(new.email, '')) not in ('javidez89@gmail.com', 'nstellahq@gmail.com') then
    raise exception 'Correo no autorizado para AppFinanza';
  end if;
  return new;
end;
$$;

create or replace function private.provision_finance_member()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare
  shared_workspace uuid;
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', new.email))
  on conflict (id) do nothing;

  insert into public.workspaces (name) values ('AppFinanza compartido')
  on conflict (name) do update set name = excluded.name
  returning id into shared_workspace;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (shared_workspace, new.id, case when new.email = 'javidez89@gmail.com' then 'owner' else 'member' end)
  on conflict (workspace_id, user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists enforce_finance_allowlist on auth.users;
create trigger enforce_finance_allowlist before insert on auth.users
for each row execute function private.enforce_finance_allowlist();
drop trigger if exists provision_finance_member on auth.users;
create trigger provision_finance_member after insert on auth.users
for each row execute function private.provision_finance_member();

create or replace function private.is_workspace_member(target_workspace uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select (select auth.uid()) is not null
    and exists (select 1 from public.workspace_members wm where wm.workspace_id = target_workspace and wm.user_id = (select auth.uid()));
$$;

create or replace function private.current_workspace_id()
returns uuid language sql stable security definer set search_path = public, pg_temp as $$
  select wm.workspace_id from public.workspace_members wm where wm.user_id = (select auth.uid()) limit 1;
$$;

create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null default private.current_workspace_id() references public.workspaces(id) on delete cascade,
  name text not null,
  account_type text not null check (account_type in ('cash', 'checking', 'savings', 'wallet', 'bank', 'other')),
  institution text,
  currency text not null default 'COP',
  opening_balance numeric(20,2) not null default 0 check (opening_balance >= 0),
  active boolean not null default true,
  notes text,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null default private.current_workspace_id() references public.workspaces(id) on delete cascade,
  name text not null,
  category_type text not null check (category_type in ('income', 'expense', 'both')),
  created_at timestamptz not null default now(),
  unique (workspace_id, name, category_type)
);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null default private.current_workspace_id() references public.workspaces(id) on delete cascade,
  kind text not null check (kind in ('income', 'expense', 'transfer', 'loan_out', 'loan_payment', 'loan_interest_payment', 'investment_out', 'investment_return', 'debt_disbursement', 'debt_payment', 'debt_interest_payment', 'card_purchase', 'card_payment')),
  description text not null,
  category text not null default 'General',
  amount numeric(20,2) not null check (amount > 0),
  transaction_date date not null default current_date,
  notes text,
  reference_type text,
  reference_id uuid,
  account_id uuid references public.accounts(id) on delete set null,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.loans (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null default private.current_workspace_id() references public.workspaces(id) on delete cascade,
  borrower_name text not null,
  borrower_contact text,
  description text,
  principal numeric(20,2) not null check (principal > 0),
  interest_rate numeric(9,4) not null check (interest_rate >= 0),
  interest_rate_type text not null check (interest_rate_type in ('monthly', 'annual_effective')),
  installment_frequency text not null check (installment_frequency in ('monthly', 'biweekly', 'weekly')),
  installments_count integer not null check (installments_count > 0),
  fixed_payment numeric(20,2) not null check (fixed_payment >= 0),
  total_to_collect numeric(20,2) not null check (total_to_collect >= principal),
  total_interest numeric(20,2) not null check (total_interest >= 0),
  start_date date not null,
  first_due_date date not null,
  status text not null default 'active' check (status in ('active', 'paid', 'cancelled')),
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.loan_installments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null default private.current_workspace_id() references public.workspaces(id) on delete cascade,
  loan_id uuid not null references public.loans(id) on delete cascade,
  installment_number integer not null check (installment_number > 0),
  due_date date not null,
  principal_amount numeric(20,2) not null check (principal_amount >= 0),
  interest_amount numeric(20,2) not null check (interest_amount >= 0),
  total_amount numeric(20,2) not null check (total_amount >= 0),
  remaining_balance numeric(20,2) not null check (remaining_balance >= 0),
  status text not null default 'pending' check (status in ('pending', 'paid', 'overdue', 'partial')),
  paid_at timestamptz,
  paid_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (loan_id, installment_number)
);

create table public.investments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null default private.current_workspace_id() references public.workspaces(id) on delete cascade,
  investment_type text not null default 'cdt' check (investment_type in ('cdt', 'fund', 'stock', 'crypto', 'other')),
  institution text not null,
  description text,
  principal numeric(20,2) not null check (principal > 0),
  annual_effective_rate numeric(9,4) not null check (annual_effective_rate >= 0),
  start_date date not null,
  maturity_date date not null check (maturity_date >= start_date),
  term_days integer not null check (term_days >= 0),
  projected_return numeric(20,2) not null default 0,
  projected_maturity_value numeric(20,2) not null,
  status text not null default 'active' check (status in ('active', 'matured', 'redeemed', 'cancelled')),
  redeemed_at timestamptz,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.credit_cards (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null default private.current_workspace_id() references public.workspaces(id) on delete cascade,
  name text not null,
  institution text not null,
  last_four text check (last_four is null or last_four ~ '^[0-9]{4}$'),
  credit_limit numeric(20,2) not null check (credit_limit > 0),
  current_balance numeric(20,2) not null default 0 check (current_balance >= 0),
  cutoff_day integer not null default 15 check (cutoff_day between 1 and 28),
  payment_day integer not null default 25 check (payment_day between 1 and 28),
  active boolean not null default true,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null default private.current_workspace_id() references public.workspaces(id) on delete cascade,
  category text not null,
  month date not null,
  limit_amount numeric(20,2) not null check (limit_amount > 0),
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, category, month)
);

create table public.savings_goals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null default private.current_workspace_id() references public.workspaces(id) on delete cascade,
  name text not null,
  target_amount numeric(20,2) not null check (target_amount > 0),
  current_amount numeric(20,2) not null default 0 check (current_amount >= 0),
  target_date date,
  status text not null default 'active' check (status in ('active', 'completed', 'cancelled')),
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.personal_debts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null default private.current_workspace_id() references public.workspaces(id) on delete cascade,
  creditor_name text not null,
  description text,
  principal numeric(20,2) not null check (principal > 0),
  outstanding_balance numeric(20,2) not null check (outstanding_balance >= 0),
  annual_interest_rate numeric(9,4) not null default 0 check (annual_interest_rate >= 0),
  minimum_payment numeric(20,2) not null default 0 check (minimum_payment >= 0),
  due_day integer check (due_day between 1 and 28),
  status text not null default 'active' check (status in ('active', 'paid', 'cancelled')),
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid references auth.users(id),
  action text not null,
  entity text not null,
  entity_id uuid,
  created_at timestamptz not null default now()
);

create index accounts_workspace_idx on public.accounts(workspace_id);
create index transactions_workspace_date_idx on public.transactions(workspace_id, transaction_date desc);
create index installments_workspace_due_idx on public.loan_installments(workspace_id, due_date, status);
create index investments_workspace_maturity_idx on public.investments(workspace_id, maturity_date, status);
create index budgets_workspace_month_idx on public.budgets(workspace_id, month, category);

create or replace function private.set_updated_at()
returns trigger language plpgsql security invoker set search_path = pg_catalog as $$ begin new.updated_at = now(); return new; end; $$;

create or replace function private.audit_mutation()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare row_data jsonb; begin
  row_data := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  insert into public.audit_events(workspace_id, user_id, action, entity, entity_id)
  values ((row_data ->> 'workspace_id')::uuid, (select auth.uid()), tg_op, tg_table_name, (row_data ->> 'id')::uuid);
  return coalesce(new, old);
end; $$;

do $$ declare table_name text; begin
  foreach table_name in array array['accounts','transactions','loans','loan_installments','investments','credit_cards','budgets','savings_goals','personal_debts'] loop
    execute format('create trigger set_updated_at before update on public.%I for each row execute function private.set_updated_at()', table_name);
    execute format('create trigger audit_%I after insert or update or delete on public.%I for each row execute function private.audit_mutation()', table_name, table_name);
  end loop;
end $$;

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.accounts enable row level security;
alter table public.categories enable row level security;
alter table public.transactions enable row level security;
alter table public.loans enable row level security;
alter table public.loan_installments enable row level security;
alter table public.investments enable row level security;
alter table public.credit_cards enable row level security;
alter table public.budgets enable row level security;
alter table public.savings_goals enable row level security;
alter table public.personal_debts enable row level security;
alter table public.audit_events enable row level security;

create policy profiles_self on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy workspaces_member on public.workspaces for select to authenticated using (private.is_workspace_member(id));
create policy members_workspace on public.workspace_members for select to authenticated using (private.is_workspace_member(workspace_id));
create policy audit_workspace on public.audit_events for select to authenticated using (private.is_workspace_member(workspace_id));

do $$ declare table_name text; policy_name text; begin
  foreach table_name in array array['accounts','categories','transactions','loans','loan_installments','investments','credit_cards','budgets','savings_goals','personal_debts'] loop
    policy_name := table_name || '_workspace_members';
    execute format('create policy %I on public.%I for all to authenticated using (private.is_workspace_member(workspace_id)) with check (private.is_workspace_member(workspace_id))', policy_name, table_name);
  end loop;
end $$;

revoke all on schema private from public;
revoke all on all tables in schema public from anon, authenticated;
revoke all on function private.enforce_finance_allowlist(), private.provision_finance_member(), private.is_workspace_member(uuid), private.current_workspace_id(), private.set_updated_at(), private.audit_mutation() from public;
grant usage on schema public to authenticated;
grant usage on schema private to authenticated;
grant execute on function private.is_workspace_member(uuid), private.current_workspace_id() to authenticated;
grant select on public.profiles, public.workspaces, public.workspace_members, public.audit_events to authenticated;
grant select, insert, update, delete on public.accounts, public.categories, public.transactions, public.loans, public.loan_installments, public.investments, public.credit_cards, public.budgets, public.savings_goals, public.personal_debts to authenticated;
