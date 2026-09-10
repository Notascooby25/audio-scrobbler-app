import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import HomePage from './pages/HomePage'
import LibraryPage from './pages/LibraryPage'
import OverviewPage from './pages/OverviewPage'
import ProfilePage from './pages/ProfilePage'
import ReportsPage from './pages/ReportsPage'
import SettingsPage from './pages/SettingsPage'

export default function App() {
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
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

