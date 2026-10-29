import { PGlite } from '@electric-sql/pglite';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';

const db = new PGlite();
const room = '00000000-0000-4000-8000-000000000001', student = '00000000-0000-4000-8000-000000000002', subject = '00000000-0000-4000-8000-000000000003', task = '00000000-0000-4000-8000-000000000004', admin = '00000000-0000-4000-8000-000000000005';

beforeAll(async () => {
  await db.exec(`
    create role anon; create role authenticated;
    create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
    grant usage on schema auth to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;
    create schema storage;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid default gen_random_uuid(), bucket_id text, name text, metadata jsonb);
    alter table storage.objects enable row level security;
    grant usage on schema storage to anon, authenticated;
    grant select,insert on storage.objects to anon, authenticated;
  `);
  for (const filename of readdirSync('supabase/migrations').filter(name => name.endsWith('.sql')).sort()) await db.exec(readFileSync(`supabase/migrations/${filename}`, 'utf8'));
  await db.exec(`
    insert into auth.users values ('${admin}'); insert into private.admin_members values ('${admin}');
    insert into public.classrooms(id,label) values ('${room}','ห้องทดสอบ');
    insert into public.students(id,classroom_id,no,name,student_code) values ('${student}','${room}',1,'นักเรียนทดสอบ','00123');
    insert into public.subjects(id,classroom_id,name) values ('${subject}','${room}','วิชาทดสอบ');
    insert into public.assignments(id,classroom_id,subject_id,title,task_type,assigned_on,due_date) values ('${task}','${room}','${subject}','งานทดสอบ','submit','2026-10-26','2026-10-29');
  `);
});
afterAll(async () => { await db.close(); });

async function asRole<T>(role: string, user: string, run: () => Promise<T>): Promise<T> {
  await db.exec(`set role ${role}; select set_config('request.jwt.claim.sub','${user}',false)`);
  try { return await run(); } finally { await db.exec(`reset role; select set_config('request.jwt.claim.sub','',false)`); }
}

