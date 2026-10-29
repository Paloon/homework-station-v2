export type Status = 'not_started' | 'in_progress' | 'done' | 'submitted';
export type TaskType = 'submit' | 'do' | 'optional';
export type View = 'tasks' | 'timetable' | 'students' | 'overview' | 'manage' | 'more';

export const statusLabels: Record<Status, string> = {
  not_started: 'ยังไม่เริ่ม', in_progress: 'กำลังทำ', done: 'ทำเสร็จแล้ว', submitted: 'ส่งแล้ว',
};
export const typeLabels: Record<TaskType, string> = { submit: 'ต้องส่ง', do: 'ต้องทำ', optional: 'งานเสริม' };

export interface Student { id: string; number: number; name: string; studentCode: string; archivedAt?: string | null }
export interface Subject { id: string; name: string; archivedAt?: string | null }
export interface Assignment {
  id: string; subjectId: string; title: string; type: TaskType;
  assignedOn: string | null; dueDate: string; description: string; attachmentUrl: string | null; archivedAt?: string | null;
}
export interface Submission { assignmentId: string; studentId: string; status: Status; version: number }
export interface Timetable {
  id: string; title: string; url: string; width: number; height: number; updatedAt: string; note: string;
}
export interface ClassroomData {
  classroom: { id: string; name: string; term: string } | null;
  students: Student[]; subjects: Subject[]; assignments: Assignment[]; submissions: Submission[];
  timetable: Timetable | null;
}
export interface Filters {
  completion: 'pending' | 'all' | 'complete'; subjectId: string; type: TaskType | ''; due: '' | 'today' | 'week' | 'overdue'; search: string;
}
export const emptyData = (): ClassroomData => ({ classroom: null, students: [], subjects: [], assignments: [], submissions: [], timetable: null });
