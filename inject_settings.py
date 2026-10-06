import sys
import re

with open('frontend/src/pages/SettingsPage.jsx', 'r') as f:
    content = f.read()

notifications_section = """      {activeTab === 'notifications' && settings && (
        <section
          className="settings-form"
          role="tabpanel"
          id="settings-panel-notifications"
          aria-labelledby="settings-tab-notifications"
        >
          <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>Notification Preferences</h3>
          <label className="settings-checkbox">
            <input type="checkbox" checked={settings.notify_recaps} onChange={(event) => changeSetting('notify_recaps', event.target.checked)} />
            Recaps & Insights (Weekly/Monthly summaries)
          </label>
          
          {settings.notify_recaps && (
            <label style={{ marginLeft: '1.5rem', marginBottom: '1rem', display: 'block' }}>
              Recap Frequency
              <select value={settings.recap_frequency} onChange={(event) => changeSetting('recap_frequency', event.target.value)}>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </label>
          )}

          <label className="settings-checkbox">
            <input type="checkbox" checked={settings.notify_milestones} onChange={(event) => changeSetting('notify_milestones', event.target.checked)} />
            Personal Milestones & Streaks
          </label>
          <label className="settings-checkbox">
            <input type="checkbox" checked={settings.notify_system} onChange={(event) => changeSetting('notify_system', event.target.checked)} />
            System & Health Alerts
          </label>

          <div style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '0.5px solid var(--color-border)', maxWidth: '100%', boxSizing: 'border-box' }}>
            <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>Device Push Notifications</h3>
            <p className="notice" style={{ marginBottom: '1rem' }}>
              Receive alerts directly on your device even when the app is closed.
            </p>
            <button type="button" className="secondary-button" onClick={() => {
              if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
                alert('Push notifications are not supported by your browser.');
                return;
              }
              Notification.requestPermission().then(permission => {
                if (permission === 'granted') {
                  navigator.serviceWorker.ready.then(reg => {
                    reg.pushManager.subscribe({
                      userVisibleOnly: true,
                      // TODO: Add VAPID public key
                      applicationServerKey: 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuB3IQ41jT-w8J5Q3nI8sQo3bQ'
                    }).then(sub => {
                      subscribeToPushNotifications({ token: session.accessToken, subscription: sub.toJSON() })
                        .then(() => alert('Subscribed to push notifications successfully!'))
                        .catch(e => alert('Failed to subscribe on server: ' + e));
                    }).catch(e => alert('Failed to subscribe: ' + e));
                  });
                } else {
                  alert('Permission for notifications was denied.');
                }
              });
            }}>
              Enable Device Notifications
            </button>
            <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: 'var(--color-surface)', borderRadius: '8px', fontSize: '0.9rem' }}>
              <p style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>Setup Instructions:</p>
              <ul style={{ paddingLeft: '1.2rem', margin: 0 }}>
                <li style={{ marginBottom: '0.5rem' }}><strong>iOS:</strong> You must first add this app to your Home Screen (Share → Add to Home Screen). Open it from your home screen, then come back to this menu to enable notifications.</li>
                <li><strong>Android/Desktop:</strong> Click 'Enable' and accept the browser permission prompt. If on mobile, install the app via your browser menu for the best experience.</li>
              </ul>
            </div>
          </div>
        </section>
      )}
"""

target = "{activeTab === 'danger' && session?.accessToken && ("
if target in content:
    content = content.replace(target, notifications_section + target)
    with open('frontend/src/pages/SettingsPage.jsx', 'w') as f:
        f.write(content)
    print("Injected successfully")
else:
    print("Could not find target")
