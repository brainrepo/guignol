import { spawn } from 'node:child_process'
import type { Article } from '../../shared/types.js'
import { settings } from '../settings.js'
import { log } from '../log.js'

const TIMEOUT_MS = 30_000

/**
 * TODO (user contribution): progetta il prompt per il summary.
 *
 * Considerazioni di design:
 *   - Lingua: italiano? Inglese? Seguire la lingua dell'articolo (harder to detect)?
 *   - Formato: 3 bullet point? Paragrafo breve (<= 100 parole)? TL;DR + punti chiave?
 *   - Tono: neutro, giornalistico, casual?
 *   - Deve citare l'autore/fonte? Includere il titolo nel summary?
 *   - Come gestire articoli molto lunghi (troncare? dire a claude di essere conciso)?
 *   - Vuoi istruire claude a NON aggiungere preamboli tipo "Ecco il riassunto:"?
 *
 * Suggerimento: un buon prompt corto è più robusto di uno molto articolato.
 * Quando lo modifichi, ricorda che l'output diventerà il campo `summary:` nel frontmatter YAML
 * — evita caratteri che rompono YAML (doppie virgolette non bilanciate, colonne a inizio riga).
 *
 * Placeholder iniziale — sostituire con prompt pensato:
 */
export function buildSummaryPrompt(article: Article): string {
  // TODO utente: migliora questo prompt.
  return [
    'Riassumi il seguente articolo in 3 bullet point brevi in italiano.',
    'Non aggiungere preamboli, restituisci solo i bullet.',
    '',
    `Titolo: ${article.title}`,
    article.author ? `Autore: ${article.author}` : '',
    '',
    article.body
  ].filter(Boolean).join('\n')
}

export interface SummarizeResult {
  summary: string
  model?: string
}

export class ClaudeCliError extends Error {
  constructor(message: string, public readonly code?: number) {
    super(message)
    this.name = 'ClaudeCliError'
  }
}

/**
 * Invoca `claude -p` come subprocess e ritorna lo stdout.
 * Il prompt è inviato via stdin per evitare limiti/escaping di argv.
 */
export async function summarize(article: Article): Promise<SummarizeResult> {
  const prompt = buildSummaryPrompt(article)
  const bin = settings.get('claudeBinary')
  log.info('ai', `summarizing "${article.title}" via ${bin}`)

  return await new Promise<SummarizeResult>((resolve, reject) => {
    const child = spawn(bin, ['-p'], {
      env: withExtendedPath(process.env),
      stdio: ['pipe', 'pipe', 'pipe']
    })

    let stdout = ''
    let stderr = ''
    let settled = false

    const timeout = setTimeout(() => {
      if (settled) return
      settled = true
      child.kill('SIGKILL')
      reject(new ClaudeCliError(`claude timeout after ${TIMEOUT_MS}ms`))
    }, TIMEOUT_MS)

    child.stdout.on('data', (chunk) => { stdout += chunk.toString('utf8') })
    child.stderr.on('data', (chunk) => { stderr += chunk.toString('utf8') })

    child.on('error', (err) => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      const msg = (err as NodeJS.ErrnoException).code === 'ENOENT'
        ? `'${bin}' non trovato nel PATH. Installa Claude Code o imposta il path nelle settings.`
        : err.message
      reject(new ClaudeCliError(msg))
    })

    child.on('close', (code) => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      if (code !== 0) {
        reject(new ClaudeCliError(stderr.trim() || `claude exited with code ${code}`, code ?? undefined))
        return
      }
      resolve({ summary: stdout.trim() })
    })

    child.stdin.write(prompt)
    child.stdin.end()
  })
}

/**
 * Electron app lanciate dal Finder/Dock su macOS non ereditano il PATH della shell.
 * Aggiungo i path comuni dove `claude` potrebbe essere installato.
 */
function withExtendedPath(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const extras = ['/usr/local/bin', '/opt/homebrew/bin', `${env.HOME}/.local/bin`]
  const existing = env.PATH ?? ''
  const parts = new Set([...existing.split(':'), ...extras].filter(Boolean))
  return { ...env, PATH: Array.from(parts).join(':') }
}
