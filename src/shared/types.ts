export interface Feed {
  url: string
  title: string
  slug: string
  addedAt: string
  lastFetchedAt?: string
  lastError?: string
  errorCount?: number
}

export interface FeedsFile {
  feeds: Feed[]
  version: 1
}

export interface ArticleFrontmatter {
  id: string
  feed: string
  feed_url: string
  title: string
  link: string
  author?: string
  published: string
  fetched: string
  read: boolean
  starred: boolean
  tags: string[]
  summary?: string
  summary_generated_at?: string
}

export interface Article extends ArticleFrontmatter {
  body: string
  filePath: string
}

export interface ArticleMeta extends ArticleFrontmatter {
  filePath: string
}

export type Theme = 'light' | 'dark' | 'system'

export interface AppSettings {
  vaultPath: string
  highlightsPath: string
  pollingMinutes: number
  notificationsEnabled: boolean
  claudeBinary: string
  theme: Theme
}

export interface Highlight {
  text: string
  createdAt: string
}

export interface HighlightDoc {
  article_id: string
  article_title: string
  article_link: string
  feed: string
  feed_url: string
  created: string
  updated: string
  highlights: Highlight[]
}

export interface FetchResult {
  feedUrl: string
  newArticles: number
  errors?: string
}

export type LogLevel = 'info' | 'warn' | 'error' | 'debug'

export interface LogEntry {
  ts: string
  level: LogLevel
  source: string
  message: string
  detail?: string
}
