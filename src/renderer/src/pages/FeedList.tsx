import { useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ChevronRight, FolderPlus, Plus, Rss, X } from 'lucide-react'
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import type { ArticleMeta, Feed } from '../../../shared/types'
import PromptModal from '../components/PromptModal'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '../components/ui/dropdown-menu'

interface Props {
  feeds: Feed[]
  articles: ArticleMeta[]
  selected: string | null
  onSelect: (slug: string | null) => void
  onChanged: () => void
  onAddFeed: () => void
}

const COLLAPSED_KEY = 'feedList.collapsed'
const KNOWN_FOLDERS_KEY = 'feedList.knownFolders'
const UNCATEGORIZED_DROP_ID = 'folder::__uncategorized__'
const folderDropId = (name: string): string => `folder::${name}`

function readCollapsed(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(COLLAPSED_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return typeof parsed === 'object' && parsed ? parsed : {}
  } catch {
    return {}
  }
}

function writeCollapsed(map: Record<string, boolean>): void {
  try { localStorage.setItem(COLLAPSED_KEY, JSON.stringify(map)) } catch { /* quota */ }
}

function readKnownFolders(): string[] {
  try {
    const raw = localStorage.getItem(KNOWN_FOLDERS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : []
  } catch {
    return []
  }
}

function writeKnownFolders(list: string[]): void {
  try { localStorage.setItem(KNOWN_FOLDERS_KEY, JSON.stringify(list)) } catch { /* quota */ }
}

export default function FeedList({ feeds, articles, selected, onSelect, onChanged, onAddFeed }: Props): JSX.Element {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const onHighlights = location.pathname === '/highlights'
  const onDigests = location.pathname.startsWith('/digests')
  const fullWidthRoute = onHighlights || location.pathname === '/settings'
  const notOnArticles = fullWidthRoute || onDigests

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(readCollapsed)
  const [knownFolders, setKnownFolders] = useState<string[]>(readKnownFolders)
  const [promptKind, setPromptKind] = useState<{ mode: 'new' } | { mode: 'rename'; name: string } | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
  )

  const toggleCollapse = (key: string): void => {
    setCollapsed((prev) => {
      const next = { ...prev, [key]: !prev[key] }
      writeCollapsed(next)
      return next
    })
  }

  const unreadByFeed = useMemo(() => {
    const m = new Map<string, number>()
    for (const a of articles) if (!a.read) m.set(a.feed, (m.get(a.feed) ?? 0) + 1)
    return m
  }, [articles])
  const totalUnread = useMemo(
    () => articles.reduce((n, a) => n + (a.read ? 0 : 1), 0),
    [articles]
  )

  const { folderGroups, uncategorized } = useMemo(() => {
    const byFolder = new Map<string, Feed[]>()
    const unassigned: Feed[] = []
    for (const f of feeds) {
      if (f.folder && f.folder.length > 0) {
        const list = byFolder.get(f.folder) ?? []
        list.push(f)
        byFolder.set(f.folder, list)
      } else {
        unassigned.push(f)
      }
    }
    for (const name of knownFolders) {
      if (!byFolder.has(name)) byFolder.set(name, [])
    }
    const groups = Array.from(byFolder.entries())
      .map(([name, items]) => ({ name, items }))
      .sort((a, b) => a.name.localeCompare(b.name))
    return { folderGroups: groups, uncategorized: unassigned }
  }, [feeds, knownFolders])

  const handleRemove = async (feedUrl: string): Promise<void> => {
    if (!confirm(t('feedList.confirmRemove'))) return
    await window.guignol.feeds.remove(feedUrl)
    onChanged()
  }

  const handleRenameFolderSubmit = async (oldName: string, newName: string): Promise<void> => {
    const trimmed = newName.trim()
    if (trimmed === oldName || trimmed.length === 0) { setPromptKind(null); return }
    await window.guignol.feeds.renameFolder(oldName, trimmed)
    const updated = knownFolders.filter((f) => f !== oldName)
    updated.push(trimmed)
    setKnownFolders(updated)
    writeKnownFolders(updated)
    setPromptKind(null)
    onChanged()
  }

  const handleDeleteFolder = async (name: string): Promise<void> => {
    if (!confirm(t('feedList.confirmDeleteFolder', { name }))) return
    await window.guignol.feeds.renameFolder(name, null)
    const updated = knownFolders.filter((f) => f !== name)
    setKnownFolders(updated)
    writeKnownFolders(updated)
    onChanged()
  }

  const handleNewFolderSubmit = (name: string): void => {
    const trimmed = name.trim()
    if (trimmed.length === 0) { setPromptKind(null); return }
    if (!folderGroups.some((g) => g.name === trimmed)) {
      const updated = [...knownFolders, trimmed]
      setKnownFolders(updated)
      writeKnownFolders(updated)
    }
    setPromptKind(null)
  }

  const handleDragEnd = async (ev: DragEndEvent): Promise<void> => {
    const feedUrl = ev.active.data.current?.feedUrl as string | undefined
    if (!feedUrl || ev.over == null) return
    const targetFolder = ev.over.data.current?.folder as string | null | undefined
    await window.guignol.feeds.setFolder(feedUrl, targetFolder ?? null)
    await Promise.resolve(onChanged())
  }

  const itemBase = 'group flex items-center gap-2.5 px-6 py-2 cursor-pointer text-[13px] relative'

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <div>
        <ul className="m-0 p-0 list-none pt-4 pb-2">
          <EditorialNavItem
            numeral="I."
            label={t('feedList.highlights')}
            active={onHighlights}
            onClick={() => navigate('/highlights')}
          />
          <EditorialNavItem
            numeral="II."
            label={t('feedList.digests')}
            active={onDigests}
            onClick={() => navigate('/digests')}
          />
        </ul>

        <ul className="m-0 p-0 list-none mt-2 border-t border-white/10 pt-2">
          <EditorialNavItem
            numeral="III."
            label={t('feedList.feeds')}
            active={!notOnArticles}
            onClick={() => { if (notOnArticles) navigate('/'); onSelect(null) }}
            trailing={
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    onClick={(e) => e.stopPropagation()}
                    aria-label={t('feedList.addMenuLabel', 'Add')}
                    title={t('feedList.addMenuLabel', 'Add')}
                    className="h-12 w-12 -translate-y-10 rounded-full bg-slate-100 text-slate-800 flex items-center justify-center shadow-md hover:bg-white hover:scale-110 active:scale-95 transition-all"
                  >
                    <Plus size={24} strokeWidth={2.5} aria-hidden />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => onAddFeed()}>
                    <Rss size={12} strokeWidth={2} aria-hidden />
                    {t('feedList.addFeed', 'Add feed')}
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setPromptKind({ mode: 'new' })}>
                    <FolderPlus size={12} strokeWidth={2} aria-hidden />
                    {t('feedList.newFolder')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            }
          />
          <li
            className={`${itemBase} ${!notOnArticles && selected === null ? 'text-fg font-semibold' : 'text-fg-dim hover:text-fg'}`}
            onClick={() => { if (notOnArticles) navigate('/'); onSelect(null) }}
          >
            <span className="flex-1 min-w-0 truncate">{t('feedList.all')}</span>
            <UnreadCount n={totalUnread} />
            {!notOnArticles && selected === null && (
              <span className="absolute left-0 top-0 bottom-0 w-0.5 bg-accent" />
            )}
          </li>

          {folderGroups.map((group) => {
            const isCollapsed = collapsed[group.name] === true
            const folderUnread = group.items.reduce(
              (n, f) => n + (unreadByFeed.get(f.slug) ?? 0),
              0
            )
            return (
              <FolderSection
                key={group.name}
                dropId={folderDropId(group.name)}
                folderName={group.name}
                count={folderUnread}
                collapsed={isCollapsed}
                onToggle={() => toggleCollapse(group.name)}
                onRename={() => setPromptKind({ mode: 'rename', name: group.name })}
                onDelete={() => handleDeleteFolder(group.name)}
              >
                {group.items.map((f) => (
                  <DraggableFeedRow
                    key={f.url}
                    feed={f}
                    active={!notOnArticles && selected === f.slug}
                    unread={unreadByFeed.get(f.slug) ?? 0}
                    itemBase={itemBase}
                    indent
                    onClick={() => { if (notOnArticles) navigate('/'); onSelect(f.slug) }}
                    onRemove={() => handleRemove(f.url)}
                    removeLabel={t('common.remove')}
                  />
                ))}
              </FolderSection>
            )
          })}

          <UncategorizedZone
            hasFolders={folderGroups.length > 0}
            hasItems={uncategorized.length > 0}
            label={t('feedList.uncategorized')}
          >
            {uncategorized.map((f) => (
              <DraggableFeedRow
                key={f.url}
                feed={f}
                active={!notOnArticles && selected === f.slug}
                unread={unreadByFeed.get(f.slug) ?? 0}
                itemBase={itemBase}
                onClick={() => { if (notOnArticles) navigate('/'); onSelect(f.slug) }}
                onRemove={() => handleRemove(f.url)}
                removeLabel={t('common.remove')}
              />
            ))}
          </UncategorizedZone>
        </ul>
      </div>
      <PromptModal
        open={promptKind !== null}
        title={
          promptKind?.mode === 'rename'
            ? t('feedList.renameFolder')
            : t('feedList.newFolder')
        }
        placeholder={t('feedList.newFolderPrompt')}
        initialValue={promptKind?.mode === 'rename' ? promptKind.name : ''}
        submitLabel={
          promptKind?.mode === 'rename'
            ? t('feedList.renameFolder')
            : t('feedList.newFolder')
        }
        onSubmit={(v) => {
          if (promptKind?.mode === 'rename') void handleRenameFolderSubmit(promptKind.name, v)
          else if (promptKind?.mode === 'new') handleNewFolderSubmit(v)
        }}
        onClose={() => setPromptKind(null)}
      />
    </DndContext>
  )
}

