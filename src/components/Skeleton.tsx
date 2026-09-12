/**
 * Skeleton — animated shimmer placeholder for loading states.
 * Use `<Skeleton className="h-4 w-32" />` anywhere content is loading.
 */
interface SkeletonProps {
  className?: string
  circle?: boolean
}

export function Skeleton({ className = '', circle = false }: SkeletonProps) {
  return (
    <div
      className={`skeleton ${circle ? 'rounded-full' : 'rounded-xl'} ${className}`}
      aria-hidden="true"
    />
  )
}

/** Pre-built skeleton for a feed card */
export function FeedCardSkeleton() {
  return (
    <div className="flex flex-col gap-3 card p-4 animate-fade-in">
      <Skeleton className="h-48 w-full" />
      <div className="flex items-center gap-2">
        <Skeleton circle className="h-8 w-8" />
        <Skeleton className="h-4 w-28" />
        <Skeleton className="ml-auto h-4 w-12" />
      </div>
      <Skeleton className="h-5 w-40" />
      <div className="flex items-center justify-between">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-6 w-20" />
      </div>
    </div>
  )
}

/** Pre-built skeleton for a notification row */
export function NotificationSkeleton() {
  return (
    <div className="flex items-center gap-3 card p-3 animate-fade-in">
      <Skeleton circle className="h-9 w-9" />
      <Skeleton className="h-4 flex-1" />
    </div>
  )
}

/** Pre-built skeleton for a friend row */
export function FriendRowSkeleton() {
  return (
    <div className="flex items-center gap-3 rounded-full bg-surface shadow-[var(--shadow-card)] px-4 py-2 animate-fade-in">
      <Skeleton circle className="h-8 w-8" />
      <Skeleton className="h-4 w-32" />
    </div>
  )
}

/** Pre-built skeleton for a profile header */
export function ProfileHeaderSkeleton() {
  return (
    <div className="flex flex-col items-center gap-3 pt-8 pb-5 animate-fade-in">
      <Skeleton circle className="h-20 w-20" />
      <Skeleton className="h-5 w-32" />
      <Skeleton className="h-4 w-20" />
    </div>
  )
}
