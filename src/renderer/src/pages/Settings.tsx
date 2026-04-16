import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Folder } from 'lucide-react'
import type { AiProviderName, AppSettings, Language, Theme } from '../../../shared/types'
import { AI_PROVIDERS, LANGUAGES } from '../../../shared/types'

interface Props { onChanged: () => void }

export default function Settings({ onChanged }: Props): JSX.Element {
  const { t } = useTranslation()
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [status, setStatus] = useState<string | null>(null)

  useEffect(() => { void window.guignol.settings.get().then(setSettings) }, [])

  if (!settings) return (
    <div className="py-16 px-10 text-center text-fg-muted font-serif italic">{t('common.loading')}</div>
  )

  const update = async (patch: Partial<AppSettings>): Promise<void> => {
    const updated = await window.guignol.settings.set(patch)
    setSettings(updated)
    onChanged()
  }

  const importOpml = async (): Promise<void> => {
    setStatus(t('settings.opml.importing'))
    const r = await window.guignol.opml.import()
    setStatus(
      r
        ? t('settings.opml.imported', { added: r.added, skipped: r.skipped, errors: r.errors.length })
        : t('settings.opml.cancelled')
    )
    onChanged()
  }

  const exportOpml = async (): Promise<void> => {
    const path = await window.guignol.opml.export()
    setStatus(path ? t('settings.opml.exported', { path }) : t('settings.opml.cancelled'))
  }

  const themes: { value: Theme; label: string; hint: string }[] = [
    { value: 'system', label: t('settings.theme.system'), hint: t('settings.theme.systemHint') },
    { value: 'light', label: t('settings.theme.light'), hint: t('settings.theme.lightHint') },
    { value: 'dark', label: t('settings.theme.dark'), hint: t('settings.theme.darkHint') }
  ]

  const inputClass = 'mt-2 w-full text-sm py-1.5 text-fg border-b border-fg-faint focus:border-accent transition-colors placeholder:text-fg-muted normal-case tracking-normal font-normal'
  const labelClass = 'block mb-7 label'
  const btn = 'px-2.5 py-1.5 text-xs uppercase tracking-caps text-fg-dim rounded hover:text-fg hover:bg-bg-hover'

  return (
    <div className="max-w-[560px] px-14 pt-14 pb-20">
      <h1 className="font-serif text-4xl font-normal tracking-tight m-0 mb-2">{t('settings.title')}</h1>

      <fieldset className="border-0 p-0 m-0 mb-9">
        <legend className="label mb-3">{t('settings.theme.label')}</legend>
        <div className="grid grid-cols-3 gap-3 max-w-[480px]">
          {themes.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => update({ theme: t.value })}
              aria-pressed={settings.theme === t.value}
              className={`relative flex flex-col gap-2.5 p-2.5 rounded-[10px] border bg-bg-panel transition-[border-color,transform,box-shadow] duration-150 hover:-translate-y-px hover:border-fg-muted ${settings.theme === t.value ? 'border-accent shadow-[0_0_0_2px_var(--color-accent)]' : 'border-fg-faint'}`}
            >
              <ThemePreview kind={t.value} />
              <div className="flex flex-col gap-0.5 px-0.5 pb-0.5 text-left">
                <span className="text-[13px] font-semibold text-fg normal-case tracking-normal">{t.label}</span>
                <span className="text-[11px] text-fg-muted normal-case tracking-normal font-normal">{t.hint}</span>
              </div>
              {settings.theme === t.value && (
                <span
                  aria-hidden
                  className="absolute top-2 right-2.5 w-[18px] h-[18px] rounded-full bg-accent text-white text-[11px] font-bold flex items-center justify-center leading-none shadow-[0_2px_6px_rgba(15,23,42,0.25)]"
                >
                  ✓
                </span>
              )}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="border-0 p-0 m-0 mb-9">
        <legend className="label mb-3">{t('settings.language.label')}</legend>
        <div className="flex flex-wrap gap-1.5">
          {(Object.entries(LANGUAGES) as [Language, { label: string }][]).map(([code, meta]) => {
            const active = settings.language === code
            return (
              <button
                key={code}
                type="button"
                onClick={() => update({ language: code })}
                aria-pressed={active}
                className={`px-3 py-1.5 text-[13px] rounded-full border transition-colors ${active ? 'bg-accent text-bg border-accent' : 'text-fg-dim border-fg-faint hover:text-fg hover:bg-bg-hover'}`}
              >
                {meta.label}
              </button>
            )
          })}
        </div>
        <small className="block mt-2 font-normal text-fg-muted normal-case tracking-normal text-xs">
          {t('settings.language.hint')}
        </small>
      </fieldset>

      <PathField
        label={t('settings.vaultPath.label')}
        hint={t('settings.vaultPath.hint')}
        value={settings.vaultPath}
        onPick={(p) => void update({ vaultPath: p })}
      />

      <PathField
        label={t('settings.highlightsPath.label')}
        hint={t('settings.highlightsPath.hint')}
        value={settings.highlightsPath}
        onPick={(p) => void update({ highlightsPath: p })}
      />

      <PathField
        label={t('settings.digestsPath.label')}
        hint={t('settings.digestsPath.hint')}
        value={settings.digestsPath}
        onPick={(p) => void update({ digestsPath: p })}
      />

      <label className={labelClass}>
        {t('settings.polling.label')}
        <input
          type="number"
          min={1}
          max={1440}
          value={settings.pollingMinutes}
          onChange={(e) => update({ pollingMinutes: Number(e.target.value) })}
          className={inputClass}
        />
      </label>

      <label className="flex items-center gap-2.5 mb-7 text-[13px] text-fg font-normal normal-case tracking-normal">
        <input
          type="checkbox"
          checked={settings.notificationsEnabled}
          onChange={(e) => update({ notificationsEnabled: e.target.checked })}
        />
        {t('settings.notifications.label')}
      </label>

      <fieldset className="border-0 p-0 m-0 mb-7">
        <legend className="label mb-3">{t('settings.ai.providerLabel')}</legend>
        <div className="flex flex-wrap gap-1.5">
          {(Object.entries(AI_PROVIDERS) as [AiProviderName, { label: string }][]).map(([code, meta]) => {
            const active = settings.aiProvider === code
            return (
              <button
                key={code}
                type="button"
                onClick={() => update({ aiProvider: code })}
                aria-pressed={active}
                className={`px-3 py-1.5 text-[13px] rounded-full border transition-colors ${active ? 'bg-accent text-bg border-accent' : 'text-fg-dim border-fg-faint hover:text-fg hover:bg-bg-hover'}`}
              >
                {meta.label}
              </button>
            )
          })}
        </div>
        <small className="block mt-2 font-normal text-fg-muted normal-case tracking-normal text-xs">
          {t('settings.ai.providerHint')}
        </small>
      </fieldset>

      <label className={labelClass}>
        {t('settings.claudeBinary.label')}
        <input
          type="text"
          value={settings.claudeBinary}
          onChange={(e) => setSettings({ ...settings, claudeBinary: e.target.value })}
          onBlur={() => update({ claudeBinary: settings.claudeBinary })}
          className={inputClass}
        />
        <small className="block font-normal text-fg-muted mt-1.5 normal-case tracking-normal text-xs">
          {t('settings.claudeBinary.hintPrefix')} <code>claude</code>. {t('settings.claudeBinary.hintSuffix')} <code>/opt/homebrew/bin/claude</code>.
        </small>
      </label>

      <label className={labelClass}>
        {t('settings.codexBinary.label')}
        <input
          type="text"
          value={settings.codexBinary}
          onChange={(e) => setSettings({ ...settings, codexBinary: e.target.value })}
          onBlur={() => update({ codexBinary: settings.codexBinary })}
          className={inputClass}
        />
        <small className="block font-normal text-fg-muted mt-1.5 normal-case tracking-normal text-xs">
          {t('settings.codexBinary.hintPrefix')} <code>codex</code>. {t('settings.codexBinary.hintAuth')} <code>codex login</code>.
        </small>
      </label>

      <h2 className="font-serif mt-12 text-[22px] font-normal">{t('settings.opml.title')}</h2>
      <div className="flex gap-1 mt-2">
        <button onClick={importOpml} className={btn}>{t('settings.opml.import')}</button>
        <button onClick={exportOpml} className={btn}>{t('settings.opml.export')}</button>
      </div>

      {status && (
        <div className="mt-5 pt-2.5 label border-t border-fg-faint text-accent">
          {status}
        </div>
      )}
    </div>
  )
}

