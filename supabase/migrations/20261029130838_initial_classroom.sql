begin;

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated;

create table private.admin_members (
  user_id uuid primary key references auth.users(id) on delete cascade
);

create function private.is_admin() returns boolean language sql stable security definer
set search_path = '' as $$
  select auth.uid() is not null and exists (select 1 from private.admin_members where user_id = auth.uid());
$$;
revoke all on function private.is_admin() from public;
grant execute on function private.is_admin() to anon, authenticated;

create function public.admin_access() returns boolean language sql stable security invoker
set search_path = '' as $$ select private.is_admin(); $$;
revoke all on function public.admin_access() from public;
grant execute on function public.admin_access() to anon, authenticated;

create table public.classrooms (
  id uuid primary key default gen_random_uuid(),
  singleton boolean not null default true unique check (singleton),
  label text not null check (length(btrim(label)) between 1 and 100),
  term_label text not null default '' check (length(term_label) <= 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.students (
  id uuid primary key default gen_random_uuid(),
  classroom_id uuid not null references public.classrooms(id) on delete restrict,
  no integer not null check (no > 0),
  name text not null check (length(btrim(name)) between 1 and 200),
  student_code text check (student_code is null or length(btrim(student_code)) between 1 and 100),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, classroom_id)
);
create unique index students_active_no on public.students(classroom_id, no) where archived_at is null;
create unique index students_active_code on public.students(classroom_id, student_code) where archived_at is null and student_code is not null;
create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  classroom_id uuid not null references public.classrooms(id) on delete restrict,
  name text not null check (length(btrim(name)) between 1 and 200),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, classroom_id)
);
create unique index subjects_active_name on public.subjects(classroom_id, name) where archived_at is null;
create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  classroom_id uuid not null references public.classrooms(id) on delete restrict,
  subject_id uuid not null,
  title text not null check (length(btrim(title)) between 1 and 300),
  description text not null default '' check (length(description) <= 10000),
  task_type text not null check (task_type in ('submit', 'do', 'optional')),
  assigned_on date not null,
  due_date date not null,
  attachment_url text check (attachment_url is null or attachment_url ~ '^https?://'),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (assigned_on <= due_date),
  unique (id, classroom_id),
  foreign key (subject_id, classroom_id) references public.subjects(id, classroom_id) on delete restrict
);
create index assignments_subject on public.assignments(subject_id, classroom_id);
create index assignments_due on public.assignments(classroom_id, due_date, id) where archived_at is null;
create index assignments_assigned on public.assignments(classroom_id, assigned_on) where archived_at is null;
create table public.submissions (
  classroom_id uuid not null references public.classrooms(id) on delete restrict,
  student_id uuid not null,
  assignment_id uuid not null,
  status text not null check (status in ('not_started', 'in_progress', 'done', 'submitted')),
  version bigint not null default 1 check (version > 0),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (student_id, assignment_id),
  foreign key (student_id, classroom_id) references public.students(id, classroom_id) on delete cascade,
  foreign key (assignment_id, classroom_id) references public.assignments(id, classroom_id) on delete cascade
);
create index submissions_assignment on public.submissions(assignment_id, classroom_id);
create index submissions_classroom on public.submissions(classroom_id, student_id);
create table public.timetable_images (
  id uuid primary key default gen_random_uuid(),
  classroom_id uuid not null references public.classrooms(id) on delete restrict,
  title text not null check (length(btrim(title)) between 1 and 200),
  storage_path text not null unique,
  mime_type text not null check (mime_type in ('image/png', 'image/jpeg', 'image/webp')),
  width integer not null check (width > 0), height integer not null check (height > 0),
  byte_size bigint not null check (byte_size > 0 and byte_size <= 6291456),
  description text not null default '' check (length(description) <= 2000),
  upload_ready boolean not null default false,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (not is_active or upload_ready),
  check (storage_path like classroom_id::text || '/' || id::text || '/original.%')
);
create unique index one_active_timetable on public.timetable_images(classroom_id) where is_active;
create index timetable_history on public.timetable_images(classroom_id, created_at desc);
create table private.import_batches (
  id uuid primary key,
  classroom_id uuid not null references public.classrooms(id),
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create function private.touch_updated_at() returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_table_name in ('students','subjects','assignments') then
    if old.archived_at is not null and new.archived_at is null then raise exception 'RECORD_ARCHIVED'; end if;
  end if;
  new.updated_at := now(); return new;
end;
$$;
revoke all on function private.touch_updated_at() from public;

do $$ declare table_name text; begin
  foreach table_name in array array['classrooms','students','subjects','assignments','submissions','timetable_images'] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('create trigger touch_updated_at before update on public.%I for each row execute function private.touch_updated_at()', table_name);
    execute format('grant select on public.%I to anon, authenticated', table_name);
    execute format('create policy read_classroom on public.%I for select to anon, authenticated using (true)', table_name);
    if table_name <> 'submissions' then
      execute format('grant insert, update on public.%I to authenticated', table_name);
      execute format('create policy admin_insert on public.%I for insert to authenticated with check ((select private.is_admin()))', table_name);
      execute format('create policy admin_update on public.%I for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()))', table_name);
    end if;
  end loop;
end $$;

create function public.save_classroom(p_label text, p_term_label text) returns uuid language plpgsql security invoker set search_path = '' as $$
declare result uuid;
begin
  insert into public.classrooms(label, term_label) values (btrim(p_label), btrim(p_term_label))
  on conflict (singleton) do update set label = excluded.label, term_label = excluded.term_label returning id into result;
  return result;
end;
$$;
revoke all on function public.save_classroom(text,text) from public;
grant execute on function public.save_classroom(text,text) to authenticated;

create function private.validate_relations() returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_table_name = 'subjects' and new.archived_at is not null and old.archived_at is null then
    if exists (select 1 from public.assignments where subject_id = new.id and archived_at is null) then raise exception 'SUBJECT_IN_USE'; end if;
  elsif tg_table_name = 'assignments' and new.archived_at is null then
    perform 1 from public.subjects where id = new.subject_id and classroom_id = new.classroom_id and archived_at is null for share;
    if not found then raise exception 'RECORD_ARCHIVED'; end if;
  end if;
  return new;
end;
$$;
revoke all on function private.validate_relations() from public;
create trigger subjects_relations before update on public.subjects for each row execute function private.validate_relations();
create trigger assignments_relations before insert or update on public.assignments for each row execute function private.validate_relations();

-- The classroom explicitly uses shared student selection, not verified student identity.
-- Only this narrow function can change a submission; anonymous direct table writes stay denied.
create function private.write_status(p_student_id uuid, p_assignment_id uuid, p_status text, p_expected_version bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare room uuid; task public.assignments; existing public.submissions; changed public.submissions;
begin
  if p_status not in ('not_started','in_progress','done','submitted') or p_status is null or p_expected_version is null or p_expected_version < 0 then raise exception 'INVALID_STATUS'; end if;
  select classroom_id into room from public.students where id = p_student_id and archived_at is null for share;
  if not found then raise exception 'RECORD_ARCHIVED'; end if;
  select * into task from public.assignments where id = p_assignment_id and classroom_id = room and archived_at is null for share;
  if not found then raise exception 'RECORD_ARCHIVED'; end if;
  insert into public.submissions as target(classroom_id, student_id, assignment_id, status, version, completed_at)
  select room, p_student_id, p_assignment_id, p_status, 1,
    case when p_status = 'submitted' or (task.task_type <> 'submit' and p_status = 'done') then now() else null end
  where p_expected_version = 0
  on conflict (student_id, assignment_id) do nothing returning * into changed;
  if changed.student_id is null then
    update public.submissions set status = p_status, version = version + 1,
      completed_at = case when p_status = 'submitted' or (task.task_type <> 'submit' and p_status = 'done') then coalesce(completed_at, now()) else null end
    where student_id = p_student_id and assignment_id = p_assignment_id and version = p_expected_version
    returning * into changed;
  end if;
  if changed.student_id is null then
    select * into existing from public.submissions where student_id = p_student_id and assignment_id = p_assignment_id;
    if existing.status = p_status and existing.version = p_expected_version + 1 then return to_jsonb(existing); end if;
    raise exception 'STATUS_CONFLICT';
  end if;
  return to_jsonb(changed);
end;
$$;
revoke all on function private.write_status(uuid,uuid,text,bigint) from public;
grant execute on function private.write_status(uuid,uuid,text,bigint) to anon, authenticated;
create function public.set_submission_status(p_student_id uuid, p_assignment_id uuid, p_status text, p_expected_version bigint)
returns jsonb language sql security invoker set search_path = '' as $$ select private.write_status(p_student_id,p_assignment_id,p_status,p_expected_version); $$;
revoke all on function public.set_submission_status(uuid,uuid,text,bigint) from public;
grant execute on function public.set_submission_status(uuid,uuid,text,bigint) to anon, authenticated;

create function private.import_students(p_classroom_id uuid, p_batch_id uuid, p_rows jsonb) returns integer language plpgsql security definer set search_path = '' as $$
declare previous jsonb; item jsonb; total integer := 0;
begin
  if not private.is_admin() then raise insufficient_privilege; end if;
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
revoke all on function private.import_students(uuid,uuid,jsonb) from public;
grant execute on function private.import_students(uuid,uuid,jsonb) to authenticated;
create function public.import_students(p_classroom_id uuid, p_batch_id uuid, p_rows jsonb) returns integer language sql security invoker set search_path = '' as $$ select private.import_students(p_classroom_id,p_batch_id,p_rows); $$;
revoke all on function public.import_students(uuid,uuid,jsonb) from public;
grant execute on function public.import_students(uuid,uuid,jsonb) to authenticated;

create function public.activate_timetable(p_id uuid, p_classroom_id uuid) returns void language plpgsql security invoker set search_path = '' as $$
begin
  if not private.is_admin() then raise insufficient_privilege; end if;
  perform 1 from public.classrooms where id = p_classroom_id for update;
  perform 1 from public.timetable_images where id = p_id and classroom_id = p_classroom_id and upload_ready;
  if not found then raise exception 'IMAGE_NOT_READY'; end if;
  update public.timetable_images set is_active = false where classroom_id = p_classroom_id and is_active;
  update public.timetable_images set is_active = true where id = p_id and classroom_id = p_classroom_id;
end;
$$;
revoke all on function public.activate_timetable(uuid,uuid) from public;
grant execute on function public.activate_timetable(uuid,uuid) to authenticated;

do $$ declare name text; begin
  if exists(select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach name in array array['classrooms','students','subjects','assignments','submissions','timetable_images'] loop
      execute format('alter publication supabase_realtime add table public.%I', name);
    end loop;
  end if;
end $$;

commit;
