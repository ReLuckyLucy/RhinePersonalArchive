# Development log

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
