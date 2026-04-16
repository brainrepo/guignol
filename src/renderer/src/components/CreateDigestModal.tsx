import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Sparkles } from 'lucide-react'
import type { DigestDoc, DigestScope, Feed } from '../../../shared/types'

interface Props {
  open: boolean
  onClose: () => void
  onCreated: (doc: DigestDoc) => void
  feeds: Feed[]
}

type ScopeKind = 'all' | 'folder' | 'feed'

const PRESETS: { key: string; days: number }[] = [
  { key: 'createDigest.presetLast24h', days: 1 },
  { key: 'createDigest.presetLast3days', days: 3 },
  { key: 'createDigest.presetLastWeek', days: 7 },
  { key: 'createDigest.presetLast30days', days: 30 }
]

export default function CreateDigestModal({ open, onClose, onCreated, feeds }: Props): JSX.Element | null {
  const { t } = useTranslation()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fromDate, setFromDate] = useState(() => defaultFromDate(7))
  const [scopeKind, setScopeKind] = useState<ScopeKind>('all')
  const [scopeFolder, setScopeFolder] = useState('')
  const [scopeFeedSlug, setScopeFeedSlug] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const folders = useMemo(() => {
    const set = new Set<string>()
    for (const f of feeds) if (f.folder) set.add(f.folder)
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [feeds])

  const sortedFeeds = useMemo(
    () => [...feeds].sort((a, b) => a.title.localeCompare(b.title)),
    [feeds]
  )

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && !busy) onClose()
    }
    window.addEventListener('keydown', onKey)
    const id = window.setTimeout(() => inputRef.current?.focus(), 20)
    return () => { window.removeEventListener('keydown', onKey); window.clearTimeout(id) }
  }, [open, onClose, busy])

  useEffect(() => {
    if (!open) {
      setError(null)
      setBusy(false)
      setFromDate(defaultFromDate(7))
      setScopeKind('all')
      setScopeFolder('')
      setScopeFeedSlug('')
    }
  }, [open])

  if (!open) return null

  const buildScope = (): DigestScope => {
    if (scopeKind === 'folder' && scopeFolder) return { kind: 'folder', name: scopeFolder }
    if (scopeKind === 'feed' && scopeFeedSlug) return { kind: 'feed', slug: scopeFeedSlug }
    return { kind: 'all' }
  }

  const canSubmit = (): boolean => {
    if (busy) return false
    if (scopeKind === 'folder' && !scopeFolder) return false
    if (scopeKind === 'feed' && !scopeFeedSlug) return false
    return true
  }

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const fromISO = new Date(fromDate + 'T00:00:00').toISOString()
      const doc = await window.guignol.digests.create(fromISO, buildScope())
      onCreated(doc)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const segBtn = (active: boolean): string =>
    `px-3 py-1.5 text-[12px] uppercase tracking-caps transition-colors ${active
      ? 'text-fg bg-bg-hover'
      : 'text-fg-muted hover:text-fg'}`

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-28 bg-black/45 backdrop-blur-sm animate-[fade-in_120ms_ease-out]"
      onMouseDown={() => !busy && onClose()}
    >
      <form
        onSubmit={submit}
        onMouseDown={(e) => e.stopPropagation()}
        className="bg-bg-panel border border-fg-faint rounded-lg w-[480px] max-w-[90vw] shadow-[0_20px_50px_rgba(0,0,0,0.3)] overflow-hidden"
      >
        <header className="px-6 pt-6 pb-1">
          <div className="label mb-1">{t('createDigest.label')}</div>
          <h2 className="font-serif text-2xl font-normal tracking-tight text-fg m-0">
            {t('createDigest.title')}
          </h2>
        </header>

        <div className="px-6 py-5 space-y-5">
          <div>
            <label className="label block mb-2">{t('createDigest.scopeLabel')}</label>
            <div className="inline-flex rounded-md border border-fg-faint overflow-hidden">
              <button
                type="button"
                onClick={() => setScopeKind('all')}
                className={segBtn(scopeKind === 'all')}
                disabled={busy}
              >
                {t('createDigest.scopeAll')}
              </button>
              <button
                type="button"
                onClick={() => setScopeKind('folder')}
                className={`${segBtn(scopeKind === 'folder')} border-l border-fg-faint`}
                disabled={busy || folders.length === 0}
                title={folders.length === 0 ? t('feedList.uncategorized') : undefined}
              >
                {t('createDigest.scopeFolder')}
              </button>
              <button
                type="button"
                onClick={() => setScopeKind('feed')}
                className={`${segBtn(scopeKind === 'feed')} border-l border-fg-faint`}
                disabled={busy || feeds.length === 0}
              >
                {t('createDigest.scopeFeed')}
              </button>
            </div>
            {scopeKind === 'folder' && (
              <select
                value={scopeFolder}
                onChange={(e) => setScopeFolder(e.target.value)}
                disabled={busy}
                className="mt-3 w-full text-[14px] py-2 bg-transparent text-fg border-b border-fg-faint focus:border-accent transition-colors"
              >
                <option value="">{t('createDigest.scopePickFolder')}</option>
                {folders.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            )}
            {scopeKind === 'feed' && (
              <select
                value={scopeFeedSlug}
                onChange={(e) => setScopeFeedSlug(e.target.value)}
                disabled={busy}
                className="mt-3 w-full text-[14px] py-2 bg-transparent text-fg border-b border-fg-faint focus:border-accent transition-colors"
              >
                <option value="">{t('createDigest.scopePickFeed')}</option>
                {sortedFeeds.map((f) => (
                  <option key={f.slug} value={f.slug}>{f.title}</option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="label block mb-2">{t('createDigest.fromDate')}</label>
            <input
              ref={inputRef}
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              disabled={busy}
              max={new Date().toISOString().slice(0, 10)}
              className="w-full text-[15px] py-2 text-fg border-b border-fg-faint focus:border-accent transition-colors"
            />
          </div>

          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <button
                key={p.days}
                type="button"
                onClick={() => setFromDate(defaultFromDate(p.days))}
                disabled={busy}
                className="px-2.5 py-1 text-[12px] rounded-full text-fg-dim hover:text-fg hover:bg-bg-hover border border-fg-faint transition-colors"
              >
                {t(p.key)}
              </button>
            ))}
          </div>

          {error && (
            <div className="text-xs text-red-500 break-words">{error}</div>
          )}
          {busy && (
            <div className="text-xs text-fg-muted flex items-center gap-2">
              <Sparkles size={12} className="animate-pulse" />
              {t('createDigest.busy')}
            </div>
          )}
        </div>

        <footer className="flex items-center justify-end gap-1 px-4 py-3 bg-bg-alt border-t border-fg-faint">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="px-3 py-1.5 text-xs uppercase tracking-caps text-fg-dim rounded hover:text-fg hover:bg-bg-hover"
          >
            {t('createDigest.cancel')}
          </button>
          <button
            type="submit"
            disabled={!canSubmit()}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[13px] font-medium text-bg bg-accent hover:bg-accent-dim transition-colors disabled:opacity-40"
          >
            <Sparkles size={14} strokeWidth={2} aria-hidden />
            {busy ? t('createDigest.generating') : t('createDigest.submit')}
          </button>
        </footer>
      </form>
    </div>
  )
}

function defaultFromDate(daysAgo: number): string {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  return d.toISOString().slice(0, 10)
}
