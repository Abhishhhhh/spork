import { NavLink } from 'react-router-dom'

const TABS = [
  { to: '/home/feed',    label: 'Home',    icon: 'M3 10 12 3l9 7M5 9v12h5v-7h4v7h5V9', isLog: false },
  { to: '/home/log',     label: 'Log',     icon: 'M12 5v14M5 12h14',                    isLog: true  },
  { to: '/home/profile', label: 'Profile', icon: 'M20 21v-2a8 8 0 0 0-16 0v2M16 6a4 4 0 1 1-8 0 4 4 0 0 1 8 0', isLog: false },
]

/** Floating pill navigation — Home · (+) Log · Profile */
export function BottomTabBar() {
  return (
    <nav aria-label="Main navigation" className="bottomnav">
      {TABS.map(tab => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.isLog}
          className={({ isActive }) => `no-press ${isActive ? 'active' : ''}`}
        >
          {tab.isLog ? (
            <span className="plus">
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d={tab.icon} />
              </svg>
            </span>
          ) : (
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d={tab.icon} />
            </svg>
          )}
          <span>{tab.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
