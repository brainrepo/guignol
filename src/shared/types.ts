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

export type Language = 'en' | 'it' | 'es' | 'fr' | 'de'

export const LANGUAGES: Record<Language, { label: string; promptName: string }> = {
  en: { label: 'English', promptName: 'English' },
  it: { label: 'Italiano', promptName: 'Italian' },
  es: { label: 'Español', promptName: 'Spanish' },
  fr: { label: 'Français', promptName: 'French' },
  de: { label: 'Deutsch', promptName: 'German' }
}

export interface AppSettings {
  vaultPath: string
  highlightsPath: string
  digestsPath: string
  pollingMinutes: number
  notificationsEnabled: boolean
  claudeBinary: string
  theme: Theme
  language: Language
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

export interface DigestArticleRef {
  id: string
  title: string
  feed: string
  link: string
  published: string
}

export interface DigestDoc {
  id: string
  created: string
  from: string
  to: string
  summary: string
  articles: DigestArticleRef[]
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
