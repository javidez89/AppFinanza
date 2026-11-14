insert into public.loans values (3, 'total', 50000000, 10000000, 60000000);
do $$
begin
  if not exists (select 1 from public.loans where id = 1 and interest_rate_type = 'monthly' and total_to_collect = 480075964.32)
    or not exists (select 1 from public.loans where id = 2 and interest_rate_type = 'annual_effective' and total_to_collect = 70966582.56)
    or not exists (select 1 from public.loans where id = 3 and interest_rate_type = 'total' and total_to_collect = 60000000) then
    raise exception 'The migration changed an existing loan or rejected the total-interest mode';
  end if;
  begin
    insert into public.loans values (4, 'unsupported', 1, 0, 1);
    raise exception 'Unsupported mode was accepted';
  exception when check_violation then
    null;
  end;
end;
$$;
