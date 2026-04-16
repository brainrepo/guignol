import { access, mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { join } from 'node:path'
import matter from 'gray-matter'
import type { DigestArticleRef, DigestDoc, DigestScope, Language } from '../shared/types.js'
import { LANGUAGES } from '../shared/types.js'
import { settings } from './settings.js'
import { runClaude } from './ai/claude-cli.js'
import { getAllMeta, upsertMeta } from './vault/index.js'
import { readArticleFile } from './vault/reader.js'
import { updateArticleFrontmatter } from './vault/writer.js'
import { listFeeds } from './feeds/manager.js'
import { log } from './log.js'

function digestsRoot(): string {
  return settings.get('digestsPath')
}

function digestPath(id: string, fromISO: string): string {
  const date = fromISO.slice(0, 10)
  return join(digestsRoot(), `${date}-${id}.md`)
}

async function fileExists(path: string): Promise<boolean> {
  try { await access(path); return true } catch { return false }
}

function stripUndefined(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue
    out[k] = v
  }
  return out
}

/**
 * Digest prompt. English instructions with `Respond in {Language}` injection
 * so Claude writes the digest in the user's chosen UI language.
 */
function buildDigestPrompt(
  entries: { title: string; feed: string; link: string; preview: string }[],
  lang: Language
): string {
  const languageName = LANGUAGES[lang].promptName
  const lines: string[] = [
    `Summarize the highlights from these ${entries.length} unread articles in 5-7 thematic bullet points. Respond in ${languageName}.`,
    'Group similar themes when possible.',
    '',
    'IMPORTANT — source link formatting:',
    '- At the end of each bullet, cite sources as markdown links.',
    '- The link text MUST be a short (3-6 word) version of the article title, NOT the word "source".',
    '- Example: `... considerations on the [MCP protocol in AI clients](URL).`',
    '- If a bullet derives from multiple articles, chain multiple links separated by spaces.',
    '- Use exactly the URLs provided below; do not invent or modify them.',
    '',
    'Do not add any preamble — return only the bullets.',
    '',
    '---'
  ]
  entries.forEach((e, i) => {
    lines.push('')
    lines.push(`### Article ${i + 1} — ${e.feed}`)
    lines.push(`Title: ${e.title}`)
    lines.push(`URL: ${e.link}`)
    if (e.preview) {
      lines.push('Preview:')
      lines.push(e.preview)
    }
  })
  return lines.join('\n')
}

function renderDigestBody(doc: DigestDoc, lang: Language): string {
  const lines: string[] = []
  const fromDate = new Date(doc.from).toLocaleDateString(lang, { day: 'numeric', month: 'long', year: 'numeric' })
  const toDate = new Date(doc.to).toLocaleDateString(lang, { day: 'numeric', month: 'long', year: 'numeric' })
  lines.push(`# Digest — ${fromDate} → ${toDate}`, '')
  lines.push(doc.summary, '')
  lines.push('## Included articles', '')
  for (const a of doc.articles) {
    const pub = new Date(a.published).toLocaleDateString(lang, { day: '2-digit', month: 'short' })
    lines.push(`- [${a.title}](${a.link}) — _${a.feed}_ (${pub})`)
  }
  return lines.join('\n')
}

async function resolveScope(scope: DigestScope): Promise<Set<string> | null> {
  if (scope.kind === 'all') return null
  if (scope.kind === 'feed') return new Set([scope.slug])
  const feeds = await listFeeds()
  return new Set(feeds.filter((f) => f.folder === scope.name).map((f) => f.slug))
}

function parseScope(raw: unknown): DigestScope | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const r = raw as { kind?: unknown; name?: unknown; slug?: unknown }
  if (r.kind === 'all') return { kind: 'all' }
  if (r.kind === 'folder' && typeof r.name === 'string') return { kind: 'folder', name: r.name }
  if (r.kind === 'feed' && typeof r.slug === 'string') return { kind: 'feed', slug: r.slug }
  return undefined
}

