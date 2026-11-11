begin;

create table private.part_viewers (
  part_id uuid not null references public.parts (id) on delete cascade,
  viewer_hash bytea not null,
  primary key (part_id, viewer_hash)
);

alter table private.part_viewers enable row level security;
revoke all on table private.part_viewers from public, anon, authenticated;

create function private.record_part_view(target_part_id uuid, browser_id uuid)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform 1 from public.parts
  where id = target_part_id and is_published
  for share;

  if not found then
    return null;
  end if;

  if browser_id is not null then
    -- Scope the anonymous fingerprint to one part so rows cannot link a browser's visits across parts.
    insert into private.part_viewers (part_id, viewer_hash)
    values (target_part_id, sha256(uuid_send(target_part_id) || uuid_send(browser_id)))
    on conflict (part_id, viewer_hash) do nothing;
  end if;

  return (select count(*) from private.part_viewers where part_id = target_part_id);
end;
$$;

create function public.record_part_view(target_part_id uuid, browser_id uuid)
returns bigint
language sql
security invoker
set search_path = ''
as $$
  select private.record_part_view(target_part_id, browser_id);
$$;

create function private.list_part_viewer_counts()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case when private.is_catalog_admin() then (
    select coalesce(jsonb_object_agg(part_id, viewer_count), '{}'::jsonb)
    from (
      select part_id, count(*) as viewer_count
      from private.part_viewers
      group by part_id
    ) as counts
  ) end;
$$;

create function public.list_part_viewer_counts()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select private.list_part_viewer_counts();
$$;

grant usage on schema private to anon;
revoke all on function private.record_part_view(uuid, uuid) from public, anon, authenticated;
revoke all on function public.record_part_view(uuid, uuid) from public, anon, authenticated;
grant execute on function private.record_part_view(uuid, uuid) to anon, authenticated;
grant execute on function public.record_part_view(uuid, uuid) to anon, authenticated;
revoke all on function private.list_part_viewer_counts() from public, anon, authenticated;
revoke all on function public.list_part_viewer_counts() from public, anon, authenticated;
grant execute on function private.list_part_viewer_counts() to authenticated;
grant execute on function public.list_part_viewer_counts() to authenticated;

commit;
