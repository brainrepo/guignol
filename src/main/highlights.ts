import { access, mkdir, readFile, readdir, rename, stat, unlink, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import matter from 'gray-matter'
import type { ArticleMeta, Highlight, HighlightDoc } from '../shared/types.js'
import { settings } from './settings.js'
import { articleFilename } from './vault/paths.js'
import { log } from './log.js'

type HighlightsFile = HighlightDoc

function highlightsRoot(): string {
  return settings.get('highlightsPath')
}

function highlightsFilePath(meta: ArticleMeta): string {
  const filename = articleFilename(meta.published, meta.id)
  return join(highlightsRoot(), meta.feed, filename)
}

async function fileExists(path: string): Promise<boolean> {
  try { await access(path); return true } catch { return false }
}

async function readFileFor(meta: ArticleMeta): Promise<HighlightsFile | null> {
  const path = highlightsFilePath(meta)
  if (!(await fileExists(path))) return null
  const raw = await readFile(path, 'utf8')
  const parsed = matter(raw)
  const data = parsed.data as Partial<HighlightsFile>
  return {
    article_id: data.article_id ?? meta.id,
    article_title: data.article_title ?? meta.title,
    article_link: data.article_link ?? meta.link,
    feed: data.feed ?? meta.feed,
    feed_url: data.feed_url ?? meta.feed_url,
    created: data.created ?? new Date().toISOString(),
    updated: data.updated ?? new Date().toISOString(),
    highlights: Array.isArray(data.highlights) ? data.highlights : []
  }
}

/**
 * TODO (user contribution):
 * Formato del file di highlight. Attualmente:
 *   - Frontmatter con metadata (article_id/title/link/feed, timestamps)
 *   - `highlights:` array YAML come source of truth
 *   - Body markdown rigenerato da questo array (blockquote + timestamp)
 *
 * Alternative che potresti voler esplorare:
 *   - Supporto per una "nota" libera per highlight (annotation)
 *   - Tag per highlight (es. #importante, #da-rivedere)
 *   - Colori per highlight (come Kindle)
 *   - Link ad altri articoli/highlight (reference)
 *
 * Se cambi questo renderer, aggiorna anche il parser (readFileFor) di conseguenza.
 */
function renderBody(file: HighlightsFile): string {
  if (file.highlights.length === 0) return ''
  const lines: string[] = []
  lines.push(`# ${file.article_title}`, '')
  lines.push(`[Articolo originale](${file.article_link})`, '')
  for (const h of file.highlights) {
    const quoted = h.text.split('\n').map((l) => `> ${l}`).join('\n')
    lines.push(quoted)
    lines.push(`— _${new Date(h.createdAt).toLocaleString('it-IT')}_`)
    lines.push('')
  }
  return lines.join('\n')
}

async function writeFileFor(meta: ArticleMeta, file: HighlightsFile): Promise<void> {
  const path = highlightsFilePath(meta)
  await mkdir(dirname(path), { recursive: true })
  const fm: Record<string, unknown> = {
    article_id: file.article_id,
    article_title: file.article_title,
    article_link: file.article_link,
    feed: file.feed,
    feed_url: file.feed_url,
    created: file.created,
    updated: file.updated,
    highlights: file.highlights
  }
  const serialized = matter.stringify(renderBody(file), fm)
  const tmp = join(dirname(path), `.hl-${Date.now()}.tmp`)
  await writeFile(tmp, serialized, 'utf8')
  await rename(tmp, path)
}

function normalizeText(s: string): string {
  return s.replace(/\s+/g, ' ').trim()
}

export async function listHighlights(meta: ArticleMeta): Promise<Highlight[]> {
  const file = await readFileFor(meta)
  return file?.highlights ?? []
}

export async function addHighlight(meta: ArticleMeta, text: string): Promise<Highlight[]> {
  const normalized = normalizeText(text)
  if (!normalized) return []
  const now = new Date().toISOString()
  const existing = await readFileFor(meta)
  const file: HighlightsFile = existing ?? {
    article_id: meta.id,
    article_title: meta.title,
    article_link: meta.link,
    feed: meta.feed,
    feed_url: meta.feed_url,
    created: now,
    updated: now,
    highlights: []
  }
  if (file.highlights.some((h) => normalizeText(h.text) === normalized)) {
    return file.highlights
  }
  file.highlights.push({ text, createdAt: now })
  file.updated = now
  await writeFileFor(meta, file)
  log.info('highlights', `added to "${meta.title}" (${file.highlights.length} totali)`)
  return file.highlights
}

export async function listAllHighlightDocs(): Promise<HighlightDoc[]> {
  const root = highlightsRoot()
  const out: HighlightDoc[] = []

  let feedDirs: string[]
  try { feedDirs = await readdir(root) } catch { return out }

  for (const dir of feedDirs) {
    const full = join(root, dir)
    let s
    try { s = await stat(full) } catch { continue }
    if (!s.isDirectory()) continue

    let files: string[]
    try { files = await readdir(full) } catch { continue }

    for (const file of files) {
      if (!file.endsWith('.md')) continue
      const path = join(full, file)
      try {
        const raw = await readFile(path, 'utf8')
        const parsed = matter(raw)
        const data = parsed.data as Partial<HighlightDoc>
        if (!Array.isArray(data.highlights) || data.highlights.length === 0) continue
        out.push({
          article_id: data.article_id ?? '',
          article_title: data.article_title ?? '(senza titolo)',
          article_link: data.article_link ?? '',
          feed: data.feed ?? dir,
          feed_url: data.feed_url ?? '',
          created: data.created ?? '',
          updated: data.updated ?? '',
          highlights: data.highlights
        })
      } catch {
        // skip malformed
      }
    }
  }

  return out
}

export async function removeHighlight(meta: ArticleMeta, text: string): Promise<Highlight[]> {
  const existing = await readFileFor(meta)
  if (!existing) return []
  const normalized = normalizeText(text)
  const next = existing.highlights.filter((h) => normalizeText(h.text) !== normalized)
  if (next.length === existing.highlights.length) return existing.highlights
  existing.highlights = next
  existing.updated = new Date().toISOString()
  if (next.length === 0) {
    try { await unlink(highlightsFilePath(meta)) } catch { /* già rimosso */ }
    log.info('highlights', `file rimosso per "${meta.title}" (nessuna highlight rimasta)`)
    return []
  }
  await writeFileFor(meta, existing)
  log.info('highlights', `removed from "${meta.title}" (${next.length} restanti)`)
  return next
}
