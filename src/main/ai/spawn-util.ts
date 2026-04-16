import { spawn } from 'node:child_process'

export class AiCliError extends Error {
  constructor(message: string, public readonly providerName: string, public readonly code?: number) {
    super(message)
    this.name = 'AiCliError'
  }
}

export interface RunCliOptions {
  bin: string
  args: string[]
  /** If set, written to stdin then closed. If undefined, stdin is closed immediately. */
  stdinPrompt?: string
  timeoutMs: number
  /** Used in error messages + ENOENT hint. */
  providerName: string
  /** Extra env vars to merge (e.g. OPENAI_API_KEY). */
  extraEnv?: NodeJS.ProcessEnv
}

/**
 * Spawns a CLI binary, optionally pipes `stdinPrompt` into stdin, and resolves
 * with trimmed stdout. Rejects with AiCliError on timeout, non-zero exit, or
 * ENOENT. Mirrors the shape used originally in claude-cli.ts.
 */
export function runCli(opts: RunCliOptions): Promise<string> {
  const { bin, args, stdinPrompt, timeoutMs, providerName, extraEnv } = opts

  return new Promise<string>((resolve, reject) => {
    const child = spawn(bin, args, {
      env: { ...withExtendedPath(process.env), ...extraEnv },
      // stdin must be 'ignore' (not 'pipe' + immediate end) when we're not
      // writing a prompt: some CLIs detect piped stdin and change their flag
      // behavior accordingly, even if the pipe is empty.
      stdio: [stdinPrompt !== undefined ? 'pipe' : 'ignore', 'pipe', 'pipe']
    })

    let stdout = ''
    let stderr = ''
    let settled = false

    const timeout = setTimeout(() => {
      if (settled) return
      settled = true
      child.kill('SIGKILL')
      reject(new AiCliError(`${providerName} timeout after ${timeoutMs}ms`, providerName))
    }, timeoutMs)

    child.stdout!.on('data', (chunk) => { stdout += chunk.toString('utf8') })
    child.stderr!.on('data', (chunk) => { stderr += chunk.toString('utf8') })

    child.on('error', (err) => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      const msg = (err as NodeJS.ErrnoException).code === 'ENOENT'
        ? `'${bin}' not found in PATH. Install the ${providerName} CLI or set its binary path in Settings.`
        : err.message
      reject(new AiCliError(msg, providerName))
    })

    child.on('close', (code) => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      if (code !== 0) {
        reject(new AiCliError(
          stderr.trim() || `${providerName} exited with code ${code}`,
          providerName,
          code ?? undefined
        ))
        return
      }
      resolve(stdout.trim())
    })

    if (stdinPrompt !== undefined && child.stdin) {
      child.stdin.write(stdinPrompt)
      child.stdin.end()
    }
  })
}

/**
 * Electron GUI launches on macOS don't inherit the shell PATH — add common
 * install locations so `claude` / `codex` resolve even when the user hasn't
 * configured an absolute path in Settings.
 */
export function withExtendedPath(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const extras = ['/usr/local/bin', '/opt/homebrew/bin', `${env.HOME}/.local/bin`]
  const existing = env.PATH ?? ''
  const parts = new Set([...existing.split(':'), ...extras].filter(Boolean))
  return { ...env, PATH: Array.from(parts).join(':') }
}
