# Guignol

**A local-first RSS reader for macOS that writes to your markdown vault.**

Every article, highlight, and AI-generated digest is a plain markdown file in a folder you own — ready for Claude Code, Obsidian, or any tool that reads text. No database, no proprietary format, no cloud account.

---

## What it does

- **RSS reader** with a clean three-pane layout (rail · folders/feeds · articles · reader).
- **Feed folders** with drag-and-drop — create, rename, delete. Your layout persists inside the vault (`feeds.json`).
- **Reader mode** — articles re-rendered with Readability, serif typography (`Iowan Old Style`), comfortable measure.
- **Highlights** — select a passage, save it as a markdown line mirroring the article path. An *All Highlights* view gathers every line across every feed.
- **AI summaries** — per-article summary generated via your local `claude` CLI. Regenerate at will.
- **AI digests** — Claude reads what you saved and writes themed digests across a date range. Scope each digest to **All feeds**, a **folder**, or a **single feed**; scope is persisted in the digest's frontmatter.
- **Mark all read** — one button in the toolbar, scoped to the current view.
- **OPML import / export** for feed lists.
- **Five languages** — English, Italian, Spanish, French, German. Light, dark, and system themes. WCAG AA contrast on all text.
- **Bring-your-own-Claude** — every AI feature invokes the locally installed `claude` CLI as a subprocess. No embedded API key, no token meter, no Guignol server.

## Architecture

- **Electron** (main + preload + renderer) with **TypeScript** end-to-end.
- **electron-vite** for dev and build.
- Main process: RSS fetcher, vault I/O, highlights, digest orchestration, Claude CLI runner, IPC.
- Renderer: **React 18** + **React Router** + **Tailwind CSS** + **i18next** + **@dnd-kit** for drag-and-drop.
- Vault format: one markdown file per article with YAML frontmatter. Feeds live in `feeds.json`. Digests are markdown with frontmatter. Highlights are markdown files mirroring the article path.

## Install

Download the latest signed + notarized DMG from [GitHub Releases](https://github.com/brainrepo/guignol/releases/latest). Pick **Apple Silicon** for M1/M2/M3/M4, **Intel** for pre-2020 Macs.

Guignol's AI features require the [Claude Code](https://www.anthropic.com/claude-code) CLI installed on the same machine. Sign in once with `claude`; Guignol borrows the session. Binary path is configurable in **Settings → Claude CLI binary**.

## Develop

Requires Node ≥ 20 and macOS.

```bash
git clone https://github.com/brainrepo/guignol.git
cd guignol
npm install
npm run dev
```

Scripts:

| script | effect |
|---|---|
| `npm run dev` | Launch Electron + Vite dev server with HMR |
| `npm run build` | Build main + preload + renderer bundles |
| `npm run start` | Preview a production build |
| `npm run typecheck` | Type-check both `tsconfig.node.json` and `tsconfig.web.json` |
| `npm run dist:mac` | Produce signed + notarized DMGs via `electron-builder` |

### Project layout

```
src/
  main/              # Electron main process
    feeds/           # fetch + schedule + manager
    vault/           # read + write markdown + index
    reader/          # Readability extraction
    opml/            # import + export
    ai/              # claude CLI runner
    digests.ts
    highlights.ts
    ipc.ts
    settings.ts
  preload/           # IPC bridge exposed as window.guignol
  renderer/src/
    pages/           # ArticleList, ArticleDetail, FeedList, Settings, …
    components/      # Modals, ScopeBadge, PromptModal, …
    i18n/locales/    # en, it, es, fr, de
    styles/global.css
  shared/types.ts    # shared TypeScript types
web/                 # static landing page
```

## Vault anatomy

Given a vault at `~/Guignol/`:

```
~/Guignol/
  feeds.json                      # feed list + folder tags
  <feed-slug>/
    2026-04-15-article-slug.md    # one file per article, YAML frontmatter + body
~/Guignol/highlights/
  <feed-slug>/
    2026-04-15-article-slug.md    # one file per article you highlighted from
~/Guignol/digests/
  2026-04-15-<id>.md              # one file per digest, scope in frontmatter
```

Every path is configurable in **Settings**.

## Contributing

Pull requests welcome. Before opening one:

1. `npm run typecheck` must pass.
2. UI changes should respect the **WCAG AA** contrast ratios baked into `src/renderer/src/styles/global.css` token values.
3. New user-facing strings go through `react-i18next` and ship in all five locale files.

## Releases

See [CHANGELOG.md](./CHANGELOG.md).

## License

TBD — until a license file is added, all rights reserved by the author.

## Author

Built by [Mauro Murru](https://github.com/brainrepo). No tracking, no cookies, no telemetry.
