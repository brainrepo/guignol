import { useTranslation } from 'react-i18next'
import { Folder, Rss, Globe } from 'lucide-react'
import type { DigestScope, Feed } from '../../../shared/types'
import { Badge } from './ui/badge'

interface Props {
  scope?: DigestScope
  feeds: Feed[]
}

export default function ScopeBadge({ scope, feeds }: Props): JSX.Element {
  const { t } = useTranslation()
  const effective: DigestScope = scope ?? { kind: 'all' }

  if (effective.kind === 'all') {
    return <ScopeChip icon={<Globe size={10} strokeWidth={2} aria-hidden />} label={t('createDigest.scopeAll')} />
  }
  if (effective.kind === 'folder') {
    return <ScopeChip icon={<Folder size={10} strokeWidth={2} aria-hidden />} label={effective.name} />
  }
  const feed = feeds.find((f) => f.slug === effective.slug)
  return <ScopeChip icon={<Rss size={10} strokeWidth={2} aria-hidden />} label={feed?.title ?? effective.slug} />
}

function ScopeChip({ icon, label }: { icon: React.ReactNode; label: string }): JSX.Element {
  return (
    <Badge
      variant="outline"
      className="gap-1 px-1.5 py-0.5 text-[10px] uppercase tracking-caps text-fg-muted border-border font-normal"
      title={label}
    >
      {icon}
      <span className="max-w-[100px] truncate normal-case tracking-normal">{label}</span>
    </Badge>
  )
}
