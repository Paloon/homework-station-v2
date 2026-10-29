import { calculateProgress, statusFor } from './progress';
import { statusLabels } from './types';
import type { ClassroomData } from './types';

export function reportRows(data: ClassroomData): string[][] {
  const headers = ['เลขที่', 'ชื่อ-นามสกุล', 'รหัสประจำตัว', 'สถานะรายชื่อ', 'งานบังคับครบ', 'งานบังคับทั้งหมด', 'เปอร์เซ็นต์งานบังคับ', 'งานเสริมสำเร็จ', ...data.assignments.map(task => `${data.subjects.find(subject => subject.id === task.subjectId)?.name ?? ''} | ${task.title} | ${task.dueDate} | ${task.id}${task.archivedAt ? ' | เก็บเข้าประวัติ' : ''}`)];
  return [headers, ...data.students.map(student => {
    const progress = calculateProgress(data.assignments, data.submissions, student.id);
    return [String(student.number), student.name, student.studentCode, student.archivedAt ? 'เก็บเข้าประวัติ' : 'ใช้งานอยู่', String(progress.completed), String(progress.required), progress.percent === null ? '' : String(progress.percent), String(progress.optionalCompleted), ...data.assignments.map(task => statusLabels[statusFor(data.submissions, student.id, task.id)])];
  })];
}
