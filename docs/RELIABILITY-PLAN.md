# Editing reliability and confirmed ongoing dates

**Goal:** Implement the three reproduced reliability gaps from the 2026-11-08 readiness review.

**Design:** Use the existing native UI and local SQLite service. Persist resume editing recovery separately from saved resume drafts, never automatically confirm facts or save the shared profile. Renew only rejected authentication requests once, with a library identity boundary. Carry ongoing status only through explicitly confirmed fact fields into new resume documents.

**Scope:** This slice implements cross-refresh recovery for the resume editor. Dossier/fact form recovery, additional file formats, real material processing, and a new downloadable release remain separate follow-up work.

**Constraints:** No external AI/cloud storage, browser-local personal draft store, model/camera changes, automatic material extraction or personal fact confirmation. Maintain immutable historical resume versions. Real backup password entry is performed only by the user in the local UI.

## Decisions

- Persist a versioned resume recovery row in the current library, with original saved-draft revision and raw profile editing strings. Incomplete email is recoverable but still validated on formal save.
- Recovery snapshots are not saved resume records. The list offers recovery entries; explicit save clears only the matching checkpoint if newer typing did not occur. Concurrent recovery edits must not overwrite another tab.
- Auto-checkpoint after a short idle interval. Show pending/saved/error state and warn before leaving if latest input is not durable. Preserve snapshots and base revisions across page/list navigation and in-flight saves.
- The API session exposes a stable identity derived from the opened library path. A new server instance on the same library may reconnect; a changed library may not receive old-page edits automatically. Retry authentication failures only, never ambiguous network/server failures.
- Existing facts without an ongoing field retain their old date semantics. Only a confirmed ongoing boolean can produce “至今”; conflicting end/ongoing evidence blocks freezing.

## Implementation plan

- [x] Session renewal: add failing isolated HTTP/client tests, implement single-flight renewal, one retry and library boundary, preserve normal API/upload behavior.
- [x] Ongoing dates: add failing domain tests, extend only the appropriate fact field/type, expose confirmation checkbox and render confirmed dates without changing old versions.
- [x] Recovery service: schema migration, bounded/validated authenticated APIs, optimistic revisions, backup/restore manifest coverage and old-backup compatibility.
- [x] Recovery editor: one autosave controller, list restoration, immediate navigation flush, safe formal-save cleanup, failure/conflict/unsaved-exit behavior.
- [x] Run full integration and browser regression groups, independent final review, source privacy scan and continuity/usage updates.
- [ ] Commit/integrate the verified work and verify remote Windows/Docker checks. Apply to the local service only after real backup and restore verification.

## Execution ledger

- Baseline: `1152477`, clean source tree. Native worktree setup could not resolve this repository's base in the chat's upstream repository context; a repository-scoped Git worktree is used on D:. Its runtime config points at a separate synthetic default library, reusing only OCR/browser resource directories.
- The user created the encrypted backup and completed new-directory verification through the local UI. Both success states were observed; the current library was not switched. No password was read or recorded.
- Independent session and date fixes are delegated under the parallel-agent workflow; the parent owns recovery, integration and final verification.
- An additional failing browser test exposed stale profile revision loss during recovery; retaining that base revision now prevents overwriting newer shared profile data.
- Independent review identified two date-revision issues: unselected live dates interfering with validation, and snapshot fields lacking explicit adoption of dossier corrections. Both were reproduced, fixed and approved in focused re-review.
- Local acceptance: production build, 88 integration tests and all 17 browser cases passed in sequential groups. A harness run interrupted by a concurrent development reload was repeated after edits stopped. A changed pending-save label was restored and the complete resume flow then passed.
- Source packaging and privacy acceptance: 955 public source files, 27 private identity markers, zero matches. The local staging package contains no configuration or library data; published release assets remain unchanged.
