import { formatDate, weekRange } from '../domain/dates';
import { calculateProgress, isComplete, statusFor } from '../domain/progress';
import type { ClassroomData } from '../domain/types';
import { emptyState, escapeHtml as e, icon } from '../shared/html';

export function weeklySummary(data: ClassroomData, today: string): string {
  const { start, end } = weekRange(today);
  const assigned = data.assignments.filter(task => task.assignedOn && task.assignedOn >= start && task.assignedOn <= end);
  return [`สรุปงาน ${data.classroom?.name ?? ''}`, `${formatDate(start)} – ${formatDate(end)}`, ...assigned.map(task => `${data.subjects.find(subject => subject.id === task.subjectId)?.name ?? 'วิชาที่เก็บเข้าประวัติ'}: ${task.title} (ครบกำหนด ${formatDate(task.dueDate)})`), ...(assigned.length ? [] : ['ยังไม่มีงานที่มอบหมายในสัปดาห์นี้'])].join('\n');
}

export function overviewView(data: ClassroomData, today: string): string {
  const heading = '<div class="page-heading"><div><h1>ภาพรวมของห้อง</h1><p>ติดตามงานบังคับและงานที่มอบหมายในสัปดาห์นี้</p></div></div>';
  if (!data.students.length || !data.assignments.length) return heading + `<div class="paper">${emptyState('ยังไม่มีข้อมูลสำหรับสรุป', 'เพิ่มรายชื่อนักเรียนและงานก่อน แล้วจะดูความคืบหน้าของห้องได้จากที่นี่', 'overview')}</div>`;
  const required = data.assignments.filter(task => task.type !== 'optional');
  const progress = data.students.map(student => calculateProgress(data.assignments, data.submissions, student.id));
  const complete = progress.filter(item => item.percent === 100).length, pending = progress.reduce((total, item) => total + item.required - item.completed, 0);
  const followUp = required.map(task => ({ task, missing: data.students.filter(student => !isComplete(task, statusFor(data.submissions, student.id, task.id))).length })).filter(item => item.missing > 0).sort((a, b) => a.task.dueDate.localeCompare(b.task.dueDate) || a.task.id.localeCompare(b.task.id));
  const { start, end } = weekRange(today);
  const assigned = data.assignments.filter(task => task.assignedOn && task.assignedOn >= start && task.assignedOn <= end);
  return heading + `<div class="paper"><div class="summary-grid"><div><strong>${data.students.length}</strong><span>นักเรียนทั้งหมด</span></div><div><strong>${required.length ? complete : '—'}</strong><span>${required.length ? 'ทำงานบังคับครบ (คน)' : 'ยังไม่มีงานบังคับ'}</span></div><div><strong>${pending}</strong><span>งานบังคับค้างรวม (คน × งาน)</span></div></div>
  <section class="overview-section"><h2>งานที่ต้องติดตาม</h2><p>แสดงจำนวนคนที่ยังทำงานบังคับไม่ครบในแต่ละงาน</p>${followUp.length ? `<ul class="data-list">${followUp.map(({ task, missing }) => `<li class="data-row"><div class="data-row-main"><strong>${e(task.title)}</strong><p>${e(data.subjects.find(subject => subject.id === task.subjectId)?.name ?? '')} · ครบกำหนด ${formatDate(task.dueDate)}</p><div class="overview-bar"><span style="width:${(data.students.length - missing) / data.students.length * 100}%"></span></div></div><strong>${missing} คนยังไม่ครบ</strong></li>`).join('')}</ul>` : '<p class="muted">ไม่มีงานบังคับที่ต้องติดตาม</p>'}</section>
  <section class="overview-section"><div class="section-header"><h2>งานประจำสัปดาห์</h2><button class="button" data-copy-week>${icon('copy')} คัดลอกสรุป</button></div><p>${formatDate(start)} – ${formatDate(end)} · นับจากวันที่มอบหมาย</p>${assigned.length ? `<ul class="data-list">${assigned.map(task => `<li class="data-row"><div class="data-row-main"><strong>${e(task.title)}</strong><p>${e(data.subjects.find(subject => subject.id === task.subjectId)?.name ?? '')} · ครบกำหนด ${formatDate(task.dueDate)}</p></div></li>`).join('')}</ul>` : '<p>ยังไม่มีงานที่มอบหมายในสัปดาห์นี้</p>'}</section></div>`;
}
