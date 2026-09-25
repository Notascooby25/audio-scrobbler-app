import { useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import FollowingPage from './pages/FollowingPage'
import HomePage from './pages/HomePage'
import LibraryPage from './pages/LibraryPage'
import OverviewPage from './pages/OverviewPage'
import ProfilePage from './pages/ProfilePage'
import ReportsPage from './pages/ReportsPage'
import SettingsPage from './pages/SettingsPage'
import { fetchUserSettings } from './api'
import { readSession } from './session'

export default function App() {
  useEffect(() => {
    const session = readSession()
    if (session?.accessToken) {
      fetchUserSettings({ token: session.accessToken })
        .then(settings => {
          if (settings.theme) {
            localStorage.setItem('audio-scrobbler-theme', settings.theme)
            document.documentElement.setAttribute('data-theme', settings.theme)
          }
        })
        .catch(() => {})
    }
  }, [])

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<OverviewPage />} />
          <Route path="/connect" element={<HomePage />} />
          <Route path="/overview" element={<OverviewPage />} />
          <Route path="/library" element={<LibraryPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/profile/:userId" element={<ProfilePage />} />
          <Route path="/following" element={<FollowingPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

