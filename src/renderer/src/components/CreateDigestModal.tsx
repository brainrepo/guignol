import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Sparkles } from 'lucide-react'
import type { DigestDoc } from '../../../shared/types'

interface Props {
  open: boolean
  onClose: () => void
  onCreated: (doc: DigestDoc) => void
}

const PRESETS: { key: string; days: number }[] = [
  { key: 'createDigest.presetLast24h', days: 1 },
  { key: 'createDigest.presetLast3days', days: 3 },
  { key: 'createDigest.presetLastWeek', days: 7 },
  { key: 'createDigest.presetLast30days', days: 30 }
]

export default function CreateDigestModal({ open, onClose, onCreated }: Props): JSX.Element | null {
  const { t } = useTranslation()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fromDate, setFromDate] = useState(() => defaultFromDate(7))
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && !busy) onClose()
    }
    window.addEventListener('keydown', onKey)
    const t = window.setTimeout(() => inputRef.current?.focus(), 20)
    return () => { window.removeEventListener('keydown', onKey); window.clearTimeout(t) }
  }, [open, onClose, busy])

  useEffect(() => {
    if (!open) {
      setError(null)
      setBusy(false)
      setFromDate(defaultFromDate(7))
    }
  }, [open])

  if (!open) return null

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const fromISO = new Date(fromDate + 'T00:00:00').toISOString()
      const doc = await window.guignol.digests.create(fromISO)
      onCreated(doc)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

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
            disabled={busy}
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
