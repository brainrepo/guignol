import type { Article, Language } from '../../shared/types.js'
import { LANGUAGES } from '../../shared/types.js'
import type { AiResponseKind } from './schema.js'

export interface DigestEntry {
  title: string
  feed: string
  link: string
  preview: string
}

/**
 * Output contract appended to every prompt. The model must emit exactly one
 * JSON object matching AiResponse — no markdown fences, no preamble. This lets
 * us parse provider output uniformly (see parse.ts), sidestepping each CLI's
 * native JSON event format.
 */
function outputContract(kind: AiResponseKind): string {
  return [
    '',
    '---',
    'OUTPUT FORMAT — REQUIRED:',
    'Respond with a single JSON object and nothing else. No prose before or after.',
    'Do NOT wrap the JSON in markdown code fences.',
    'Schema:',
    `  {"kind": "${kind}", "content": "<markdown body as specified above>"}`,
    'The "content" field MUST contain the markdown body in a single JSON string',
    '(newlines as \\n, quotes escaped).'
  ].join('\n')
}

export function buildSummaryPrompt(article: Article, lang: Language): string {
  const languageName = LANGUAGES[lang].promptName
  return [
    `Summarize the following article in 3 short bullet points. Respond in ${languageName}.`,
    'Do not add any preamble in the markdown bullets — just return the 3 bullets.',
    '',
    `Title: ${article.title}`,
    article.author ? `Author: ${article.author}` : '',
    '',
    article.body,
    outputContract('summary')
  ].filter(Boolean).join('\n')
}

export function buildDigestPrompt(entries: DigestEntry[], lang: Language): string {
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
    'Do not add any preamble in the markdown bullets — just return the bullets.',
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
  lines.push(outputContract('digest'))
  return lines.join('\n')
}
