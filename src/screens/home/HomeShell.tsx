import { Outlet } from 'react-router-dom'
import { BottomTabBar } from '../../components/BottomTabBar'

export function HomeShell() {
  return (
    <div className="pb-20">
      <Outlet />
      <BottomTabBar />
    </div>
  )
}
