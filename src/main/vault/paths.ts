import { createHash } from 'node:crypto'
import { join } from 'node:path'
import slugify from 'slugify'
import { settings } from '../settings.js'

export function vaultRoot(): string {
  return settings.get('vaultPath')
}

export function feedsFilePath(): string {
  return join(vaultRoot(), 'feeds.json')
}

export function feedSlug(title: string): string {
  return slugify(title, { lower: true, strict: true }).slice(0, 50) || 'untitled'
}

export function feedDir(slug: string): string {
  return join(vaultRoot(), slug)
}

export function articleId(guidOrLink: string): string {
  return createHash('sha1').update(guidOrLink).digest('hex').slice(0, 8)
}

export function articleFilename(publishedISO: string, id: string): string {
  const date = publishedISO.slice(0, 10)
  return `${date}-${id}.md`
}

export function articlePath(slug: string, publishedISO: string, id: string): string {
  return join(feedDir(slug), articleFilename(publishedISO, id))
}
