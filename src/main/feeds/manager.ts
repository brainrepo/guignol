import { readFile, writeFile, mkdir, access, rename, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { Feed, FeedsFile } from '../../shared/types.js'
import { feedDir, feedsFilePath, vaultRoot, feedSlug } from '../vault/paths.js'
import { getMetaByFeed, removeMeta } from '../vault/index.js'
import { log } from '../log.js'

async function ensureVault(): Promise<void> {
  await mkdir(vaultRoot(), { recursive: true })
}

async function readFeedsFile(): Promise<FeedsFile> {
  await ensureVault()
  const path = feedsFilePath()
  try {
    await access(path)
  } catch {
    const empty: FeedsFile = { feeds: [], version: 1 }
    await writeFeedsFile(empty)
    return empty
  }
  const raw = await readFile(path, 'utf8')
  try {
    return JSON.parse(raw) as FeedsFile
  } catch {
    return { feeds: [], version: 1 }
  }
}

async function writeFeedsFile(data: FeedsFile): Promise<void> {
  const path = feedsFilePath()
  const tmp = join(dirname(path), `.feeds.${Date.now()}.tmp`)
  await writeFile(tmp, JSON.stringify(data, null, 2), 'utf8')
  await rename(tmp, path)
}

export async function listFeeds(): Promise<Feed[]> {
  const f = await readFeedsFile()
  return f.feeds
}

export async function addFeed(url: string, title: string): Promise<Feed> {
  const data = await readFeedsFile()
  const existing = data.feeds.find((f) => f.url === url)
  if (existing) return existing
  const slug = uniqueSlug(title, data.feeds)
  const feed: Feed = { url, title, slug, addedAt: new Date().toISOString() }
  data.feeds.push(feed)
  await writeFeedsFile(data)
  return feed
}

export async function removeFeed(url: string): Promise<void> {
  const data = await readFeedsFile()
  const target = data.feeds.find((f) => f.url === url)
  data.feeds = data.feeds.filter((f) => f.url !== url)
  await writeFeedsFile(data)
  if (target) {
    const stale = getMetaByFeed(target.slug)
    for (const meta of stale) {
      removeMeta(meta.id)
    }
    await rm(feedDir(target.slug), { recursive: true, force: true })
    log.info('feeds', `removed "${target.title}" (${stale.length} articles, dir ${feedDir(target.slug)})`)
  }
}

export async function updateFeed(url: string, patch: Partial<Feed>): Promise<void> {
  const data = await readFeedsFile()
  const idx = data.feeds.findIndex((f) => f.url === url)
  if (idx === -1) return
  const merged = { ...data.feeds[idx], ...patch }
  if ('folder' in patch && (patch.folder === undefined || patch.folder === '')) {
    delete merged.folder
  }
  data.feeds[idx] = merged
  await writeFeedsFile(data)
}

export async function renameFolder(oldName: string, newName: string | null): Promise<void> {
  const data = await readFeedsFile()
  let changed = false
  for (const f of data.feeds) {
    if (f.folder === oldName) {
      if (newName && newName.length > 0) f.folder = newName
      else delete f.folder
      changed = true
    }
  }
  if (changed) await writeFeedsFile(data)
}

function uniqueSlug(title: string, existing: Feed[]): string {
  const base = feedSlug(title)
  let slug = base
  let i = 2
  while (existing.some((f) => f.slug === slug)) {
    slug = `${base}-${i}`
    i += 1
  }
  return slug
}
