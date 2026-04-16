import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { Feed, HighlightDoc } from '../../../shared/types'
import { colorForFeed } from '../util/color'

interface Props { feeds: Feed[] }

interface FlatEntry {
  articleId: string
  articleTitle: string
  articleLink: string
  feed: string
  createdAt: string
  text: string
  indexInArticle: number
}

export default function HighlightsView({ feeds }: Props): JSX.Element {
  const { t, i18n } = useTranslation()
  const [docs, setDocs] = useState<HighlightDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [filterFeed, setFilterFeed] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    let cancelled = false
    void window.guignol.highlights.listAll().then((d) => {
      if (!cancelled) { setDocs(d); setLoading(false) }
    })
    return () => { cancelled = true }
  }, [])

  const flat: FlatEntry[] = useMemo(() => {
    const out: FlatEntry[] = []
    for (const d of docs) {
      d.highlights.forEach((h, i) => {
        out.push({
          articleId: d.article_id,
          articleTitle: d.article_title,
          articleLink: d.article_link,
          feed: d.feed,
          createdAt: h.createdAt,
          text: h.text,
          indexInArticle: i
        })
      })
    }
    return out.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }, [docs])

  const feedSlugs = useMemo(() => Array.from(new Set(docs.map((d) => d.feed))), [docs])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return flat.filter((e) => {
      if (filterFeed && e.feed !== filterFeed) return false
      if (!q) return true
      return e.text.toLowerCase().includes(q) || e.articleTitle.toLowerCase().includes(q)
    })
  }, [flat, filterFeed, search])

  const totalCount = flat.length
  const feedTitle = (slug: string): string => feeds.find((f) => f.slug === slug)?.title ?? slug

  const chipBase = 'inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded'

  return (
    <div className="max-w-[760px] mx-auto px-14 pt-14 pb-20">
      <header className="mb-7">
        <div className="label mb-1">{t('highlights.title')}</div>
        <h1 className="font-serif text-4xl font-normal tracking-tight m-0 mb-1.5 uppercase">
          {t('highlights.heading')}
        </h1>
        <div className="label">
          {t('highlights.count', { count: totalCount })}
          {filtered.length !== totalCount && ` · ${t('highlights.filtered', { count: filtered.length })}`}
        </div>
      </header>

      <div className="flex flex-col gap-3.5 mb-8 pb-4 border-b border-fg-faint">
        <input
          type="text"
          placeholder={t('highlights.searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="text-sm py-1.5 text-fg border-b border-fg-faint focus:border-accent transition-colors placeholder:text-fg-muted"
        />
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setFilterFeed(null)}
            className={`${chipBase} ${filterFeed === null ? 'bg-bg-alt text-fg shadow-[inset_0_-2px_0] shadow-accent' : 'text-fg-dim hover:text-fg hover:bg-bg-hover'}`}
          >
            {t('highlights.allFeeds')}
          </button>
          {feedSlugs.map((slug) => {
            const active = filterFeed === slug
            return (
              <button
                key={slug}
                onClick={() => setFilterFeed(slug)}
                className={`${chipBase} ${active ? 'bg-bg-alt text-fg shadow-[inset_0_-2px_0] shadow-accent' : 'text-fg-dim hover:text-fg hover:bg-bg-hover'}`}
              >
                <span
                  className="w-[7px] h-[7px] rounded-full inline-block"
                  style={{ background: colorForFeed(slug) }}
                />
                {feedTitle(slug)}
              </button>
            )
          })}
        </div>
      </div>

      {loading && (
        <div className="py-16 text-center text-fg-muted font-serif italic">{t('common.loading')}</div>
      )}
      {!loading && filtered.length === 0 && totalCount === 0 && (
        <div className="py-16 text-center text-fg-muted font-serif italic">
          {t('highlights.emptyAll')}
        </div>
      )}
      {!loading && filtered.length === 0 && totalCount > 0 && (
        <div className="py-16 text-center text-fg-muted font-serif italic">
          {t('highlights.emptyFiltered')}
        </div>
      )}

      <ul className="m-0 p-0 list-none flex flex-col gap-7">
        {filtered.map((e, i) => {
          const feedColor = colorForFeed(e.feed)
          return (
            <li
              key={`${e.articleId}-${e.indexInArticle}-${i}`}
              onClick={() =>
                navigate(`/article/${e.articleId}`, {
                  state: { scrollToHighlight: e.indexInArticle }
                })
              }
              className="cursor-pointer pl-4 border-l-2 transition-transform duration-150 hover:translate-x-0.5"
              style={{ borderColor: feedColor }}
            >
              <blockquote className="font-serif text-[17px] leading-snug text-fg m-0 p-0 border-0 not-italic">
                {e.text}
              </blockquote>
              <div className="flex flex-wrap items-center gap-2 mt-2 label">
                <span className="font-semibold" style={{ color: feedColor }}>{feedTitle(e.feed)}</span>
                <span className="opacity-50">·</span>
                <span className="text-fg-dim font-medium">{e.articleTitle}</span>
                <span className="opacity-50">·</span>
                <span className="font-mono tracking-wider">
                  {new Date(e.createdAt).toLocaleString(i18n.language, {
                    day: '2-digit', month: 'short', year: 'numeric',
                    hour: '2-digit', minute: '2-digit'
                  })}
                </span>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
