import { formatDate, weekRange } from '../domain/dates';
import { calculateProgress, isComplete, statusFor } from '../domain/progress';
import { statusLabels } from '../domain/types';
import type { ClassroomData } from '../domain/types';
import { emptyState, escapeHtml as e, icon } from '../shared/html';
import { openDialog } from '../shared/dialog';

export function weeklySummary(data: ClassroomData, today: string): string {
  const { start, end } = weekRange(today);
  const assigned = data.assignments.filter(task => task.assignedOn && task.assignedOn >= start && task.assignedOn <= end);
  return [`สรุปงาน ${data.classroom?.name ?? ''}`, `${formatDate(start)} – ${formatDate(end)}`, ...assigned.map(task => `${data.subjects.find(subject => subject.id === task.subjectId)?.name ?? 'วิชาที่เก็บเข้าประวัติ'}: ${task.title} (ครบกำหนด ${formatDate(task.dueDate)})`), ...(assigned.length ? [] : ['ยังไม่มีงานที่มอบหมายในสัปดาห์นี้'])].join('\n');
}

export function overviewView(data: ClassroomData, today: string, dueFilter = ''): string {
  const heading = '<div class="page-heading"><div><h1>ภาพรวมของห้อง</h1><p>ติดตามงานบังคับและงานที่มอบหมายในสัปดาห์นี้</p></div></div>';
  if (!data.students.length || !data.assignments.length) return heading + `<div class="paper">${emptyState('ยังไม่มีข้อมูลสำหรับสรุป', 'เพิ่มรายชื่อนักเรียนและงานก่อน แล้วจะดูความคืบหน้าของห้องได้จากที่นี่', 'overview')}</div>`;
  const required = data.assignments.filter(task => task.type !== 'optional');
  const progress = data.students.map(student => calculateProgress(data.assignments, data.submissions, student.id));
  const complete = progress.filter(item => item.percent === 100).length, pending = progress.reduce((total, item) => total + item.required - item.completed, 0);
  const followUp = required.map(task => ({ task, missing: data.students.filter(student => !isComplete(task, statusFor(data.submissions, student.id, task.id))).length })).filter(item => item.missing > 0).sort((a, b) => a.task.dueDate.localeCompare(b.task.dueDate) || a.task.id.localeCompare(b.task.id));
  const { start, end } = weekRange(today);
  const assigned = data.assignments.filter(task => task.assignedOn && task.assignedOn >= start && task.assignedOn <= end);
  return heading + `<div class="paper"><div class="summary-grid"><div><strong>${data.students.length}</strong><span>นักเรียนทั้งหมด</span></div><div><strong>${required.length ? complete : '—'}</strong><span>${required.length ? 'ทำงานบังคับครบ (คน)' : 'ยังไม่มีงานบังคับ'}</span></div><div><strong>${pending}</strong><span>งานบังคับค้างรวม (คน × งาน)</span></div></div>
  <section class="overview-section"><h2>งานที่ต้องติดตาม</h2><p>เลือกงานเพื่อดูรายชื่อและสถานะของนักเรียนที่ยังทำไม่ครบ</p><label class="field follow-up-filter"><span>ช่วงกำหนดส่งที่ต้องติดตาม</span><select id="follow-up-due"><option value="">ทุกช่วงเวลา</option><option value="overdue" ${dueFilter === 'overdue' ? 'selected' : ''}>เกินกำหนด</option><option value="today" ${dueFilter === 'today' ? 'selected' : ''}>ครบกำหนดวันนี้</option><option value="upcoming" ${dueFilter === 'upcoming' ? 'selected' : ''}>ยังไม่ถึงกำหนด</option></select></label>${followUp.length ? `<ul class="data-list">${followUp.map(({ task, missing }) => `<li class="data-row" data-follow-up-row data-due="${task.dueDate < today ? 'overdue' : task.dueDate === today ? 'today' : 'upcoming'}"><div class="data-row-main"><strong>${e(task.title)}</strong><p>${e(data.subjects.find(subject => subject.id === task.subjectId)?.name ?? '')} · ครบกำหนด ${formatDate(task.dueDate)}</p><div class="overview-bar"><span style="width:${(data.students.length - missing) / data.students.length * 100}%"></span></div></div><div class="follow-up-action"><strong>${missing} คนยังไม่ครบ</strong><span class="${task.dueDate < today ? 'overdue' : 'muted'}">${task.dueDate < today ? 'เกินกำหนด' : task.dueDate === today ? 'ครบกำหนดวันนี้' : 'ยังไม่ถึงกำหนด'}</span><button class="button" data-follow-up="${e(task.id)}" aria-label="ดูรายชื่อ ${e(task.title)}">ดูรายชื่อ ${icon('arrow', 16)}</button></div></li>`).join('')}</ul>` : '<p class="muted">ไม่มีงานบังคับที่ต้องติดตาม</p>'}<p id="follow-up-empty" class="muted" hidden>ไม่มีงานที่ต้องติดตามในช่วงเวลานี้</p></section>
  <section class="overview-section"><div class="section-header"><h2>งานประจำสัปดาห์</h2><button class="button" data-copy-week>${icon('copy')} คัดลอกสรุป</button></div><p>${formatDate(start)} – ${formatDate(end)} · นับจากวันที่มอบหมาย</p>${assigned.length ? `<ul class="data-list">${assigned.map(task => `<li class="data-row"><div class="data-row-main"><strong>${e(task.title)}</strong><p>${e(data.subjects.find(subject => subject.id === task.subjectId)?.name ?? '')} · ครบกำหนด ${formatDate(task.dueDate)}</p></div></li>`).join('')}</ul>` : '<p>ยังไม่มีงานที่มอบหมายในสัปดาห์นี้</p>'}</section></div>`;
}

