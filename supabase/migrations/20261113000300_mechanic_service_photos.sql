begin;

alter table public.mechanic_services
  add column images jsonb not null default '[]'::jsonb;

grant insert (id, images), update (images) on public.mechanic_services to authenticated;

create function private.prepare_service_images()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  relative_images jsonb;
begin
  if jsonb_typeof(new.images) is distinct from 'array' then
    raise check_violation using message = 'Invalid service images';
  end if;

  if jsonb_array_length(new.images) > 8 then
    raise check_violation using message = 'Invalid service images';
  end if;

  -- Strip the service prefix before reusing the catalog's path and alt-text validation.
  select coalesce(jsonb_agg(jsonb_build_object(
    'path', substring(image->>'path' from 10),
    'alt', image->'alt'
  )), '[]'::jsonb)
  into relative_images
  from jsonb_array_elements(new.images) as image;

  if not private.valid_catalog_images(new.id, relative_images) or exists (
    select 1 from jsonb_array_elements(new.images) as image
    where not exists (
      select 1 from storage.objects as object
      where object.bucket_id = 'part-images' and object.name = image->>'path'
        and starts_with(object.name, 'services/')
    )
  ) then
    raise check_violation using message = 'Invalid or missing service images';
  end if;
  return new;
end;
$$;

revoke all on function private.prepare_service_images() from public, anon, authenticated;

create trigger prepare_service_images
before insert or update of images on public.mechanic_services
for each row execute function private.prepare_service_images();

alter policy catalog_image_admin_insert on storage.objects
with check (
  bucket_id = 'part-images'
  and (select private.is_catalog_admin())
  and (private.is_catalog_image_path(name)
    or (starts_with(name, 'services/') and private.is_catalog_image_path(substring(name from 10))))
);

create index mechanic_service_images_idx on public.mechanic_services using gin (images jsonb_path_ops);

alter policy catalog_image_admin_delete on storage.objects
using (
  bucket_id = 'part-images'
  and (select private.is_catalog_admin())
  and not exists (
    select 1 from public.parts as part
    where part.images @> jsonb_build_array(jsonb_build_object('path', storage.objects.name))
  )
  and not exists (
    select 1 from public.mechanic_services as service
    where service.images @> jsonb_build_array(jsonb_build_object('path', storage.objects.name))
  )
);

commit;
