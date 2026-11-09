begin;

create table public.store_contact (
  id boolean primary key default true check (id),
  phone text check (
    char_length(phone) <= 40
    and phone ~ '^[+0-9(). -]+$'
    and char_length(regexp_replace(phone, '[^0-9]', '', 'g')) between 6 and 15
  ),
  address text check (char_length(btrim(address)) between 1 and 240),
  map_url text check (char_length(map_url) <= 2048 and map_url like 'https://%')
);

alter table public.store_contact enable row level security;
revoke all on public.store_contact from public, anon, authenticated;
grant select on public.store_contact to anon, authenticated;
grant insert, update on public.store_contact to authenticated;

create policy store_contact_read on public.store_contact
for select to anon, authenticated using (true);

create policy store_contact_admin_insert on public.store_contact
for insert to authenticated with check ((select private.is_catalog_admin()));

create policy store_contact_admin_update on public.store_contact
for update to authenticated
using ((select private.is_catalog_admin()))
with check ((select private.is_catalog_admin()));

commit;
