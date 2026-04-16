import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Plus } from 'lucide-react'
import type { DigestDoc } from '../../../shared/types'
import CreateDigestModal from '../components/CreateDigestModal'

export default function DigestsList(): JSX.Element {
  const { t, i18n } = useTranslation()
  const [docs, setDocs] = useState<DigestDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const { id: activeId } = useParams()

  const reload = async (): Promise<void> => {
    setDocs(await window.guignol.digests.listAll())
  }

  useEffect(() => {
    let cancelled = false
    void window.guignol.digests.listAll().then((d) => {
      if (!cancelled) { setDocs(d); setLoading(false) }
    })
    return () => { cancelled = true }
  }, [])

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-8 pb-3">
        <div>
          <div className="label">{t('digestsList.heading')}</div>
          <div className="text-xs text-fg-muted mt-0.5">
            {loading ? '…' : t('digestsList.count', { count: docs.length })}
          </div>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium text-bg bg-accent hover:bg-accent-dim transition-colors"
        >
          <Plus size={13} strokeWidth={2.25} aria-hidden />
          {t('digestsList.newButton')}
        </button>
      </div>

      {loading && (
        <div className="py-10 px-8 text-fg-muted font-serif italic text-sm">{t('common.loading')}</div>
      )}
      {!loading && docs.length === 0 && (
        <div className="py-10 px-8 text-fg-muted font-serif italic text-sm">
          {t('digestsList.empty')}
        </div>
      )}

      <ul className="m-0 p-0 list-none overflow-y-auto flex-1">
        {docs.map((d) => {
          const isActive = activeId === d.id
          const from = new Date(d.from).toLocaleDateString(i18n.language, { day: 'numeric', month: 'short' })
          const to = new Date(d.to).toLocaleDateString(i18n.language, { day: 'numeric', month: 'short', year: 'numeric' })
          const preview = d.summary
            .replace(/\[.*?\]\(.*?\)/g, '')
            .replace(/[*#_>\-]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 140)
          return (
            <li
              key={d.id}
              className={`relative ${isActive ? 'bg-bg-alt' : 'hover:bg-bg-alt'}`}
            >
              {isActive && <span className="absolute right-0 top-0 bottom-0 w-[3px] bg-accent" />}
              <Link
                to={`/digests/${d.id}`}
                className="block py-3.5 pl-6 pr-8 border-l-[3px] border-accent"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] uppercase tracking-caps font-semibold text-accent">
                    {from} → {to}
                  </span>
                  <span className="text-[10px] uppercase tracking-caps text-fg-muted">
                    {d.articles.length} {t('digestsList.articleShort')}
                  </span>
                </div>
                <div className="font-serif text-[15px] leading-snug text-fg line-clamp-2">
                  {preview || t('digestsList.empty_preview')}
                </div>
                <div className="mt-1.5 text-[10px] uppercase tracking-caps text-fg-muted font-mono">
                  {new Date(d.created).toLocaleString(i18n.language, {
                    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                  })}
                </div>
              </Link>
            </li>
          )
        })}
      </ul>

      <CreateDigestModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={() => { void reload() }}
      />
    </div>
  )
}
