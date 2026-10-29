import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Repository, EntityKind } from './repository';
import type { ClassroomData, Timetable, Assignment, Student, Subject, Status } from '../domain/types';

interface ClassroomRow { id: string; label: string; term_label: string }
interface StudentRow { id: string; no: number; name: string; student_code: string | null; archived_at: string | null }
interface SubjectRow { id: string; name: string; archived_at: string | null }
interface AssignmentRow { id: string; subject_id: string; title: string; task_type: Assignment['type']; assigned_on: string; due_date: string; description: string; attachment_url: string | null; archived_at: string | null }
interface SubmissionRow { student_id: string; assignment_id: string; status: Status; version: number }
interface TimetableRow { id: string; title: string; storage_path: string; width: number; height: number; created_at: string; description: string | null }

function databaseError(error: { code?: string; message?: string } | null): void {
  if (!error) return;
  if (error.message?.includes('STATUS_CONFLICT')) throw new Error('สถานะถูกเปลี่ยนจากอีกเครื่องแล้ว โหลดข้อมูลล่าสุดและเลือกใหม่อีกครั้ง');
  if (error.message?.includes('RECORD_ARCHIVED')) throw new Error('นักเรียนหรืองานนี้ถูกเก็บเข้าประวัติแล้ว กรุณาโหลดข้อมูลล่าสุด');
  if (error.message?.includes('SUBJECT_IN_USE')) throw new Error('วิชานี้ยังมีงานใช้งานอยู่ กรุณาเก็บงานเหล่านั้นเข้าประวัติก่อน');
  if (error.code === '23505') throw new Error('มีเลขที่ รหัส หรือชื่อวิชานี้แล้ว กรุณาตรวจรายการก่อนบันทึกอีกครั้ง');
  if (error.code === '42501' || error.code === 'PGRST301') throw new Error('ไม่มีสิทธิ์บันทึกรายการนี้ กรุณาเข้าสู่ระบบผู้ดูแลอีกครั้ง');
  throw new Error('เชื่อมต่อหรือบันทึกข้อมูลไม่สำเร็จ กรุณาลองใหม่ หากยังเกิดซ้ำให้ผู้ดูแลตรวจการตั้งค่าระบบ');
}

// A classroom is loaded in full so progress never uses a truncated page as its denominator.
async function allRows<T>(client: SupabaseClient, table: string, columns: string, classroomId?: string, activeOnly = true): Promise<T[]> {
  const rows: T[] = [];
  for (let offset = 0; ; offset += 500) {
    let query = client.from(table).select(columns).order(table === 'submissions' ? 'student_id' : 'id');
    if (table === 'submissions') query = query.order('assignment_id');
    if (classroomId) query = query.eq('classroom_id', classroomId);
    if (activeOnly) query = query.is('archived_at', null);
    const result = await query.range(offset, offset + 499).returns<T[]>();
    databaseError(result.error);
    rows.push(...(result.data ?? []));
    if ((result.data?.length ?? 0) < 500) return rows;
  }
}

