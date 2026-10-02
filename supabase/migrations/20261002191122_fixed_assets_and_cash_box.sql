create table public.fixed_assets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null default private.current_workspace_id() references public.workspaces(id) on delete cascade,
  name text not null check (length(btrim(name)) > 0),
  asset_type text not null check (asset_type in ('vehicle', 'property', 'equipment', 'other')),
  acquisition_date date not null,
  acquisition_cost numeric(20,2) not null check (acquisition_cost >= 0),
  current_value numeric(20,2) not null check (current_value >= 0),
  notes text,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index fixed_assets_workspace_idx on public.fixed_assets(workspace_id);
create unique index accounts_one_cash_box_per_workspace on public.accounts(workspace_id)
  where notes = 'appfinanza:cash-box';

create trigger set_updated_at before update on public.fixed_assets
  for each row execute function private.set_updated_at();
create trigger audit_fixed_assets after insert or update or delete on public.fixed_assets
  for each row execute function private.audit_mutation();

alter table public.fixed_assets enable row level security;
create policy fixed_assets_workspace_members on public.fixed_assets for all to authenticated
  using (private.is_workspace_member(workspace_id))
  with check (private.is_workspace_member(workspace_id));

revoke all on public.fixed_assets from public, anon, authenticated;
grant select, insert, update on public.fixed_assets to authenticated;

create function public.register_fixed_asset(
  p_name text,
  p_asset_type text,
  p_acquisition_date date,
  p_acquisition_cost numeric,
  p_current_value numeric,
  p_account_id uuid default null,
  p_record_cash_outflow boolean default false,
  p_notes text default null,
  p_existing_transaction_id uuid default null
) returns uuid
language plpgsql security invoker set search_path = pg_catalog, public, private as $$
declare
  v_workspace_id uuid;
  v_asset_id uuid;
  v_existing_transaction public.transactions%rowtype;
begin
  v_workspace_id := private.current_workspace_id();
  if v_workspace_id is null or p_name is null or btrim(p_name) = ''
     or p_asset_type not in ('vehicle', 'property', 'equipment', 'other')
     or p_acquisition_date is null or p_acquisition_cost is null or p_acquisition_cost < 0
     or p_current_value is null or p_current_value < 0 then
    raise exception 'Datos del activo incompletos o inválidos';
  end if;

  if p_record_cash_outflow and (p_acquisition_cost <= 0) then
    raise exception 'La compra debe tener un valor mayor que cero';
  end if;

  if p_record_cash_outflow and p_existing_transaction_id is not null then
    raise exception 'No se puede registrar y convertir la misma compra';
  end if;

  if p_existing_transaction_id is not null then
    select * into v_existing_transaction from public.transactions
    where id = p_existing_transaction_id and workspace_id = v_workspace_id and kind = 'expense'
    for update;
    if not found then
      raise exception 'El gasto seleccionado ya no está disponible';
    end if;
    if v_existing_transaction.amount <> p_acquisition_cost
       or v_existing_transaction.transaction_date <> p_acquisition_date then
      raise exception 'El valor y la fecha deben coincidir con el gasto original';
    end if;
  end if;

  if p_account_id is not null and not exists (
    select 1 from public.accounts where id = p_account_id and workspace_id = v_workspace_id and active
  ) then
    raise exception 'La cuenta de origen no está disponible';
  end if;

  insert into public.fixed_assets
    (workspace_id, name, asset_type, acquisition_date, acquisition_cost, current_value, notes)
  values
    (v_workspace_id, btrim(p_name), p_asset_type, p_acquisition_date, p_acquisition_cost,
     p_current_value, nullif(btrim(p_notes), ''))
  returning id into v_asset_id;

  if p_record_cash_outflow then
    insert into public.transactions
      (workspace_id, kind, description, category, amount, transaction_date, notes,
       reference_type, reference_id, account_id)
    values
      (v_workspace_id, 'transfer', 'Compra de ' || btrim(p_name), 'Patrimonio',
       p_acquisition_cost, p_acquisition_date, nullif(btrim(p_notes), ''),
       'fixed_asset_purchase', v_asset_id, p_account_id);
  elsif p_existing_transaction_id is not null then
    update public.transactions
    set kind = 'transfer', description = 'Compra de ' || btrim(p_name), category = 'Patrimonio',
        reference_type = 'fixed_asset_purchase', reference_id = v_asset_id
    where id = p_existing_transaction_id;
  end if;

  return v_asset_id;
end;
$$;

revoke all on function public.register_fixed_asset(text, text, date, numeric, numeric, uuid, boolean, text, uuid) from public, anon;
grant execute on function public.register_fixed_asset(text, text, date, numeric, numeric, uuid, boolean, text, uuid) to authenticated;
