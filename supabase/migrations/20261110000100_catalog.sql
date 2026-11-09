begin;

create schema private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

create table private.catalog_admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);

alter table private.catalog_admins enable row level security;
revoke all on private.catalog_admins from public, anon, authenticated;

create function private.is_catalog_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from private.catalog_admins
    where user_id = (select auth.uid())
  );
$$;

revoke all on function private.is_catalog_admin() from public, anon, authenticated;
grant execute on function private.is_catalog_admin() to authenticated;

create function public.is_catalog_admin()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select private.is_catalog_admin();
$$;

revoke all on function public.is_catalog_admin() from public, anon, authenticated;
grant execute on function public.is_catalog_admin() to authenticated;

create function private.is_catalog_image_path(object_path text)
returns boolean
language sql
immutable
strict
set search_path = ''
as $$
  select object_path ~ (
    '^' || uuid_pattern || '/' || uuid_pattern || '[.](jpg|jpeg|png|webp|avif)$'
  )
  from (values ('[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}')) as pattern(uuid_pattern);
$$;

create function private.valid_catalog_images(part_id uuid, part_images jsonb)
returns boolean
language plpgsql
immutable
strict
set search_path = ''
as $$
begin
  if jsonb_typeof(part_images) is distinct from 'array' then
    return false;
  end if;

  if jsonb_array_length(part_images) > 8 then
    return false;
  end if;

  return not exists (
    select 1 from jsonb_array_elements(part_images) as image
    where jsonb_typeof(image) is distinct from 'object'
      or jsonb_typeof(image->'path') is distinct from 'string'
      or not private.is_catalog_image_path(image->>'path')
      or split_part(image->>'path', '/', 1) <> part_id::text
      or jsonb_typeof(image->'alt') is distinct from 'string'
      or char_length(image->>'alt') > 160
  ) and (
    select count(distinct image->>'path') = count(*)
    from jsonb_array_elements(part_images) as image
  );
end;
$$;

revoke all on function private.is_catalog_image_path(text) from public, anon, authenticated;
revoke all on function private.valid_catalog_images(uuid, jsonb) from public, anon, authenticated;
grant execute on function private.is_catalog_image_path(text) to authenticated;
grant execute on function private.valid_catalog_images(uuid, jsonb) to authenticated;

create table public.parts (
  id uuid primary key default gen_random_uuid(),
  sku text not null check (sku = btrim(sku) and char_length(sku) between 1 and 64),
  name text not null check (char_length(btrim(name)) between 1 and 160 and char_length(name) <= 160),
  category text not null check (char_length(btrim(category)) between 1 and 80 and char_length(category) <= 80),
  make text check (char_length(make) <= 80),
  model text check (char_length(model) <= 80),
  year_from integer check (year_from between 1886 and 2100),
  year_to integer check (year_to between 1886 and 2100),
  oem_number text check (char_length(oem_number) <= 120),
  condition text not null default 'used' check (condition in ('new', 'used', 'refurbished')),
  price numeric(12, 2) check (price between 0 and 9999999999.99),
  quantity integer not null default 0 check (quantity between 0 and 999999),
  description text not null default '' check (char_length(description) <= 5000),
  is_published boolean not null default false,
  is_featured boolean not null default false,
  images jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint parts_year_order check (year_from <= year_to),
  constraint parts_valid_images check (private.valid_catalog_images(id, images))
);

create unique index parts_sku_unique on public.parts (lower(sku));
create index parts_updated_idx on public.parts (updated_at desc, id);
create index parts_published_updated_idx on public.parts (updated_at desc, id) where is_published;
create index parts_images_idx on public.parts using gin (images jsonb_path_ops);

alter table public.parts enable row level security;
revoke all on public.parts from public, anon, authenticated;
grant select on public.parts to anon, authenticated;
grant insert (
  id, sku, name, category, make, model, year_from, year_to, oem_number, condition,
  price, quantity, description, is_published, is_featured, images
) on public.parts to authenticated;
grant update (
  sku, name, category, make, model, year_from, year_to, oem_number, condition,
  price, quantity, description, is_published, is_featured, images
) on public.parts to authenticated;
grant delete on public.parts to authenticated;

create policy parts_read_published on public.parts
for select to anon using (is_published);

create policy parts_read_authenticated on public.parts
for select to authenticated using (is_published or (select private.is_catalog_admin()));

create policy parts_admin_insert on public.parts
for insert to authenticated with check ((select private.is_catalog_admin()));

create policy parts_admin_update on public.parts
for update to authenticated
using ((select private.is_catalog_admin()))
with check ((select private.is_catalog_admin()));

create policy parts_admin_delete on public.parts
for delete to authenticated using ((select private.is_catalog_admin()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('part-images', 'part-images', true, 8388608, array[
  'image/jpeg', 'image/png', 'image/webp', 'image/avif'
]);

-- Storage download URLs are public. Listing, uploading and deleting require an admin.
create policy catalog_image_admin_select on storage.objects
for select to authenticated
using (bucket_id = 'part-images' and (select private.is_catalog_admin()));

create policy catalog_image_admin_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'part-images'
  and (select private.is_catalog_admin())
  and private.is_catalog_image_path(name)
);

-- Use the Storage API after committing the catalog change. A cleanup request must
-- never delete an image that a catalog row still references.
create policy catalog_image_admin_delete on storage.objects
for delete to authenticated
using (
  bucket_id = 'part-images'
  and (select private.is_catalog_admin())
  and not exists (
    select 1 from public.parts as part
    where part.images @> jsonb_build_array(jsonb_build_object('path', storage.objects.name))
  )
);

create function private.prepare_catalog_part()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := clock_timestamp();
    new.updated_at := new.created_at;
  else
    new.updated_at := greatest(clock_timestamp(), old.updated_at + interval '1 microsecond');
  end if;

  if tg_op = 'INSERT' or new.images is distinct from old.images then
    if not private.valid_catalog_images(new.id, new.images) then
      raise check_violation using message = 'Invalid catalog images', constraint = 'parts_valid_images';
    end if;

    if exists (
      select 1 from jsonb_array_elements(new.images) as image
      where not exists (
        select 1 from storage.objects as object
        where object.bucket_id = 'part-images' and object.name = image->>'path'
      )
    ) then
      raise check_violation using message = 'A catalog image is missing from Storage', constraint = 'parts_image_uploaded';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.prepare_catalog_part() from public, anon, authenticated;

create trigger prepare_catalog_part
before insert or update on public.parts
for each row execute function private.prepare_catalog_part();

commit;
