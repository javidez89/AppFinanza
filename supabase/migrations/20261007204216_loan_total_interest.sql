-- Add the one-time percentage without changing any existing loan or schedule.
alter table public.loans
  drop constraint loans_interest_rate_type_check,
  add constraint loans_interest_rate_type_check
    check (interest_rate_type in ('total', 'monthly', 'annual_effective'));
