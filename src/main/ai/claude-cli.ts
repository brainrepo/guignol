import { spawn } from 'node:child_process'
import type { Article, Language } from '../../shared/types.js'
import { LANGUAGES } from '../../shared/types.js'
import { settings } from '../settings.js'
import { log } from '../log.js'

const TIMEOUT_MS = 30_000

/**
 * Summary prompt. English instructions with `Respond in {Language}` injection
 * so the model writes the summary in the user's chosen UI language.
 *
 * The output is stored as the `summary:` frontmatter field — avoid characters
 * that break YAML (unbalanced quotes, colons at line starts).
 */
export function buildSummaryPrompt(article: Article, lang: Language): string {
  const languageName = LANGUAGES[lang].promptName
  return [
    `Summarize the following article in 3 short bullet points. Respond in ${languageName}.`,
    'Do not add any preamble — return only the bullets.',
    '',
    `Title: ${article.title}`,
    article.author ? `Author: ${article.author}` : '',
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

export async function runClaude(prompt: string, timeoutMs = TIMEOUT_MS): Promise<string> {
  const bin = settings.get('claudeBinary')

  return await new Promise<string>((resolve, reject) => {
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
      reject(new ClaudeCliError(`claude timeout after ${timeoutMs}ms`))
    }, timeoutMs)

    child.stdout.on('data', (chunk) => { stdout += chunk.toString('utf8') })
    child.stderr.on('data', (chunk) => { stderr += chunk.toString('utf8') })

    child.on('error', (err) => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      const msg = (err as NodeJS.ErrnoException).code === 'ENOENT'
        ? `'${bin}' not found in PATH. Install Claude Code or set the binary path in Settings.`
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
      resolve(stdout.trim())
    })

    child.stdin.write(prompt)
    child.stdin.end()
  })
}

/**
 * Spawns `claude -p` as a subprocess and returns stdout.
 * The prompt is sent via stdin to avoid argv length/escaping limits.
 */
export async function summarize(article: Article): Promise<SummarizeResult> {
  const prompt = buildSummaryPrompt(article, settings.get('language'))
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
        ? `'${bin}' not found in PATH. Install Claude Code or set the binary path in Settings.`
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
 * Electron apps launched from Finder/Dock on macOS do not inherit the shell PATH.
 * Add common locations where `claude` might be installed.
 */
function withExtendedPath(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const extras = ['/usr/local/bin', '/opt/homebrew/bin', `${env.HOME}/.local/bin`]
  const existing = env.PATH ?? ''
  const parts = new Set([...existing.split(':'), ...extras].filter(Boolean))
  return { ...env, PATH: Array.from(parts).join(':') }
}
