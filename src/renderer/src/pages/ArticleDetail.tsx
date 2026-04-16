import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ArrowUpRight, Sparkles, Star, Trash2, X } from 'lucide-react'
import type { Article, Feed, Highlight } from '../../../shared/types'
import { colorForFeed } from '../util/color'
import { applyHighlights, scrollToHighlight } from '../util/highlights'

interface Props {
  id: string
  onPatched: () => void
  feeds: Feed[]
}

interface SelectionTip {
  x: number
  y: number
  text: string
  alreadyHighlighted: boolean
}

export default function ArticleDetail({ id, onPatched, feeds }: Props): JSX.Element {
  const { t, i18n } = useTranslation()
  const [article, setArticle] = useState<Article | null>(null)
  const [loading, setLoading] = useState(true)
  const [summarizing, setSummarizing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [highlights, setHighlights] = useState<Highlight[]>([])
  const [tip, setTip] = useState<SelectionTip | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const bodyRef = useRef<HTMLDivElement>(null)
  const location = useLocation()
  const deepLinkHighlight = (location.state as { scrollToHighlight?: number } | null)?.scrollToHighlight

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setArticle(null)
    setError(null)
    setHighlights([])
    Promise.all([
      window.guignol.articles.read(id),
      window.guignol.highlights.list(id).catch(() => [] as Highlight[])
    ])
      .then(async ([a, hs]) => {
        if (cancelled) return
        setArticle(a)
        setHighlights(hs)
        setLoading(false)
        if (!a.read) {
          await window.guignol.articles.patch(id, { read: true })
          onPatched()
        }
      })
      .catch((e) => { if (!cancelled) { setError(String(e)); setLoading(false) } })
    return () => { cancelled = true }
  }, [id])

  useEffect(() => {
    if (!bodyRef.current) return
    applyHighlights(bodyRef.current, highlights.map((h) => h.text))
    if (deepLinkHighlight !== undefined && highlights[deepLinkHighlight]) {
      window.setTimeout(() => {
        if (bodyRef.current) scrollToHighlight(bodyRef.current, deepLinkHighlight)
      }, 80)
    }
  }, [highlights, article?.body])

  useEffect(() => {
    const onMouseUp = (): void => {
      const sel = window.getSelection()
      if (!sel || sel.isCollapsed) { setTip(null); return }
      const text = sel.toString().trim()
      if (text.length < 3) { setTip(null); return }
      const range = sel.getRangeAt(0)
      const body = bodyRef.current
      if (!body || !body.contains(range.commonAncestorContainer)) { setTip(null); return }
      const rect = range.getBoundingClientRect()
      if (rect.width === 0 && rect.height === 0) { setTip(null); return }
      const alreadyHighlighted = highlights.some(
        (h) => h.text.replace(/\s+/g, ' ').trim() === text.replace(/\s+/g, ' ')
      )
      setTip({ x: rect.left + rect.width / 2, y: rect.top - 8, text, alreadyHighlighted })
    }
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') { setTip(null); setDrawerOpen(false) }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'h') {
        if (highlights.length === 0) return
        e.preventDefault()
        setDrawerOpen((v) => !v)
      }
    }
    document.addEventListener('mouseup', onMouseUp)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mouseup', onMouseUp)
      document.removeEventListener('keydown', onKey)
    }
  }, [highlights])

  if (loading) return (
    <div className="py-16 px-10 text-center text-fg-muted font-serif italic text-[15px]">{t('common.loading')}</div>
  )
  if (error) return <div className="text-red-600 p-14">{error}</div>
  if (!article) return (
    <div className="py-16 px-10 text-center text-fg-muted font-serif italic text-[15px]">{t('articleDetail.notFound')}</div>
  )

  const feedTitle = feeds.find((f) => f.slug === article.feed)?.title ?? article.feed
  const feedColor = colorForFeed(article.feed)

  const toggleStar = async (): Promise<void> => {
    await window.guignol.articles.patch(id, { starred: !article.starred })
    setArticle({ ...article, starred: !article.starred })
    onPatched()
  }

  const summarize = async (): Promise<void> => {
    setSummarizing(true)
    setError(null)
    try {
      const r = await window.guignol.ai.summarize(id)
      setArticle({ ...article, summary: r.summary, summary_generated_at: new Date().toISOString() })
      onPatched()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSummarizing(false)
    }
  }

  const commitHighlight = async (): Promise<void> => {
    if (!tip) return
    try {
      const next = tip.alreadyHighlighted
        ? await window.guignol.highlights.remove(id, tip.text)
        : await window.guignol.highlights.add(id, tip.text)
      setHighlights(next)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setTip(null)
      window.getSelection()?.removeAllRanges()
    }
  }

  const actionBtn = 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] text-fg-dim hover:text-fg hover:bg-bg-hover transition-colors disabled:opacity-40 disabled:hover:text-fg-dim disabled:hover:bg-transparent'
  const primaryBtn = 'inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[13px] font-medium text-bg bg-accent hover:bg-accent-dim transition-colors disabled:opacity-40'

  return (
    <article className="max-w-[680px] mx-auto px-14 pt-14 pb-20">
      <header className="mb-8">
        <div
          className="text-[11px] uppercase tracking-caps font-semibold mb-2"
          style={{ color: feedColor }}
        >
          {feedTitle}
        </div>
        <h1 className="font-serif text-4xl leading-tight mb-4 font-medium tracking-tight">
          {article.title}
        </h1>
        <div className="text-[13px] text-fg-muted flex flex-wrap items-center gap-x-3 gap-y-1">
          <time>
            {new Date(article.published).toLocaleDateString(i18n.language, { day: 'numeric', month: 'long', year: 'numeric' })}
          </time>
          {article.author && (
            <>
              <span className="w-1 h-1 rounded-full bg-fg-faint" aria-hidden />
              <span>{article.author}</span>
            </>
          )}
          {highlights.length > 0 && (
            <>
              <span className="w-1 h-1 rounded-full bg-fg-faint" aria-hidden />
              <span>{t('articleDetail.highlightCount', { count: highlights.length })}</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-1 mt-4 flex-wrap">
          <button
            onClick={() => window.guignol.articles.openExternal(article.link)}
            className={actionBtn}
          >
            <ArrowUpRight size={14} strokeWidth={2} aria-hidden />
            <span>{t('articleDetail.original')}</span>
          </button>
          <button onClick={toggleStar} className={actionBtn}>
            <Star
              size={14}
              strokeWidth={2}
              aria-hidden
              className={article.starred ? 'text-accent' : ''}
              fill={article.starred ? 'currentColor' : 'none'}
            />
            <span>{article.starred ? t('articleDetail.saved') : t('articleDetail.save')}</span>
          </button>
          <button
            onClick={() => setDrawerOpen((v) => !v)}
            disabled={highlights.length === 0}
            aria-pressed={drawerOpen}
            className={actionBtn}
          >
            <span>{t('articleDetail.highlights')}</span>
            {highlights.length > 0 && (
              <span className="text-[11px] leading-none px-1.5 py-0.5 rounded-full bg-bg-alt text-fg-dim font-semibold">
                {highlights.length}
              </span>
            )}
          </button>
          <div className="flex-1" />
          <button onClick={summarize} disabled={summarizing} className={primaryBtn}>
            <Sparkles size={14} strokeWidth={2} aria-hidden />
            <span>{summarizing ? t('articleDetail.generating') : article.summary ? t('articleDetail.regenerate') : t('articleDetail.summaryAi')}</span>
          </button>
        </div>
      </header>

      {article.summary && (
        <section className="relative py-5 pl-5 mb-9 before:content-[''] before:absolute before:left-0 before:top-0 before:bottom-0 before:w-0.5 before:bg-accent">
          <h2 className="m-0 mb-2.5 label font-semibold">{t('articleDetail.summaryHeading')}</h2>
          <div className="text-fg leading-relaxed">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{article.summary}</ReactMarkdown>
          </div>
          {article.summary_generated_at && (
            <small className="block mt-3 label">
              {t('articleDetail.generatedAt', { date: new Date(article.summary_generated_at).toLocaleString(i18n.language) })}
            </small>
          )}
        </section>
      )}

      <section className="article-body" ref={bodyRef}>
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{article.body}</ReactMarkdown>
      </section>

      {tip && (
        <div
          className="highlight-tip"
          style={{ left: tip.x, top: tip.y }}
          onMouseDown={(e) => e.preventDefault()}
        >
          <button
            onClick={commitHighlight}
            className="px-3 py-1.5 text-[11px] uppercase tracking-caps font-semibold text-bg rounded hover:bg-white/10"
          >
            {tip.alreadyHighlighted ? t('articleDetail.removeHighlight') : t('articleDetail.highlightAction')}
          </button>
        </div>
      )}

      <aside
        className={`fixed top-0 right-0 bottom-0 w-[380px] max-w-[90vw] bg-bg-panel border-l border-fg-faint flex flex-col z-40 transition-transform duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] ${drawerOpen ? 'translate-x-0' : 'translate-x-full'}`}
        style={{ boxShadow: 'var(--shadow-drawer)' }}
        aria-hidden={!drawerOpen}
      >
        <header className="flex items-start justify-between px-7 pt-10 pb-5 shrink-0">
          <div>
            <div className="label mb-1">{t('articleDetail.highlights')}</div>
            <h2 className="font-serif text-[22px] font-normal m-0 tracking-tight text-fg">
              {t('articleDetail.highlightCountLabel', { count: highlights.length })}
            </h2>
          </div>
          <button
            onClick={() => setDrawerOpen(false)}
            aria-label={t('common.close')}
            className="p-1.5 text-fg-muted rounded hover:text-fg hover:bg-bg-hover"
          >
            <X size={18} strokeWidth={2} aria-hidden />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-7 pb-10">
          {highlights.length === 0 && (
            <div className="text-fg-muted text-[13px] leading-relaxed py-6">
              {t('articleDetail.drawerEmpty')}
            </div>
          )}
          <ul className="m-0 p-0 list-none flex flex-col gap-5">
            {highlights.map((h, i) => (
              <li
                key={i}
                onClick={() => bodyRef.current && scrollToHighlight(bodyRef.current, i)}
                title={t('articleDetail.scrollToHighlight')}
                className="group cursor-pointer pl-3.5 border-l-2 transition-[border-color,transform] duration-150 hover:translate-x-0.5"
                style={{ borderColor: 'var(--color-highlight-border)' }}
              >
                <blockquote className="font-serif text-[15px] leading-snug text-fg m-0 p-0 border-0 not-italic">
                  {h.text}
                </blockquote>
                <div className="flex items-center justify-between mt-1.5 label">
                  <span>
                    {new Date(h.createdAt).toLocaleString(i18n.language, {
                      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                    })}
                  </span>
                  <button
                    onClick={async (e) => {
                      e.stopPropagation()
                      const next = await window.guignol.highlights.remove(id, h.text)
                      setHighlights(next)
                    }}
                    aria-label={t('articleDetail.removeHighlightAria')}
                    className="invisible group-hover:visible p-1 text-fg-muted hover:text-red-500 rounded"
                  >
                    <Trash2 size={13} strokeWidth={2} aria-hidden />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </article>
  )
}
