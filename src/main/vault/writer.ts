import { mkdir, rename, writeFile, access } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import matter from 'gray-matter'
import type { ArticleFrontmatter } from '../../shared/types.js'
import { articlePath, feedDir } from './paths.js'

export async function ensureFeedDir(slug: string): Promise<void> {
  await mkdir(feedDir(slug), { recursive: true })
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

/**
 * Write an article atomically. Returns true if a new file was written,
 * false if the file already existed (skipped — dedup gratuita).
 *
 * TODO (user contribution):
 * Decidere la politica per i conflitti. Attualmente: se il file esiste, skip.
 * Possibili strategie alternative:
 *   - Sovrascrivi sempre (utile se il feed corregge articoli)
 *   - Tieni la versione più recente per data fetched, scartando quella vecchia
 *   - Versioning: salva file vecchio come .bak prima di sovrascrivere
 *   - Confronta hash del body, sovrascrivi solo se cambiato
 * Vedi sotto il TODO nella funzione resolveConflict().
 */
export async function writeArticle(
  frontmatter: ArticleFrontmatter,
  body: string
): Promise<boolean> {
  const slug = frontmatter.feed
  const path = articlePath(slug, frontmatter.published, frontmatter.id)

  await ensureFeedDir(slug)

  const exists = await fileExists(path)
  if (exists) {
    const action = await resolveConflict(path, frontmatter, body)
    if (action === 'skip') return false
  }

  const cleaned = stripUndefined(frontmatter as unknown as Record<string, unknown>)
  const serialized = matter.stringify(body, cleaned)
  const tmp = join(dirname(path), `.${frontmatter.id}.tmp`)
  await writeFile(tmp, serialized, 'utf8')
  await rename(tmp, path)
  return !exists
}

/**
 * TODO (user contribution): implementa la politica di gestione conflitti.
 *
 * Riceve il path del file esistente e i nuovi dati. Deve ritornare:
 *   - 'skip'      → non fare nulla, mantieni il file esistente
 *   - 'overwrite' → sovrascrivi (writeArticle scriverà sopra)
 *
 * Considerazioni:
 *   - Sovrascrivere preserva eventuali campi aggiunti come `summary` o `read`?
 *     (NO: vengono persi se non li ri-iniettiamo dal file esistente)
 *   - Vuoi confrontare body o solo data di pubblicazione?
 *   - Vuoi tenere `read`/`summary` del vecchio anche dopo overwrite?
 *
 * Per ora ritorno 'skip' — modifica qui per cambiare comportamento.
 */
async function resolveConflict(
  _existingPath: string,
  _newFrontmatter: ArticleFrontmatter,
  _newBody: string
): Promise<'skip' | 'overwrite'> {
  return 'skip'
}

/**
 * Update frontmatter di un articolo esistente preservando il body.
 * Usato per aggiungere summary AI, toggle read.
 */
export async function updateArticleFrontmatter(
  filePath: string,
  patch: Partial<ArticleFrontmatter>
): Promise<void> {
  const { readFile } = await import('node:fs/promises')
  const raw = await readFile(filePath, 'utf8')
  const parsed = matter(raw)
  const merged = stripUndefined({ ...parsed.data, ...patch })
  const serialized = matter.stringify(parsed.content, merged)
  const tmp = join(dirname(filePath), `.${Date.now()}.tmp`)
  await writeFile(tmp, serialized, 'utf8')
  await rename(tmp, filePath)
}

function stripUndefined(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue
    out[k] = v
  }
  return out
}