export function createSupabaseRepository(url: string, key: string): Repository {
  const client = createClient(url, key);
  function timetable(row: TimetableRow): Timetable {
    return { id: row.id, title: row.title, url: client.storage.from('timetables').getPublicUrl(row.storage_path).data.publicUrl, width: row.width, height: row.height, updatedAt: row.created_at, note: row.description ?? '' };
  }
  async function upsert(table: string, row: Record<string, unknown>): Promise<void> {
    const { data, error } = await client.from(table).upsert(row).select('id').single();
    databaseError(error); if (!data) throw new Error('บันทึกไม่สำเร็จ กรุณาลองใหม่');
  }
  return {
    configured: true, fixture: false,
    async load(includeArchived = false): Promise<ClassroomData> {
      const classrooms = await allRows<ClassroomRow>(client, 'classrooms', 'id,label,term_label', undefined, false);
      if (classrooms.length > 1) throw new Error('รุ่นนี้รองรับห้องเดียว กรุณาตรวจการตั้งค่าห้องเรียน');
      const classroom = classrooms[0];
      if (!classroom) return { classroom: null, students: [], subjects: [], assignments: [], submissions: [], timetable: null };
      const [students, subjects, assignments, submissions, images] = await Promise.all([
        allRows<StudentRow>(client, 'students', 'id,no,name,student_code,archived_at', classroom.id, !includeArchived),
        allRows<SubjectRow>(client, 'subjects', 'id,name,archived_at', classroom.id, !includeArchived),
        allRows<AssignmentRow>(client, 'assignments', 'id,subject_id,title,task_type,assigned_on,due_date,description,attachment_url,archived_at', classroom.id, !includeArchived),
        allRows<SubmissionRow>(client, 'submissions', 'student_id,assignment_id,status,version', classroom.id, false),
        client.from('timetable_images').select('id,title,storage_path,width,height,created_at,description').eq('classroom_id', classroom.id).eq('is_active', true).returns<TimetableRow[]>(),
      ]);
      databaseError(images.error);
      return {
        classroom: { id: classroom.id, name: classroom.label, term: classroom.term_label },
        students: students.map(row => ({ id: row.id, number: row.no, name: row.name, studentCode: row.student_code ?? '', archivedAt: row.archived_at })).sort((a, b) => a.number - b.number),
        subjects: subjects.map(row => ({ id: row.id, name: row.name, archivedAt: row.archived_at })),
        assignments: assignments.map(row => ({ id: row.id, subjectId: row.subject_id, title: row.title, type: row.task_type, assignedOn: row.assigned_on, dueDate: row.due_date, description: row.description, attachmentUrl: row.attachment_url, archivedAt: row.archived_at })),
        submissions: submissions.map(row => ({ studentId: row.student_id, assignmentId: row.assignment_id, status: row.status, version: Number(row.version) })),
        timetable: images.data?.[0] ? timetable(images.data[0]) : null,
      };
    },
    async adminAccess() { const { data, error } = await client.rpc('admin_access'); databaseError(error); return data === true; },
    async signIn(email, password) {
      const { error } = await client.auth.signInWithPassword({ email, password });
      if (error) throw new Error('เข้าสู่ระบบไม่สำเร็จ ตรวจอีเมลและรหัสผ่านแล้วลองใหม่');
    },
    async signOut() { const { error } = await client.auth.signOut(); databaseError(error); },
    async setStatus(studentId, assignmentId, status, version) {
      const result = await client.rpc('set_submission_status', { p_student_id: studentId, p_assignment_id: assignmentId, p_status: status, p_expected_version: version });
      databaseError(result.error); return result.data;
    },
    async saveClassroom(name, term) {
      const { error } = await client.rpc('save_classroom', { p_label: name, p_term_label: term }); databaseError(error);
    },
    saveStudent: (student: Student, classroomId: string) => upsert('students', { id: student.id, classroom_id: classroomId, no: student.number, name: student.name, student_code: student.studentCode || null }),
    saveSubject: (subject: Subject, classroomId: string) => upsert('subjects', { id: subject.id, classroom_id: classroomId, name: subject.name }),
    saveAssignment: (task: Assignment, classroomId: string) => upsert('assignments', { id: task.id, classroom_id: classroomId, subject_id: task.subjectId, title: task.title, task_type: task.type, assigned_on: task.assignedOn, due_date: task.dueDate, description: task.description, attachment_url: task.attachmentUrl }),
    async archive(kind: EntityKind, id: string) {
      const result = await client.from(kind).update({ archived_at: new Date().toISOString() }).eq('id', id).select('id').single();
      databaseError(result.error); if (!result.data) throw new Error('ไม่พบรายการนี้แล้ว กรุณาโหลดข้อมูลล่าสุด');
    },
    async importStudents(rows, batchId, classroomId) {
      const result = await client.rpc('import_students', { p_classroom_id: classroomId, p_batch_id: batchId, p_rows: rows }); databaseError(result.error);
    },
    async uploadTimetable(file, metadata, classroomId, id) {
      const extension = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }[file.type];
      if (!extension || file.size > 6 * 1024 * 1024) throw new Error('เลือกไฟล์ PNG, JPEG หรือ WebP ขนาดไม่เกิน 6 MB');
      const path = `${classroomId}/${id}/original.${extension}`;
      // Reserve metadata first: failed uploads remain visible for an explicit retry, never replace the old active image.
      const reserved = await client.from('timetable_images').upsert({ id, classroom_id: classroomId, title: metadata.title, storage_path: path, mime_type: file.type, width: metadata.width, height: metadata.height, byte_size: file.size, description: metadata.note }, { onConflict: 'id', ignoreDuplicates: true });
      databaseError(reserved.error);
      const uploaded = await client.storage.from('timetables').upload(path, file, { upsert: false, contentType: file.type });
      if (uploaded.error) {
        const existing = await client.storage.from('timetables').download(path);
        if (existing.error || !existing.data || existing.data.size !== file.size || !await sameBytes(existing.data, file)) throw new Error('อัปโหลดรูปไม่สำเร็จ รูปเดิมยังใช้งานอยู่ กรุณาลองใหม่');
      }
      const ready = await client.rpc('mark_timetable_ready', { p_id: id, p_classroom_id: classroomId });
      databaseError(ready.error);
      const active = await client.rpc('activate_timetable', { p_id: id, p_classroom_id: classroomId });
      if (active.error) throw new Error('อัปโหลดแล้ว แต่ยังเปิดใช้รูปใหม่ไม่สำเร็จ รูปเดิมยังใช้งานอยู่ ลองใหม่หรือเปิดประวัติรูป');
    },
    async timetableHistory(classroomId) {
      const result = await client.from('timetable_images').select('id,title,storage_path,width,height,created_at,description').eq('classroom_id', classroomId).order('created_at', { ascending: false }).returns<TimetableRow[]>();
      databaseError(result.error); return (result.data ?? []).map(timetable);
    },
    async activateTimetable(id, classroomId) { const { error } = await client.rpc('activate_timetable', { p_id: id, p_classroom_id: classroomId }); databaseError(error); },
    subscribe(onChange, onConnection) {
      const channel = client.channel('classroom-state');
      for (const table of ['classrooms', 'students', 'subjects', 'assignments', 'submissions', 'timetable_images']) channel.on('postgres_changes', { event: '*', schema: 'public', table }, onChange);
      channel.subscribe(status => { onConnection(status === 'SUBSCRIBED'); if (status === 'SUBSCRIBED') onChange(); });
      return () => { void client.removeChannel(channel); };
    },
  };
}

async function sameBytes(left: Blob, right: Blob): Promise<boolean> {
  const [a, b] = await Promise.all([left.arrayBuffer(), right.arrayBuffer()]);
  const first = new Uint8Array(a), second = new Uint8Array(b);
  return first.length === second.length && first.every((value, index) => value === second[index]);
}
