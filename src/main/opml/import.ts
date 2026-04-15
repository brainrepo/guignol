import { readFile } from 'node:fs/promises'
import { parseStringPromise } from 'xml2js'
import { addFeed } from '../feeds/manager.js'
import { probeFeed } from '../feeds/fetcher.js'

interface OpmlOutline {
  $?: { text?: string; title?: string; xmlUrl?: string; type?: string }
  outline?: OpmlOutline | OpmlOutline[]
}

function collectFeedUrls(node: OpmlOutline | OpmlOutline[] | undefined, out: { url: string; title: string }[]): void {
  if (!node) return
  const arr = Array.isArray(node) ? node : [node]
  for (const o of arr) {
    const attrs = o.$
    if (attrs?.xmlUrl) {
      out.push({ url: attrs.xmlUrl, title: attrs.title || attrs.text || attrs.xmlUrl })
    }
    if (o.outline) collectFeedUrls(o.outline, out)
  }
}

export async function importOpml(filePath: string): Promise<{ added: number; skipped: number; errors: string[] }> {
  const xml = await readFile(filePath, 'utf8')
  const parsed = await parseStringPromise(xml)
  const body = parsed?.opml?.body?.[0]
  const urls: { url: string; title: string }[] = []
  collectFeedUrls(body?.outline, urls)

  let added = 0
  let skipped = 0
  const errors: string[] = []

  for (const { url, title } of urls) {
    try {
      let finalTitle = title
      try {
        const probed = await probeFeed(url)
        finalTitle = probed.title
      } catch {
        // usa il title dell'OPML se probe fallisce
      }
      const existing = await addFeed(url, finalTitle)
      if (existing.addedAt) added += 1
      else skipped += 1
    } catch (e) {
      errors.push(`${url}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  return { added, skipped, errors }
}
