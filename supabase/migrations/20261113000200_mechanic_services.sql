begin;

create table public.mechanic_services (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 160),
  description text not null default '' check (char_length(description) <= 2000),
  price numeric(10, 2) check (price between 0 and 99999999.99),
  price_from boolean not null default false check (not price_from or price is not null),
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.mechanic_services enable row level security;
revoke all on public.mechanic_services from public, anon, authenticated;
grant select on public.mechanic_services to anon, authenticated;
grant insert (name, description, price, price_from, is_published) on public.mechanic_services to authenticated;
grant update (name, description, price, price_from, is_published) on public.mechanic_services to authenticated;
grant delete on public.mechanic_services to authenticated;

create policy services_read_published on public.mechanic_services
for select to anon using (is_published);

create policy services_read_authenticated on public.mechanic_services
for select to authenticated using (is_published or (select private.is_catalog_admin()));

create policy services_admin_insert on public.mechanic_services
for insert to authenticated with check ((select private.is_catalog_admin()));

create policy services_admin_update on public.mechanic_services
for update to authenticated using ((select private.is_catalog_admin())) with check ((select private.is_catalog_admin()));

create policy services_admin_delete on public.mechanic_services
for delete to authenticated using ((select private.is_catalog_admin()));

create function private.set_service_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := greatest(clock_timestamp(), old.updated_at + interval '1 microsecond');
  return new;
end;
$$;

revoke all on function private.set_service_updated_at() from public, anon, authenticated;

create trigger set_service_updated_at before update on public.mechanic_services
for each row execute function private.set_service_updated_at();

commit;
