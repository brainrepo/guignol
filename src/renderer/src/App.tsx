import { useEffect, useState } from 'react'
import { Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { PanelLeft, PanelLeftClose, Plus, RefreshCw, Settings as SettingsIcon } from 'lucide-react'
import i18n from './i18n'
import type { ArticleMeta, Feed, Theme } from '../../shared/types'
import FeedList from './pages/FeedList'
import ArticleList from './pages/ArticleList'
import ArticleDetail from './pages/ArticleDetail'
import Settings from './pages/Settings'
import HighlightsView from './pages/HighlightsView'
import DigestsList from './pages/DigestsList'
import DigestDetail from './pages/DigestDetail'
import AddFeedModal from './components/AddFeedModal'
import { applyTheme, watchSystemTheme } from './util/theme'

export default function App(): JSX.Element {
  const { t } = useTranslation()
  const [feeds, setFeeds] = useState<Feed[]>([])
  const [articles, setArticles] = useState<ArticleMeta[]>([])
  const [selectedFeed, setSelectedFeed] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [addFeedOpen, setAddFeedOpen] = useState(false)
  const [theme, setTheme] = useState<Theme>('system')
  const [sideWidth, setSideWidth] = useState(() => readStoredNum('sideWidth', 260))
  const [middleWidth, setMiddleWidth] = useState(() => readStoredNum('middleWidth', 420))
  const location = useLocation()
  const fullWidthRoute =
    location.pathname === '/settings' ||
    location.pathname === '/highlights'
  const onDigestsRoute = location.pathname.startsWith('/digests')

  const reload = async (): Promise<void> => {
    setFeeds(await window.guignol.feeds.list())
    setArticles(await window.guignol.articles.list())
    const s = await window.guignol.settings.get()
    setTheme(s.theme)
    if (s.language && i18n.language !== s.language) {
      void i18n.changeLanguage(s.language)
    }
  }

  useEffect(() => {
    void reload()
    const off = window.guignol.on.newArticles(() => { void reload() })
    return off
  }, [])

  useEffect(() => {
    applyTheme(theme)
    if (theme !== 'system') return
    const off = watchSystemTheme(() => applyTheme('system'))
    return off
  }, [theme])

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const mod = e.metaKey || e.ctrlKey
      if (!mod) return
      const togglesSidebar =
        e.code === 'Backslash' ||
        e.code === 'IntlBackslash' ||
        e.key === '\\' ||
        e.key === '/' ||
        e.key.toLowerCase() === 'b'
      if (togglesSidebar) {
        e.preventDefault()
        setSidebarOpen((v) => !v)
        return
      }
      if (e.key.toLowerCase() === 'n') {
        e.preventDefault()
        setAddFeedOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const visibleArticles = selectedFeed
    ? articles.filter((a) => a.feed === selectedFeed)
    : articles
  const selectedFeedTitle = selectedFeed
    ? feeds.find((f) => f.slug === selectedFeed)?.title
    : null
  const unreadCount = visibleArticles.filter((a) => !a.read).length

  const railCol = sidebarOpen ? '80px' : '48px'
  const sideCol = sidebarOpen ? `${sideWidth}px` : '0px'
  const middleCol = fullWidthRoute ? '0px' : `${middleWidth}px`
  const gridTemplateColumns = `${railCol} ${sideCol} ${middleCol} 1fr`

  useEffect(() => { localStorage.setItem('sideWidth', String(sideWidth)) }, [sideWidth])
  useEffect(() => { localStorage.setItem('middleWidth', String(middleWidth)) }, [middleWidth])

  const startResize = (
    getValue: () => number,
    setValue: (n: number) => void,
    min: number,
    max: number
  ) => (e: React.MouseEvent): void => {
    e.preventDefault()
    const startX = e.clientX
    const startW = getValue()
    const onMove = (ev: MouseEvent): void => {
      const delta = ev.clientX - startX
      setValue(Math.max(min, Math.min(max, startW + delta)))
    }
    const onUp = (): void => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }

  return (
    <div
      className="grid h-screen bg-bg transition-[grid-template-columns] duration-200 ease-[cubic-bezier(0.4,0,0.2,1)]"
      style={{ gridTemplateColumns }}
    >
      <div
        className="rail flex flex-col items-center pt-8 pb-6"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <div className="flex-1 flex items-center justify-center">
          <div className="rail-brand">Guignol</div>
        </div>
        <SettingsRailButton />
        <button
          onClick={() => setAddFeedOpen(true)}
          aria-label={t('app.addFeed')}
          title={t('app.addFeedTooltip')}
          className="mt-2 w-9 h-9 flex items-center justify-center rounded-full bg-accent text-bg hover:bg-accent-dim transition-colors"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          <Plus size={18} strokeWidth={2.25} aria-hidden />
        </button>
      </div>

      <aside
        className={`relative bg-bg-panel pt-8 pb-5 overflow-x-hidden overflow-y-auto ${sidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none overflow-hidden'} transition-opacity duration-150`}
      >
        <FeedList
          feeds={feeds}
          selected={selectedFeed}
          onSelect={setSelectedFeed}
          onChanged={reload}
        />
        {sidebarOpen && (
          <ResizeHandle
            onMouseDown={startResize(() => sideWidth, setSideWidth, 180, 420)}
            ariaLabel={t('app.resizeSidebar')}
          />
        )}
      </aside>

      <section className={`relative flex flex-col overflow-hidden bg-bg border-l border-fg-faint ${fullWidthRoute ? 'opacity-0 pointer-events-none' : ''}`}>
        <TopBar
          onRefresh={async () => { await window.guignol.feeds.refresh(); await reload() }}
          onToggleSidebar={() => setSidebarOpen((v) => !v)}
          sidebarOpen={sidebarOpen}
        />
        {!onDigestsRoute && selectedFeedTitle && (
          <div className="px-8 pb-5">
            <h1 className="font-serif text-2xl font-normal tracking-tight text-fg m-0 mb-1.5">
              {selectedFeedTitle}
            </h1>
            <div className="label">
              {unreadCount > 0
                ? t('app.articleCountUnread', { unread: unreadCount, total: visibleArticles.length })
                : t('app.articleCount', { total: visibleArticles.length })}
            </div>
          </div>
        )}
        {onDigestsRoute ? (
          <DigestsList feeds={feeds} />
        ) : (
          <ArticleList articles={visibleArticles} feeds={feeds} />
        )}
        {!fullWidthRoute && (
          <ResizeHandle
            onMouseDown={startResize(() => middleWidth, setMiddleWidth, 320, 720)}
            ariaLabel={t('app.resizeArticleList')}
          />
        )}
      </section>

      <section className="overflow-y-auto bg-bg border-l border-fg-faint">
        <Routes>
          <Route path="/" element={<EmptyState />} />
          <Route path="/article/:id" element={<ArticleRoute onPatched={reload} feeds={feeds} />} />
          <Route path="/highlights" element={<HighlightsView feeds={feeds} />} />
          <Route path="/digests" element={<DigestDetail feeds={feeds} />} />
          <Route path="/digests/:id" element={<DigestDetail feeds={feeds} />} />
          <Route path="/settings" element={<Settings onChanged={reload} />} />
        </Routes>
      </section>

      <AddFeedModal
        open={addFeedOpen}
        onClose={() => setAddFeedOpen(false)}
        onAdded={reload}
        feeds={feeds}
      />
    </div>
  )
}

function TopBar({
  onRefresh,
  onToggleSidebar,
  sidebarOpen
}: {
  onRefresh: () => void
  onToggleSidebar: () => void
  sidebarOpen: boolean
}): JSX.Element {
  const { t } = useTranslation()
  const btn = 'inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[13px] text-fg-dim rounded hover:text-fg hover:bg-bg-hover'
  return (
    <div className="flex items-center gap-1 px-8 pt-8 pb-4 justify-end">
      <button
        onClick={onToggleSidebar}
        aria-label={sidebarOpen ? t('app.hideSidebar') : t('app.showSidebar')}
        title={sidebarOpen ? t('app.hideSidebarTooltip') : t('app.showSidebarTooltip')}
        className="p-1.5 text-fg-muted rounded hover:text-fg hover:bg-bg-hover mr-auto"
      >
        {sidebarOpen ? <PanelLeftClose size={16} strokeWidth={2} aria-hidden /> : <PanelLeft size={16} strokeWidth={2} aria-hidden />}
      </button>
      <button onClick={onRefresh} className={btn}>
        <RefreshCw size={14} strokeWidth={2} aria-hidden /> {t('app.refresh')}
      </button>
    </div>
  )
}

function SettingsRailButton({ className = '' }: { className?: string }): JSX.Element {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const active = location.pathname === '/settings'
  return (
    <button
      onClick={() => navigate(active ? '/' : '/settings')}
      aria-label={t('app.settings')}
      title={t('app.settings')}
      className={`${className} w-9 h-9 flex items-center justify-center rounded-full transition-colors ${active ? 'text-fg bg-bg-hover' : 'text-fg-muted hover:text-fg hover:bg-bg-hover'}`}
      style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
    >
      <SettingsIcon size={16} strokeWidth={2} aria-hidden />
    </button>
  )
}

function EmptyState(): JSX.Element {
  const { t } = useTranslation()
  return (
    <div className="py-16 px-10 text-center text-fg-muted font-serif italic text-[15px]">
      {t('app.selectArticle')}
    </div>
  )
}

function ArticleRoute({ onPatched, feeds }: { onPatched: () => void; feeds: Feed[] }): JSX.Element {
  const { id } = useParams()
  if (!id) return <EmptyState />
  return <ArticleDetail id={id} onPatched={onPatched} feeds={feeds} />
}

function ResizeHandle({
  onMouseDown,
  ariaLabel
}: {
  onMouseDown: (e: React.MouseEvent) => void
  ariaLabel: string
}): JSX.Element {
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={ariaLabel}
      onMouseDown={onMouseDown}
      className="group absolute top-0 right-0 h-full w-2 -mr-1 cursor-col-resize z-30 select-none"
    >
      <div className="w-0.5 h-full ml-1 bg-transparent group-hover:bg-accent transition-colors duration-150" />
    </div>
  )
}

function readStoredNum(key: string, fallback: number): number {
  try {
    const v = localStorage.getItem(key)
    if (!v) return fallback
    const n = Number(v)
    return Number.isFinite(n) ? n : fallback
  } catch {
    return fallback
  }
}
