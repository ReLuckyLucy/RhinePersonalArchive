# Project state

Updated: 2026-10-24. Standalone release: v0.1.0.

Native TypeScript/Three.js UI and Node 24.10/SQLite local backend. Runtime data
is external to source control, Docker context and downloadable bundles.

Public release branch is created from a clean allowlist without earlier private
development history. Historical local working records are retained privately.

Verified: 46/46 isolated integration tests, 10 browser suites and production build.
Native Windows portable execution and a fresh non-root Docker container both
passed blank-library creation, upload, extraction, search, fact confirmation,
PDF/DOCX export and encrypted backup/restore. Container restart retained records.
Release packaging rejects user databases, runtime configuration and private paths.
Source and Windows packages are distributed through GitHub Releases; see
docs/RELEASING.md for reproduction and checksum verification.

Current source adds a footer indicator for the actually opened library, with a
read-only path/counts dialog and a link to existing location settings. This is
not yet part of the v0.1.0 downloads. Verification: 47/47 integration tests,
production build, UI shell (retry, keyboard and narrow layouts), wave and wave
lifecycle suites. Live reconnection preserved all existing tables and config.

Resume boundaries: confirmed version-pinned evidence, manual truth review,
immutable resume versions. Keyword matching and wording rules are not an AI
truth checker. Read TODO.md before continuing development.

Current source also adds automatic extraction status for the whole library and
the current dossier. Only explicit clicks queue pending work or retry a failed
material; finished text and review reasons update in place without replacing
unsaved statements or changing evidence versions. Counts are current-version
material coverage, not estimated file percentages or completion times.

Verification: 49/49 integration tests, production build and all 11 browser suites
across two runs, including original wave and source-version regressions. The
single long browser attempt hit Chromium ERR_NO_BUFFER_SPACE before the journey
page loaded; journey and the remaining suites passed with a fresh browser.
The live service shows progress without enqueueing pending work; all 23 existing
tables and the local configuration matched their pre-upgrade snapshots. Public
source privacy scan found zero matches for 27 private identity markers across
935 files. The v0.1.0 downloads remain unchanged.

The first usability pass is implemented: visible Chinese utility labels, clear
new/upload actions, an advanced actions menu, explicit material ownership,
reason-specific review navigation with return focus/scroll, and direct library
location management. It reuses existing import and edit APIs; no database schema
or backend behavior changed. The reading and resume usability passes follow below,
with completion and separate acceptance tracked in TODO.md.

Verification: 49 integration tests, production build and all 12 browser suites
passed across two groups. Homepage/upload/review paths were checked at desktop
and narrow widths, including failed-upload preservation and menu keyboard exit.
Public source privacy scan: 939 files, 27 private identity markers, zero matches.
The live UI was loaded and its new actions observed. Local configuration and
schema matched the acceptance baseline; the whole-database hash changed during
concurrent browsing, so full data immutability is not claimed for that live run.

The second usability pass adds expanded detail reading, compact dossier extraction
statistics, contribution/source comparison, return-to-contribution focus and
original/extracted-text tabs. PDF navigation and zoom use the browser's native
viewer. Source versions remain pinned; late responses cannot replace a newer
view selection. Saved human text corrections refresh the matching preview.
Reading and favorite changes preserve unsaved statements; an open dossier stays
available after unfavoriting until back applies the favorites filter. Reference
dossiers use reference descriptions/materials/notes without personal confirmation
actions. Archive/merge lives in the detail's secondary menu.

This slice changes frontend behavior only, with no schema or backend changes.
The live service serves the current production build, and its configuration hash
is unchanged. Synthetic isolated libraries supply all writing tests and screenshots;
no private materials were queued for acceptance. Public source scan: 940 files,
27 private identity markers, zero matches. Published v0.1.0 assets are unchanged.

Verification: production build, 49/49 integration tests and all 13 browser suites
passed in three sequential groups. Reading screenshots were checked in light/dark
at 1440, 760, 390 and 334 pixels; native PDF switching, delayed text responses,
correction refresh and favorite-filter draft retention were exercised with
synthetic material. The old source-version refusal and WebGL lifecycle regressions
also passed. Real iPhone/Safari acceptance remains separate as listed in TODO.md.

The third usability pass implements single-page resume stages, persistent save,
version, PDF and Word actions, explicit current/history export targets and honest
empty/stale/blocked preview states. Exporting current edits saves and freezes a
validated version; an explicitly selected history version retains its document.
Mutating operations serialize, capture input before requests and refuse automatic
downloads if input changes during the operation. Export and save failures preserve
the form. Session drafts survive page/list navigation and multiple unsaved draft
switches without being automatically written to SQLite; refresh/close still clears
unsubmitted input. Returning during persistence waits for its resulting revision.

No backend, schema, resume template or wave-scene change was needed. The independent
review found local-back input loss and hidden initial validation results. Both
were covered by failing-then-passing tests and fixed; no findings remain deferred.
The new non-WebGL resume flow is part of default browser acceptance and Windows CI.
Published v0.1.0 downloads remain unchanged.

Verification for the resume pass: production build, 49/49 integration tests and
all 14 browser suites passed in three sequential groups. Light/dark layouts at
1440, 760, 390 and 334 pixels retain visible actions and no horizontal overflow.
Synthetic exports verify current and historical version targeting; delayed saves,
history reads, list restoration, withdrawn evidence and transport failures are
covered. Public source scan: 943 files, 27 private markers, zero matches. The local
service was stopped; the existing starter launched it using its unchanged config,
and its health/entry match the current build. No private-library editing was used
for acceptance. Office DOCX visual and real iPhone/Safari checks remain separate.
