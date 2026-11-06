import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout";
import FollowingPage from "./pages/FollowingPage";
import HomePage from "./pages/HomePage";
import LibraryPage from "./pages/LibraryPage";
import OverviewPage from "./pages/OverviewPage";
import ProfilePage from "./pages/ProfilePage";
import ReportsPage from "./pages/ReportsPage";
import SettingsPage from "./pages/SettingsPage";
import ChangelogPage from "./pages/ChangelogPage";
import SetlistsPage from "./components/setlists/SetlistsPage";
import SetlistGigPage from "./components/setlists/SetlistGigPage";
import { fetchUserSettings } from "./api";
import { readSession } from "./session";

export default function App() {
  const session = readSession();

  useEffect(() => {
    if (session?.accessToken) {
      fetchUserSettings({ token: session.accessToken })
        .then((settings) => {
          if (settings.theme) {
            localStorage.setItem("audio-scrobbler-theme", settings.theme);
            document.documentElement.setAttribute("data-theme", settings.theme);
          }
          if (settings.accent_color) {
            localStorage.setItem("audio-scrobbler-accent", settings.accent_color);
            document.documentElement.setAttribute("data-accent", settings.accent_color);
          }
        })
        .catch(() => {});
    }
  }, [session?.accessToken]);

  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route element={<Layout />}>
          <Route
            path="/"
            element={
              session?.accessToken ? (
                <Navigate to="/play" replace />
              ) : (
                <Navigate to="/connect" replace />
              )
            }
          />
          <Route path="/connect" element={<HomePage />} />
          <Route path="/play" element={<OverviewPage />} />
          <Route path="/overview" element={<Navigate to="/play" replace />} />
          <Route path="/library" element={<LibraryPage />} />
          <Route path="/gigs" element={<SetlistsPage />} />
          <Route path="/setlists" element={<Navigate to="/gigs" replace />} />
          {/* Not under /setlists/: that prefix is proxied to the API by nginx and Vite */}
          <Route path="/gigs/:concertId" element={<SetlistGigPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/profile/:userId" element={<ProfilePage />} />
          <Route path="/following" element={<FollowingPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/changelog" element={<ChangelogPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
