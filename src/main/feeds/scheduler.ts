import { EventEmitter } from 'node:events'
import type { FetchResult } from '../../shared/types.js'
import { listFeeds } from './manager.js'
import { fetchAll } from './fetcher.js'
import { settings } from '../settings.js'
import { log } from '../log.js'

class SchedulerEvents extends EventEmitter {}
export const schedulerEvents = new SchedulerEvents()

let timer: NodeJS.Timeout | null = null
let inflight = false

export async function runNow(): Promise<FetchResult[]> {
  if (inflight) {
    log.warn('scheduler', 'runNow skipped (already inflight)')
    return []
  }
  inflight = true
  try {
    const feeds = await listFeeds()
    log.info('scheduler', `cycle start (${feeds.length} feeds)`)
    const results = await fetchAll(feeds)
    const totalNew = results.reduce((n, r) => n + r.newArticles, 0)
    log.info('scheduler', `cycle done: ${totalNew} nuovi totali`)
    schedulerEvents.emit('cycle', { results, totalNew })
    return results
  } finally {
    inflight = false
  }
}

export function start(): void {
  stop()
  const minutes = settings.get('pollingMinutes')
  const ms = Math.max(1, minutes) * 60_000
  timer = setInterval(() => {
    void runNow()
  }, ms)
}

export function stop(): void {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}

export function restart(): void {
  start()
}
