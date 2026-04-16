import { app } from 'electron'
import { join } from 'node:path'
import Store from 'electron-store'
import type { AppSettings } from '../shared/types.js'

const defaults: AppSettings = {
  vaultPath: join(app.getPath('documents'), 'Guignol'),
  highlightsPath: join(app.getPath('documents'), 'Guignol-Highlights'),
  digestsPath: join(app.getPath('documents'), 'Guignol-Digests'),
  pollingMinutes: 15,
  notificationsEnabled: true,
  aiProvider: 'claude',
  claudeBinary: 'claude',
  codexBinary: 'codex',
  theme: 'system',
  language: 'en'
}

const store = new Store<AppSettings>({
  name: 'guignol-settings',
  defaults
})

// Migrate dropped providers: users who had selected 'gemini' before its removal
// would otherwise trip `Unknown AI provider` on the next summarize call.
if ((store.get('aiProvider') as string) === 'gemini') store.set('aiProvider', 'claude')

export const settings = {
  get<K extends keyof AppSettings>(key: K): AppSettings[K] {
    return store.get(key)
  },
  set<K extends keyof AppSettings>(key: K, value: AppSettings[K]): void {
    store.set(key, value)
  },
  all(): AppSettings {
    return store.store
  },
  onChange(cb: (settings: AppSettings) => void): () => void {
    return store.onDidAnyChange(() => cb(store.store))
  }
}
