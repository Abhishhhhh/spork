import { NavLink } from 'react-router-dom'

const SIDE_TABS = [
  { to: '/home/feed', label: 'Feed', icon: '🏠' },
  { to: '/home/rewards', label: 'Streaks', icon: '🔥' },
]

const RIGHT_TABS = [
  { to: '/home/friends', label: 'Friends', icon: '👥' },
  { to: '/home/profile', label: 'Profile', icon: '👤' },
]

export function BottomTabBar() {
  return (
    <nav className="fixed inset-x-0 bottom-0 mx-auto flex max-w-[430px] items-center justify-around border-t border-border bg-background py-2">
      {SIDE_TABS.map((tab) => (
        <TabLink key={tab.to} {...tab} />
      ))}

      <NavLink
        to="/home/log"
        aria-label="Log a meal"
        className="flex h-14 w-14 -translate-y-3 items-center justify-center rounded-full bg-primary text-2xl text-background shadow-lg"
      >
        +
      </NavLink>

      {RIGHT_TABS.map((tab) => (
        <TabLink key={tab.to} {...tab} />
      ))}
    </nav>
  )
}

function TabLink({ to, label, icon }: { to: string; label: string; icon: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex flex-col items-center gap-0.5 px-3 py-1 text-xs ${isActive ? 'text-primary' : 'text-muted'}`
      }
    >
      <span className="text-xl">{icon}</span>
      {label}
    </NavLink>
  )
}
