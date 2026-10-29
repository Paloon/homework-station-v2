import type { ClassroomData, Status, Student, Subject, Assignment, Timetable } from '../domain/types';
import type { RosterRow } from '../domain/csv';

export type EntityKind = 'students' | 'subjects' | 'assignments';
export interface Repository {
  configured: boolean;
  fixture: boolean;
  load(includeArchived?: boolean): Promise<ClassroomData>;
  adminAccess(): Promise<boolean>;
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  setStatus(studentId: string, assignmentId: string, status: Status, version: number): Promise<unknown>;
  saveClassroom(name: string, term: string): Promise<void>;
  saveStudent(student: Student, classroomId: string): Promise<void>;
  saveSubject(subject: Subject, classroomId: string): Promise<void>;
  saveAssignment(task: Assignment, classroomId: string): Promise<void>;
  archive(kind: EntityKind, id: string): Promise<void>;
  importStudents(rows: RosterRow[], batchId: string, classroomId: string): Promise<void>;
  uploadTimetable(file: File, metadata: Omit<Timetable, 'id' | 'url' | 'updatedAt'>, classroomId: string, id: string): Promise<void>;
  timetableHistory(classroomId: string): Promise<Timetable[]>;
  activateTimetable(id: string, classroomId: string): Promise<void>;
  subscribe(onChange: () => void, onConnection: (ready: boolean) => void): () => void;
}

export async function createRepository(): Promise<Repository | null> {
  if (import.meta.env.MODE === 'test' && new URLSearchParams(location.search).has('fixture')) {
    const { createFixtureRepository } = await import('./test-repository');
    return createFixtureRepository();
  }
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  const { createSupabaseRepository } = await import('./supabase');
  return createSupabaseRepository(url, key);
}
