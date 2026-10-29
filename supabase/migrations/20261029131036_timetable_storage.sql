begin;
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('timetables', 'timetables', true, 6291456, array['image/png','image/jpeg','image/webp'])
on conflict (id) do nothing;

create policy timetable_read on storage.objects for select to anon, authenticated using (bucket_id = 'timetables');
create policy timetable_upload on storage.objects for insert to authenticated with check (
  bucket_id = 'timetables' and (select private.is_admin()) and exists (
    select 1 from public.timetable_images where storage_path = name and not upload_ready and not is_active
  )
);

create function public.mark_timetable_ready(p_id uuid, p_classroom_id uuid) returns void language plpgsql security invoker set search_path = '' as $$
begin
  if not private.is_admin() then raise insufficient_privilege; end if;
  update public.timetable_images as image set upload_ready = true
  where image.id = p_id and image.classroom_id = p_classroom_id
    and exists (select 1 from storage.objects as object where object.bucket_id = 'timetables' and object.name = image.storage_path);
  if not found then raise exception 'IMAGE_NOT_UPLOADED'; end if;
end;
$$;
revoke all on function public.mark_timetable_ready(uuid,uuid) from public;
grant execute on function public.mark_timetable_ready(uuid,uuid) to authenticated;
commit;
