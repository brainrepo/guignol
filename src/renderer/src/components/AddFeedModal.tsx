import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Feed } from '../../../shared/types'

interface Props {
  open: boolean
  onClose: () => void
  onAdded: () => void
  feeds: Feed[]
}

const NEW_FOLDER = '__new__'

export default function AddFeedModal({ open, onClose, onAdded, feeds }: Props): JSX.Element | null {
  const { t } = useTranslation()
  const [url, setUrl] = useState('')
  const [folderChoice, setFolderChoice] = useState('')
  const [newFolder, setNewFolder] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const folders = useMemo(() => {
    const set = new Set<string>()
    for (const f of feeds) if (f.folder) set.add(f.folder)
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [feeds])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent): void => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    const id = window.setTimeout(() => inputRef.current?.focus(), 20)
    return () => { window.removeEventListener('keydown', onKey); window.clearTimeout(id) }
  }, [open, onClose])

  useEffect(() => {
    if (!open) {
      setUrl('')
      setFolderChoice('')
      setNewFolder('')
      setError(null)
      setBusy(false)
    }
  }, [open])

  if (!open) return null

  const resolveFolder = (): string | null => {
    if (folderChoice === NEW_FOLDER) {
      const trimmed = newFolder.trim()
      return trimmed.length > 0 ? trimmed : null
    }
    return folderChoice.length > 0 ? folderChoice : null
  }

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (!url.trim()) return
    setBusy(true)
    setError(null)
    try {
      const feed = await window.guignol.feeds.add(url.trim())
      const folder = resolveFolder()
      if (folder) {
        await window.guignol.feeds.setFolder(feed.url, folder)
      }
      onAdded()
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
      onMouseDown={onClose}
    >
      <form
        onSubmit={submit}
        onMouseDown={(e) => e.stopPropagation()}
        className="bg-bg-panel border border-fg-faint rounded-lg w-[480px] max-w-[90vw] shadow-[0_20px_50px_rgba(0,0,0,0.3)] overflow-hidden"
      >
        <header className="px-6 pt-6 pb-1">
          <div className="label mb-1">{t('addFeed.label')}</div>
          <h2 className="font-serif text-2xl font-normal tracking-tight text-fg m-0">
            {t('addFeed.title')}
          </h2>
        </header>

        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="label block mb-2">{t('addFeed.url')}</label>
            <input
              ref={inputRef}
              type="url"
              placeholder={t('addFeed.placeholder')}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={busy}
              className="w-full text-[15px] py-2 text-fg border-b border-fg-faint focus:border-accent transition-colors placeholder:text-fg-muted"
            />
          </div>

          <div>
            <label className="label block mb-2">{t('addFeed.folder')}</label>
            <select
              value={folderChoice}
              onChange={(e) => setFolderChoice(e.target.value)}
              disabled={busy}
              className="w-full text-[14px] py-2 bg-transparent text-fg border-b border-fg-faint focus:border-accent transition-colors"
            >
              <option value="">{t('addFeed.folderNone')}</option>
              {folders.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
              <option value={NEW_FOLDER}>{t('addFeed.folderNew')}</option>
            </select>
            {folderChoice === NEW_FOLDER && (
              <input
                type="text"
                placeholder={t('addFeed.folderNamePlaceholder')}
                value={newFolder}
                onChange={(e) => setNewFolder(e.target.value)}
                disabled={busy}
                className="mt-3 w-full text-[14px] py-2 text-fg border-b border-fg-faint focus:border-accent transition-colors placeholder:text-fg-muted"
              />
            )}
          </div>

          {error && (
            <div className="text-xs text-red-500 break-words">{error}</div>
          )}
        </div>

        <footer className="flex items-center justify-end gap-1 px-4 py-3 bg-bg-alt border-t border-fg-faint">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="px-3 py-1.5 text-xs uppercase tracking-caps text-fg-dim rounded hover:text-fg hover:bg-bg-hover"
          >
            {t('addFeed.cancel')}
          </button>
          <button
            type="submit"
            disabled={busy || !url.trim()}
            className="px-3 py-1.5 text-xs uppercase tracking-caps text-accent rounded hover:text-bg hover:bg-accent disabled:opacity-35"
          >
            {busy ? t('addFeed.submitting') : t('addFeed.submit')}
          </button>
        </footer>
      </form>
    </div>
  )
}
