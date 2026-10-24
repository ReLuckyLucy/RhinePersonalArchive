# Resume usability implementation plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan. Steps use checkbox syntax for tracking.

**Goal:** Make selection, preview and export discoverable without losing edits or exporting the wrong version.

**Architecture:** Keep the approved single-page workspace and its existing save/build/freeze/export APIs. Add stage anchors and one persistent action bar; distinguish the current draft, an outdated preview and an explicitly selected historical version. No database or export-template changes.

**Tech Stack:** Existing TypeScript, native DOM/CSS, Node/SQLite and Playwright.

**Spec:** `docs/UX-REVIEW.md`, resume editing row and acceptance conditions; user approved implementation and continued the staged usability work.

## Global constraints

- Use only confirmed facts; preserve selected fact revisions and immutable versions.
- Do not mutate or enqueue private library material for acceptance.
- Preserve the original wave scene and the one application implementation.
- Source and published v0.1.0 downloads remain separate; do not replace release assets.
- Reuse the clean current checkout and existing isolated browser-test libraries.

## Review focus

- Editing after saving a version must not silently export that old version.
- A late save/build or historical-version response must not replace newer edits or preview intent.
- Export failures and blocking evidence issues must leave the form usable, with no download.
- Narrow screens must expose actions and preview without horizontal overflow or covering the final fields.
- An empty or withdrawn selection must provide a direct review path without automatic confirmation.

## Task 1: One-page stage navigation, honest preview and stable export actions

**Files:** Modify `src/features/resume/editor.ts`, `workspace.ts`, `src/main.ts`, `src/styles/resume.css`; create `tests/browser/resume-flow.test.mjs`; retain existing resume/journey/revisions tests.

**Interfaces:** Preserve `mountResumeEditor` callers and suspension contract, adding only an optional `onReviewQueue:()=>void` callback through `mountResume`. Reuse POST profile/resume-drafts, GET build, POST freeze/exports, and GET resume-versions/version.

- [x] Write and run failing user-flow tests: actions visible at entry; empty preview explains save; empty sections collapse; stage navigation retains form values; export creates a validated current version; edit then export uses a new version; explicit history selection exports its fixed document; pending save and failures preserve edits; no facts links to review.
- [x] Implement one-page stage anchors and a persistent action bar with visible save, version, PDF and Word actions. Keep one copy of each form field. Group empty sections and personal information; add explicit preview and target labels.
- [x] Track edit generation, preview intent, saved preview freshness and selected immutable version. Capture input before asynchronous saves; serialize mutating actions. Do not freeze/export when edits changed during an in-flight save. A draft export saves/freezes current input before export; history exports its explicitly labeled version.
- [x] Verify the new suite plus resume, revisions and journey. Check light/dark at desktop and 760/390/334 widths, save/export errors, and navigation while operations are pending.
- [x] Run production build and all integration tests; run all browser suites in sequential groups. Request one independent whole-change review, address important findings, scan public files and record actual acceptance.
- [x] Update TODO/state/log, usage and file map, add this plan and the browser suite to public packaging/default test inventory.

Publication gate: Commit the verified change, push the authorized main branch and verify remote SHA plus Windows/Docker checks before reporting delivery. Git history and the linked Actions run carry publication evidence.

## Execution ledger

- 2026-10-24: Baseline `abdf61c`, clean main checkout. Existing one-page design and implementation authorization are retained; no new approval loop. The new behavior is UI guidance and correct export targeting, not a new resume pipeline.
- Kept this public plan outside the ignored historical working-record directory and included its exact filename in the release allowlist.
- Initial test failed because the stage navigation did not exist; the implemented flow passes real version/export and asynchronous preservation checks.
- A 334-pixel check found the pre-existing 340-pixel body minimum. A resume-scoped 320-pixel minimum fixes the overflow without changing other page layouts.
- A repeated build after remote fact withdrawal left old preview text visible because the cache key used input generation alone. Its failing test preceded a separate preview render revision; the same-input rebuild now refreshes the document.
- Independent final review found list-back input loss (Important) and hidden initial build issues (labeled Minor). Initial blockers are treated as a correctness issue because the new preview claim must reflect validation state. Both have failing-then-passing regressions; no findings were deferred.
- Session drafts are held by key until the browser is refreshed/closed. List navigation and switching multiple unsaved drafts do not write them to SQLite. Initial build and save share issue rendering; withdrawn contributions are omitted and explained immediately.
- Final verification: production build, 49/49 integration tests and all 14 browser suites passed across three sequential groups. Source privacy scan: 943 files, 27 markers, zero matches. The existing starter restored the stopped local service with unchanged configuration and serves the current build.
