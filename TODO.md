# Development TODO

## Editing reliability — 2026-11-08

- [x] Durable resume editing recovery in the active library; incomplete profile input remains separate from formally saved data.
- [x] Preserve latest edits through refresh/navigation, pending saves, checkpoint failures and optimistic conflicts.
- [x] Reconnect expired sessions once on the same library; block stale edits after a library switch.
- [x] Explicitly select and confirm ongoing date status; carry it into new resume documents without altering historical versions.
- [x] Verify schema-3 encrypted backups before migration and include recovery snapshots in new backups.
- [x] Independent review, public packaging/privacy checks, main integration and remote Windows/Docker acceptance.
- [ ] Add cross-refresh recovery for dossier and fact forms in a later slice.
- [ ] Decide a new downloadable release after source acceptance; published v0.1.0 assets are unchanged.

## Product usability — first pass

- [x] Keep search, saved and settings labels visible at narrow widths.
- [x] Expose new dossier / add material; move catalog import and archived browsing into more actions.
- [x] Select an existing dossier before upload; retain the file and selection after failures.
- [x] Link review reasons to role/date fields or facts/materials tabs; restore return context.
- [x] Open and focus library location directly from its management entry.
- [x] Detail reading space, compact extraction status and original/evidence comparison.
- [x] Resume stage guidance, persistent actions and explicit current/history export targets.
- [x] Resume session edits survive stage, page and list navigation; initial/stale/blocked previews explain their state.
- [x] Adapt reference-dossier wording and secondary organization actions.
- [x] Preserve the open detail and unsaved statement after removing a favorite, including from the favorites filter.

## Extraction progress

- [x] Read-only current-version material counts, global and per dossier.
- [x] Explicit pending extraction, individual failure retry and readable reasons.
- [x] Poll only mounted/visible pages; preserve unsaved statements and pinned previews.
- [x] Refresh completed text and review reasons without reopening the dossier.
- [x] Original/evidence reading layout with pinned versions and text/original switching.

## Current library identity

- [x] Show the connected library name and open its current path/counts without changing data.
- [x] Verify empty-library identity, retry, keyboard return and desktop/mobile layout.

## Standalone v0.1.0

- [x] Preserve wave array, search, dossier/evidence/resume workflows.
- [x] Portable default paths, explicit runtime overrides and desktop opening.
- [x] Protect human text corrections and imported topic identity.
- [x] Apply reference-specific review conditions and attach uploads directly.
- [x] Blank-library entry and optional generic catalog import.
- [x] Dockerfile, local-only Compose, default-deny build context.
- [x] Independent review and fixes; 46 integration tests and 10 browser suites.
- [x] Native and non-root container acceptance, including export, backup and restart persistence.
- [x] Source/Windows packaging with a public-file allowlist and privacy scan.
- [x] Document clean public history, release assets and external library reconnection.

## Separate acceptance

- [x] Inspect all PDF pages from compact, long-title/multiline and overflow synthetic exports.
- [x] Verify neutral Word heading hierarchy and one-bullet multiline contributions in the emitted Word package.
- [ ] Office application visual acceptance of DOCX formatting.
- [ ] iPhone Safari hardware acceptance of motion and touch.

DOCX visual acceptance is still pending. Microsoft Word is now installed locally; earlier XML checks do not establish page appearance or font substitution.

Unknown personal facts always require user confirmation; automated tests use synthetic material.
