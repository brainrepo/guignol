import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Sparkles } from 'lucide-react'
import type { DigestDoc, DigestScope, Feed } from '../../../shared/types'
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
import { ToggleGroup, ToggleGroupItem } from './ui/toggle-group'
import { Label } from './ui/label'

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

export default function CreateDigestModal({ open, onClose, onCreated, feeds }: Props): JSX.Element {
  const { t } = useTranslation()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fromDate, setFromDate] = useState(() => defaultFromDate(7))
  const [scopeKind, setScopeKind] = useState<ScopeKind>('all')
  const [scopeFolder, setScopeFolder] = useState('')
  const [scopeFeedSlug, setScopeFeedSlug] = useState('')

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
    if (!open) {
      setError(null)
      setBusy(false)
      setFromDate(defaultFromDate(7))
      setScopeKind('all')
      setScopeFolder('')
      setScopeFeedSlug('')
    }
  }, [open])

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

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !busy) onClose() }}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <div className="label">{t('createDigest.label')}</div>
          <DialogTitle>{t('createDigest.title')}</DialogTitle>
        </DialogHeader>

        <form onSubmit={submit} className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <Label>{t('createDigest.scopeLabel')}</Label>
            <ToggleGroup
              type="single"
              value={scopeKind}
              onValueChange={(v) => v && setScopeKind(v as ScopeKind)}
              disabled={busy}
            >
              <ToggleGroupItem value="all">{t('createDigest.scopeAll')}</ToggleGroupItem>
              <ToggleGroupItem value="folder" disabled={folders.length === 0}>
                {t('createDigest.scopeFolder')}
              </ToggleGroupItem>
              <ToggleGroupItem value="feed" disabled={feeds.length === 0}>
                {t('createDigest.scopeFeed')}
              </ToggleGroupItem>
            </ToggleGroup>
            {scopeKind === 'folder' && (
              <Select value={scopeFolder} onValueChange={setScopeFolder} disabled={busy}>
                <SelectTrigger>
                  <SelectValue placeholder={t('createDigest.scopePickFolder')} />
                </SelectTrigger>
                <SelectContent>
                  {folders.map((name) => (
                    <SelectItem key={name} value={name}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {scopeKind === 'feed' && (
              <Select value={scopeFeedSlug} onValueChange={setScopeFeedSlug} disabled={busy}>
                <SelectTrigger>
                  <SelectValue placeholder={t('createDigest.scopePickFeed')} />
                </SelectTrigger>
                <SelectContent>
                  {sortedFeeds.map((f) => (
                    <SelectItem key={f.slug} value={f.slug}>{f.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="digest-from">{t('createDigest.fromDate')}</Label>
            <Input
              id="digest-from"
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              disabled={busy}
              max={new Date().toISOString().slice(0, 10)}
            />
            <div className="flex flex-wrap gap-1.5 mt-1">
              {PRESETS.map((p) => (
                <Button
                  key={p.days}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setFromDate(defaultFromDate(p.days))}
                  disabled={busy}
                  className="rounded-full"
                >
                  {t(p.key)}
                </Button>
              ))}
            </div>
          </div>

          {error && (
            <div className="text-xs text-destructive break-words">{error}</div>
          )}
          {busy && (
            <div className="text-xs text-fg-muted flex items-center gap-2">
              <Sparkles size={12} className="animate-pulse" />
              {t('createDigest.busy')}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
              {t('createDigest.cancel')}
            </Button>
            <Button type="submit" variant="default" disabled={!canSubmit()} className="rounded-full">
              <Sparkles size={14} strokeWidth={2} aria-hidden />
              {busy ? t('createDigest.generating') : t('createDigest.submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function defaultFromDate(daysAgo: number): string {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  return d.toISOString().slice(0, 10)
}
