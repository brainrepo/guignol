import { JSDOM } from 'jsdom'
import { Readability } from '@mozilla/readability'
import TurndownService from 'turndown'
import { log } from '../log.js'

export type ReaderErrorKind = 'network' | 'http' | 'empty' | 'parse'

export class ReaderExtractionError extends Error {
  constructor(
    message: string,
    public readonly kind: ReaderErrorKind,
    public readonly status?: number
  ) {
    super(message)
    this.name = 'ReaderExtractionError'
  }
}

export interface ReaderResult {
  body: string
  sourceUrl: string
  wordCount: number
}

const FETCH_TIMEOUT_MS = 20_000

const turndown = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-',
  emDelimiter: '_'
})

/**
 * Anchors that wrap block elements (headings, paragraphs, divs) cause Turndown
 * to emit `[\n\ntext\n\n](url)` — ReactMarkdown can't parse a link split across
 * paragraphs, so the brackets render as literals. Collapse internal whitespace
 * so link text stays on one line.
 */
turndown.addRule('flattenLinks', {
  filter: (node) => node.nodeName === 'A' && !!node.getAttribute('href'),
  replacement: (content, node) => {
    const href = (node as HTMLElement).getAttribute('href') ?? ''
    const text = content.replace(/\s+/g, ' ').trim()
    if (!text) return ''
    return `[${text}](${href})`
  }
})

/**
 * HTTP headers for the reader fetch. We pretend to be Chrome arriving from
 * Google search, which maximizes success on two common classes of target:
 *   - CDN edges (Cloudflare/Akamai) that 403 unknown UAs
 *   - Soft paywalls (NYT/WaPo/LA Times) that whitelist Google referrals
 *
 * Trade-offs accepted: not identifying as Guignol in the UA; simulating
 * search-engine traffic. Acceptable for a personal reader; if you prefer a
 * polite UA, switch this function back to `Guignol/0.1` and handle 403s in
 * `recoverReaderFailure` (Hook C) by retrying with browser headers.
 */
function buildReaderHeaders(_url: string): Record<string, string> {
  return {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Referer': 'https://www.google.com/',
    'Upgrade-Insecure-Requests': '1'
  }
}

/**
 * Fetch the original article URL, extract the main content with Mozilla
 * Readability, and return it as Markdown. Runs in the main process only
 * (no CORS/CSP constraints).
 */
export async function fetchReaderContent(url: string): Promise<ReaderResult> {
  log.info('reader', `fetching ${url}`)

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  let res: Response
  try {
    res = await fetch(url, {
      redirect: 'follow',
      headers: buildReaderHeaders(url),
      signal: controller.signal
    })
  } catch (err) {
    clearTimeout(timer)
    const message = err instanceof Error ? err.message : String(err)
    throw new ReaderExtractionError(`network error: ${message}`, 'network')
  }
  clearTimeout(timer)

  if (!res.ok) {
    throw new ReaderExtractionError(`HTTP ${res.status} for ${url}`, 'http', res.status)
  }

  const html = await res.text()
  const sourceUrl = res.url || url

  let article: { content: string | null; textContent: string | null } | null
  try {
    const dom = new JSDOM(html, { url: sourceUrl })
    article = new Readability(dom.window.document).parse()
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    throw new ReaderExtractionError(`parse failed: ${message}`, 'parse')
  }

  if (!article || !article.content) {
    throw new ReaderExtractionError('Readability returned no content', 'empty')
  }

  const body = turndown.turndown(article.content).trim()
  if (!body) {
    throw new ReaderExtractionError('extraction produced empty markdown', 'empty')
  }

  const wordCount = countWords(article.textContent ?? body)
  log.info('reader', `ok ${sourceUrl} — ${wordCount} words`)
  return { body, sourceUrl, wordCount }
}

function countWords(text: string): number {
  const matches = text.trim().match(/\S+/g)
  return matches ? matches.length : 0
}
