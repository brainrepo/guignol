import { BrowserWindow, dialog, ipcMain, shell } from 'electron'
import type { AppSettings } from '../shared/types.js'
import { settings } from './settings.js'
import { addFeed, listFeeds, removeFeed } from './feeds/manager.js'
import { probeFeed } from './feeds/fetcher.js'
import { runNow, restart, schedulerEvents } from './feeds/scheduler.js'
import { buildIndex, getAllMeta, getMeta, getMetaByFeed, upsertMeta } from './vault/index.js'
import { readArticleFile } from './vault/reader.js'
import { updateArticleFrontmatter } from './vault/writer.js'
import { summarize } from './ai/claude-cli.js'
import { importOpml } from './opml/import.js'
import { exportOpml } from './opml/export.js'
import { notifyNewArticles } from './notifications.js'
import { log } from './log.js'
import { addHighlight, listAllHighlightDocs, listHighlights, removeHighlight } from './highlights.js'

export function registerIpc(): void {
  // ===== Settings =====
  ipcMain.handle('settings:get', () => settings.all())
  ipcMain.handle('settings:set', (_e, patch: Partial<AppSettings>) => {
    for (const [k, v] of Object.entries(patch)) {
      settings.set(k as keyof AppSettings, v as never)
    }
    if ('pollingMinutes' in patch) restart()
    return settings.all()
  })
  ipcMain.handle('settings:pickDirectory', async (_e, current?: string) => {
    const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
    const result = await dialog.showOpenDialog(win!, {
      title: 'Seleziona cartella',
      defaultPath: current,
      properties: ['openDirectory', 'createDirectory']
    })
    if (result.canceled || !result.filePaths[0]) return null
    return result.filePaths[0]
  })

  // ===== Feeds =====
  ipcMain.handle('feeds:list', () => listFeeds())
  ipcMain.handle('feeds:add', async (_e, url: string) => {
    const probed = await probeFeed(url)
    const feed = await addFeed(url, probed.title)
    void runNow()
    return feed
  })
  ipcMain.handle('feeds:remove', (_e, url: string) => removeFeed(url))
  ipcMain.handle('feeds:refresh', () => runNow())

  // ===== Articles =====
  ipcMain.handle('articles:list', (_e, feedSlug?: string) => {
    return feedSlug ? getMetaByFeed(feedSlug) : getAllMeta()
  })
  ipcMain.handle('articles:read', async (_e, id: string) => {
    const meta = getMeta(id)
    if (!meta) throw new Error(`Article ${id} not found`)
    return await readArticleFile(meta.filePath)
  })
  ipcMain.handle('articles:patch', async (_e, id: string, patch: Record<string, unknown>) => {
    const meta = getMeta(id)
    if (!meta) throw new Error(`Article ${id} not found`)
    await updateArticleFrontmatter(meta.filePath, patch)
    upsertMeta({ ...meta, ...patch } as typeof meta)
    return getMeta(id)
  })
  ipcMain.handle('articles:openExternal', (_e, url: string) => shell.openExternal(url))

  // ===== AI summary =====
  ipcMain.handle('ai:summarize', async (_e, id: string) => {
    const meta = getMeta(id)
    if (!meta) throw new Error(`Article ${id} not found`)
    const article = await readArticleFile(meta.filePath)
    const result = await summarize(article)
    const patch = { summary: result.summary, summary_generated_at: new Date().toISOString() }
    await updateArticleFrontmatter(meta.filePath, patch)
    upsertMeta({ ...meta, ...patch })
    return result
  })

  // ===== OPML =====
  ipcMain.handle('opml:import', async () => {
    const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
    const result = await dialog.showOpenDialog(win!, {
      title: 'Importa OPML',
      filters: [{ name: 'OPML', extensions: ['opml', 'xml'] }],
      properties: ['openFile']
    })
    if (result.canceled || !result.filePaths[0]) return null
    const report = await importOpml(result.filePaths[0])
    void runNow()
    return report
  })
  ipcMain.handle('opml:export', async () => {
    const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
    const result = await dialog.showSaveDialog(win!, {
      title: 'Esporta OPML',
      defaultPath: 'guignol-feeds.opml',
      filters: [{ name: 'OPML', extensions: ['opml'] }]
    })
    if (result.canceled || !result.filePath) return null
    await exportOpml(result.filePath)
    return result.filePath
  })

  // ===== Vault rebuild (utile dopo cambio path) =====
  ipcMain.handle('vault:rebuild', () => buildIndex())

  // ===== Highlights =====
  ipcMain.handle('highlights:listAll', () => listAllHighlightDocs())
  ipcMain.handle('highlights:list', async (_e, articleId: string) => {
    const meta = getMeta(articleId)
    if (!meta) throw new Error(`Article ${articleId} not found`)
    return await listHighlights(meta)
  })
  ipcMain.handle('highlights:add', async (_e, articleId: string, text: string) => {
    const meta = getMeta(articleId)
    if (!meta) throw new Error(`Article ${articleId} not found`)
    return await addHighlight(meta, text)
  })
  ipcMain.handle('highlights:remove', async (_e, articleId: string, text: string) => {
    const meta = getMeta(articleId)
    if (!meta) throw new Error(`Article ${articleId} not found`)
    return await removeHighlight(meta, text)
  })

  // ===== Log =====
  ipcMain.handle('log:history', () => log.history())

  // ===== Push events from main → renderer =====
  schedulerEvents.on('cycle', ({ totalNew }: { totalNew: number }) => {
    notifyNewArticles(totalNew)
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send('articles:new', { totalNew })
    }
  })
}
