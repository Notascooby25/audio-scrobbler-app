import { Outlet } from 'react-router-dom'
import HeaderNav from './HeaderNav'

export default function Layout() {
  return (
    <main className="app-shell">
      <HeaderNav />
      <Outlet />
    </main>
  )
}
