import { calendarDay } from './dates';
import type { Assignment, Filters, Status, Submission } from './types';

export function isComplete(task: Assignment, status: Status = 'not_started'): boolean {
  return status === 'submitted' || (task.type !== 'submit' && status === 'done');
}

export function statusFor(submissions: Submission[], studentId: string, assignmentId: string): Status {
  return submissions.find(item => item.studentId === studentId && item.assignmentId === assignmentId)?.status ?? 'not_started';
}

export function calculateProgress(assignments: Assignment[], submissions: Submission[], studentId: string) {
  const required = assignments.filter(task => task.type !== 'optional');
  const completed = required.filter(task => isComplete(task, statusFor(submissions, studentId, task.id))).length;
  return {
    required: required.length, completed,
    optionalCompleted: assignments.filter(task => task.type === 'optional' && isComplete(task, statusFor(submissions, studentId, task.id))).length,
    percent: required.length ? Math.round(completed / required.length * 100) : null,
  };
}

export function selectAssignments(assignments: Assignment[], submissions: Submission[], studentId: string, filters: Filters, today: string): Assignment[] {
  return assignments.filter(task => {
    const complete = isComplete(task, statusFor(submissions, studentId, task.id));
    const difference = calendarDay(task.dueDate) - calendarDay(today);
    return (filters.completion === 'all' || complete === (filters.completion === 'complete'))
      && (!filters.subjectId || task.subjectId === filters.subjectId)
      && (!filters.type || task.type === filters.type)
      && (!filters.search || `${task.title} ${task.description}`.toLocaleLowerCase('th').includes(filters.search.toLocaleLowerCase('th')))
      && (!filters.due || (filters.due === 'overdue' ? difference < 0 && !complete : filters.due === 'today' ? difference === 0 : difference >= 0 && difference <= 7));
  }).sort((left, right) => {
    const optional = Number(left.type === 'optional') - Number(right.type === 'optional');
    return optional || left.dueDate.localeCompare(right.dueDate) || left.id.localeCompare(right.id);
  });
}
