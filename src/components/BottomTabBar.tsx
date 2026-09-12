import { NavLink } from 'react-router-dom'

const TABS = [
  { to: '/home/feed',    label: 'Home',    icon: 'M3 10 12 3l9 7M5 9v12h5v-7h4v7h5V9', isLog: false },
  { to: '/home/log',     label: 'Log',     icon: 'M12 5v14M5 12h14',                    isLog: true  },
  { to: '/home/profile', label: 'Profile', icon: 'M20 21v-2a8 8 0 0 0-16 0v2M16 6a4 4 0 1 1-8 0 4 4 0 0 1 8 0', isLog: false },
]

export function BottomTabBar() {
  return (
    <nav
      aria-label="Main navigation"
      className="bottom-tabs fixed inset-x-0 bottom-0 z-40 mx-auto grid max-w-[430px] grid-cols-3 bg-background/95 backdrop-blur-sm border-t border-border/40"
    >
      {TABS.map(tab =>
        tab.isLog ? (
          /* ── Centre Log button ────────────────────────────────────
             Light/pink: filled primary pill (pink/black), white icon.
             Dark:       black pill with white border + white + icon.   */
          <NavLink
            key={tab.to}
            to={tab.to}
            end
            className="no-press flex min-h-14 flex-col items-center justify-center gap-1 text-xs"
          >
            {({ isActive }) => (
              <>
                {/* Outer ring — only in dark gives the white-border look */}
                <span className={`
                  flex h-11 w-11 items-center justify-center rounded-full transition-colors
                  bg-primary
                  border-2 border-background
                  shadow-[0_0_0_1.5px_var(--color-primary)]
                  ${isActive ? 'scale-105' : ''}
                `}>
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="var(--color-background)"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-5 w-5"
                  >
                    <path d={tab.icon} />
                  </svg>
                </span>
                <span className={`text-xs ${isActive ? 'font-semibold text-primary' : 'text-muted'}`}>
                  {tab.label}
                </span>
              </>
            )}
          </NavLink>
        ) : (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) =>
              `no-press flex min-h-14 flex-col items-center justify-center gap-1 px-1 py-2 text-xs ${isActive ? 'font-semibold text-primary' : 'text-muted'}`
            }
          >
            {() => (
              <>
                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                  <path d={tab.icon} />
                </svg>
                <span>{tab.label}</span>
              </>
            )}
          </NavLink>
        )
      )}
    </nav>
  )
}
