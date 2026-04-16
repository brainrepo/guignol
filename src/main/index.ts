import { app, BrowserWindow, shell, nativeImage } from 'electron'
import { join } from 'node:path'
import { registerIpc } from './ipc.js'
import { buildIndex } from './vault/index.js'
import { start as startScheduler, runNow } from './feeds/scheduler.js'

const iconPath = join(__dirname, '../../assets/icon.png')

const isDev = !!process.env['ELECTRON_RENDERER_URL']

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 720,
    minHeight: 480,
    titleBarStyle: 'hiddenInset',
    show: false,
    icon: iconPath,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  win.on('ready-to-show', () => win.show())

  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })

  win.webContents.on('will-navigate', (e, url) => {
    const currentUrl = win.webContents.getURL()
    // permetti hash-change di react-router, intercetta tutto il resto (link http/https esterni)
    if (url.split('#')[0] === currentUrl.split('#')[0]) return
    e.preventDefault()
    void shell.openExternal(url)
  })

  const url = process.env['ELECTRON_RENDERER_URL']
  if (url) {
    void win.loadURL(url)
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  if (isDev) win.webContents.openDevTools({ mode: 'detach' })

  return win
}

app.whenReady().then(async () => {
  if (process.platform === 'darwin' && app.dock) {
    try {
      app.dock.setIcon(nativeImage.createFromPath(iconPath))
    } catch { /* icon non trovata, ignora */ }
  }
  registerIpc()
  await buildIndex()
  startScheduler()
  void runNow()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
