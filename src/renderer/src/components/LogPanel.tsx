import { useEffect, useRef, useState } from 'react'
import type { LogEntry } from '../../../shared/types'

const MAX = 500

export default function LogPanel(): JSX.Element {
  const [open, setOpen] = useState(true)
  const [entries, setEntries] = useState<LogEntry[]>([])
  const [levelFilter, setLevelFilter] = useState<'all' | 'error' | 'warn'>('all')
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const autoscrollRef = useRef(true)

  useEffect(() => {
    void window.guignol.log.history().then((h) => setEntries(h))
    const off = window.guignol.on.log((entry) => {
      setEntries((prev) => {
        const next = [...prev, entry]
        return next.length > MAX ? next.slice(next.length - MAX) : next
      })
    })
    return off
  }, [])

  useEffect(() => {
    if (autoscrollRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [entries])

  const onScroll = (): void => {
    const el = scrollRef.current
    if (!el) return
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 20
    autoscrollRef.current = atBottom
  }

  const filtered = entries.filter((e) => {
    if (levelFilter === 'all') return true
    if (levelFilter === 'error') return e.level === 'error'
    if (levelFilter === 'warn') return e.level === 'warn' || e.level === 'error'
    return true
  })

  const errorCount = entries.filter((e) => e.level === 'error').length
  const warnCount = entries.filter((e) => e.level === 'warn').length

  return (
    <div className={`logpanel ${open ? 'open' : 'closed'}`}>
      <div className="logpanel-header">
        <button className="ghost" onClick={() => setOpen(!open)}>
          {open ? '▼' : '▲'} Log ({entries.length})
          {errorCount > 0 && <span className="badge-error">{errorCount}</span>}
          {warnCount > 0 && <span className="badge-warn">{warnCount}</span>}
        </button>
        {open && (
          <>
            <select value={levelFilter} onChange={(e) => setLevelFilter(e.target.value as typeof levelFilter)}>
              <option value="all">Tutti</option>
              <option value="warn">Warn + Error</option>
              <option value="error">Solo errori</option>
            </select>
            <button className="ghost" onClick={() => setEntries([])}>Svuota</button>
          </>
        )}
      </div>
      {open && (
        <div className="logpanel-body" ref={scrollRef} onScroll={onScroll}>
          {filtered.length === 0 && <div className="log-empty">nessun log</div>}
          {filtered.map((e, i) => (
            <div key={i} className={`log-row level-${e.level}`}>
              <span className="log-ts">{e.ts.slice(11, 19)}</span>
              <span className="log-level">{e.level}</span>
              <span className="log-source">{e.source}</span>
              <span className="log-msg">{e.message}</span>
              {e.detail && <div className="log-detail">{e.detail}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
