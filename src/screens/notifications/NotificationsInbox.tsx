import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMarkNotificationsRead, useNotifications, type NotificationItem } from '../../hooks/useNotifications'
import { relativeTime } from '../../lib/relativeTime'
import { NotificationSkeleton } from '../../components/Skeleton'

const TYPE_CONFIG: Record<NotificationItem['type'], { icon: string; verb: string }> = {
  like:    { icon: '🔥', verb: 'liked your' },
  comment: { icon: '💬', verb: 'commented on your' },
  reply:   { icon: '↩️', verb: 'replied on your' },
}

export default function NotificationsInbox() {
  const navigate = useNavigate()
  const { data: notifications, isLoading, isError } = useNotifications()
  const markRead = useMarkNotificationsRead()
  const hasMarkedRead = useRef(false)

  useEffect(() => {
    if (hasMarkedRead.current) return
    hasMarkedRead.current = true
    markRead.mutate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="flex min-h-[calc(100vh-5rem)] flex-col">
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center gap-3 bg-background/95 px-5 py-4 backdrop-blur-sm border-b border-border/50">
        <button
          onClick={() => navigate(-1)}
          aria-label="Back"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-surface shadow-[var(--shadow-card)] text-primary"
        >
          ←
        </button>
        <h1 className="text-base font-bold text-primary">Notifications</h1>
      </div>

      <div className="flex flex-col gap-2 px-4 py-4">
        {/* Loading */}
        {isLoading && [1,2,3,4].map((i) => <NotificationSkeleton key={i} />)}

        {/* Error */}
        {isError && (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <p className="text-2xl">😕</p>
            <p className="text-sm text-muted">Couldn't load notifications.</p>
          </div>
        )}

        {/* Empty */}
        {!isLoading && !isError && (!notifications || notifications.length === 0) && (
          <div className="flex flex-col items-center gap-3 py-20 text-center">
            <p className="text-4xl">🔔</p>
            <p className="font-semibold text-primary">All clear</p>
            <p className="text-sm text-muted">When someone likes or comments on your meals, you'll see it here.</p>
          </div>
        )}

        {/* Notifications */}
        {notifications && notifications.map((n, i) => {
          const cfg = TYPE_CONFIG[n.type]
          const isUnread = !n.readAt
          return (
            <button
              key={n.id}
              onClick={() => navigate(`/home/log/${n.logId}`)}
              className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition-colors animate-slide-up no-press hover:bg-background ${
                isUnread ? 'border-primary/30 bg-primary/5' : 'border-border'
              }`}
              style={{ animationDelay: `${i * 30}ms` }}
            >
              {/* Notification type icon */}
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-background text-base">
                {cfg.icon}
              </div>

              {/* Actor avatar */}
              {n.actor.photo_url ? (
                <img src={n.actor.photo_url} alt={n.actor.name} className="h-9 w-9 shrink-0 rounded-full object-cover" />
              ) : (
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-background text-sm font-bold text-muted">
                  {n.actor.name.charAt(0).toUpperCase()}
                </div>
              )}

              {/* Text */}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-primary leading-snug">
                  <span className="font-semibold">@{n.actor.username}</span>
                  {' '}{cfg.verb}{' '}
                  <span className="font-medium">{n.log.name ?? n.log.meal_type}</span>
                </p>
                <p className="text-xs text-muted mt-0.5">{relativeTime(n.createdAt)}</p>
              </div>

              {/* Unread dot */}
              {isUnread && (
                <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}