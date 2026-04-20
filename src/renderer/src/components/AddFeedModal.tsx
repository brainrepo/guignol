import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Feed } from '../../../shared/types'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from './ui/dialog'
import { Button } from './ui/button'
import { Input } from './ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from './ui/select'
import { Label } from './ui/label'

interface Props {
  open: boolean
  onClose: () => void
  onAdded: () => void
  feeds: Feed[]
}

const NEW_FOLDER = '__new__'
const NO_FOLDER = '__none__'

export default function AddFeedModal({ open, onClose, onAdded, feeds }: Props): JSX.Element {
  const { t } = useTranslation()
  const [url, setUrl] = useState('')
  const [folderChoice, setFolderChoice] = useState<string>(NO_FOLDER)
  const [newFolder, setNewFolder] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const folders = useMemo(() => {
    const set = new Set<string>()
    for (const f of feeds) if (f.folder) set.add(f.folder)
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [feeds])

  useEffect(() => {
    if (!open) {
      setUrl('')
      setFolderChoice(NO_FOLDER)
      setNewFolder('')
      setError(null)
      setBusy(false)
    }
  }, [open])

  const resolveFolder = (): string | null => {
    if (folderChoice === NEW_FOLDER) {
      const trimmed = newFolder.trim()
      return trimmed.length > 0 ? trimmed : null
    }
    if (folderChoice === NO_FOLDER) return null
    return folderChoice
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
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <div className="label">{t('addFeed.label')}</div>
          <DialogTitle>{t('addFeed.title')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <Label htmlFor="feed-url">{t('addFeed.url')}</Label>
            <Input
              id="feed-url"
              type="url"
              autoFocus
              placeholder={t('addFeed.placeholder')}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={busy}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label>{t('addFeed.folder')}</Label>
            <Select value={folderChoice} onValueChange={setFolderChoice} disabled={busy}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_FOLDER}>{t('addFeed.folderNone')}</SelectItem>
                {folders.map((name) => (
                  <SelectItem key={name} value={name}>{name}</SelectItem>
                ))}
                <SelectItem value={NEW_FOLDER}>{t('addFeed.folderNew')}</SelectItem>
              </SelectContent>
            </Select>
            {folderChoice === NEW_FOLDER && (
              <Input
                type="text"
                placeholder={t('addFeed.folderNamePlaceholder')}
                value={newFolder}
                onChange={(e) => setNewFolder(e.target.value)}
                disabled={busy}
              />
            )}
          </div>

          {error && (
            <div className="text-xs text-destructive break-words">{error}</div>
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
              {t('addFeed.cancel')}
            </Button>
            <Button type="submit" variant="default" disabled={busy || !url.trim()}>
              {busy ? t('addFeed.submitting') : t('addFeed.submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
