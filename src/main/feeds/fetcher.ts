import Parser from 'rss-parser'
import TurndownService from 'turndown'
import type { ArticleFrontmatter, Feed, FetchResult } from '../../shared/types.js'
import { articleId, articlePath } from '../vault/paths.js'
import { writeArticle } from '../vault/writer.js'
import { upsertMeta } from '../vault/index.js'
import { updateFeed } from './manager.js'
import { log } from '../log.js'

const parser = new Parser({
  timeout: 10_000,
  headers: { 'User-Agent': 'Guignol/0.1 (+https://github.com/brainrepo/guignol)' }
})

const turndown = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-',
  emDelimiter: '_'
})

export async function fetchFeed(feed: Feed): Promise<FetchResult> {
  log.info('fetcher', `fetching ${feed.title}`, feed.url)
  try {
    const parsed = await parser.parseURL(feed.url)
    log.debug('fetcher', `parsed ${feed.title}: ${parsed.items.length} items`)
    let newCount = 0

    for (const item of parsed.items) {
      const ref = item.guid || item.link
      if (!ref) continue
      const id = articleId(ref)
      const published = item.isoDate || item.pubDate || new Date().toISOString()
      const publishedISO = new Date(published).toISOString()
      const html = item['content:encoded'] || item.content || item.contentSnippet || ''
      const body = html ? turndown.turndown(html) : ''

      const frontmatter: ArticleFrontmatter = {
        id,
        feed: feed.slug,
        feed_url: feed.url,
        title: item.title?.trim() || '(senza titolo)',
        link: item.link || '',
        author: item.creator || item.author,
        published: publishedISO,
        fetched: new Date().toISOString(),
        read: false,
        starred: false,
        tags: item.categories ?? []
      }

      const written = await writeArticle(frontmatter, body)
      if (written) {
        newCount += 1
        const filePath = articlePath(feed.slug, frontmatter.published, frontmatter.id)
        upsertMeta({ ...frontmatter, filePath })
      }
    }

    await updateFeed(feed.url, {
      lastFetchedAt: new Date().toISOString(),
      lastError: undefined,
      errorCount: 0
    })

    log.info('fetcher', `done ${feed.title}: ${newCount} nuovi`)
    return { feedUrl: feed.url, newArticles: newCount }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    log.error('fetcher', `failed ${feed.title}`, err)
    await updateFeed(feed.url, {
      lastError: message,
      errorCount: ((feed.errorCount ?? 0) + 1)
    })
    return { feedUrl: feed.url, newArticles: 0, errors: message }
  }
}

export async function fetchAll(feeds: Feed[]): Promise<FetchResult[]> {
  const results = await Promise.all(feeds.map(fetchFeed))
  return results
}

/**
 * Validazione rapida di un URL feed prima di salvarlo: prova a parsarlo
 * e ritorna il titolo estratto (o lancia).
 */
export async function probeFeed(url: string): Promise<{ title: string }> {
  log.info('fetcher', `probing ${url}`)
  try {
    const parsed = await parser.parseURL(url)
    const title = parsed.title?.trim() || url
    log.info('fetcher', `probe ok: ${title}`)
    return { title }
  } catch (err) {
    log.error('fetcher', `probe failed ${url}`, err)
    throw err
  }
}
