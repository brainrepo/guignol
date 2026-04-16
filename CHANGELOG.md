# Changelog

All notable changes to Guignol are documented in this file.

Format loosely follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning follows [SemVer](https://semver.org/).

## [0.3.0] - 2026-04-16

### Added
- **Mark all read** — TopBar button (`CheckCheck` icon) that marks every unread article in the current view as read. Scope follows the sidebar selection: marks only the selected feed, or every feed when viewing *All*. Disabled when nothing is unread.
- `window.guignol.articles.markAllRead(feedSlug?)` bridge method; backed by `articles:markAllRead` IPC handler. Returns the number of articles updated.

### Changed
- `.gitignore` now excludes `*.dmg`, `*.zip`, and `web/downloads/` — hosted release binaries belong in GitHub Releases, not in the repo.

### Fixed
- Historical DMG artifacts that were blocking `git push` (>100 MB) stripped from the local unpushed commit history via `git filter-branch`.

---

## [0.2.0] - 2026-04-16

### Added
- **Feed folders** — feeds can now be grouped under named folders. Folder tag stored on each feed (`folder?: string` in `feeds.json`), no schema migration needed.
- **Drag-and-drop** assignment of feeds to folders in the sidebar, powered by `@dnd-kit/core` + `@dnd-kit/sortable`. Click and drag still coexist via a 4px activation threshold.
- **Create / rename / delete** folder actions in the sidebar. Deleting a folder moves its feeds to *Uncategorized* (feeds are never destroyed).
- **Empty-folder slots** — a new `FolderPlus` button next to the `Feeds` label creates a folder that lives in `localStorage` until a feed is dropped in (then becomes persistent on disk).
- **Digest scopes** — the Create Digest modal now supports `All` / `Folder` / `Feed` scoping. Scope is persisted in the digest's frontmatter (`scope: { kind, ... }`); legacy digests without the field render as `All`.
- **Scope badge** on digest list cards and the digest detail header.
- **Folder picker** in the Add Feed modal, with an inline *"+ New folder…"* option.
- New `PromptModal` component replaces Electron-incompatible `window.prompt()` calls.
- i18n keys added across all five locales (en / it / es / fr / de) for folder and scope UX.

### Changed
- **Sidebar layout refined** — rail background is now neutrally darker, with a right border for definition. Brand wordmark sits vertically-centered using sans-serif (Space Grotesk) at lighter weight and wider tracking.
- **Typography** — enabled `text-rendering: optimizeLegibility`, `-moz-osx-font-smoothing: grayscale`, `font-feature-settings: 'kern','liga','calt'`, `font-optical-sizing: auto`, and `font-synthesis: none` globally for crisper rendering.
- **Create-feed `+` button** is now filled-accent to serve as the clear primary action in the rail; the Settings cog uses a neutral hover/active state instead of an accent fill.
- **Sidebar toggle shortcut** is now layout-independent. Cmd/Ctrl + `\`, `/`, or `B` all toggle the sidebar — works on Italian/ISO keyboards where `\` lives behind AltGr.
- `createDigest(fromISO, scope)` accepts an optional `DigestScope` and filters unread articles accordingly.
- `window.guignol.feeds` bridge gains `setFolder(url, folder)` and `renameFolder(oldName, newName)`.
- `AddFeedModal` and `DigestsList` now receive the `feeds` array so they can render folder pickers and scope badges.

### Fixed
- **Accessibility (WCAG AA)** — `--color-fg-muted` darkened in light mode (`#8795a8` → `#5a6778`) and lightened in dark mode (`#6b7685` → `#8b95a3`). All small text now meets 4.5:1 contrast on every surface (`bg`, `bg-panel`, `bg-alt`).

### Removed
- Guignol logo image from the leftmost rail (brand wordmark kept).

---

## [0.1.0] - 2026-03-xx

Initial release. Core RSS reader with markdown vault, highlights, AI summaries, reader mode, digest generation, OPML import/export, and five-language UI.
