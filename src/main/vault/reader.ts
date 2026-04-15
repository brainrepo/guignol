import { readFile, readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'
import matter from 'gray-matter'
import type { Article, ArticleFrontmatter, ArticleMeta } from '../../shared/types.js'
import { vaultRoot } from './paths.js'

export async function readArticleFile(filePath: string): Promise<Article> {
  const raw = await readFile(filePath, 'utf8')
  const parsed = matter(raw)
  const fm = parsed.data as ArticleFrontmatter
  return { ...fm, body: parsed.content, filePath }
}

export async function listAllArticleMeta(): Promise<ArticleMeta[]> {
  const root = vaultRoot()
  const out: ArticleMeta[] = []

  let feedDirs: string[]
  try {
    feedDirs = await readdir(root)
  } catch {
    return out
  }

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
        const fm = parsed.data as ArticleFrontmatter
        out.push({ ...fm, filePath: path })
      } catch {
        // skip malformed files silently — log opzionale futuro
      }
    }
  }

  return out
}