export function bindOverview(container: HTMLElement, data: ClassroomData, today: string, onFilterChange: (value: string) => void): void {
  container.querySelector<HTMLSelectElement>('#follow-up-due')?.addEventListener('change', event => {
    const filter = (event.target as HTMLSelectElement).value;
    onFilterChange(filter);
    const rows = [...container.querySelectorAll<HTMLElement>('[data-follow-up-row]')];
    rows.forEach(row => { row.hidden = !!filter && row.dataset.due !== filter; });
    container.querySelector<HTMLElement>('#follow-up-empty')!.hidden = !rows.length || rows.some(row => !row.hidden);
  });
  container.querySelector<HTMLSelectElement>('#follow-up-due')?.dispatchEvent(new Event('change'));
  container.querySelectorAll<HTMLButtonElement>('[data-follow-up]').forEach(button => button.addEventListener('click', () => {
    const task = data.assignments.find(item => item.id === button.dataset.followUp);
    if (!task) return;
    const students = data.students.filter(student => !isComplete(task, statusFor(data.submissions, student.id, task.id)));
    const deadline = task.dueDate < today ? 'เกินกำหนด' : task.dueDate === today ? 'ครบกำหนดวันนี้' : 'ยังไม่ถึงกำหนด';
    const subject = data.subjects.find(item => item.id === task.subjectId)?.name ?? '';
    const summary = [`${data.classroom?.name ?? ''} · ${subject}`, task.title, `ครบกำหนด ${formatDate(task.dueDate)} · ${deadline}`, `ยังไม่ครบ ${students.length} คน`, ...students.map(student => `${student.number}. ${student.name} — ${statusLabels[statusFor(data.submissions, student.id, task.id)]}`)].join('\n');
    const dialog = openDialog(task.title, `<p>${e(subject)} · ครบกำหนด ${formatDate(task.dueDate)}</p><p class="${task.dueDate < today ? 'overdue' : 'muted'}">${deadline} · ${students.length} คนยังไม่ครบ</p><ul class="data-list">${students.map(student => `<li class="data-row"><strong>${student.number}. ${e(student.name)}</strong><span>${statusLabels[statusFor(data.submissions, student.id, task.id)]}</span></li>`).join('')}</ul><button class="button" data-copy-follow-up>${icon('copy')} คัดลอกรายชื่อ</button><p class="field-help" role="status" data-copy-status hidden></p><label class="field copy-fallback" hidden><span>รายชื่อนักเรียนที่งานยังไม่ครบ</span><textarea readonly rows="8">${e(summary)}</textarea></label>`);
    dialog.querySelector('[data-copy-follow-up]')!.addEventListener('click', async () => {
      try {
        if (!navigator.clipboard?.writeText) throw new Error();
        await navigator.clipboard.writeText(summary);
        const notice = dialog.querySelector<HTMLElement>('[data-copy-status]')!;
        notice.hidden = false; notice.textContent = 'คัดลอกรายชื่อแล้ว';
      } catch {
        dialog.querySelector<HTMLElement>('.copy-fallback')!.hidden = false;
        const text = dialog.querySelector('textarea')!; text.focus(); text.select();
      }
    });
  }));
}
