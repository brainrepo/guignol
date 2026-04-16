import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

interface Props {
  open: boolean
  title: string
  placeholder?: string
  initialValue?: string
  submitLabel?: string
  onSubmit: (value: string) => void
  onClose: () => void
}

export default function PromptModal({
  open,
  title,
  placeholder,
  initialValue = '',
  submitLabel,
  onSubmit,
  onClose
}: Props): JSX.Element | null {
  const { t } = useTranslation()
  const [value, setValue] = useState(initialValue)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setValue(initialValue)
    const id = window.setTimeout(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    }, 20)
    const onKey = (e: KeyboardEvent): void => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('keydown', onKey); window.clearTimeout(id) }
  }, [open, initialValue, onClose])

  if (!open) return null

  const submit = (e: React.FormEvent): void => {
    e.preventDefault()
    const trimmed = value.trim()
    if (trimmed.length === 0) return
    onSubmit(trimmed)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-28 bg-black/45 backdrop-blur-sm animate-[fade-in_120ms_ease-out]"
      onMouseDown={onClose}
    >
      <form
        onSubmit={submit}
        onMouseDown={(e) => e.stopPropagation()}
        className="bg-bg-panel border border-fg-faint rounded-lg w-[420px] max-w-[90vw] shadow-[0_20px_50px_rgba(0,0,0,0.3)] overflow-hidden"
      >
        <header className="px-6 pt-5 pb-2">
          <h2 className="font-serif text-lg font-normal tracking-tight text-fg m-0">{title}</h2>
        </header>

        <div className="px-6 pb-5">
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
            className="w-full text-[15px] py-2 text-fg border-b border-fg-faint focus:border-accent transition-colors placeholder:text-fg-muted"
          />
        </div>

        <footer className="flex items-center justify-end gap-1 px-4 py-3 bg-bg-alt border-t border-fg-faint">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-xs uppercase tracking-caps text-fg-dim rounded hover:text-fg hover:bg-bg-hover"
          >
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            disabled={value.trim().length === 0}
            className="px-3 py-1.5 text-xs uppercase tracking-caps text-accent rounded hover:text-bg hover:bg-accent disabled:opacity-35"
          >
            {submitLabel ?? t('common.save')}
          </button>
        </footer>
      </form>
    </div>
  )
}
