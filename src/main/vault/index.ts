import type { ArticleMeta } from '../../shared/types.js'
import { listAllArticleMeta } from './reader.js'

let cache: Map<string, ArticleMeta> = new Map()
let initialized = false

export async function buildIndex(): Promise<void> {
  const all = await listAllArticleMeta()
  cache = new Map(all.map((a) => [a.id, a]))
  initialized = true
}

export function getAllMeta(): ArticleMeta[] {
  return Array.from(cache.values())
}

export function getMetaByFeed(feedSlug: string): ArticleMeta[] {
  return getAllMeta().filter((a) => a.feed === feedSlug)
}

export function getMeta(id: string): ArticleMeta | undefined {
  return cache.get(id)
}

export function upsertMeta(meta: ArticleMeta): void {
  cache.set(meta.id, meta)
}

export function removeMeta(id: string): void {
  cache.delete(id)
}

export function isInitialized(): boolean {
  return initialized
}
