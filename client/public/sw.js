/* CyberDesk Push Notification Service Worker */

self.addEventListener("push", (event) => {
  event.waitUntil(
    (async () => {
      let payload = {};

      try {
        payload = event.data ? event.data.json() : {};
      } catch {
        payload = {
          body: event.data?.text?.() || "You have a new message.",
        };
      }

      const title = payload.title || "New CyberDesk message";

      const options = {
        body: payload.body || "You have received a new message.",

        icon: "/favicon.ico",
        badge: "/favicon.ico",

        tag: payload.tag || "cyberdesk-notification",

        renotify: false,

        // URL must be passed to the notification itself.
        data: {
          url: payload.url || "/",
          requestId: payload.data?.requestId || null,
        },
      };

      await self.registration.showNotification(title, options);
    })()
  );
});


/*
 * Open the related request workspace when the notification
 * is clicked.
 */
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  event.waitUntil(
    (async () => {
      const requestedPath =
        event.notification?.data?.url || "/";

      let targetUrl;

      try {
        targetUrl = new URL(requestedPath, self.location.origin);

        // Never navigate to a URL outside CyberDesk.
        if (targetUrl.origin !== self.location.origin) {
          targetUrl = new URL("/", self.location.origin);
        }
      } catch {
        targetUrl = new URL("/", self.location.origin);
      }

      console.log(
        "[CyberDesk] Opening notification URL:",
        targetUrl.href
      );

      const windowClients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      // Reuse an existing CyberDesk tab when possible.
      for (const client of windowClients) {
        try {
          const clientOrigin = new URL(client.url).origin;

          if (clientOrigin !== self.location.origin) {
            continue;
          }

          if (typeof client.navigate === "function") {
            const navigatedClient = await client.navigate(
              targetUrl.href
            );

            if (navigatedClient) {
              await navigatedClient.focus();
              return;
            }
          }

          await client.focus();
          return;
        } catch (error) {
          console.warn(
            "[CyberDesk] Could not reuse existing tab:",
            error?.message || error
          );
        }
      }

      // No usable tab exists, so open a new one.
      const openedClient = await self.clients.openWindow(
        targetUrl.href
      );

      if (!openedClient) {
        console.warn(
          "[CyberDesk] Browser did not open a new window."
        );
      }
    })()
  );
});