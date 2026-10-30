import { calendarDay, dueLabel, formatDate } from '../domain/dates';
import { calculateProgress, isComplete, selectAssignments, statusFor } from '../domain/progress';
import { statusLabels, typeLabels } from '../domain/types';
import type { Assignment, ClassroomData, Filters } from '../domain/types';
import { emptyState, escapeHtml as e, icon, safeUrl } from '../shared/html';

export function progressMarkup(data: ClassroomData, studentId: string): string {
  const progress = calculateProgress(data.assignments, data.submissions, studentId);
  if (progress.percent === null) return '<div class="progress-summary"><p class="muted">ยังไม่มีงานบังคับ</p></div>';
  return `<div class="progress-summary"><div class="progress-summary-top"><strong>${progress.percent === 100 ? `${icon('check')} งานบังคับครบแล้ว` : 'ความคืบหน้างานบังคับ'}</strong><span>ครบ ${progress.completed}/${progress.required} งาน <span class="muted">(${progress.percent}%)</span></span></div><div class="progress-track" role="progressbar" aria-label="ความคืบหน้างานบังคับ" aria-valuenow="${progress.percent}" aria-valuemin="0" aria-valuemax="100"><span style="width:${progress.percent}%"></span></div>${progress.optionalCompleted ? `<small class="muted">งานเสริมสำเร็จ ${progress.optionalCompleted} งาน</small>` : ''}</div>`;
}

export function taskCard(task: Assignment, data: ClassroomData, studentId: string, today: string): string {
  const status = statusFor(data.submissions, studentId, task.id), complete = isComplete(task, status);
  const due = dueLabel(task.dueDate, today), attachment = safeUrl(task.attachmentUrl);
  return `<article class="task-card ${complete ? 'task-complete' : ''}" data-task="${e(task.id)}">
    <div class="task-meta"><span class="subject-label">${e(data.subjects.find(subject => subject.id === task.subjectId)?.name ?? 'วิชาที่เก็บเข้าประวัติ')}</span><span class="type-label">${typeLabels[task.type]}</span></div>
    <h3>${e(task.title)}</h3>
    <div class="task-due">${icon('calendar', 16)}<span>ครบกำหนด ${formatDate(task.dueDate)}</span>${!complete ? `<span class="due-label ${due.overdue ? 'overdue' : task.dueDate === today ? 'today' : ''}">${due.text}</span>` : ''}</div>
    ${task.description ? `<details class="task-description"><summary>รายละเอียดงาน</summary><p>${e(task.description)}</p>${task.assignedOn ? `<p class="field-help">มอบหมาย ${formatDate(task.assignedOn)}</p>` : ''}</details>` : ''}
    <div class="task-bottom">${attachment ? `<a class="task-link" href="${e(attachment)}" target="_blank" rel="noopener noreferrer">เปิดเอกสารแนบ ${icon('arrow', 16)}</a>` : '<span class="field-help">บันทึกสถานะตามงานที่ทำจริง</span>'}
      <label class="status-control"><span>สถานะ</span><select class="status-${status}" aria-label="สถานะ ${e(task.title)}" data-status="${e(task.id)}">${Object.entries(statusLabels).map(([value, label]) => `<option value="${value}" ${value === status ? 'selected' : ''}>${label}</option>`).join('')}</select></label>
    </div>
  </article>`;
}

export function taskList(data: ClassroomData, studentId: string, filters: Filters, today: string): string {
  if (!data.assignments.length) return `<div class="paper">${emptyState('ยังไม่มีงานในห้องเรียน', 'เมื่อผู้ดูแลเพิ่มงานแล้ว รายการและวันครบกำหนดจะแสดงที่นี่', 'tasks')}</div>`;
  const tasks = selectAssignments(data.assignments, data.submissions, studentId, filters, today);
  if (!tasks.length) {
    const progress = calculateProgress(data.assignments, data.submissions, studentId);
    const isFiltered = filters.subjectId || filters.type || filters.due || filters.search || filters.completion !== 'pending';
    const complete = !isFiltered && progress.percent === 100;
    return `<div class="paper">${emptyState(complete ? 'งานบังคับครบแล้ว' : 'ไม่พบงานที่ตรงกับตัวกรอง', complete ? 'ดูรายการที่สำเร็จแล้ว หรือเปิดงานทั้งหมดเพื่อตรวจงานเสริม' : 'ลองเลือกวิชา ประเภท หรือช่วงกำหนดส่งอื่น', complete ? 'check' : 'search', '<button class="button" data-reset-filters>ดูงานทั้งหมด</button>')}</div>`;
  }
  const groups = new Map<string, Assignment[]>();
  for (const task of tasks) {
    const days = calendarDay(task.dueDate) - calendarDay(today), complete = isComplete(task, statusFor(data.submissions, studentId, task.id));
    const group = task.type === 'optional' ? 'งานเสริม' : complete ? 'สำเร็จแล้ว' : days < 0 ? 'งานเกินกำหนด' : days === 0 ? 'ครบกำหนดวันนี้' : days <= 3 ? 'ภายใน 3 วัน' : days <= 7 ? 'ภายใน 7 วัน' : 'หลังจากนั้น';
    groups.set(group, [...(groups.get(group) ?? []), task]);
  }
  return [...groups].map(([name, items]) => `<section class="task-group" data-group="${e(name)}"><h2 class="group-heading ${name === 'งานเกินกำหนด' ? 'overdue' : ''}">${e(name)}<span class="count">${items.length}</span></h2>${items.map(task => taskCard(task, data, studentId, today)).join('')}</section>`).join('');
}

export function taskFilters(data: ClassroomData, filters: Filters): string {
  return `<div class="filter-tabs" role="group" aria-label="กรองตามความสำเร็จ">${([['pending', 'ยังไม่ครบ'], ['all', 'ทั้งหมด'], ['complete', 'สำเร็จแล้ว']] as const).map(([value, label]) => `<button type="button" class="filter-tab" data-completion="${value}" aria-pressed="${filters.completion === value}">${label}</button>`).join('')}</div>
  <label class="field task-search"><span>ค้นหางาน</span><input id="filter-search" type="search" value="${e(filters.search)}" placeholder="ค้นหาชื่องานหรือรายละเอียด" /></label><div class="filters"><label class="field"><span>วิชา</span><select id="filter-subject"><option value="">ทุกวิชา</option>${data.subjects.map(subject => `<option value="${e(subject.id)}" ${filters.subjectId === subject.id ? 'selected' : ''}>${e(subject.name)}</option>`).join('')}</select></label>
  <label class="field"><span>ประเภทงาน</span><select id="filter-type"><option value="">ทุกประเภท</option>${Object.entries(typeLabels).map(([value, label]) => `<option value="${value}" ${filters.type === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label>
  <label class="field"><span>กำหนดส่ง</span><select id="filter-due"><option value="">ทุกช่วงเวลา</option>${[['overdue', 'เกินกำหนด'], ['today', 'วันนี้'], ['week', 'ภายใน 7 วัน']].map(([value, label]) => `<option value="${value}" ${filters.due === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label>
  <button class="button quiet" data-reset-filters>ล้างตัวกรอง</button></div>`;
}
