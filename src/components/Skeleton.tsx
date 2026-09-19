/**
 * Skeleton — animated shimmer placeholder for loading states.
 * Use `<Skeleton className="h-4 w-32" />` anywhere content is loading.
 */
interface SkeletonProps {
  className?: string
  circle?: boolean
}

export function Skeleton({ className = '', circle = false }: SkeletonProps) {
  return <div className={`skeleton ${circle ? 'rounded-full' : ''} ${className}`} aria-hidden="true" />
}

/** Pre-built skeleton for a feed card */
export function FeedCardSkeleton() {
  return (
    <div className="feed-card flex flex-col gap-3 animate-fade-in">
      <div className="flex items-center gap-2.5">
        <Skeleton className="h-[39px] w-[39px] !rounded-[15px]" />
        <Skeleton className="h-4 w-28" />
      </div>
      <Skeleton className="h-[230px] w-full !rounded-[29px]" />
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-7 w-20 rounded-full" />
      </div>
    </div>
  )
}

/** Pre-built skeleton for a notification row */
export function NotificationSkeleton() {
  return (
    <div className="choice animate-fade-in">
      <Skeleton className="h-[39px] w-[39px] !rounded-[15px]" />
      <Skeleton className="h-4 flex-1" />
    </div>
  )
}

/** Pre-built skeleton for a friend row */
export function FriendRowSkeleton() {
  return (
    <div className="choice animate-fade-in">
      <Skeleton className="h-[39px] w-[39px] !rounded-[15px]" />
      <Skeleton className="h-4 w-32" />
    </div>
  )
}

/** Pre-built skeleton for a profile header */
export function ProfileHeaderSkeleton() {
  return (
    <div className="flex items-center gap-4 animate-fade-in">
      <Skeleton className="h-[72px] w-[72px] !rounded-[26px]" />
      <div className="flex flex-col gap-2">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-4 w-20" />
      </div>
    </div>
  )
}