describe('Postgres migrations and contracts (PGlite, not live Supabase)', () => {
  it('สร้างจากฐานว่างและบังคับห้องเดียว', async () => {
    const result = await db.query<{ count: number }>('select count(*)::int as count from public.classrooms');
    expect(result.rows[0].count).toBe(1);
    await expect(db.query("insert into public.classrooms(label) values ('อีกห้อง')")).rejects.toThrow();
  });
  it('anon อ่านได้ แต่แก้รายชื่อหรือเขียนสถานะตรง ๆ ไม่ได้', async () => {
    await asRole('anon', '', async () => {
      expect((await db.query<{ name: string }>('select name from public.students')).rows[0].name).toBe('นักเรียนทดสอบ');
      await expect(db.query("insert into public.students(classroom_id,no,name) values ($1,8,'ห้ามเพิ่ม')", [room])).rejects.toThrow();
      await expect(db.query("update public.submissions set status='submitted'")).rejects.toThrow();
    });
  });
  it('authenticated ที่ไม่ใช่ผู้ดูแลไม่สามารถเพิ่มข้อมูล', async () => {
    await asRole('authenticated', student, async () => {
      expect((await db.query<{ admin_access: boolean }>('select public.admin_access()')).rows[0].admin_access).toBe(false);
      await expect(db.query("insert into public.subjects(classroom_id,name) values ($1,'ห้ามเพิ่ม')", [room])).rejects.toThrow();
    });
  });
  it('RPC สถานะตรวจ version, retry ไม่เพิ่มซ้ำ, done ของ submit ยังไม่มี completed_at', async () => {
    await asRole('anon', '', async () => {
      const first = await db.query<{ result: { version: number; completed_at: string | null } }>('select public.set_submission_status($1,$2,$3,$4) as result', [student, task, 'done', 0]);
      expect(Number(first.rows[0].result.version)).toBe(1); expect(first.rows[0].result.completed_at).toBeNull();
      const retry = await db.query<{ result: { version: number } }>('select public.set_submission_status($1,$2,$3,$4) as result', [student, task, 'done', 0]);
      expect(Number(retry.rows[0].result.version)).toBe(1);
      await expect(db.query('select public.set_submission_status($1,$2,$3,$4)', [student, task, 'submitted', 0])).rejects.toThrow('STATUS_CONFLICT');
      const next = await db.query<{ result: { version: number; completed_at: string | null } }>('select public.set_submission_status($1,$2,$3,$4) as result', [student, task, 'submitted', 1]);
      expect(Number(next.rows[0].result.version)).toBe(2); expect(next.rows[0].result.completed_at).not.toBeNull();
      await expect(db.query('select public.set_submission_status($1,$2,$3,$4)', [student, task, 'unknown', 2])).rejects.toThrow();
    });
  });
  it('FK/วันที่/เลขที่ซ้ำกันถูกปฏิเสธ', async () => {
    await expect(db.query("insert into public.students(classroom_id,no,name) values ($1,1,'ซ้ำ')", [room])).rejects.toThrow();
    await expect(db.query("insert into public.assignments(classroom_id,subject_id,title,task_type,assigned_on,due_date) values ($1,$2,'วันที่ผิด','do','2026-10-30','2026-10-29')", [room, subject])).rejects.toThrow();
    await expect(db.query("insert into public.submissions(classroom_id,student_id,assignment_id,status) values ($1,$2,$3,'done')", [room, crypto.randomUUID(), task])).rejects.toThrow();
  });
  it('import ทั้งชุดเป็น atomic และ batch เดิมนำเข้าซ้ำไม่เพิ่มแถว', async () => {
    await asRole('authenticated', admin, async () => {
      const batch = crypto.randomUUID(), rows = [{ number: 2, name: 'นำเข้า ทดสอบ', studentCode: '00002' }];
      await db.query('select public.import_students($1,$2,$3)', [room, batch, JSON.stringify(rows)]);
      await db.query('select public.import_students($1,$2,$3)', [room, batch, JSON.stringify(rows)]);
      expect((await db.query<{ count: number }>('select count(*)::int as count from public.students where no=2')).rows[0].count).toBe(1);
      await expect(db.query('select public.import_students($1,$2,$3)', [room, crypto.randomUUID(), JSON.stringify([{ number: 3, name: 'ต้อง rollback', studentCode: '003' }, { number: 2, name: 'ซ้ำ', studentCode: '004' }])])).rejects.toThrow();
      expect((await db.query('select * from public.students where no=3')).rows).toHaveLength(0);
    });
  });
  it('รูปใหม่ activate ไม่ได้ก่อน upload และสลับรูปแล้วยังมี active เดียว', async () => {
    await asRole('authenticated', admin, async () => {
      const first = crypto.randomUUID(), second = crypto.randomUUID();
      for (const id of [first, second]) {
        await db.query("insert into public.timetable_images(id,classroom_id,title,storage_path,mime_type,width,height,byte_size) values ($1,$2,'ภาพทดสอบ',$3,'image/png',1200,800,100)", [id, room, `${room}/${id}/original.png`]);
        await expect(db.query('select public.activate_timetable($1,$2)', [id, room])).rejects.toThrow('IMAGE_NOT_READY');
        await expect(db.query('select public.mark_timetable_ready($1,$2)', [id, room])).rejects.toThrow('IMAGE_NOT_UPLOADED');
        await db.query("insert into storage.objects(bucket_id,name) values ('timetables',$1)", [`${room}/${id}/original.png`]);
        await db.query('select public.mark_timetable_ready($1,$2)', [id, room]);
        await db.query('select public.activate_timetable($1,$2)', [id, room]);
      }
      expect((await db.query<{ id: string }>('select id from public.timetable_images where is_active')).rows).toEqual([{ id: second }]);
    });
  });
  it('archive ป้องกันเขียนสถานะ/กู้กลับเงียบ ๆ และวิชาที่มีงานยัง archive ไม่ได้', async () => {
    await expect(db.query('update public.subjects set archived_at=now() where id=$1', [subject])).rejects.toThrow('SUBJECT_IN_USE');
    await db.query('update public.students set archived_at=now() where id=$1', [student]);
    await asRole('anon', '', async () => {
      await expect(db.query('select public.set_submission_status($1,$2,$3,$4)', [student, task, 'submitted', 2])).rejects.toThrow('RECORD_ARCHIVED');
    });
    await expect(db.query('update public.students set archived_at=null where id=$1', [student])).rejects.toThrow('RECORD_ARCHIVED');
  });
});
