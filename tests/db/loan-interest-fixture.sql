-- Run ONLY in a disposable database. Minimal fixture for the production constraint.
create table public.loans (
  id integer primary key,
  interest_rate_type text not null check (interest_rate_type in ('monthly', 'annual_effective')),
  principal numeric(20,2) not null,
  total_interest numeric(20,2) not null,
  total_to_collect numeric(20,2) not null
);
insert into public.loans values
  (1, 'monthly', 50000000, 430075964.43, 480075964.32),
  (2, 'annual_effective', 50000000, 20966582.79, 70966582.56);