function FolderSection({
  dropId,
  folderName,
  count,
  collapsed,
  onToggle,
  onRename,
  onDelete,
  children
}: {
  dropId: string
  folderName: string
  count: number
  collapsed: boolean
  onToggle: () => void
  onRename: () => void
  onDelete: () => void
  children: React.ReactNode
}): JSX.Element {
  const { t } = useTranslation()
  const { setNodeRef, isOver } = useDroppable({ id: dropId, data: { folder: folderName } })
  return (
    <li ref={setNodeRef} className={`list-none ${isOver ? 'bg-accent/10' : ''} transition-colors`}>
      <div
        className={`group flex items-center gap-2 px-6 pt-3 pb-1 cursor-pointer select-none text-fg-muted hover:text-fg transition-colors ${isOver ? 'text-accent' : ''}`}
        onClick={onToggle}
      >
        <ChevronRight
          size={12}
          strokeWidth={2.5}
          aria-hidden
          className={`shrink-0 transition-transform duration-150 ${collapsed ? '' : 'rotate-90'}`}
        />
        <span className="label flex-1 min-w-0 truncate normal-case tracking-normal font-semibold text-[11px]">
          {folderName}
        </span>
        <UnreadCount n={count} />

        <button
          onClick={(e) => { e.stopPropagation(); onRename() }}
          aria-label={t('feedList.renameFolder')}
          title={t('feedList.renameFolder')}
          className="invisible group-hover:visible text-[10px] uppercase tracking-caps text-fg-muted hover:text-accent"
        >
          ✎
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete() }}
          aria-label={t('feedList.deleteFolder')}
          title={t('feedList.deleteFolder')}
          className="invisible group-hover:visible p-0.5 text-fg-muted hover:text-accent"
        >
          <X size={12} strokeWidth={2} aria-hidden />
        </button>
      </div>
      {!collapsed && <ul className="m-0 p-0 list-none">{children}</ul>}
    </li>
  )
}

