import type { ClassroomData, Timetable } from '../domain/types';
import { formatDate } from '../domain/dates';
import { downloadFile, emptyState, escapeHtml as e, icon, safeUrl } from '../shared/html';
import { openDialog } from '../shared/dialog';

export function timetableView(data: ClassroomData, canEdit: boolean): string {
  const image = data.timetable;
  return `<div class="page-heading"><div><h1>ตารางสอน</h1><p>${e(data.classroom ? `${data.classroom.name} ${data.classroom.term}` : 'เปิดดูได้โดยไม่ต้องเลือกนักเรียน')}</p></div>${canEdit ? `<button class="button primary" data-upload-timetable>${icon('plus')} เพิ่มรูปตารางสอน</button>` : ''}</div>
  <div class="paper">${!image ? emptyState('ยังไม่ได้เพิ่มตารางสอน', 'เมื่อเพิ่มรูปตารางสอนแล้ว จะเปิดดูและขยายได้จากหน้านี้', 'calendar') : `<div class="timetable-tools"><div style="flex:1;min-width:0"><h2>${e(image.title)}</h2><small class="muted">อัปเดต ${formatDate(image.updatedAt.slice(0, 10))}</small></div><button class="button" data-open-viewer>${icon('expand')} ขยายดู</button><button class="button" data-download-image>${icon('download')} ดาวน์โหลดรูปต้นฉบับ</button></div><div class="timetable-frame" id="timetable-image"><img src="${e(safeUrl(image.url) ?? '')}" width="${image.width}" height="${image.height}" alt="${e(`ตารางสอน ${data.classroom?.name ?? ''} ${image.title}`)}" /></div>${image.note ? `<p class="timetable-note">${e(image.note)}</p>` : ''}`}</div>`;
}

export function bindTimetable(container: HTMLElement, data: ClassroomData, notify: (message: string) => void): void {
  const image = data.timetable;
  if (!image) return;
  const element = container.querySelector<HTMLImageElement>('#timetable-image img');
  const showFailure = () => {
    const frame = container.querySelector('#timetable-image');
    if (!frame) return;
    frame.innerHTML = emptyState('โหลดรูปตารางสอนไม่สำเร็จ', 'มีตารางสอนอยู่ในระบบ แต่ยังเปิดไฟล์ไม่ได้ กรุณาลองใหม่', 'alert', '<button class="button" data-retry-image>ลองใหม่</button>');
    frame.querySelector('[data-retry-image]')!.addEventListener('click', () => {
      frame.innerHTML = `<img src="${e(safeUrl(image.url) ?? '')}" alt="${e(image.title)}" width="${image.width}" height="${image.height}" />`;
      frame.querySelector('img')!.addEventListener('error', showFailure, { once: true });
    });
  };
  element?.addEventListener('error', showFailure, { once: true });
  if (element?.complete && element.naturalWidth === 0) showFailure();
  container.querySelector('[data-open-viewer]')?.addEventListener('click', () => openViewer(image));
  container.querySelector('[data-download-image]')?.addEventListener('click', async () => {
    try {
      const response = await fetch(image.url);
      if (!response.ok) throw new Error();
      const blob = await response.blob();
      const extension = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[blob.type];
      if (!extension) throw new Error();
      downloadFile(`timetable-${image.id}.${extension}`, blob);
    } catch { notify('ดาวน์โหลดรูปไม่สำเร็จ กรุณาลองใหม่'); }
  });
}

function openViewer(image: Timetable): void {
  const dialog = openDialog(image.title, `<div class="viewer-tools"><button class="button" data-fit>พอดีหน้าจอ</button><button class="button" data-actual>ขนาด 100%</button><button class="icon-button" data-out aria-label="ซูมออก">${icon('zoomOut')}</button><output class="zoom-level" aria-live="polite"></output><button class="icon-button" data-in aria-label="ซูมเข้า">${icon('zoomIn')}</button></div><div class="image-viewport" tabindex="0" aria-label="ภาพตารางสอน เลื่อนดูภาพได้"><img src="${e(safeUrl(image.url) ?? '')}" alt="${e(image.title)}" /></div>`, true);
  const viewport = dialog.querySelector<HTMLElement>('.image-viewport')!, img = viewport.querySelector('img')!;
  let scale = 1;
  function setScale(value: number) {
    scale = Math.max(.5, Math.min(3, value)); img.style.width = `${image.width * scale}px`;
    dialog.querySelector('output')!.textContent = `${Math.round(scale * 100)}%`;
  }
  function fit() {
    const value = Math.min(1, (viewport.clientWidth - 2) / image.width, (window.innerHeight * .65 - 2) / image.height);
    // Fitting a large original may need less than 50%; explicit zoom buttons remain within 50–300%.
    scale = value; img.style.width = `${image.width * scale}px`; dialog.querySelector('output')!.textContent = `${Math.round(scale * 100)}%`;
    viewport.scrollTo(0, 0);
  }
  dialog.querySelector('[data-fit]')!.addEventListener('click', fit);
  dialog.querySelector('[data-actual]')!.addEventListener('click', () => setScale(1));
  dialog.querySelector('[data-in]')!.addEventListener('click', () => setScale(scale + .25));
  dialog.querySelector('[data-out]')!.addEventListener('click', () => setScale(scale - .25));
  img.addEventListener('error', () => { viewport.innerHTML = '<p class="notice error">โหลดรูปตารางสอนไม่สำเร็จ ปิดหน้าต่างแล้วลองใหม่</p>'; });
  fit();
}
