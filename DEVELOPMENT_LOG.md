# Development log

## 2026-10-22 — extraction progress

- Added authenticated, non-cached snapshots of unique current-version materials,
  scoped to the library or a dossier. Old job versions and earlier failed retries
  do not contaminate current counts. No schema migration or file hashing on poll.
- Added explicit pending-only enqueue and failed-only retry filters; validation
  completes before jobs are created. Existing explicit re-extraction API remains
  available and preserves human corrections.
- Mounted/visible progress panels poll without overlapping requests, explain
  failures and pause on hidden pages. Disposing cancels requests and timers.
  Completed text and review reasons refresh without replacing unsaved statements.
- Verified 49 integration tests, production build and all 11 browser suites in
  two runs. The long run hit Chromium ERR_NO_BUFFER_SPACE before journey loaded;
  journey, revisions, detail, wave and wave-lifecycle passed in a fresh browser.
- Verified the actual production UI at desktop/mobile widths without mutation
  requests. Upgrade preserved all 23 tables and configuration, and did not enqueue
  pending private materials. Privacy scan: 935 public files, 27 markers, zero hits.
- Added the progress browser suite to Windows CI alongside the UI shell. No
  v0.1.0 release assets were replaced; original/evidence reading is a later slice.

## 2026-10-22 — current library identity

- Added an authenticated, non-cached, read-only library identity endpoint derived
  from the opened context, including unique materials and archived/active counts.
- Footer shows the folder name without a native hover tooltip. Details expose
  the full path, distinguish an empty library, retry failed reads and open the
  existing location settings after closing the dialog.
- Verified 47 integration tests, production build, shell (desktop/narrow layouts,
  long names, failures and focus), wave and resource lifecycle browser suites.
- Applied to the local service; all 23 existing tables and its local config were
  unchanged. The published v0.1.0 assets remain the original release snapshot.

## 2026-10-22 — standalone release preparation

- Replaced machine-specific defaults with writable project-relative runtime paths.
- Added stable catalog topic ownership, correction protection and reference review.
- Added empty-library onboarding and explicit catalog selection; uploads attach to their dossier.
- Added source and Windows release staging, a privacy scan and streaming ZIP packaging.
- Added non-root Docker deployment, persistent volumes and workflow acceptance scripts.
- Ruling: keep one application implementation for source, portable and Docker modes;
  runtime paths and bind configuration change, business behavior does not.
- Ruling: retain earlier private development history locally and publish only a
  new public root assembled from an explicit allowlist. Never push all local branches.
- Verification: 46 integration tests and 10 browser suites passed; production build passed.
- Independent release review found two important import-integrity issues; both
  were fixed and the scoped re-review reported ready. Regression tests cover aliases,
  interrupted imports and atomic per-record catalog updates.
- Fresh non-root Docker execution passed the complete synthetic workflow and
  restart persistence. Windows portable ZIP extraction and bundled runtime passed
  the same export and encrypted backup/restore workflow.
- Remaining acceptance is limited to Office DOCX visual inspection and real
  iPhone/Safari motion and touch testing, tracked separately in TODO.md.
- CI browser diagnostics preserve the original error if screenshots fail. Hosted GPU-less runners verify the UI shell and complete native/container data workflows. Full-resolution wave interaction remains a required local acceptance step; software rendering stalls are not reported as successful visual acceptance.
- The UI shell test accepts the one-second entry finishing before a click. Vite scans only the application entry and ignores runtime/release outputs, preventing extracted verification copies from triggering reloads. All 10 full-resolution local browser suites passed after these fixes.
