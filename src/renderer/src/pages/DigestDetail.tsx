import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ArrowUpRight } from 'lucide-react'
import type { DigestDoc, Feed } from '../../../shared/types'
import { colorForFeed } from '../util/color'
import ScopeBadge from '../components/ScopeBadge'

interface Props { feeds: Feed[] }

export default function DigestDetail({ feeds }: Props): JSX.Element {
  const { t, i18n } = useTranslation()
  const { id } = useParams()
  const [doc, setDoc] = useState<DigestDoc | null>(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setDoc(null)
    void window.guignol.digests.listAll().then((all) => {
      if (cancelled) return
      setDoc(all.find((d) => d.id === id) ?? null)
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [id])

  if (!id) {
    return (
      <div className="py-16 px-10 text-center text-fg-muted font-serif italic text-[15px]">
        {t('digestDetail.selectOne')}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="py-16 px-10 text-center text-fg-muted font-serif italic text-[15px]">
        {t('common.loading')}
      </div>
    )
  }

  if (!doc) {
    return (
      <div className="py-16 px-10 text-center text-fg-muted font-serif italic text-[15px]">
        {t('digestDetail.notFound')}
      </div>
    )
  }

  const from = new Date(doc.from).toLocaleDateString(i18n.language, { day: 'numeric', month: 'long', year: 'numeric' })
  const to = new Date(doc.to).toLocaleDateString(i18n.language, { day: 'numeric', month: 'long', year: 'numeric' })
  const feedTitle = (slug: string): string => feeds.find((f) => f.slug === slug)?.title ?? slug

  const linkToId = new Map<string, string>()
  for (const a of doc.articles) {
    linkToId.set(normalizeUrl(a.link), a.id)
  }

  return (
    <article className="max-w-[720px] mx-auto px-14 pt-14 pb-20">
      <header className="mb-8">
        <div className="text-[11px] uppercase tracking-caps font-semibold text-accent mb-2">
          {t('digestDetail.label')}
        </div>
        <h1 className="font-serif text-4xl leading-tight mb-4 font-medium tracking-tight">
          {from} → {to}
        </h1>
        <div className="text-[13px] text-fg-muted flex flex-wrap items-center gap-x-3 gap-y-1">
          <ScopeBadge scope={doc.scope} feeds={feeds} />
          <span>{t('digestDetail.articleCount', { count: doc.articles.length })}</span>
          <span className="w-1 h-1 rounded-full bg-fg-faint" aria-hidden />
          <time>{new Date(doc.created).toLocaleString(i18n.language)}</time>
        </div>
      </header>

      <section className="text-fg text-[16px] leading-relaxed mb-10 digest-prose">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            a: ({ href, children }) => {
              const articleId = href ? linkToId.get(normalizeUrl(href)) : undefined
              return (
                <a
                  href={href}
                  className="source-chip"
                  onClick={(e) => {
                    e.preventDefault()
                    if (articleId) navigate(`/article/${articleId}`)
                    else if (href) void window.guignol.articles.openExternal(href)
                  }}
                  title={articleId ? t('digestDetail.openInGuignol') : t('digestDetail.openExternal')}
                >
                  <span>{children}</span>
                  <ArrowUpRight size={11} strokeWidth={2.25} aria-hidden />
                </a>
              )
            }
          }}
        >
          {doc.summary}
        </ReactMarkdown>
      </section>

      <section>
        <h2 className="label mb-4">{t('digestDetail.includedHeading', { count: doc.articles.length })}</h2>
        <ul className="m-0 p-0 list-none flex flex-col gap-3">
          {doc.articles.map((a) => (
            <li
              key={a.id}
              className="group flex items-start gap-3 cursor-pointer py-2 px-3 -mx-3 rounded hover:bg-bg-alt transition-colors"
              onClick={() => navigate(`/article/${a.id}`)}
            >
              <span
                className="w-2 h-2 rounded-full shrink-0 mt-2"
                style={{ background: colorForFeed(a.feed) }}
              />
              <div className="flex-1 min-w-0">
                <div className="font-serif text-[15px] leading-snug text-fg group-hover:text-accent transition-colors">
                  {a.title}
                </div>
                <div className="mt-0.5 text-[11px] uppercase tracking-caps text-fg-muted flex items-center gap-2">
                  <span>{feedTitle(a.feed)}</span>
                  <span className="opacity-50">·</span>
                  <span>{new Date(a.published).toLocaleDateString(i18n.language, { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                </div>
              </div>
              <ArrowUpRight
                size={14}
                strokeWidth={2}
                aria-hidden
                className="text-fg-muted group-hover:text-accent shrink-0 mt-1"
              />
            </li>
          ))}
        </ul>
      </section>
    </article>
  )
}

function normalizeUrl(url: string): string {
  try {
    const u = new URL(url)
    u.hash = ''
    let pathname = u.pathname
    if (pathname.length > 1 && pathname.endsWith('/')) pathname = pathname.slice(0, -1)
    return (u.origin + pathname + u.search).toLowerCase()
  } catch {
    return url.trim().toLowerCase().replace(/\/+$/, '')
  }
}
