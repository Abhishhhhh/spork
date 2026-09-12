import { Outlet, useLocation } from 'react-router-dom'
import { BottomTabBar } from '../../components/BottomTabBar'

export function HomeShell() {
  const { pathname } = useLocation()
  return (
    <div className="pb-20">
      {/* key forces remount on route change, triggering page-enter animation */}
      <div key={pathname} className="page-enter">
        <Outlet />
      </div>
      <BottomTabBar />
    </div>
  )
}
