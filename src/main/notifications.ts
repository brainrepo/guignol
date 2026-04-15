import { Notification, BrowserWindow } from 'electron'
import { settings } from './settings.js'

export function notifyNewArticles(count: number): void {
  if (!settings.get('notificationsEnabled')) return
  if (count <= 0) return
  if (!Notification.isSupported()) return

  const n = new Notification({
    title: 'Guignol',
    body: count === 1 ? '1 nuovo articolo' : `${count} nuovi articoli`,
    silent: false
  })

  n.on('click', () => {
    const win = BrowserWindow.getAllWindows()[0]
    if (win) {
      if (win.isMinimized()) win.restore()
      win.show()
      win.focus()
    }
  })

  n.show()
}
