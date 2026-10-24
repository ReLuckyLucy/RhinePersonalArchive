# Development log

## 2026-10-24 — resume guidance and stable actions

- Kept a single native one-page form. Added stage anchors, a fixed action bar,
  collapsed empty groups, explicit preview access and an empty-selection review
  route. Current draft, saved version and chosen history are labeled separately.
- Current export saves/builds/freezes before downloading. Input generations and
  preview intent guard late responses; mutation actions serialize. Saving during
  navigation completes with the resulting revision, without overwriting captured
  newer input. Errors leave fields and retry actions available.
- A same-generation rebuild after external fact withdrawal exposed a stale iframe
  cache key. A failing browser assertion preceded a separate render revision fix.
- Independent source review found list-back data loss and hidden initial build
  issues. Fixed the first with keyed session draft snapshots and the second with
  shared initial/save issue rendering and a qualified preview state. Both findings
  have failing-then-passing regressions; neither was deferred. Session snapshots
  are not a second persistent library and are not automatically saved.
- The new resume-flow suite uses real isolated Word versions/exports, injects save
  and export transport failures, delays save/history responses and checks multiple
  draft restoration. It starts on resume and uses review for page navigation, so
  hosted acceptance does not depend on WebGL. Added it to default tests and CI.
- No backend/schema/template changes; private material is not used in tests.
  Published v0.1.0 assets remain the original release. Public plan and usage/state
  records describe the new source behavior and retain separate Office/iPhone checks.
- Verified build, 49 integration tests and all 14 browser suites across three
  sequential groups after fixes. Public source privacy scan: 943 files, 27 markers,
  zero hits. Live service was not running; the existing starter launched the same
  configuration, whose hash is unchanged, and served the current production build.

## 2026-10-22 — detail reading and evidence comparison

- Added expanded reading without changing the scene, models or camera. Desktop
  places the source beside its contribution; narrow source pages prioritize the
  selected original. Single-dossier extraction counts collapse, while failures
  and retries remain visible and library-wide statistics remain full.
- Added keyboard-accessible original/text tabs for visual files, native PDF
  navigation/zoom, source version and claim context, and return-to-claim focus.
  Text corrections refresh only the matching selected version. Generation checks
  discard late text responses after a view switch; missing pinned versions fail
  explicitly without substituting new material.
- Reading layout and favorite changes preserve unsaved text and current preview.
  Independent review caught the favorites-filter removal path; a failing browser
  regression preceded the fix that retains an open dossier until back. Existing
  lifecycle acceptance now checks this behavior and still verifies WebGL cleanup.
  Re-review found no remaining actionable issues.
- Reference descriptions, materials and note forms use their own wording and
  do not offer personal-fact confirmation. Organize/merge uses the detail menu.
- Verified production build, 49 integration tests and all 13 browser suites in
  three sequential groups. Light/dark screenshots at 1440/760/390/334 pixels
  include contribution comparison, corrected text and narrow reading layouts.
  Pinned-source refusal, delayed text response, favorites-filter preservation,
  full workflow and WebGL disposal/retry passed with isolated synthetic libraries.
- The browser harness now permits Chromium's packaged PDF resources and built-in
  PDF extension, preserving its block on unrelated external network origins.
  The initial failure reported null origins; full URL diagnostics identified the
  browser-internal resources before the narrowly scoped harness change.
- Public source scan: 940 files, 27 private identity markers, zero hits. Live
  health and generated entry match the current build; configuration hash is
  unchanged. No backend/schema migration or private material queue was needed.
  Published v0.1.0 assets remain unchanged; resume guidance/export is next.

## 2026-10-22 — usability entry points

- Preserved the wave scene and its motion. Utility labels stay visible across
  narrow layouts; the homepage exposes new dossier and material upload actions.
  Catalog import and archived browsing use a keyboard-accessible native menu.
- Added a single-file upload dialog that explicitly selects the owner, uses the
  existing upload API, retains choices on failure and opens the materials tab on
  success. Empty libraries route to dossier creation without placeholder records.
- Review reasons now link to role/date fields or facts/materials tabs; returning
  restores scroll and keyboard context. Hidden archive tools become inert in
  detail mode. Library management expands/focuses the existing directory form.
- Verified 49 integration tests, build and all 12 browser suites in two groups;
  shell, full workflow, evidence version pinning and wave lifecycle included.
  The initial concurrent browser-test attempt collided on Vite's HMR port; browser
  groups were then run sequentially with independent temporary libraries.
- Public source scan: 939 files and 27 private identity markers, zero hits.
  Actual local UI showed the new controls; configuration and schema were stable.
  A whole-database hash comparison differed during concurrent page navigation,
  and is not reported as an unchanged-data pass. Live acceptance submitted no
  material, fact, resume or settings writes; no database migration was required.
- This completes the entry/navigation slice. Reading layout, compact extraction,
  reference wording and resume stage/export work remain visible in TODO.md.
  Published v0.1.0 downloads are unchanged.

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
