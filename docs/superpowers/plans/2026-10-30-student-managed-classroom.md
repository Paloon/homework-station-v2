# Student-managed classroom Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Students collaboratively manage the shared classroom without a separate admin login; teachers inspect progress.
**Architecture:** Keep the existing single classroom, name picker, CRUD forms, validation and status RPC. Add an incremental migration granting shared edits to anon/authenticated with room-scoped RLS and timetable upload constraints. No account or name selection is treated as verified identity.
**Tech Stack:** Vite, TypeScript, Supabase Postgres/Storage/Realtime, Vitest/PGlite, Playwright.
**Spec:** User confirmed all students may add/edit subjects, assignments, roster, classroom and timetable; teacher uses overview to check progress.

## Global Constraints
- Preserve all existing classroom data and original checkout.
- No individual student login or teacher approval step.
- Shared assignment creation/editing is available directly on the tasks page.
- Keep RLS enabled, permanent DELETE unavailable, status version checks, validation, soft archives and upload readiness intact.
- Keep credentials and private admin/import tables unavailable through the public data API.

## Review Focus
- A visitor without an Auth session can create and edit classroom records, import a roster and upload/activate a timetable.
- Existing signed-in users have the same collaboration behavior.
- No subject exists: adding a subject is visible and adding an assignment gives a clear prerequisite.
- Saving shared work must not change the selected student or lose draft values on failure.
- Teachers still drill into incomplete rosters; direct status writes and file deletion remain blocked.

### Task 1: Shared editing database contract
**Files:** generated `supabase/migrations/*_collaborative_classroom.sql`, `tests/integration/database.test.ts`.
- [ ] Add room-scoped shared INSERT/UPDATE grants and policies, scoped upload policy and anon RPC access.
- [ ] Test anonymous/signed-in collaboration and unchanged constraints with all migrations.

### Task 2: Student workflow
**Files:** `src/app.ts`, `src/features/manage.ts`, `src/features/tasks.ts`, `src/features/timetable.ts`, `src/data/repository.ts`, `src/data/supabase.ts`, `src/data/test-repository.ts`, `tests/e2e/*`, `tests/unit/supabase-repository.test.ts`.
- [ ] Remove the login gate and Auth calls from the classroom workflow.
- [ ] Reuse shared forms for add assignment/subject and edit/archive assignments from the tasks page.
- [ ] Update copy and cover collaboration without an Auth session, including errors and mobile layout.

### Task 3: Verification and release
**Files:** README, implementation/deployment notes.
- [ ] Run build, focused unit tests, database contracts, browser suite and visual checks.
- [ ] Apply the additive migration through Supabase, inspect advisors and run rollback-only cloud checks.
- [ ] Publish through Git/Vercel, verify remote HEAD and production bundle/health.
