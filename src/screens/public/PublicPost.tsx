// Public share page — spork.fit/p/<log id>. Opens without an account.
// Signed-in viewers who can already see the post (owner / friends) are sent
// straight to it inside the app instead.
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { fetchPublicPost, type PublicPost as Post } from '../../lib/shareLink'
import { relativeTime } from '../../lib/relativeTime'
import { useSession } from '../../hooks/useSession'
import { Avatar } from '../../components/Avatar'
import { PhotoViewer } from '../../components/PhotoViewer'
import { SporkWordmark } from '../../components/brand/SporkWordmark'

type State = { kind: 'loading' } | { kind: 'missing' } | { kind: 'ready'; post: Post }

export default function PublicPost() {
  const { logId = '' } = useParams<{ logId: string }>()
  const navigate = useNavigate()
  const { session, loading: sessionLoading } = useSession()
  const [state, setState] = useState<State>({ kind: 'loading' })
  const [zoom, setZoom] = useState(false)

  useEffect(() => {
    if (sessionLoading) return
    let cancelled = false
    ;(async () => {
      // Already allowed to see it in the app? Open it there.
      if (session) {
        const { data } = await supabase.from('logs').select('id').eq('id', logId).maybeSingle()
        if (cancelled) return
        if (data) { navigate(`/home/log/${logId}`, { replace: true }); return }
      }
      const post = await fetchPublicPost(logId)
      if (cancelled) return
      setState(post ? { kind: 'ready', post } : { kind: 'missing' })
    })()
    return () => { cancelled = true }
  }, [logId, session, sessionLoading, navigate])

  useEffect(() => {
    if (state.kind === 'ready') {
      document.title = `${state.post.name || 'A meal'} · @${state.post.author.username} on Spork`
      return () => { document.title = 'Spork' }
    }
  }, [state])

  const cta = session
    ? <button type="button" onClick={() => navigate('/home/feed')} className="btn">Open Spork</button>
    : <Link to="/welcome" className="btn no-press block text-center">Join Spork · it’s free</Link>

  return (
    <div className="screen min-h-screen animate-fade-in">
      <div className="flex justify-center" style={{ padding: '10px 0 18px' }}>
        <SporkWordmark size={28} />
      </div>

      {state.kind === 'loading' && <p className="muted text-center" style={{ padding: 60 }}>Loading…</p>}

      {state.kind === 'missing' && (
        <div className="card text-center" style={{ padding: 36 }}>
          <div style={{ fontSize: 40, lineHeight: 1 }}>◌</div>
          <h4 style={{ marginTop: 12 }}>This post isn’t available</h4>
          <p className="small muted" style={{ marginTop: 6 }}>It may have been made private or deleted.</p>
          {cta}
        </div>
      )}

      {state.kind === 'ready' && (() => {
        const { post } = state
        const mealType = post.meal_type.charAt(0).toUpperCase() + post.meal_type.slice(1)
        return (
          <>
            <div className="feed-card">
              <div className="flex items-center gap-2.5">
                <Avatar name={post.author.name} photoUrl={post.author.photo_url} />
                <span className="min-w-0 flex-1">
                  <b className="block truncate font-semibold">@{post.author.username}</b>
                  <small className="muted block">{relativeTime(post.created_at)} · {mealType}</small>
                </span>
              </div>

              {post.photo_url && (
                <img src={post.photo_url} alt={post.name ?? 'Meal photo'} className="photo natural"
                  style={{ marginTop: 13, cursor: 'zoom-in' }} onClick={() => setZoom(true)} />
              )}

              <h3 style={{ marginTop: 14 }}>{post.name || mealType}</h3>
              {post.caption && <p className="small muted">{post.caption}</p>}

              <div className="flex flex-wrap gap-1.5" style={{ marginTop: 10 }}>
                {post.calories != null && <span className="pill tint">{Number(post.calories).toLocaleString()} kcal</span>}
                {post.protein_g != null && <span className="pill tint">{post.protein_g}g protein</span>}
                {post.carbs_g != null && <span className="pill tint">{post.carbs_g}g carbs</span>}
                {post.fat_g != null && <span className="pill tint">{post.fat_g}g fat</span>}
              </div>
            </div>

            <p className="small muted text-center" style={{ margin: '18px 0 4px' }}>
              Track meals, build streaks and share with friends.
            </p>
            {cta}
            {zoom && post.photo_url && <PhotoViewer src={post.photo_url} alt={post.name ?? 'Meal photo'} onClose={() => setZoom(false)} />}
          </>
        )
      })()}
    </div>
  )
}
