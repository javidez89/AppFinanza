-- Solo el propietario del workspace puede modificar o eliminar ingresos y gastos.
-- En el workspace inicial, javidez89@gmail.com es el propietario.

create or replace function private.is_workspace_owner(target_workspace uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = target_workspace
        and wm.user_id = (select auth.uid())
        and wm.role = 'owner'
    );
$$;

revoke all on function private.is_workspace_owner(uuid) from public;
grant execute on function private.is_workspace_owner(uuid) to authenticated;

drop policy if exists transactions_workspace_members on public.transactions;

create policy transactions_select_workspace_members
on public.transactions for select to authenticated
using ((select private.is_workspace_member(workspace_id)));

create policy transactions_insert_workspace_members
on public.transactions for insert to authenticated
with check ((select private.is_workspace_member(workspace_id)));

create policy transactions_update_non_cashflow_members
on public.transactions for update to authenticated
using ((select private.is_workspace_member(workspace_id)) and kind not in ('income', 'expense'))
with check ((select private.is_workspace_member(workspace_id)) and kind not in ('income', 'expense'));

create policy transactions_delete_non_cashflow_members
on public.transactions for delete to authenticated
using ((select private.is_workspace_member(workspace_id)) and kind not in ('income', 'expense'));

create policy transactions_owner_update_cashflow
on public.transactions for update to authenticated
using (
  (select private.is_workspace_member(workspace_id))
  and (select private.is_workspace_owner(workspace_id))
  and kind in ('income', 'expense')
)
with check (
  (select private.is_workspace_member(workspace_id))
  and (select private.is_workspace_owner(workspace_id))
  and kind in ('income', 'expense')
);

create policy transactions_owner_delete_cashflow
on public.transactions for delete to authenticated
using (
  (select private.is_workspace_member(workspace_id))
  and (select private.is_workspace_owner(workspace_id))
  and kind in ('income', 'expense')
);
