import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ArrowUpRight, BookOpen, Loader2, RefreshCw, Sparkles, Trash2, X } from 'lucide-react'
import type { Article, Feed, Highlight } from '../../../shared/types'
import { colorForFeed } from '../util/color'
import { applyHighlights, scrollToHighlight } from '../util/highlights'

function countWords(text: string): number {
  const matches = text.trim().match(/\S+/g)
  return matches ? matches.length : 0
}

/**
 * TODO (user contribution): soglia "estrazione troppo corta".
 *
 * Quando Readability riesce ma ritorna pochissimo testo, di solito siamo
 * davanti a un paywall o a una pagina con contenuto lazy-loaded. Il banner
 * che usa questa funzione avvisa l'utente senza nascondergli comunque il
 * contenuto estratto. Strategie possibili:
 *
 *   - Soglia assoluta: `readerWords < 120` — semplice, ma ingiusta con post
 *     molto brevi tipo "link blog" (Daring Fireball, Kottke, Waxy).
 *   - Rapporto reader/feed: se `readerWords < 1.5 * feedWords`, probabile
 *     paywall (reader non dà molto più del teaser). Più preciso.
 *   - Combinazione: sospetto se reader < 120 parole E reader < 2× feed.
 *   - Ritorna sempre false e fidati dell'utente.
 *
 * @param readerWords Numero di parole dell'estrazione reader
 * @param feedBody Markdown body del feed (puoi contarne le parole o
 *                 ignorarlo se la tua soglia è solo sul reader)
 * @returns true → UI mostra banner "estrazione sospetta" sopra il reader body
 */
function isReaderTooShort(readerWords: number, feedBody: string): boolean {
  const FLOOR = 150
  const RATIO = 1.5
  if (readerWords <= 0) return false
  if (readerWords < FLOOR) return true
  const feedWords = countWords(feedBody)
  return feedWords > 0 && readerWords < feedWords * RATIO
}

/**
 * TODO (user contribution): soglia "feed troppo corto per essere letto bene".
 *
 * Usata per decidere se aprire direttamente la vista reader quando il feed
 * pubblica solo un teaser e abbiamo già il reader_body su disco. Non tocca
 * la fetch iniziale — fa scattare l'auto-switch solo dopo che l'utente ha
 * già fatto reader:fetch una volta su quell'articolo.
 *
 * Considerazioni:
 *   - Soglia assoluta (es. 200 parole) — semplice, copre la maggior parte
 *     dei feed teaser (Medium, Substack snippet, corporate blog).
 *   - Più alta → reader "ruba" più articoli al feed (più invasiva).
 *   - Più bassa → molti teaser restano in feed view (meno seamless).
 *   - 200 parole ≈ 1–2 paragrafi, buon compromesso.
 *
 * @param feedBody Markdown body del feed così come arriva da disco
 * @returns true → alla prossima apertura si aprirà in reader view
 */
