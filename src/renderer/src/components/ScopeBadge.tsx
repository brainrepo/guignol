import { useTranslation } from 'react-i18next'
import { Folder, Rss, Globe } from 'lucide-react'
import type { DigestScope, Feed } from '../../../shared/types'

interface Props {
  scope?: DigestScope
  feeds: Feed[]
}

export default function ScopeBadge({ scope, feeds }: Props): JSX.Element {
  const { t } = useTranslation()
  const effective: DigestScope = scope ?? { kind: 'all' }

  if (effective.kind === 'all') {
    return <Badge icon={<Globe size={10} strokeWidth={2} aria-hidden />} label={t('createDigest.scopeAll')} />
  }
  if (effective.kind === 'folder') {
    return <Badge icon={<Folder size={10} strokeWidth={2} aria-hidden />} label={effective.name} />
  }
  const feed = feeds.find((f) => f.slug === effective.slug)
  return <Badge icon={<Rss size={10} strokeWidth={2} aria-hidden />} label={feed?.title ?? effective.slug} />
}

function Badge({ icon, label }: { icon: React.ReactNode; label: string }): JSX.Element {
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] uppercase tracking-caps text-fg-muted border border-fg-faint rounded-full"
      title={label}
    >
      {icon}
      <span className="max-w-[100px] truncate normal-case tracking-normal">{label}</span>
    </span>
  )
}
