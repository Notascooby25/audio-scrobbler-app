import sys

with open('frontend/src/pages/SettingsPage.jsx', 'r') as f:
    content = f.read()

# Add states for notifications
state_injections = """  const [notifications, setNotifications] = useState([])
  const [notificationsLoading, setNotificationsLoading] = useState(false)"""

if "const [notifications, setNotifications]" not in content:
    content = content.replace("const saveTimer = useRef(null)", state_injections + "\n  const saveTimer = useRef(null)")

# Add fetch effect
effect_injection = """  useEffect(() => {
    if (activeTab === 'notifications' && session?.accessToken) {
      setNotificationsLoading(true)
      import('../api').then(({ fetchNotifications, markNotificationsRead }) => {
        fetchNotifications({ token: session.accessToken })
          .then(data => {
            setNotifications(data)
            setNotificationsLoading(false)
            // Mark them as read if there are unread ones
            if (data.some(n => !n.is_read)) {
              markNotificationsRead({ token: session.accessToken })
            }
          })
          .catch(e => {
            console.error(e)
            setNotificationsLoading(false)
          })
      })
    }
  }, [activeTab, session?.accessToken])"""

if "activeTab === 'notifications' && session?.accessToken" not in content:
    content = content.replace("useEffect(() => {\n    if (!session?.accessToken) return\n    setStatus('loading')", effect_injection + "\n\n  useEffect(() => {\n    if (!session?.accessToken) return\n    setStatus('loading')")

# Add UI to the tab
ui_injection = """          <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>Recent Alerts</h3>
          <div style={{ marginBottom: '2rem', paddingBottom: '1.5rem', borderBottom: '0.5px solid var(--color-border)' }}>
            {notificationsLoading && <p className="panel-meta">Loading notifications...</p>}
            {!notificationsLoading && notifications.length === 0 && <p className="panel-meta">No recent notifications.</p>}
            {!notificationsLoading && notifications.length > 0 && (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {notifications.map(n => (
                  <li key={n.id} style={{ padding: '0.75rem', backgroundColor: n.is_read ? 'transparent' : 'var(--color-surface)', borderRadius: '4px', marginBottom: '0.5rem' }}>
                    <div style={{ fontWeight: 'bold' }}>{n.title}</div>
                    <div style={{ fontSize: '0.9rem', marginTop: '0.25rem' }}>{n.message}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--color-meta)', marginTop: '0.25rem' }}>{new Date(n.created_at).toLocaleString()}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
"""

target = "<h3 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>Notification Preferences</h3>"
if ui_injection not in content:
    content = content.replace(target, ui_injection + "\n          " + target)

with open('frontend/src/pages/SettingsPage.jsx', 'w') as f:
    f.write(content)

print("Injected UI logic successfully")
