import { NavLink } from 'react-router-dom'

const TABS = [
  { to: '/home/feed', label: 'Feed', icon: '📰' },
  { to: '/home/log', label: 'Log', icon: '➕' },
  { to: '/home/rewards', label: 'Streaks', icon: '🔥' },
  { to: '/home/profile', label: 'Profile', icon: '👤' },
]

export function BottomTabBar() {
  return (
    <nav className="fixed inset-x-0 bottom-0 mx-auto flex max-w-[430px] justify-around border-t border-neutral-200 bg-white py-2">
      {TABS.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          className={({ isActive }) =>
            `flex flex-col items-center gap-0.5 px-3 py-1 text-xs ${isActive ? 'text-orange-500' : 'text-neutral-400'}`
          }
        >
          <span className="text-xl">{tab.icon}</span>
          {tab.label}
        </NavLink>
      ))}
    </nav>
  )
}
