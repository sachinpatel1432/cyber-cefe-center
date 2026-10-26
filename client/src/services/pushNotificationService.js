import api from "./api";

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat(
    (4 - (base64String.length % 4)) % 4
  );

  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const rawData = window.atob(base64);

  const output = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; i += 1) {
    output[i] = rawData.charCodeAt(i);
  }

  return output;
}

function keysMatch(currentKey, expectedKey) {
  if (!currentKey || !expectedKey) return false;

  const current = new Uint8Array(currentKey);
  const expected = new Uint8Array(expectedKey);

  if (current.length !== expected.length) return false;

  return current.every(
    (byte, index) => byte === expected[index]
  );
}

function ensureBrowserSupport() {
  if (
    !("serviceWorker" in navigator) ||
    !("PushManager" in window) ||
    !("Notification" in window)
  ) {
    throw new Error(
      "This browser does not support push notifications."
    );
  }

  if (!window.isSecureContext) {
    throw new Error(
      "Push notifications require HTTPS or localhost."
    );
  }
}

export async function getPushNotificationStatus() {
  if (
    !("serviceWorker" in navigator) ||
    !("PushManager" in window) ||
    !("Notification" in window) ||
    !window.isSecureContext
  ) {
    return {
      supported: false,
      enabled: false,
      permission: "unsupported",
    };
  }

  const registration =
    await navigator.serviceWorker.getRegistration("/");

  const subscription = registration
    ? await registration.pushManager.getSubscription()
    : null;

  return {
    supported: true,
    enabled:
      Notification.permission === "granted" &&
      Boolean(subscription),
    permission: Notification.permission,
  };
}

export async function enablePushNotifications() {
  ensureBrowserSupport();

  const permission =
    Notification.permission === "granted"
      ? "granted"
      : await Notification.requestPermission();

  if (permission !== "granted") {
    throw new Error(
      "Browser notification permission was not granted."
    );
  }

  const registration =
    await navigator.serviceWorker.register("/sw.js", {
      scope: "/",
    });

  await navigator.serviceWorker.ready;

  const keyResponse = await api.get(
    "/notifications/public-key"
  );

  const publicKey = keyResponse?.data?.publicKey;

  if (!publicKey) {
    throw new Error(
      "Backend se VAPID public key nahi mili."
    );
  }

  const applicationServerKey =
    urlBase64ToUint8Array(publicKey);

  let subscription =
    await registration.pushManager.getSubscription();

  // If the existing subscription uses an old VAPID key,
  // remove it before creating a new subscription.
  if (
    subscription &&
    !keysMatch(
      subscription.options.applicationServerKey,
      applicationServerKey
    )
  ) {
    const oldEndpoint = subscription.endpoint;

    try {
      await api.delete("/notifications/subscribe", {
        data: {
          endpoint: oldEndpoint,
        },
      });
    } finally {
      await subscription.unsubscribe();
    }

    subscription = null;
  }

  if (!subscription) {
    subscription =
      await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });
  }

  await api.post("/notifications/subscribe", {
    subscription: subscription.toJSON(),
  });

  return subscription;
}

export async function disablePushNotifications() {
  ensureBrowserSupport();

  const registration =
    await navigator.serviceWorker.getRegistration("/");

  const subscription = registration
    ? await registration.pushManager.getSubscription()
    : null;

  if (!subscription) return;

  try {
    await api.delete("/notifications/subscribe", {
      data: {
        endpoint: subscription.endpoint,
      },
    });
  } finally {
    await subscription.unsubscribe();
  }
}