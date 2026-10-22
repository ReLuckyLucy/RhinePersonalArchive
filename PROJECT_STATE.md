# Project state

Updated: 2026-10-22. Standalone release: v0.1.0.

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
