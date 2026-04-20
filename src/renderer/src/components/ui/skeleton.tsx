import { cn } from '@renderer/lib/utils'

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>): JSX.Element {
  return <div className={cn('animate-pulse rounded-md bg-bg-alt', className)} {...props} />
}
