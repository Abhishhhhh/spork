import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMarkNotificationsRead, useNotifications, type NotificationItem } from '../../hooks/useNotifications'
import { relativeTime } from '../../lib/relativeTime'
import { NotificationSkeleton } from '../../components/Skeleton'
import { TopBar } from '../../components/TopBar'
import { Avatar } from '../../components/Avatar'

const TYPE_CONFIG: Record<NotificationItem['type'], { icon: string; verb: string }> = {
  like:    { icon: '♡', verb: 'liked your meal' },
  comment: { icon: '◌', verb: 'commented on your meal' },
  reply:   { icon: '↩', verb: 'replied on your meal' },
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
    <div>
      <TopBar title="Notifications" back="/home/feed" />

      <div className="list">
        {/* Loading */}
        {isLoading && [1, 2, 3, 4].map((i) => <NotificationSkeleton key={i} />)}

        {/* Error */}
        {isError && (
          <div className="card tint text-center" style={{ margin: 0, padding: 40 }}>
            <div style={{ fontSize: 40, lineHeight: 1 }}>◌</div>
            <p className="small muted" style={{ marginTop: 8 }}>Couldn’t load notifications</p>
          </div>
        )}

        {/* Empty */}
        {!isLoading && !isError && (!notifications || notifications.length === 0) && (
          <div className="card tint text-center" style={{ margin: 0, padding: 40 }}>
            <div style={{ fontSize: 44, lineHeight: 1 }}>♧</div>
            <h4 style={{ marginTop: 12 }}>All clear</h4>
            <p className="small muted">When someone likes or comments on your meals, you’ll see it here</p>
          </div>
        )}

        {/* Notifications */}
        {notifications && notifications.map((n, i) => {
          const cfg = TYPE_CONFIG[n.type]
          const isUnread = !n.readAt
          return (
            <button
              key={n.id}
              type="button"
              onClick={() => navigate(`/home/log/${n.logId}`)}
              className={`choice no-press animate-slide-up ${isUnread ? 'sel' : ''}`}
              style={{ animationDelay: `${i * 30}ms` }}
            >
              <span className="icon">{cfg.icon}</span>
              <span className="min-w-0 flex-1">
                <b>{n.actor.name} {cfg.verb}</b>
                <small className="truncate">{n.log.name ?? n.log.meal_type} · {relativeTime(n.createdAt)}</small>
              </span>
              <Avatar name={n.actor.name} photoUrl={n.actor.photo_url} size="sm" />
            </button>
          )
        })}
      </div>
    </div>
  )
}
