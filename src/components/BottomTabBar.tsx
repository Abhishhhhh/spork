import { NavLink } from 'react-router-dom'

const TABS = [
  { to: '/home/feed',     label: 'Home',     icon: 'M3 10 12 3l9 7M5 9v12h5v-7h4v7h5V9', isLog: false },
  { to: '/home/insights', label: 'Insights', icon: 'M4 20h16M6 16v-5M11 16V7M16 16v-3M21 16V4', isLog: false },
  { to: '/home/log',      label: 'Log',      icon: 'M12 5v14M5 12h14',                    isLog: true  },
  { to: '/home/friends',  label: 'Friends',  icon: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75', isLog: false },
  { to: '/home/profile',  label: 'Profile',  icon: 'M20 21v-2a8 8 0 0 0-16 0v2M16 6a4 4 0 1 1-8 0 4 4 0 0 1 8 0', isLog: false },
]

/** Floating pill navigation — Home · Insights · (+) Log · Friends · Profile (Log always dead-centre) */
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
