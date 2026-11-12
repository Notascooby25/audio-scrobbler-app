import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import DevicePushSection from "./DevicePushSection";

vi.mock("../../api", () => ({
  fetchVapidPublicKey: vi.fn(),
  sendTestNotification: vi.fn(),
  subscribeToPushNotifications: vi.fn(),
  unsubscribeFromPushNotifications: vi.fn(),
}));

import { sendTestNotification, unsubscribeFromPushNotifications } from "../../api";

function installPush({ permission = "default", subscription = null } = {}) {
  const pushManager = { getSubscription: vi.fn().mockResolvedValue(subscription) };
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: {
      getRegistration: vi.fn().mockResolvedValue({ pushManager }),
      ready: Promise.resolve({ pushManager }),
    },
  });
  window.PushManager = function PushManager() {};
  window.Notification = { permission, requestPermission: vi.fn() };
}

function uninstallPush() {
  delete navigator.serviceWorker;
  delete window.PushManager;
  delete window.Notification;
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => {
  cleanup();
  uninstallPush();
});

describe("DevicePushSection status", () => {
  it("says it is not available when the browser has no push support", async () => {
    render(<DevicePushSection token="t" />);
    await waitFor(() =>
      expect(screen.getByTestId("push-status")).toHaveAttribute("data-state", "unsupported")
    );
    expect(screen.getByRole("button", { name: "Enable Device Notifications" })).toBeDisabled();
  });

  it("says blocked when the permission was denied", async () => {
    installPush({ permission: "denied" });
    render(<DevicePushSection token="t" />);
    await waitFor(() =>
      expect(screen.getByTestId("push-status")).toHaveAttribute("data-state", "blocked")
    );
  });

  it("says not enabled when this device has no subscription", async () => {
    installPush({ permission: "granted" });
    render(<DevicePushSection token="t" />);
    await waitFor(() =>
      expect(screen.getByTestId("push-status")).toHaveAttribute("data-state", "off")
    );
    expect(screen.getByRole("button", { name: "Enable Device Notifications" })).toBeEnabled();
  });

  it("says enabled and offers Turn Off when this device is subscribed", async () => {
    installPush({
      permission: "granted",
      subscription: { endpoint: "https://fcm.googleapis.com/x", unsubscribe: vi.fn() },
    });
    render(<DevicePushSection token="t" />);
    await waitFor(() =>
      expect(screen.getByTestId("push-status")).toHaveAttribute("data-state", "enabled")
    );
    expect(screen.queryByRole("button", { name: "Enable Device Notifications" })).toBeNull();
    expect(
      screen.getByRole("button", { name: "Turn Off Device Notifications" })
    ).toBeInTheDocument();
  });
});

describe("DevicePushSection actions", () => {
  it("turns notifications off for this device and tells the server", async () => {
    const unsubscribe = vi.fn().mockResolvedValue(true);
    installPush({
      permission: "granted",
      subscription: { endpoint: "https://fcm.googleapis.com/x", unsubscribe },
    });
    unsubscribeFromPushNotifications.mockResolvedValue({ status: "unsubscribed" });
    render(<DevicePushSection token="tok" />);
    fireEvent.click(await screen.findByRole("button", { name: "Turn Off Device Notifications" }));

    await waitFor(() =>
      expect(screen.getByTestId("push-status")).toHaveAttribute("data-state", "off")
    );
    expect(unsubscribe).toHaveBeenCalled();
    expect(unsubscribeFromPushNotifications).toHaveBeenCalledWith({
      token: "tok",
      endpoint: "https://fcm.googleapis.com/x",
    });
  });

  it("shows the server's real reason when the test notification fails", async () => {
    installPush({ permission: "granted" });
    sendTestNotification.mockResolvedValue({
      status: "error",
      message: "VAPID keys not configured on server",
    });
    render(<DevicePushSection token="t" />);
    fireEvent.click(screen.getByRole("button", { name: "Send Test Notification" }));
    expect(await screen.findByRole("status")).toHaveTextContent(
      "VAPID keys not configured on server"
    );
  });
});