async function writeDigestFile(doc: DigestDoc, lang: Language): Promise<string> {
  await mkdir(digestsRoot(), { recursive: true })
  const path = digestPath(doc.id, doc.from)
  const fm = stripUndefined({
    id: doc.id,
    created: doc.created,
    from: doc.from,
    to: doc.to,
    summary: doc.summary,
    scope: doc.scope,
    articles: doc.articles
  })
  const serialized = matter.stringify(renderDigestBody(doc, lang), fm)
  const tmp = join(digestsRoot(), `.dg-${Date.now()}.tmp`)
  await writeFile(tmp, serialized, 'utf8')
  await rename(tmp, path)
  return path
}

export async function createDigest(
  fromISO: string,
  scope: DigestScope = { kind: 'all' }
): Promise<DigestDoc> {
  const from = new Date(fromISO)
  if (isNaN(from.getTime())) throw new Error('Invalid date')

  const toISO = new Date().toISOString()
  const allowedFeedSlugs = await resolveScope(scope)

  const unread = getAllMeta().filter((m) => {
    if (m.read) return false
    if (allowedFeedSlugs && !allowedFeedSlugs.has(m.feed)) return false
    const published = new Date(m.published).getTime()
    return published >= from.getTime() && published <= new Date(toISO).getTime()
  })

  if (unread.length === 0) {
    throw new Error('No unread articles in the selected period')
  }

  log.info('digests', `creating digest from ${fromISO} scope=${scope.kind}: ${unread.length} articles`)

  // Build compact previews per article
  const entries = await Promise.all(unread.map(async (m) => {
    let preview = ''
    if (m.summary) {
      preview = m.summary
    } else {
      try {
        const full = await readArticleFile(m.filePath)
        preview = full.body.slice(0, 400).replace(/\s+/g, ' ').trim()
      } catch {
        preview = ''
      }
    }
    return { title: m.title, feed: m.feed, link: m.link, preview }
  }))

  const lang = settings.get('language')
  const prompt = buildDigestPrompt(entries, lang)
  const summary = await runClaude(prompt, 90_000)

  const articles: DigestArticleRef[] = unread.map((m) => ({
    id: m.id,
    title: m.title,
    feed: m.feed,
    link: m.link,
    published: m.published
  }))

  const id = createHash('sha1').update(fromISO + toISO + articles.map((a) => a.id).join('')).digest('hex').slice(0, 8)
  const now = new Date().toISOString()
  const doc: DigestDoc = {
    id,
    created: now,
    from: fromISO,
    to: toISO,
    summary,
    scope: scope.kind === 'all' ? undefined : scope,
    articles
  }

  await writeDigestFile(doc, lang)
  log.info('digests', `digest ${id} saved: ${articles.length} articles`)

  // Mark each article as read (solo dopo che il digest è stato salvato con successo)
  for (const m of unread) {
    try {
      await updateArticleFrontmatter(m.filePath, { read: true })
      upsertMeta({ ...m, read: true })
    } catch (err) {
      log.warn('digests', `failed to mark read ${m.id}`, err)
    }
  }

  return doc
}

export async function listDigests(): Promise<DigestDoc[]> {
  const root = digestsRoot()
  if (!(await fileExists(root))) return []
  const files = await readdir(root)
  const out: DigestDoc[] = []
  for (const file of files) {
    if (!file.endsWith('.md')) continue
    try {
      const raw = await readFile(join(root, file), 'utf8')
      const parsed = matter(raw)
      const data = parsed.data as Partial<DigestDoc>
      if (!data.id || !Array.isArray(data.articles)) continue
      out.push({
        id: data.id,
        created: data.created ?? '',
        from: data.from ?? '',
        to: data.to ?? '',
        summary: data.summary ?? parsed.content,
        scope: parseScope((data as { scope?: unknown }).scope),
        articles: data.articles
      })
    } catch {
      // skip malformed
    }
  }
  return out.sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime())
}
