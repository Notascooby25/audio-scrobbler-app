import { Outlet } from 'react-router-dom'
import HeaderNav from './HeaderNav'
import Footer from './Footer'

export default function Layout() {
  return (
    <main className="app-shell">
      <HeaderNav />
      <div className="app-content">
        <Outlet />
      </div>
      <Footer />
    </main>
  )
}
