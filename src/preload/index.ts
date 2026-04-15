import { contextBridge, ipcRenderer } from 'electron'
import type { AppSettings, Article, ArticleMeta, Feed, FetchResult, Highlight, HighlightDoc, LogEntry } from '../shared/types.js'

const api = {
  settings: {
    get: (): Promise<AppSettings> => ipcRenderer.invoke('settings:get'),
    set: (patch: Partial<AppSettings>): Promise<AppSettings> =>
      ipcRenderer.invoke('settings:set', patch),
    pickDirectory: (current?: string): Promise<string | null> =>
      ipcRenderer.invoke('settings:pickDirectory', current)
  },
  feeds: {
    list: (): Promise<Feed[]> => ipcRenderer.invoke('feeds:list'),
    add: (url: string): Promise<Feed> => ipcRenderer.invoke('feeds:add', url),
    remove: (url: string): Promise<void> => ipcRenderer.invoke('feeds:remove', url),
    refresh: (): Promise<FetchResult[]> => ipcRenderer.invoke('feeds:refresh')
  },
  articles: {
    list: (feedSlug?: string): Promise<ArticleMeta[]> =>
      ipcRenderer.invoke('articles:list', feedSlug),
    read: (id: string): Promise<Article> => ipcRenderer.invoke('articles:read', id),
    patch: (id: string, patch: Record<string, unknown>): Promise<ArticleMeta> =>
      ipcRenderer.invoke('articles:patch', id, patch),
    openExternal: (url: string): Promise<void> =>
      ipcRenderer.invoke('articles:openExternal', url)
  },
  ai: {
    summarize: (id: string): Promise<{ summary: string }> =>
      ipcRenderer.invoke('ai:summarize', id)
  },
  opml: {
    import: (): Promise<{ added: number; skipped: number; errors: string[] } | null> =>
      ipcRenderer.invoke('opml:import'),
    export: (): Promise<string | null> => ipcRenderer.invoke('opml:export')
  },
  vault: {
    rebuild: (): Promise<void> => ipcRenderer.invoke('vault:rebuild')
  },
  highlights: {
    listAll: (): Promise<HighlightDoc[]> => ipcRenderer.invoke('highlights:listAll'),
    list: (articleId: string): Promise<Highlight[]> =>
      ipcRenderer.invoke('highlights:list', articleId),
    add: (articleId: string, text: string): Promise<Highlight[]> =>
      ipcRenderer.invoke('highlights:add', articleId, text),
    remove: (articleId: string, text: string): Promise<Highlight[]> =>
      ipcRenderer.invoke('highlights:remove', articleId, text)
  },
  log: {
    history: (): Promise<LogEntry[]> => ipcRenderer.invoke('log:history')
  },
  on: {
    newArticles: (cb: (data: { totalNew: number }) => void): (() => void) => {
      const handler = (_e: unknown, data: { totalNew: number }): void => cb(data)
      ipcRenderer.on('articles:new', handler)
      return () => ipcRenderer.off('articles:new', handler)
    },
    log: (cb: (entry: LogEntry) => void): (() => void) => {
      const handler = (_e: unknown, entry: LogEntry): void => cb(entry)
      ipcRenderer.on('log:entry', handler)
      return () => ipcRenderer.off('log:entry', handler)
    }
  }
}

contextBridge.exposeInMainWorld('guignol', api)

export type GuignolApi = typeof api
