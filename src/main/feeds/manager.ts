import { readFile, writeFile, mkdir, access, rename } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { Feed, FeedsFile } from '../../shared/types.js'
import { feedsFilePath, vaultRoot, feedSlug } from '../vault/paths.js'

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
  data.feeds = data.feeds.filter((f) => f.url !== url)
  await writeFeedsFile(data)
}

export async function updateFeed(url: string, patch: Partial<Feed>): Promise<void> {
  const data = await readFeedsFile()
  const idx = data.feeds.findIndex((f) => f.url === url)
  if (idx === -1) return
  data.feeds[idx] = { ...data.feeds[idx], ...patch }
  await writeFeedsFile(data)
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
