import { createElement, BookOpen, CalendarDays, Users, ChartNoAxesCombined, Settings2, Ellipsis, Search, ChevronRight, Check, Plus, Image, X, ZoomIn, ZoomOut, Maximize2, Download, ArrowLeft, ClipboardList, CircleAlert, LogOut, FileUp, Copy, RefreshCw } from 'lucide';

const icons = { book: BookOpen, calendar: CalendarDays, students: Users, overview: ChartNoAxesCombined, manage: Settings2, more: Ellipsis, search: Search, arrow: ChevronRight, check: Check, plus: Plus, image: Image, close: X, zoomIn: ZoomIn, zoomOut: ZoomOut, expand: Maximize2, download: Download, back: ArrowLeft, tasks: ClipboardList, alert: CircleAlert, logout: LogOut, upload: FileUp, copy: Copy, refresh: RefreshCw };
export function icon(name: keyof typeof icons, size = 20): string {
  return createElement(icons[name], { width: size, height: size, 'stroke-width': 1.8, 'aria-hidden': 'true', focusable: 'false' }).outerHTML;
}
export function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
}
export function safeUrl(value: string | null): string | null {
  if (!value) return null;
  try { const url = new URL(value, window.location.origin); return ['http:', 'https:'].includes(url.protocol) ? url.href : null; } catch { return null; }
}
export function emptyState(title: string, description: string, symbol: keyof typeof icons = 'tasks', action = ''): string {
  return `<div class="empty-state"><span class="empty-icon">${icon(symbol, 32)}</span><h2>${escapeHtml(title)}</h2><p>${escapeHtml(description)}</p>${action}</div>`;
}
export function downloadFile(filename: string, content: string | Blob, type = 'text/csv;charset=utf-8'): void {
  const url = URL.createObjectURL(content instanceof Blob ? content : new Blob([content], { type }));
  const link = Object.assign(document.createElement('a'), { href: url, download: filename });
  link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
