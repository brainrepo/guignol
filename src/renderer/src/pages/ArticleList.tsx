import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { ArticleMeta, Feed } from '../../../shared/types'
import { colorForFeed } from '../util/color'

interface Props {
  articles: ArticleMeta[]
  feeds: Feed[]
}

export default function ArticleList({ articles, feeds }: Props): JSX.Element {
  const { t, i18n } = useTranslation()
  const { id: activeId } = useParams()
  const sorted = [...articles].sort(
    (a, b) => new Date(b.published).getTime() - new Date(a.published).getTime()
  )

  if (sorted.length === 0) {
    return (
      <div className="py-16 px-10 text-center text-fg-muted font-serif italic text-[15px]">
        {t('articleList.empty')}
      </div>
    )
  }

  const feedTitleBySlug = (slug: string): string =>
    feeds.find((f) => f.slug === slug)?.title ?? slug

  return (
    <ul className="m-0 p-0 list-none overflow-y-auto flex-1">
      {sorted.map((a) => {
        const d = new Date(a.published)
        const isActive = activeId === a.id
        const feedColor = colorForFeed(a.feed)
        return (
          <li
            key={a.id}
            className={`relative ${isActive ? 'bg-bg-alt' : 'hover:bg-bg-alt'}`}
          >
            {isActive && <span className="absolute right-0 top-0 bottom-0 w-[3px] bg-accent" />}
            <Link
              to={`/article/${a.id}`}
              className={`block py-3.5 pl-6 pr-8 border-l-[3px] transition-opacity ${a.read ? 'opacity-45 hover:opacity-70' : 'opacity-100'}`}
              style={{ borderColor: feedColor }}
            >
              <div className="mb-1">
                <span
                  className="text-[11px] uppercase tracking-caps font-semibold"
                  style={{ color: feedColor }}
                >
                  {feedTitleBySlug(a.feed)}
                </span>
              </div>
              <div className="font-serif text-[17px] leading-snug font-normal text-fg">
                {a.title}
              </div>
              <div className="flex items-center gap-2 mt-1.5 text-[10px] uppercase tracking-caps text-fg-muted">
                <span>
                  {d.toLocaleDateString(i18n.language, { day: 'numeric', month: 'short' })}
                </span>
                <span className="opacity-50">·</span>
                <span className="font-mono">
                  {d.toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              {a.summary && (
                <div className="text-xs text-fg-muted mt-1.5 leading-relaxed line-clamp-2">
                  {a.summary}
                </div>
              )}
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
