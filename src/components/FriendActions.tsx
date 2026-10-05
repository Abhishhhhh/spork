import { useEffect, useRef, useState } from 'react'
import {
  relationshipWith,
  useAcceptFriendRequest,
  useDeclineFriendRequest,
  useFriendships,
  useRemoveFriendship,
  useSendFriendRequest,
} from '../hooks/useFriendships'
import { useBlockUser, useBlocks, useUnblockUser } from '../hooks/useBlocks'
import { Avatar } from './Avatar'
import { useToast } from './Toast'

interface Person { id: string; username: string }

/** Follow / Requested / Friends / Accept buttons on someone's profile. */
export function FriendActions({ user }: { user: Person }) {
  const { data } = useFriendships()
  const send = useSendFriendRequest()
  const accept = useAcceptFriendRequest()
  const decline = useDeclineFriendRequest()
  const remove = useRemoveFriendship()
  const { toast } = useToast()
  const rel = relationshipWith(data, user.id)
  const busy = send.isPending || accept.isPending || decline.isPending || remove.isPending

  function unfollow() {
    if (!window.confirm(`Unfollow @${user.username}? You’ll stop seeing each other’s meals.`)) return
    remove.mutate(user.id, { onSuccess: () => toast(`Unfollowed @${user.username}`), onError: () => toast('Could not unfollow — try again', 'error') })
  }
  function unsend() {
    if (!window.confirm(`Unsend your request to @${user.username}?`)) return
    remove.mutate(user.id, { onSuccess: () => toast('Request unsent'), onError: () => toast('Could not unsend — try again', 'error') })
  }

  if (!data) return null
  return (
    <div className="action-row" style={{ marginTop: 14 }}>
      {rel.kind === 'friends' && <button type="button" className="btn light" style={{ marginTop: 0 }} disabled={busy} onClick={unfollow}>Friends ✓</button>}
      {rel.kind === 'requested' && <button type="button" className="btn light" style={{ marginTop: 0 }} disabled={busy} onClick={unsend}>Requested · Unsend</button>}
      {rel.kind === 'none' && (
        <button type="button" className="btn" style={{ marginTop: 0 }} disabled={busy}
          onClick={() => send.mutate(user.id, { onSuccess: () => toast(`Request sent to @${user.username} 👋`), onError: () => toast('Could not send request', 'error') })}>
          Follow
        </button>
      )}
      {rel.kind === 'incoming' && (
        <>
          <button type="button" className="btn light" style={{ marginTop: 0 }} disabled={busy}
            onClick={() => decline.mutate(rel.friendshipId, { onError: () => toast('Could not decline', 'error') })}>Decline</button>
          <button type="button" className="btn" style={{ marginTop: 0 }} disabled={busy}
            onClick={() => accept.mutate(rel.friendshipId, { onSuccess: () => toast(`You and @${user.username} are now friends 🎉`), onError: () => toast('Could not accept', 'error') })}>Accept</button>
        </>
      )}
    </div>
  )
}

/** ••• menu on someone's profile: Unfollow and Block / Unblock. */
export function ProfileMenu({ user, blocked, onBlocked }: { user: Person; blocked: boolean; onBlocked?: () => void }) {
  const { data } = useFriendships()
  const remove = useRemoveFriendship()
  const block = useBlockUser()
  const unblock = useUnblockUser()
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const isFriend = relationshipWith(data, user.id).kind === 'friends'

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  function handleUnfollow() {
    setOpen(false)
    if (!window.confirm(`Unfollow @${user.username}? You’ll stop seeing each other’s meals.`)) return
    remove.mutate(user.id, { onSuccess: () => toast(`Unfollowed @${user.username}`), onError: () => toast('Could not unfollow — try again', 'error') })
  }
  function handleBlock() {
    setOpen(false)
    if (!window.confirm(`Block @${user.username}?\n\nThey won’t be able to find you, see your meals or send you requests. You’ll stop being friends. They won’t be told.`)) return
    block.mutate(user.id, { onSuccess: () => { toast(`Blocked @${user.username}`); onBlocked?.() }, onError: () => toast('Could not block — try again', 'error') })
  }
  function handleUnblock() {
    setOpen(false)
    unblock.mutate(user.id, { onSuccess: () => toast(`Unblocked @${user.username}`), onError: () => toast('Could not unblock — try again', 'error') })
  }

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen((v) => !v)} className="circle" aria-label="More options" aria-expanded={open}>•••</button>
      {open && (
        <div className="absolute right-0 top-11 z-50 w-44 overflow-hidden rounded-[19px] bg-paper shadow-[0_8px_30px_#00000020] animate-slide-down">
          {isFriend && !blocked && (
            <button type="button" onClick={handleUnfollow} className="block w-full px-4 py-3 text-left text-[13px]">Unfollow</button>
          )}
          {blocked ? (
            <button type="button" onClick={handleUnblock} className="block w-full px-4 py-3 text-left text-[13px]">Unblock</button>
          ) : (
            <button type="button" onClick={handleBlock} className={`block w-full px-4 py-3 text-left text-[13px] text-error ${isFriend ? 'border-t border-line' : ''}`}>Block</button>
          )}
        </div>
      )}
    </div>
  )
}

/** Settings → Blocked accounts, with Unblock. */
export function BlockedAccounts() {
  const { data } = useBlocks()
  const unblock = useUnblockUser()
  const { toast } = useToast()
  if (!data) return null
  return (
    <div className="card" style={{ margin: 0 }}>
      <b className="block font-semibold">Blocked accounts</b>
      {data.blocked.length === 0 ? (
        <p className="small muted">You haven’t blocked anyone.</p>
      ) : (
        data.blocked.map((u) => (
          <div key={u.id} className="flex items-center gap-2.5" style={{ marginTop: 12 }}>
            <Avatar name={u.name} photoUrl={u.photo_url} />
            <span className="min-w-0 flex-1"><b className="block truncate">@{u.username}</b><small className="muted block truncate">{u.name}</small></span>
            <button type="button" className="pill tint" disabled={unblock.isPending}
              onClick={() => unblock.mutate(u.id, { onSuccess: () => toast(`Unblocked @${u.username}`), onError: () => toast('Could not unblock — try again', 'error') })}>
              Unblock
            </button>
          </div>
        ))
      )}
    </div>
  )
}
