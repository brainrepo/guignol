import { BrowserWindow, dialog, ipcMain, shell } from 'electron'
import type { AppSettings, ArticleMeta, DigestScope } from '../shared/types.js'
import { settings } from './settings.js'
import { addFeed, listFeeds, removeFeed, renameFolder, updateFeed } from './feeds/manager.js'
import { probeFeed } from './feeds/fetcher.js'
import { runNow, restart, schedulerEvents } from './feeds/scheduler.js'
import { buildIndex, getAllMeta, getMeta, getMetaByFeed, upsertMeta } from './vault/index.js'
import { readArticleFile } from './vault/reader.js'
import { updateArticleFrontmatter } from './vault/writer.js'
import { summarize } from './ai/claude-cli.js'
import { fetchReaderContent, ReaderExtractionError, type ReaderResult } from './reader/extract.js'
import { importOpml } from './opml/import.js'
import { exportOpml } from './opml/export.js'
import { notifyNewArticles } from './notifications.js'
import { log } from './log.js'
import { addHighlight, listAllHighlightDocs, listHighlights, removeHighlight } from './highlights.js'
import { createDigest, listDigests } from './digests.js'

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
  ipcMain.handle('feeds:setFolder', (_e, url: string, folder: string | null) =>
    updateFeed(url, { folder: folder ?? undefined })
  )
  ipcMain.handle('feeds:renameFolder', (_e, oldName: string, newName: string | null) =>
    renameFolder(oldName, newName)
  )

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

  // ===== Reader mode =====
  ipcMain.handle('reader:fetch', async (_e, id: string) => {
    const meta = getMeta(id)
    if (!meta) throw new Error(`Article ${id} not found`)
    if (!meta.link) throw new Error(`Article ${id} has no link to fetch`)

    try {
      const result = await fetchReaderContent(meta.link)
      await persistReaderSuccess(meta, result)
      return result
    } catch (err) {
      const extractionErr = err instanceof ReaderExtractionError
        ? err
        : new ReaderExtractionError(err instanceof Error ? err.message : String(err), 'parse')

      const recovered = await recoverReaderFailure(extractionErr, meta)
      if (recovered) {
        await persistReaderSuccess(meta, recovered)
        return recovered
      }

      const patch = { reader_error: extractionErr.message }
      await updateArticleFrontmatter(meta.filePath, patch)
      upsertMeta({ ...meta, ...patch })
      throw extractionErr
    }
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

  // ===== Digests =====
  ipcMain.handle('digests:listAll', () => listDigests())
  ipcMain.handle('digests:create', (_e, fromISO: string, scope?: DigestScope) =>
    createDigest(fromISO, scope)
  )

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

async function persistReaderSuccess(meta: ArticleMeta, result: ReaderResult): Promise<void> {
  const patch = {
    reader_body: result.body,
    reader_fetched_at: new Date().toISOString(),
    reader_source_url: result.sourceUrl,
    reader_word_count: result.wordCount,
    reader_error: undefined
  }
  await updateArticleFrontmatter(meta.filePath, patch)
  upsertMeta({ ...meta, ...patch })
}

/**
 * TODO (user contribution): politica di fallback su estrazione fallita.
 *
 * Oggi: se fetchReaderContent lancia, salviamo `reader_error` e rilanciamo.
 * È il comportamento più onesto ma non sempre il più utile. Alternative:
 *
 *   - Retry con User-Agent browser-like (tipicamente utile per 403/406 di
 *     Cloudflare / Akamai). Vedi hook A in extract.ts.
 *   - Silenzioso: se il feed body è già "abbastanza lungo" (es. > 400
 *     parole), considera che reader mode non serve e ritorna null SENZA
 *     marcare l'articolo come fallito — l'utente non vedrà un errore.
 *   - Fallback grezzo: re-fetcha la pagina e passa tutto `<article>` /
 *     `<main>` / `<body>` direttamente a Turndown, saltando Readability.
 *     Utile per siti con markup minimale su cui Readability si confonde.
 *   - Blacklist per dominio: se `new URL(meta.link).hostname` è in una
 *     lista di domini "non retry" (es. nytimes.com), ritorna null e lascia
 *     che `reader_error` persista. Evita retry continui su paywall noti.
 *
 * @param err L'errore originale (ReaderExtractionError con .kind e .status)
 * @param meta L'ArticleMeta dell'articolo (per accedere a meta.link, meta.feed, ecc.)
 * @returns ReaderResult da persistere come successo, oppure null per rilanciare l'errore
 */
async function recoverReaderFailure(
  _err: ReaderExtractionError,
  _meta: ArticleMeta
): Promise<ReaderResult | null> {
  // TODO: implementa la tua politica di recupero.
  return null
}
