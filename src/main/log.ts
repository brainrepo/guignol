import { BrowserWindow } from 'electron'

export type LogLevel = 'info' | 'warn' | 'error' | 'debug'

export interface LogEntry {
  ts: string
  level: LogLevel
  source: string
  message: string
  detail?: string
}

const MAX_BUFFER = 500
const buffer: LogEntry[] = []

function broadcast(entry: LogEntry): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('log:entry', entry)
  }
}

function push(level: LogLevel, source: string, message: string, detail?: unknown): void {
  const entry: LogEntry = {
    ts: new Date().toISOString(),
    level,
    source,
    message,
    detail: detail !== undefined ? formatDetail(detail) : undefined
  }
  buffer.push(entry)
  if (buffer.length > MAX_BUFFER) buffer.shift()
  const line = `[${entry.ts.slice(11, 19)}] [${level.toUpperCase()}] ${source}: ${message}${entry.detail ? ' — ' + entry.detail : ''}`
  if (level === 'error') console.error(line)
  else if (level === 'warn') console.warn(line)
  else console.log(line)
  broadcast(entry)
}

function formatDetail(d: unknown): string {
  if (d instanceof Error) return d.stack || d.message
  if (typeof d === 'string') return d
  try { return JSON.stringify(d) } catch { return String(d) }
}

export const log = {
  info: (source: string, message: string, detail?: unknown) => push('info', source, message, detail),
  warn: (source: string, message: string, detail?: unknown) => push('warn', source, message, detail),
  error: (source: string, message: string, detail?: unknown) => push('error', source, message, detail),
  debug: (source: string, message: string, detail?: unknown) => push('debug', source, message, detail),
  history: (): LogEntry[] => buffer.slice()
}
