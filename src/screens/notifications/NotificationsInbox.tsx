import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMarkNotificationsRead, useNotifications, type NotificationItem } from '../../hooks/useNotifications'

const TYPE_TEXT: Record<NotificationItem['type'], string> = {
  like: 'liked your',
  comment: 'commented on your',
  reply: 'replied on your',
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
    // Deliberately runs once per mount only — re-running on every
    // notifications refetch would be wrong (it would re-mark as read
    // forever, which is harmless but pointless network chatter).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (isLoading) {
    return (
      <div className="flex min-h-[calc(100vh-5rem)] items-center justify-center">
        <p className="text-muted">Loading…</p>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex min-h-[calc(100vh-5rem)] items-center justify-center px-6 text-center">
        <p className="text-muted">Something went wrong loading your notifications.</p>
      </div>
    )
  }

  return (
    <div className="flex min-h-[calc(100vh-5rem)] flex-col px-6 py-8">
      <button
        onClick={() => navigate(-1)}
        aria-label="Back"
        className="mb-6 flex h-9 w-9 items-center justify-center rounded-full border border-border text-primary"
      >
        ←
      </button>

      <h1 className="mb-6 text-2xl font-bold text-primary">Notifications</h1>

      {!notifications || notifications.length === 0 ? (
        <p className="text-sm text-muted">No notifications yet.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {notifications.map((n) => (
            <li key={n.id}>
              <button
                onClick={() => navigate(`/home/log/${n.logId}`)}
                className={`flex w-full items-center gap-3 rounded-2xl border border-border p-3 text-left ${
                  n.readAt ? '' : 'bg-border/30'
                }`}
              >
                {n.actor.photo_url ? (
                  <img src={n.actor.photo_url} alt={n.actor.name} className="h-9 w-9 rounded-full object-cover" />
                ) : (
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-border/60 text-sm text-muted">
                    {n.actor.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <p className="text-sm text-primary">
                  <span className="font-semibold">@{n.actor.username}</span> {TYPE_TEXT[n.type]}{' '}
                  {n.log.name ?? n.log.meal_type}
                </p>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
