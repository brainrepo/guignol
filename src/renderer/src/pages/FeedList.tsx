import { useLocation, useNavigate } from 'react-router-dom'
import { X } from 'lucide-react'
import type { Feed } from '../../../shared/types'
import { colorForFeed } from '../util/color'

interface Props {
  feeds: Feed[]
  selected: string | null
  onSelect: (slug: string | null) => void
  onChanged: () => void
}

export default function FeedList({ feeds, selected, onSelect, onChanged }: Props): JSX.Element {
  const navigate = useNavigate()
  const location = useLocation()
  const onHighlights = location.pathname === '/highlights'
  const fullWidthRoute = onHighlights || location.pathname === '/settings'

  const handleRemove = async (feedUrl: string): Promise<void> => {
    if (!confirm('Rimuovere questo feed? (gli articoli sul disco restano)')) return
    await window.guignol.feeds.remove(feedUrl)
    onChanged()
  }

  const itemBase = 'group flex items-center gap-2.5 px-6 py-2 cursor-pointer text-[13px] relative'

  return (
    <div>
      <ul className="m-0 p-0 list-none pt-4">
        <li
          className={`${itemBase} ${onHighlights ? 'text-fg font-semibold' : 'text-fg-dim hover:text-fg'}`}
          onClick={() => navigate('/highlights')}
        >
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ background: 'rgba(200, 144, 28, 0.85)' }}
          />
          <span className="flex-1 truncate">Highlights</span>
          {onHighlights && <span className="absolute left-0 top-0 bottom-0 w-0.5 bg-accent" />}
        </li>
      </ul>

      <div className="px-6 pt-4 pb-1">
        <div className="label">Feeds</div>
      </div>
      <ul className="m-0 p-0 list-none">
        <li
          className={`${itemBase} ${!fullWidthRoute && selected === null ? 'text-fg font-semibold' : 'text-fg-dim hover:text-fg'}`}
          onClick={() => { if (fullWidthRoute) navigate('/'); onSelect(null) }}
        >
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ background: 'var(--color-fg-muted)' }}
          />
          <span className="flex-1 truncate">Tutti</span>
          {!fullWidthRoute && selected === null && (
            <span className="absolute left-0 top-0 bottom-0 w-0.5 bg-accent" />
          )}
        </li>
        {feeds.map((f) => {
          const active = !fullWidthRoute && selected === f.slug
          return (
            <li
              key={f.url}
              className={`${itemBase} ${active ? 'text-fg font-semibold' : 'text-fg-dim hover:text-fg'}`}
              onClick={() => { if (fullWidthRoute) navigate('/'); onSelect(f.slug) }}
              title={f.lastError ?? ''}
            >
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ background: colorForFeed(f.slug) }}
              />
              <span className="flex-1 truncate">{f.title}</span>
              {f.lastError && <span className="text-red-500 font-bold">!</span>}
              <button
                onClick={(e) => { e.stopPropagation(); void handleRemove(f.url) }}
                aria-label="Rimuovi"
                className="invisible group-hover:visible p-0.5 text-fg-muted hover:text-accent rounded"
              >
                <X size={13} strokeWidth={2} aria-hidden />
              </button>
              {active && <span className="absolute left-0 top-0 bottom-0 w-0.5 bg-accent" />}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
