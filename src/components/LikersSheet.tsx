import { useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useFriendUsernames } from '../hooks/useFriendUsernames'
import { Avatar } from './Avatar'

interface Liker { id: string; name: string; username: string; photo_url: string | null }

/**
 * Everyone who liked a post, Instagram-style: you first, then your friends,
 * then everyone else — newest likes first within each group. RLS on
 * log_likes already limits this to posts the viewer can see.
 */
function useLikers(logId: string, viewerId: string | undefined, friendIds: Set<string>) {
  return useQuery({
    queryKey: ['likers', logId],
    queryFn: async (): Promise<Liker[]> => {
      const { data: likes, error } = await supabase
        .from('log_likes').select('user_id, created_at').eq('log_id', logId)
        .order('created_at', { ascending: false }).limit(500)
      if (error) throw error
      const ids = (likes ?? []).map((l) => l.user_id as string)
      if (ids.length === 0) return []
      const { data: users, error: usersError } = await supabase
        .from('users').select('id, name, username, photo_url').in('id', ids)
      if (usersError) throw usersError
      const byId = new Map((users ?? []).map((u) => [u.id, u as Liker]))
      return ids.map((id) => byId.get(id)).filter((u): u is Liker => !!u)
    },
    select: (likers) => {
      const rank = (u: Liker) => (u.id === viewerId ? 0 : friendIds.has(u.id) ? 1 : 2)
      return [...likers].sort((a, b) => rank(a) - rank(b))
    },
  })
}

export function LikersSheet({ logId, viewerId, onClose }: { logId: string; viewerId: string | undefined; onClose: () => void }) {
  const navigate = useNavigate()
  const friendUsernameById = useFriendUsernames()
  const friendIds = useMemo(() => new Set(friendUsernameById.keys()), [friendUsernameById])
  const { data: likers, isLoading, isError } = useLikers(logId, viewerId, friendIds)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  function openProfile(u: Liker) {
    onClose()
    navigate(u.id === viewerId ? '/home/profile' : `/home/friend/${u.username}`)
  }

  // Portal to <body> so an animated (transformed) ancestor can't trap the fixed overlay
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-end bg-black/70 animate-fade-in"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-[430px] rounded-t-[36px] bg-canvas px-5 pb-8 pt-4 animate-slide-up" role="dialog" aria-label="Likes">
        <div className="topbar" style={{ marginBottom: 10 }}>
          <span style={{ width: 42 }} />
          <span className="clay">Likes{likers?.length ? ` · ${likers.length}` : ''}</span>
          <button type="button" onClick={onClose} className="circle" aria-label="Close">✕</button>
        </div>

        <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
          {isLoading && <p className="small muted text-center" style={{ padding: 24 }}>Loading…</p>}
          {isError && <p className="error-text text-center" style={{ padding: 24 }}>Couldn’t load likes — try again.</p>}
          {likers?.length === 0 && <p className="small muted text-center" style={{ padding: 24 }}>No likes yet</p>}
          {likers?.map((u) => (
            <button key={u.id} type="button" onClick={() => openProfile(u)} className="no-press flex w-full items-center gap-3 text-left" style={{ padding: '9px 2px' }}>
              <Avatar name={u.name} photoUrl={u.photo_url} />
              <span className="min-w-0 flex-1">
                <b className="block truncate font-semibold">{u.name}</b>
                <small className="muted block truncate">@{u.username}</small>
              </span>
              {u.id === viewerId
                ? <span className="pill">You</span>
                : friendIds.has(u.id) && <span className="pill tint">Friend</span>}
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  )
}