function UncategorizedZone({
  hasFolders,
  hasItems,
  label,
  children
}: {
  hasFolders: boolean
  hasItems: boolean
  label: string
  children: React.ReactNode
}): JSX.Element {
  const { setNodeRef, isOver } = useDroppable({
    id: UNCATEGORIZED_DROP_ID,
    data: { folder: null }
  })
  return (
    <>
      {hasFolders && hasItems && (
        <li
          ref={setNodeRef}
          className={`list-none px-6 pt-3 pb-1 transition-colors ${isOver ? 'bg-accent/10' : ''}`}
        >
          <div className="label">{label}</div>
        </li>
      )}
      {hasFolders && !hasItems && (
        <li
          ref={setNodeRef}
          aria-hidden
          className={`list-none h-3 transition-colors ${isOver ? 'bg-accent/10' : ''}`}
        />
      )}
      {children}
    </>
  )
}

function DraggableFeedRow(props: {
  feed: Feed
  active: boolean
  unread: number
  itemBase: string
  indent?: boolean
  onClick: () => void
  onRemove: () => void
  removeLabel: string
}): JSX.Element {
  const { feed, active, unread, itemBase, indent = false, onClick, onRemove, removeLabel } = props
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: feed.url,
    data: { feedUrl: feed.url }
  })
  const dragStyle: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    zIndex: isDragging ? 50 : undefined,
    boxShadow: isDragging ? '0 8px 24px rgba(0,0,0,0.25)' : undefined,
    background: isDragging ? 'var(--color-bg-hover)' : undefined,
    borderRadius: isDragging ? 6 : undefined,
    cursor: isDragging ? 'grabbing' : 'grab'
  }
  return (
    <li
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={dragStyle}
      className={`${itemBase} ${indent ? 'pl-9' : ''} ${active ? 'text-fg font-semibold' : 'text-fg-dim hover:text-fg'}`}
      onClick={onClick}
      title={feed.lastError ?? ''}
      data-feed-url={feed.url}
    >
      <span className="flex-1 min-w-0 truncate">{feed.title}</span>
      {feed.lastError && <span className="text-red-500 font-bold">!</span>}
      <UnreadCount n={unread} />
      <button
        onClick={(e) => { e.stopPropagation(); onRemove() }}
        onPointerDown={(e) => e.stopPropagation()}
        aria-label={removeLabel}
        className="invisible group-hover:visible p-0.5 text-fg-muted hover:text-accent rounded"
      >
        <X size={13} strokeWidth={2} aria-hidden />
      </button>
      {active && <span className="absolute left-0 top-0 bottom-0 w-0.5 bg-accent" />}
    </li>
  )
}

function EditorialNavItem({
  numeral,
  label,
  active,
  onClick,
  trailing
}: {
  numeral: string
  label: string
  active: boolean
  onClick: () => void
  trailing?: React.ReactNode
}): JSX.Element {
  return (
    <li
      onClick={onClick}
      className={`relative flex items-baseline gap-3 px-6 py-2 cursor-pointer select-none transition-colors ${
        active ? 'text-fg font-medium' : 'text-fg-dim hover:text-fg'
      }`}
    >
      <span className="font-mono text-[10px] tracking-wider text-fg-muted w-5 shrink-0">
        {numeral}
      </span>
      <span
        className="font-serif text-[17px] tracking-tight leading-tight flex-1 min-w-0 truncate"
        style={{ fontVariationSettings: '"opsz" 16' }}
      >
        {label}
      </span>
      {trailing}
      {active && <span className="absolute left-0 top-2.5 bottom-2.5 w-0.5 bg-fg" />}
    </li>
  )
}

function UnreadCount({ n }: { n: number }): JSX.Element | null {
  if (n <= 0) return null
  return (
    <span className="text-[10px] font-mono tabular-nums text-fg-muted shrink-0">
      {n}
    </span>
  )
}
