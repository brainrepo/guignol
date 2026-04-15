import { useEffect, useState } from 'react'
import { Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom'
import { PanelLeft, PanelLeftClose, Plus, RefreshCw, Settings as SettingsIcon, Sparkles } from 'lucide-react'
import type { ArticleMeta, Feed, Theme } from '../../shared/types'
import FeedList from './pages/FeedList'
import ArticleList from './pages/ArticleList'
import ArticleDetail from './pages/ArticleDetail'
import Settings from './pages/Settings'
import HighlightsView from './pages/HighlightsView'
import AddFeedModal from './components/AddFeedModal'
import { applyTheme, watchSystemTheme } from './util/theme'
import guignolMark from './assets/guignol.png'

export default function App(): JSX.Element {
  const [feeds, setFeeds] = useState<Feed[]>([])
  const [articles, setArticles] = useState<ArticleMeta[]>([])
  const [selectedFeed, setSelectedFeed] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [addFeedOpen, setAddFeedOpen] = useState(false)
  const [theme, setTheme] = useState<Theme>('system')
  const location = useLocation()
  const fullWidthRoute = location.pathname === '/settings' || location.pathname === '/highlights'

  const reload = async (): Promise<void> => {
    setFeeds(await window.guignol.feeds.list())
    setArticles(await window.guignol.articles.list())
    const s = await window.guignol.settings.get()
    setTheme(s.theme)
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
      if ((e.metaKey || e.ctrlKey) && e.key === '\\') {
        e.preventDefault()
        setSidebarOpen((v) => !v)
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'n') {
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
  const sideCol = sidebarOpen ? '260px' : '0px'
  const middleCol = fullWidthRoute ? '0px' : '420px'
  const gridTemplateColumns = `${railCol} ${sideCol} ${middleCol} 1fr`

  return (
    <div
      className="grid h-screen bg-bg transition-[grid-template-columns] duration-200 ease-[cubic-bezier(0.4,0,0.2,1)]"
      style={{ gridTemplateColumns }}
    >
      <div
        className="flex flex-col items-center pt-8 pb-6 bg-bg-panel"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <img
          src={guignolMark}
          alt="Guignol"
          className="w-14 h-14 object-contain mb-2 select-none pointer-events-none"
          draggable={false}
        />
        <div className="rail-brand">Guignol</div>
        <SettingsRailButton className="mt-auto" />
        <button
          onClick={() => setAddFeedOpen(true)}
          aria-label="Aggiungi feed"
          title="Aggiungi feed (⌘N)"
          className="mt-2 w-9 h-9 flex items-center justify-center rounded-full border border-fg-faint text-accent hover:bg-accent hover:text-bg hover:border-accent transition-colors"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          <Plus size={18} strokeWidth={2.25} aria-hidden />
        </button>
      </div>

      <aside
        className={`bg-bg-panel pt-8 pb-5 overflow-y-auto ${sidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none overflow-hidden'} transition-opacity duration-150`}
      >
        <FeedList
          feeds={feeds}
          selected={selectedFeed}
          onSelect={setSelectedFeed}
          onChanged={reload}
        />
      </aside>

      <section className={`flex flex-col overflow-hidden bg-bg border-l border-fg-faint ${fullWidthRoute ? 'opacity-0 pointer-events-none' : ''}`}>
        <TopBar
          onRefresh={async () => { await window.guignol.feeds.refresh(); await reload() }}
          onToggleSidebar={() => setSidebarOpen((v) => !v)}
          sidebarOpen={sidebarOpen}
        />
        {selectedFeedTitle && (
          <div className="px-8 pb-5">
            <h1 className="font-serif text-4xl font-normal tracking-tight uppercase text-fg m-0 mb-1.5">
              {selectedFeedTitle}
            </h1>
            <div className="label">
              {unreadCount > 0 ? `${unreadCount} non letti · ` : ''}{visibleArticles.length} articoli
            </div>
          </div>
        )}
        <ArticleList articles={visibleArticles} feeds={feeds} />
      </section>

      <section className="overflow-y-auto bg-bg border-l border-fg-faint">
        <Routes>
          <Route path="/" element={<EmptyState />} />
          <Route path="/article/:id" element={<ArticleRoute onPatched={reload} feeds={feeds} />} />
          <Route path="/highlights" element={<HighlightsView feeds={feeds} />} />
          <Route path="/settings" element={<Settings onChanged={reload} />} />
        </Routes>
      </section>

      <AddFeedModal
        open={addFeedOpen}
        onClose={() => setAddFeedOpen(false)}
        onAdded={reload}
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
  const navigate = useNavigate()
  const btn = 'inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[13px] text-fg-dim rounded hover:text-fg hover:bg-bg-hover'
  return (
    <div className="flex items-center gap-1 px-8 pt-8 pb-4 justify-end">
      <button
        onClick={onToggleSidebar}
        aria-label={sidebarOpen ? 'Nascondi sidebar' : 'Mostra sidebar'}
        title={sidebarOpen ? 'Nascondi sidebar (⌘\\)' : 'Mostra sidebar (⌘\\)'}
        className="p-1.5 text-fg-muted rounded hover:text-fg hover:bg-bg-hover mr-auto"
      >
        {sidebarOpen ? <PanelLeftClose size={16} strokeWidth={2} aria-hidden /> : <PanelLeft size={16} strokeWidth={2} aria-hidden />}
      </button>
      <button onClick={() => navigate('/highlights')} className={btn}>
        <Sparkles size={14} strokeWidth={2} aria-hidden /> Highlights
      </button>
      <button onClick={onRefresh} className={btn}>
        <RefreshCw size={14} strokeWidth={2} aria-hidden /> Refresh
      </button>
    </div>
  )
}

function SettingsRailButton({ className = '' }: { className?: string }): JSX.Element {
  const navigate = useNavigate()
  const location = useLocation()
  const active = location.pathname === '/settings'
  return (
    <button
      onClick={() => navigate(active ? '/' : '/settings')}
      aria-label="Settings"
      title="Settings"
      className={`${className} w-9 h-9 flex items-center justify-center rounded-full transition-colors ${active ? 'bg-accent text-bg' : 'text-fg-muted hover:text-fg hover:bg-bg-hover'}`}
      style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
    >
      <SettingsIcon size={16} strokeWidth={2} aria-hidden />
    </button>
  )
}

function EmptyState(): JSX.Element {
  return (
    <div className="py-16 px-10 text-center text-fg-muted font-serif italic text-[15px]">
      Seleziona un articolo per leggerlo
    </div>
  )
}

function ArticleRoute({ onPatched, feeds }: { onPatched: () => void; feeds: Feed[] }): JSX.Element {
  const { id } = useParams()
  if (!id) return <EmptyState />
  return <ArticleDetail id={id} onPatched={onPatched} feeds={feeds} />
}
