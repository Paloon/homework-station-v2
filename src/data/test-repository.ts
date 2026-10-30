// This adapter is imported only by Vite test mode. All fixtures live in tests/.
import type { Repository } from './repository';
import type { ClassroomData } from '../domain/types';

export function createFixtureRepository(): Repository {
  async function request(action: string, payload: unknown = {}): Promise<any> {
    const response = await fetch('/__test__/repository', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, payload }) });
    if (!response.ok) throw new Error((await response.json()).message || 'บันทึกไม่สำเร็จ');
    return response.json();
  }
  return {
    configured: true, fixture: true,
    load: (includeArchived = false) => request('load', { includeArchived }) as Promise<ClassroomData>,
    setStatus: (studentId, assignmentId, status, version) => request('setStatus', { studentId, assignmentId, status, version }),
    saveClassroom: (name, term) => request('saveClassroom', { name, term }),
    saveStudent: (student, classroomId) => request('saveStudent', { student, classroomId }),
    saveSubject: (subject, classroomId) => request('saveSubject', { subject, classroomId }),
    saveAssignment: (task, classroomId) => request('saveAssignment', { task, classroomId }),
    archive: (kind, id) => request('archive', { kind, id }),
    importStudents: (rows, batchId, classroomId) => request('importStudents', { rows, batchId, classroomId }),
    uploadTimetable: (_file, metadata, classroomId, id) => request('uploadTimetable', { metadata, classroomId, id }),
    timetableHistory: classroomId => request('timetableHistory', { classroomId }),
    activateTimetable: (id, classroomId) => request('activateTimetable', { id, classroomId }),
    subscribe: (_change, connection) => { connection(true); return () => {}; },
  };
}