function isFeedTooShort(feedBody: string): boolean {
  const SHORT_FEED_THRESHOLD = 200
  return countWords(feedBody) < SHORT_FEED_THRESHOLD
}

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
  const [readerLoading, setReaderLoading] = useState(false)
  const [readerAutoFetching, setReaderAutoFetching] = useState(false)
  const [viewMode, setViewMode] = useState<'feed' | 'reader'>('feed')
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
    setViewMode('feed')
    setReaderAutoFetching(false)
    Promise.all([
      window.guignol.articles.read(id),
      window.guignol.highlights.list(id).catch(() => [] as Highlight[])
    ])
      .then(async ([a, hs]) => {
        if (cancelled) return
        setArticle(a)
        setHighlights(hs)
        setLoading(false)
        if (a.reader_body && isFeedTooShort(a.body)) {
          setViewMode('reader')
        }
        if (!a.read) {
          await window.guignol.articles.patch(id, { read: true })
          if (cancelled) return
          onPatched()
        }
        if (!a.reader_body && !a.reader_error && a.link && isFeedTooShort(a.body)) {
          setReaderAutoFetching(true)
          try {
            const r = await window.guignol.reader.fetch(id)
            if (cancelled) return
            setArticle((prev) => prev ? {
              ...prev,
              reader_body: r.body,
              reader_source_url: r.sourceUrl,
              reader_word_count: r.wordCount,
              reader_fetched_at: new Date().toISOString(),
              reader_error: undefined
            } : prev)
            setViewMode('reader')
            const scroller = bodyRef.current?.closest('article')?.parentElement
            scroller?.scrollTo({ top: 0, behavior: 'smooth' })
            onPatched()
          } catch (e) {
            if (cancelled) return
            const msg = e instanceof Error ? e.message : String(e)
            setArticle((prev) => prev ? { ...prev, reader_error: msg } : prev)
          } finally {
            if (!cancelled) setReaderAutoFetching(false)
          }
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

  const fetchReader = async (): Promise<void> => {
    setReaderLoading(true)
    setError(null)
    try {
      const r = await window.guignol.reader.fetch(id)
      setArticle({
        ...article,
        reader_body: r.body,
        reader_source_url: r.sourceUrl,
        reader_word_count: r.wordCount,
        reader_fetched_at: new Date().toISOString(),
        reader_error: undefined
      })
      setViewMode('reader')
      onPatched()
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg)
      setArticle({ ...article, reader_error: msg })
    } finally {
      setReaderLoading(false)
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

  const actionBtn = 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] text-fg-dim hover:text-fg hover:bg-bg-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:opacity-40 disabled:hover:text-fg-dim disabled:hover:bg-transparent'

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
        <div className="flex items-center gap-2 mt-4 flex-wrap">
          <button
            onClick={() => window.guignol.articles.openExternal(article.link)}
            className={actionBtn}
          >
            <ArrowUpRight size={14} strokeWidth={2} aria-hidden />
            <span>{t('articleDetail.original')}</span>
          </button>
          {!article.reader_body ? (
            <button onClick={fetchReader} disabled={readerLoading} className={actionBtn}>
              {readerLoading ? (
                <Loader2 size={14} strokeWidth={2} aria-hidden className="animate-spin" />
              ) : (
                <BookOpen size={14} strokeWidth={2} aria-hidden />
              )}
              <span>
                {readerLoading
                  ? t('articleDetail.readerLoading')
                  : t('articleDetail.readerMode')}
              </span>
            </button>
          ) : (
            <div className="inline-flex items-center gap-0.5">
              <div className="inline-flex rounded-full bg-bg-alt p-0.5" role="group" aria-label={t('articleDetail.readerMode')}>
                <button
                  onClick={() => setViewMode('feed')}
                  aria-pressed={viewMode === 'feed'}
                  className={`px-3 py-1 rounded-full text-[12px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${
                    viewMode === 'feed' ? 'bg-bg text-fg shadow-sm' : 'text-fg-muted hover:text-fg'
                  }`}
                >
                  {t('articleDetail.readerToggleFeed')}
                </button>
                <button
                  onClick={() => setViewMode('reader')}
                  aria-pressed={viewMode === 'reader'}
                  className={`px-3 py-1 rounded-full text-[12px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${
                    viewMode === 'reader' ? 'bg-bg text-fg shadow-sm' : 'text-fg-muted hover:text-fg'
                  }`}
                >
                  {t('articleDetail.readerToggleReader')}
                </button>
              </div>
              <button
                onClick={fetchReader}
                disabled={readerLoading}
                aria-label={t('articleDetail.readerRefresh')}
                title={t('articleDetail.readerRefresh')}
                className="inline-flex items-center justify-center rounded-full bg-bg-alt p-1.5 text-fg-muted hover:text-fg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:opacity-40 disabled:hover:text-fg-muted"
              >
                {readerLoading ? (
                  <Loader2 size={14} strokeWidth={2} aria-hidden className="animate-spin" />
                ) : (
                  <RefreshCw size={14} strokeWidth={2} aria-hidden />
                )}
              </button>
            </div>
          )}
          {highlights.length > 0 && (
            <button
              onClick={() => setDrawerOpen((v) => !v)}
              aria-pressed={drawerOpen}
              className={actionBtn}
            >
              <span>{t('articleDetail.highlights')}</span>
              <span className="text-[11px] leading-none px-1.5 py-0.5 rounded-full bg-bg-alt text-fg-dim font-semibold">
                {highlights.length}
              </span>
            </button>
          )}
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

      {viewMode === 'feed' && readerAutoFetching && (
        <div className="mb-6 text-[13px] text-fg-muted flex items-center gap-2">
          <Loader2 size={13} strokeWidth={2} aria-hidden className="animate-spin" />
          <span className="italic">{t('articleDetail.readerAutoFetching')}</span>
        </div>
      )}

      {viewMode === 'feed' && !readerAutoFetching && article.reader_error && (
        <div className="mb-6 text-[13px] text-fg-muted flex items-center gap-3">
          <span>
            <span className="text-fg-dim">{t('articleDetail.readerErrorPrefix')}</span>{' '}
            {article.reader_error}
          </span>
          <button onClick={fetchReader} disabled={readerLoading} className={actionBtn}>
            {t('articleDetail.readerRetry')}
          </button>
        </div>
      )}

      {viewMode === 'reader' && article.reader_word_count !== undefined &&
        isReaderTooShort(article.reader_word_count, article.body) && (
          <div className="mb-6 py-3 px-4 rounded-md bg-bg-alt text-[13px] text-fg-dim">
            {t('articleDetail.readerShortWarning', { words: article.reader_word_count })}
          </div>
        )}

      <section className="article-body" ref={bodyRef}>
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {viewMode === 'reader' && article.reader_body ? article.reader_body : article.body}
        </ReactMarkdown>
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

      <button
        onClick={summarize}
        disabled={summarizing}
        aria-label={article.summary ? t('articleDetail.regenerate') : t('articleDetail.summaryAi')}
        className="fixed bottom-8 right-8 z-30 inline-flex items-center gap-2 px-5 py-3 rounded-full text-[14px] font-medium text-bg bg-accent hover:bg-accent-dim shadow-xl transition-all disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {summarizing ? (
          <Loader2 size={16} strokeWidth={2} aria-hidden className="animate-spin" />
        ) : (
          <Sparkles size={16} strokeWidth={2} aria-hidden />
        )}
        <span>{summarizing ? t('articleDetail.generating') : article.summary ? t('articleDetail.regenerate') : t('articleDetail.summaryAi')}</span>
      </button>
    </article>
  )
}
