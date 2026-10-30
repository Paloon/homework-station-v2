begin;
-- This classroom intentionally permits collaborative editing without an Auth session.
-- Keep row constraints, soft archives and the status RPC as the write boundaries.
do $$ declare table_name text; begin
  foreach table_name in array array['classrooms','students','subjects','assignments','timetable_images'] loop
    execute format('drop policy admin_insert on public.%I', table_name);
    execute format('drop policy admin_update on public.%I', table_name);
    execute format('grant insert, update on public.%I to anon, authenticated', table_name);
    execute format('revoke delete on public.%I from anon, authenticated', table_name);
    if table_name = 'classrooms' then
      execute 'create policy classroom_shared_insert on public.classrooms for insert to anon, authenticated with check (singleton)';
      execute 'create policy classroom_shared_update on public.classrooms for update to anon, authenticated using (singleton) with check (singleton)';
    else
      execute format('create policy classroom_shared_insert on public.%I for insert to anon, authenticated with check (exists (select 1 from public.classrooms c where c.id = %I.classroom_id))', table_name, table_name);
      execute format('create policy classroom_shared_update on public.%I for update to anon, authenticated using (exists (select 1 from public.classrooms c where c.id = %I.classroom_id)) with check (exists (select 1 from public.classrooms c where c.id = %I.classroom_id))', table_name, table_name, table_name);
    end if;
  end loop;
end $$;

grant execute on function public.save_classroom(text,text) to anon;

create or replace function private.import_students(p_classroom_id uuid, p_batch_id uuid, p_rows jsonb) returns integer language plpgsql security definer set search_path = '' as $$
declare previous jsonb; item jsonb; total integer := 0;
begin
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 1000 then raise exception 'INVALID_IMPORT'; end if;
  perform 1 from public.classrooms where id = p_classroom_id for update;
  if not found then raise exception 'ROOM_MISSING'; end if;
  select payload into previous from private.import_batches where id = p_batch_id;
  if found then
    if previous <> p_rows or not exists(select 1 from private.import_batches where id = p_batch_id and classroom_id = p_classroom_id) then raise exception 'BATCH_CONFLICT'; end if;
    return jsonb_array_length(previous);
  end if;
  for item in select value from jsonb_array_elements(p_rows) loop
    insert into public.students(classroom_id, no, name, student_code)
    values (p_classroom_id, (item->>'number')::integer, btrim(item->>'name'), nullif(btrim(item->>'studentCode'), ''));
    total := total + 1;
  end loop;
  insert into private.import_batches(id,classroom_id,payload) values (p_batch_id,p_classroom_id,p_rows);
  return total;
end;
$$;

create or replace function public.activate_timetable(p_id uuid, p_classroom_id uuid) returns void language plpgsql security invoker set search_path = '' as $$
begin
  perform 1 from public.classrooms where id = p_classroom_id for update;
  perform 1 from public.timetable_images where id = p_id and classroom_id = p_classroom_id and upload_ready;
  if not found then raise exception 'IMAGE_NOT_READY'; end if;
  update public.timetable_images set is_active = false where classroom_id = p_classroom_id and is_active;
  update public.timetable_images set is_active = true where id = p_id and classroom_id = p_classroom_id;
end;
$$;

create or replace function public.mark_timetable_ready(p_id uuid, p_classroom_id uuid) returns void language plpgsql security invoker set search_path = '' as $$
begin
  update public.timetable_images as image set upload_ready = true
  where image.id = p_id and image.classroom_id = p_classroom_id
    and exists (select 1 from storage.objects as object where object.bucket_id = 'timetables' and object.name = image.storage_path);
  if not found then raise exception 'IMAGE_NOT_UPLOADED'; end if;
end;
$$;

grant execute on function private.import_students(uuid,uuid,jsonb) to anon;
grant execute on function public.import_students(uuid,uuid,jsonb) to anon;
grant execute on function public.activate_timetable(uuid,uuid) to anon;
grant execute on function public.mark_timetable_ready(uuid,uuid) to anon;
grant select, insert on storage.objects to anon, authenticated;

drop policy timetable_upload on storage.objects;
create policy timetable_upload on storage.objects for insert to anon, authenticated with check (
  bucket_id = 'timetables' and exists (
    select 1 from public.timetable_images image
    where image.storage_path = storage.objects.name and not image.upload_ready and not image.is_active
      and exists (select 1 from public.classrooms c where c.id = image.classroom_id)
  )
);
commit;
