import { useNavigate, useParams } from 'react-router-dom'
import { useConnections } from '../../hooks/useConnections'
import { useSession } from '../../hooks/useSession'
import { TopBar } from '../../components/TopBar'
import { Avatar } from '../../components/Avatar'
import { FriendRowSkeleton } from '../../components/Skeleton'

/**
 * The friend list behind the "friends" count on a profile. Friendships in
 * Spork are mutual, so there is one list rather than separate
 * followers/following.
 */
export default function Connections() {
  const { username } = useParams<{ username: string }>()
  const navigate = useNavigate()
  const { session } = useSession()
  const { data, isLoading } = useConnections(username)

  const isSelf = Boolean(session && data?.users && username)
  const back = isSelf ? '/home/profile' : `/home/friend/${username}`

  return (
    <div className="animate-fade-in">
      <TopBar title="Friends" back={back} />
      <p className="small muted">@{username}</p>

      {isLoading && <><FriendRowSkeleton /><FriendRowSkeleton /><FriendRowSkeleton /></>}

      {!isLoading && data && !data.visible && (
        <p className="small muted" style={{ marginTop: 16 }}>
          You can only see the friends of people you’re friends with.
        </p>
      )}

      {!isLoading && data?.visible && data.users.length === 0 && (
        <p className="small muted" style={{ marginTop: 16 }}>No friends yet</p>
      )}

      {!isLoading && data?.visible && data.users.length > 0 && (
        <ul className="list" style={{ marginTop: 14 }}>
          {data.users.map((u) => (
            <li key={u.id}>
              <button
                type="button"
                onClick={() => navigate(u.id === session?.user.id ? '/home/profile' : `/home/friend/${u.username}`)}
                className="choice w-full"
              >
                <Avatar name={u.name} photoUrl={u.photo_url} />
                <span className="min-w-0 flex-1">
                  <b className="block truncate">@{u.username}</b>
                  <small className="muted block truncate">{u.name}</small>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
