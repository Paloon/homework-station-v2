# Follow-up and assignment search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement only audit items 1 and 3: actionable follow-up and assignment search/filtering.
**Architecture:** Reuse the current classroom snapshot, completion rules, dialogs and form controls. All filtering is local; no schema or data mutations are required.
**Tech Stack:** Vite, TypeScript, semantic CSS, Playwright fixtures.
**Spec:** User selected items 1 and 3 from the preceding audit.

## Global Constraints
- One classroom; preserve student selection and progress denominator.
- No new dependency, database change, or production fixture data.
- Keep existing responsive, keyboard and clipboard fallback behavior.

## Review Focus
- A done status on a submit task is still incomplete; done on a do task is complete.
- A missing submission is not_started; optional tasks do not enter follow-up.
- Dates distinguish overdue, today and upcoming in Bangkok time.
- Combined search/subject/date filters have a clear empty state and reset.
- Clipboard failure keeps copyable text inside the same dialog.

### Task 1: Follow-up
**Files:** `src/features/overview.ts`, `src/app.ts`, `src/styles/layout.css`, `tests/e2e/app.spec.ts`.
- [ ] Add date grouping/filtering, per-assignment roster dialog with statuses and copy fallback.
- [ ] Cover completion semantics, copying, date filters and mobile overflow using fixtures.

### Task 2: Search
**Files:** `src/features/tasks.ts`, `src/features/manage.ts`, `src/app.ts`, `src/styles/layout.css`, `tests/e2e/app.spec.ts`.
- [ ] Bind student assignment search without changing progress totals.
- [ ] Add combined search/subject/due filtering and reset in assignment management.
- [ ] Run focused browser coverage, existing responsive coverage and production build.
- [ ] Review diff, then publish through the existing Git/Vercel workflow.
