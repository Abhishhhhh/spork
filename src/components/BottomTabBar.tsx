import { NavLink } from 'react-router-dom'
import { useCurrentUser } from '../hooks/useCurrentUser'

/* Rounded line icons that turn solid on the active tab (Instagram / BeReal style). */
function HomeIcon({ on }: { on: boolean }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill={on ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round">
      <path d="M3.5 10.4 12 3.6l8.5 6.8V19a1.6 1.6 0 0 1-1.6 1.6h-4.1v-5.8H9.2v5.8H5.1A1.6 1.6 0 0 1 3.5 19z" />
    </svg>
  )
}
function InsightsIcon({ on }: { on: boolean }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill={on ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round">
      <rect x="3.5" y="12" width="4.4" height="8.5" rx="1.6" />
      <rect x="9.8" y="3.5" width="4.4" height="17" rx="1.6" />
      <rect x="16.1" y="8" width="4.4" height="12.5" rx="1.6" />
    </svg>
  )
}
function FriendsIcon({ on }: { on: boolean }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="16.6" cy="7.6" r="2.9" />
      <path d="M17.4 13.6c2.4.4 4.1 2.4 4.1 5.2v1.4h-2.9" />
      <g fill={on ? 'currentColor' : 'none'}>
        <circle cx="9" cy="8" r="3.6" />
        <path d="M2.5 20.2v-.9c0-3.3 2.8-5.6 6.5-5.6s6.5 2.3 6.5 5.6v.9z" />
      </g>
    </svg>
  )
}
function PlusIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

/** Your own photo (or initial) in a circle; ringed when Profile is the active tab. */
function ProfileIcon({ on }: { on: boolean }) {
  const { data: user } = useCurrentUser()
  return (
    <span className={`tab-avatar ${on ? 'on' : ''}`} aria-hidden="true">
      {user?.photo_url ? <img src={user.photo_url} alt="" /> : <b>{(user?.name || user?.username || '?').charAt(0).toUpperCase()}</b>}
    </span>
  )
}

const TABS = [
  { to: '/home/feed',     label: 'Home',     Icon: HomeIcon },
  { to: '/home/insights', label: 'Insights', Icon: InsightsIcon },
  { to: '/home/log',      label: 'Log',      Icon: null },
  { to: '/home/friends',  label: 'Friends',  Icon: FriendsIcon },
  { to: '/home/profile',  label: 'Profile',  Icon: ProfileIcon },
]

/** Floating pill navigation — Home · Insights · (+) Log · Friends · Profile (Log always dead-centre) */
export function BottomTabBar() {
  return (
    <nav aria-label="Main navigation" className="bottomnav">
      {TABS.map(({ to, label, Icon }) => (
        <NavLink key={to} to={to} end={!Icon} className={({ isActive }) => `no-press ${isActive ? 'active' : ''}`}>
          {({ isActive }) => (
            <>
              {Icon ? <Icon on={isActive} /> : <span className="plus"><PlusIcon /></span>}
              <span>{label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}