function PathField({
  label,
  hint,
  value,
  onPick
}: {
  label: string
  hint: string
  value: string
  onPick: (path: string) => void
}): JSX.Element {
  const { t } = useTranslation()
  const choose = async (): Promise<void> => {
    const picked = await window.guignol.settings.pickDirectory(value)
    if (picked) onPick(picked)
  }
  return (
    <div className="mb-7">
      <div className="label mb-2">{label}</div>
      <div className="flex items-stretch gap-2">
        <div
          className="flex-1 min-w-0 px-3 py-2 rounded-md border border-fg-faint bg-bg-panel text-sm text-fg truncate font-mono"
          title={value}
        >
          {value}
        </div>
        <button
          type="button"
          onClick={choose}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-fg-faint text-[13px] text-fg-dim hover:text-fg hover:bg-bg-hover transition-colors"
        >
          <Folder size={14} strokeWidth={2} aria-hidden />
          {t('common.browse')}
        </button>
      </div>
      <small className="block font-normal text-fg-muted mt-1.5 normal-case tracking-normal text-xs">
        {hint}
      </small>
    </div>
  )
}

function ThemePreview({ kind }: { kind: Theme }): JSX.Element {
  if (kind === 'system') {
    return (
      <div className="grid grid-cols-[10px_1fr] gap-1.5 h-[78px] rounded-md p-2 preview-split-bg ring-1 ring-black/10">
        <div className="rounded-sm preview-split-rail opacity-80" />
        <div className="flex flex-col gap-[5px] pt-0.5">
          <div className="h-2 w-[70%] rounded-sm preview-split-text opacity-90" />
          <div className="h-[5px] w-full rounded-sm preview-split-text opacity-35" />
          <div className="h-[5px] w-[65%] rounded-sm preview-split-text opacity-35" />
          <div className="mt-1 w-9 h-1.5 rounded-sm preview-split-accent" />
        </div>
      </div>
    )
  }

  const isLight = kind === 'light'
  const bg = isLight ? '#f8fafc' : '#0f1419'
  const fg = isLight ? '#0f172a' : '#e6edf3'
  const accent = isLight ? '#2d5a94' : '#5b9cee'

  return (
    <div
      className="grid grid-cols-[10px_1fr] gap-1.5 h-[78px] rounded-md p-2"
      style={{ background: bg, boxShadow: isLight ? 'inset 0 0 0 1px rgba(0,0,0,0.08)' : 'inset 0 0 0 1px rgba(255,255,255,0.08)' }}
    >
      <div className="rounded-sm" style={{ background: fg, opacity: 0.35 }} />
      <div className="flex flex-col gap-[5px] pt-0.5">
        <div className="h-2 w-[70%] rounded-sm" style={{ background: fg, opacity: 0.9 }} />
        <div className="h-[5px] w-full rounded-sm" style={{ background: fg, opacity: 0.35 }} />
        <div className="h-[5px] w-[65%] rounded-sm" style={{ background: fg, opacity: 0.35 }} />
        <div className="mt-1 w-9 h-1.5 rounded-sm" style={{ background: accent }} />
      </div>
    </div>
  )
}
