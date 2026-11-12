import { useEffect, useState } from "react";
import {
  fetchVapidPublicKey,
  sendTestNotification,
  subscribeToPushNotifications,
  unsubscribeFromPushNotifications,
} from "../../api";

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function pushSupported() {
  return (
    typeof navigator !== "undefined" &&
    "serviceWorker" in navigator &&
    typeof window !== "undefined" &&
    "PushManager" in window &&
    "Notification" in window
  );
}

const STATUS_TEXT = {
  checking: "Checking this device…",
  unsupported: "Not available on this device or browser.",
  blocked:
    "Blocked. Allow notifications for this app in your browser or phone settings, then reload.",
  off: "Not enabled on this device.",
  enabled: "Enabled on this device.",
};

export default function DevicePushSection({ token }) {
  const [state, setState] = useState("checking");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function check() {
      if (!pushSupported()) {
        if (!cancelled) setState("unsupported");
        return;
      }
      if (Notification.permission === "denied") {
        if (!cancelled) setState("blocked");
        return;
      }
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        const sub = reg ? await reg.pushManager.getSubscription() : null;
        if (!cancelled) setState(sub ? "enabled" : "off");
      } catch {
        if (!cancelled) setState("off");
      }
    }
    check();
    return () => {
      cancelled = true;
    };
  }, []);

  async function enable() {
    if (!pushSupported()) {
      setMessage("Push notifications are not supported by your browser.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "blocked" : "off");
        setMessage("Permission for notifications was not given.");
        return;
      }
      const vapidData = await fetchVapidPublicKey();
      const reg = await navigator.serviceWorker.ready;
      const existingSub = await reg.pushManager.getSubscription();
      if (existingSub) {
        // A stale subscription made with different keys makes Chrome throw a Push Service
        // Error, so drop it before subscribing again.
        await existingSub.unsubscribe();
      }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidData.vapid_public_key.trim()),
      });
      await subscribeToPushNotifications({ token, subscription: sub.toJSON() });
      setState("enabled");
      setMessage("Subscribed to push notifications successfully.");
    } catch (err) {
      setMessage(`Failed to subscribe: ${err.message}`);
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setMessage("");
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      if (sub) {
        const endpoint = sub.endpoint;
        await sub.unsubscribe();
        await unsubscribeFromPushNotifications({ token, endpoint });
      }
      setState("off");
      setMessage("Device notifications turned off for this device.");
    } catch (err) {
      setMessage(`Failed to turn off: ${err.message}`);
    } finally {
      setBusy(false);
    }
  }

  async function sendTest() {
    setMessage("");
    try {
      const res = await sendTestNotification({ token });
      if (res.status === "error") {
        setMessage(`Test notification failed: ${res.message}`);
        return;
      }
      setMessage(`Test notification sent to ${res.sent_to} registered device(s).`);
    } catch (err) {
      setMessage(`Failed to send test notification: ${err.message}`);
    }
  }

  return (
    <div
      style={{
        marginTop: "2rem",
        paddingTop: "1.5rem",
        borderTop: "0.5px solid var(--color-border)",
        maxWidth: "100%",
        boxSizing: "border-box",
      }}
    >
      <h3 style={{ fontSize: "1rem", marginBottom: "0.5rem" }}>Device Push Notifications</h3>
      <p className="notice" style={{ marginBottom: "0.5rem" }}>
        Receive alerts directly on your device even when the app is closed.
      </p>
      <p
        data-testid="push-status"
        data-state={state}
        style={{ marginBottom: "1rem", fontWeight: 600 }}
      >
        Status: {STATUS_TEXT[state]}
      </p>
      {state !== "enabled" && (
        <button
          type="button"
          className="secondary-button"
          disabled={busy || state === "checking" || state === "unsupported"}
          onClick={enable}
        >
          Enable Device Notifications
        </button>
      )}
      {state === "enabled" && (
        <button type="button" className="secondary-button" disabled={busy} onClick={disable}>
          Turn Off Device Notifications
        </button>
      )}
      <button
        type="button"
        className="settings-button"
        style={{
          marginLeft: "1rem",
          background: "var(--color-surface)",
          color: "var(--color-ink)",
        }}
        onClick={sendTest}
      >
        Send Test Notification
      </button>
      {message && (
        <p role="status" style={{ marginTop: "1rem" }}>
          {message}
        </p>
      )}
      <div
        style={{
          marginTop: "1rem",
          padding: "1rem",
          backgroundColor: "var(--color-surface)",
          borderRadius: "8px",
          fontSize: "0.9rem",
        }}
      >
        <p style={{ fontWeight: "bold", marginBottom: "0.5rem" }}>Setup Instructions:</p>
        <ul style={{ paddingLeft: "1.2rem", margin: 0 }}>
          <li style={{ marginBottom: "0.5rem" }}>
            <strong>iOS:</strong> You must first add this app to your Home Screen (Share → Add to
            Home Screen). Open it from your home screen, then come back to this menu to enable
            notifications.
          </li>
          <li>
            <strong>Android/Desktop:</strong> Click 'Enable' and accept the browser permission
            prompt. If on mobile, install the app via your browser menu for the best experience.
          </li>
        </ul>
      </div>
    </div>
  );
}
