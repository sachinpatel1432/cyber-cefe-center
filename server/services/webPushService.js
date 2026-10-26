import webpush from "web-push";
import PushSubscription from "../models/PushSubscription.js";

let configuredSignature = "";

/**
 * Configure Web Push with server-side VAPID credentials.
 */
function configureWebPush() {
  const publicKey =
    process.env.WEB_PUSH_PUBLIC_KEY?.trim() || "";

  const privateKey =
    process.env.WEB_PUSH_PRIVATE_KEY?.trim() || "";

  const subject =
    process.env.WEB_PUSH_SUBJECT?.trim() || "";

  if (!publicKey || !privateKey || !subject) {
    console.error(
      "Web Push configuration failed: VAPID environment variables are missing."
    );

    return false;
  }

  const signature =
    `${publicKey}:${privateKey}:${subject}`;

  if (signature !== configuredSignature) {
    try {
      webpush.setVapidDetails(
        subject,
        publicKey,
        privateKey
      );

      configuredSignature = signature;
    } catch (error) {
      console.error(
        "Web Push configuration failed:",
        error.message
      );

      return false;
    }
  }

  return true;
}

/**
 * Return the public VAPID key to the frontend.
 * Never expose the private key.
 */
export function getWebPushPublicKey() {
  return process.env.WEB_PUSH_PUBLIC_KEY?.trim() || "";
}

/**
 * Normalize a user ID.
 */
function normalizeId(value) {
  if (!value) return "";

  if (typeof value === "object") {
    return String(value._id || value.id || "");
  }

  return String(value);
}

/**
 * Send a notification to every registered browser
 * belonging to a particular user.
 */
export async function sendPushToUser(userId, payload) {
  if (!configureWebPush() || !userId) {
    return {
      sent: 0,
      attempted: 0,
      failed: 0,
      skipped: true,
    };
  }

  const subscriptions = await PushSubscription.find({
    user: userId,
  })
    .select("_id endpoint keys")
    .lean();

  if (subscriptions.length === 0) {
    return {
      sent: 0,
      attempted: 0,
      failed: 0,
    };
  }

  let sent = 0;

  const results = await Promise.allSettled(
    subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: subscription.keys,
          },
          JSON.stringify(payload),
          {
            TTL: 60 * 60,
            urgency: "high",
          }
        );

        sent += 1;
      } catch (error) {
        /*
         * Log the actual push-service error.
         * Do not log private VAPID keys or subscription endpoints.
         */
        console.error("Push delivery failed:", {
          statusCode: error?.statusCode,
          body: error?.body,
          message: error?.message,
        });

        /*
         * A 404 or 410 means the subscription is no longer valid.
         * Remove only permanently invalid subscriptions.
         */
        if (
          error?.statusCode === 404 ||
          error?.statusCode === 410
        ) {
          await PushSubscription.deleteOne({
            _id: subscription._id,
          });
        }

        throw error;
      }
    })
  );

  const failed = results.filter(
    (result) => result.status === "rejected"
  ).length;

  return {
    sent,
    attempted: results.length,
    failed,
  };
}

/**
 * Notify the other participants when a chat message
 * is successfully saved.
 *
 * The notification contains a short message preview.
 */
export async function notifyRequestConversationParticipants({
  request,
  sender,
  message,
}) {
  if (!request?._id || !sender?._id || !sender?.role) {
    return {
      sent: 0,
      failed: 0,
    };
  }

  const senderId = normalizeId(sender._id);
  const customerId = normalizeId(request.customer);
  const staffId = normalizeId(request.staff);

  const recipients = new Set();

  // Customer sends a message -> notify assigned staff.
  if (sender.role === "customer" && staffId) {
    recipients.add(staffId);
  }

  // Staff sends a message -> notify the customer.
  if (sender.role === "staff" && customerId) {
    recipients.add(customerId);
  }

  // Admin messages -> notify the request participants.
  if (sender.role === "admin") {
    if (customerId) recipients.add(customerId);
    if (staffId) recipients.add(staffId);
  }

  // Do not notify the sender about their own message.
  recipients.delete(senderId);

  if (recipients.size === 0) {
    return {
      sent: 0,
      failed: 0,
    };
  }

  const senderName =
    sender.fullName ||
    sender.name ||
    sender.email ||
    "A participant";

  const requestLabel =
    request.requestNumber || String(request._id);

  /*
   * Collapse excessive whitespace and keep the preview short.
   * Message previews can appear on a device lock screen.
   */
  const cleanMessage = String(message || "")
    .replace(/\s+/g, " ")
    .trim();

  const messagePreview =
    cleanMessage.length > 180
      ? `${cleanMessage.slice(0, 177)}...`
      : cleanMessage;

  const payload = {
    title: `New message from ${senderName}`,

    body: messagePreview
      ? `${requestLabel}: ${messagePreview}`
      : `You have a new message about request ${requestLabel}.`,

    url: `/requests/${encodeURIComponent(
      String(request._id)
    )}/workspace`,

    tag: `cyberdesk-request-${String(request._id)}`,

    data: {
      requestId: String(request._id),
    },
  };

  const results = await Promise.allSettled(
    [...recipients].map((userId) =>
      sendPushToUser(userId, payload)
    )
  );

  const sent = results.reduce((count, result) => {
    if (result.status !== "fulfilled") {
      return count;
    }

    return count + (result.value?.sent || 0);
  }, 0);

  const failed = results.reduce((count, result) => {
    if (result.status === "rejected") {
      return count + 1;
    }

    return count + (result.value?.failed || 0);
  }, 0);

  return {
    sent,
    failed,
  };
}