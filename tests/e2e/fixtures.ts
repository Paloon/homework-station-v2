import type { BrowserContext } from '@playwright/test';
import type { ClassroomData, Status } from '../../src/domain/types';

export function fixtureData(): ClassroomData {
  return {
    classroom: { id: 'classroom-test', name: 'ห้องสำหรับทดสอบ', term: 'ภาคเรียนทดสอบ' },
    students: [{ id: 'student-a', number: 1, name: 'นักเรียนทดสอบ หนึ่ง', studentCode: '00123' }, { id: 'student-b', number: 12, name: 'นักเรียนทดสอบ สอง', studentCode: '00456' }],
    subjects: [{ id: 'subject-a', name: 'วิชาทดสอบ ก' }, { id: 'subject-b', name: 'วิชาทดสอบ ข' }],
    assignments: [
      { id: 'task-a', subjectId: 'subject-a', title: 'งานทดสอบที่ต้องส่ง', type: 'submit', assignedOn: '2026-10-26', dueDate: '2026-10-28', description: 'สิ่งที่ต้องส่งวันนี้\nกำลังทำแบบฝึกหัด', attachmentUrl: 'https://example.com/document' },
      { id: 'task-b', subjectId: 'subject-b', title: 'งานทดสอบที่ต้องทำ', type: 'do', assignedOn: '2026-10-26', dueDate: '2026-10-29', description: '', attachmentUrl: null },
      { id: 'task-c', subjectId: 'subject-a', title: 'งานเสริมทดสอบ', type: 'optional', assignedOn: '2026-10-26', dueDate: '2026-11-01', description: '', attachmentUrl: null },
    ],
    submissions: [{ studentId: 'student-a', assignmentId: 'task-b', status: 'done', version: 1 }],
    timetable: null,
  };
}
export async function installFixture(context: BrowserContext, initial = fixtureData(), options: { admin?: boolean; loadError?: boolean; saveError?: boolean; delayMs?: number } = {}) {
  const state = structuredClone(initial); let admin = options.admin ?? true, failedLoad = options.loadError ?? false, failedSave = options.saveError ?? false;
  const calls: { action: string; payload: any }[] = [];
  await context.route('**/__test__/repository', async route => {
    const { action, payload } = route.request().postDataJSON(); calls.push({ action, payload });
    if (options.delayMs) await new Promise(resolve => setTimeout(resolve, options.delayMs));
    const reply = (data: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
    if (action === 'load') {
      if (failedLoad) return reply({ message: 'จำลองโหลดล้มเหลว' }, 503);
      const data = structuredClone(state);
      if (!payload.includeArchived) { data.students = data.students.filter(item => !item.archivedAt); data.subjects = data.subjects.filter(item => !item.archivedAt); data.assignments = data.assignments.filter(item => !item.archivedAt); }
      return reply(data);
    }
    if (action === 'adminAccess') return reply(admin);
    if (action === 'signIn') { admin = true; return reply(null); }
    if (action === 'signOut') { admin = false; return reply(null); }
    if (failedSave) return reply({ message: 'จำลองบันทึกล้มเหลว กรุณาลองใหม่' }, 503);
    if (action === 'setStatus') {
      const current = state.submissions.find(item => item.studentId === payload.studentId && item.assignmentId === payload.assignmentId);
      if ((current?.version ?? 0) !== payload.version) return reply({ message: 'สถานะถูกเปลี่ยนจากอีกเครื่องแล้ว โหลดข้อมูลล่าสุดและเลือกใหม่อีกครั้ง' }, 409);
      if (current) { current.status = payload.status as Status; current.version++; }
      else state.submissions.push({ studentId: payload.studentId, assignmentId: payload.assignmentId, status: payload.status, version: 1 });
    }
    if (action === 'saveClassroom') state.classroom = { id: state.classroom?.id ?? 'new-classroom', name: payload.name, term: payload.term };
    if (action === 'saveStudent') { const index = state.students.findIndex(student => student.id === payload.student.id); if (index < 0) state.students.push(payload.student); else state.students[index] = payload.student; }
    if (action === 'saveSubject') { const index = state.subjects.findIndex(subject => subject.id === payload.subject.id); if (index < 0) state.subjects.push(payload.subject); else state.subjects[index] = payload.subject; }
    if (action === 'saveAssignment') { const index = state.assignments.findIndex(task => task.id === payload.task.id); if (index < 0) state.assignments.push(payload.task); else state.assignments[index] = payload.task; }
    if (action === 'archive') { const key = payload.kind as 'students' | 'subjects' | 'assignments'; const item = state[key].find(item => item.id === payload.id); if (item) item.archivedAt = new Date().toISOString(); }
    if (action === 'importStudents') for (const row of payload.rows) state.students.push({ ...row, id: crypto.randomUUID() });
    if (action === 'timetableHistory') return reply(state.timetable ? [state.timetable] : []);
    return reply(null);
  });
  return { state, calls, recoverLoad: () => { failedLoad = false; }, recoverSave: () => { failedSave = false; } };
}
