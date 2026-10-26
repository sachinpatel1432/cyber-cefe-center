import PushSubscription from "../models/PushSubscription.js";

import {
  getWebPushPublicKey,
} from "../services/webPushService.js";

/**
 * Public VAPID key needed by the browser.
 * It is safe for the frontend to receive this key.
 */
export function getPushPublicKey(_req, res) {
  const publicKey = getWebPushPublicKey();

  if (!publicKey) {
    return res.status(503).json({
      success: false,
      message: "Web Push is not configured on the server.",
    });
  }

  return res.json({
    success: true,
    publicKey,
  });
}

/**
 * Save the authenticated user's browser subscription.
 */
export async function savePushSubscription(req, res, next) {
  try {
    const userId = req.authUser?._id;

    const subscription = req.body?.subscription;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Please sign in first.",
      });
    }

    if (
      !subscription ||
      typeof subscription.endpoint !== "string" ||
      !subscription.endpoint.startsWith("https://") ||
      typeof subscription.keys?.p256dh !== "string" ||
      typeof subscription.keys?.auth !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message: "A valid browser push subscription is required.",
      });
    }

    await PushSubscription.findOneAndUpdate(
      {
        endpoint: subscription.endpoint,
      },
      {
        $set: {
          user: userId,

          endpoint: subscription.endpoint,

          expirationTime:
            subscription.expirationTime ?? null,

          keys: {
            p256dh: subscription.keys.p256dh,
            auth: subscription.keys.auth,
          },

          userAgent: String(
            req.get("user-agent") || ""
          ).slice(0, 500),
        },
      },
      {
        upsert: true,
        new: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      }
    );

    return res.status(201).json({
      success: true,
      message: "Push notifications enabled for this browser.",
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Remove one browser subscription when the user disables push.
 */
export async function removePushSubscription(req, res, next) {
  try {
    const userId = req.authUser?._id;

    const endpoint = req.body?.endpoint;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Please sign in first.",
      });
    }

    if (
      typeof endpoint !== "string" ||
      !endpoint.startsWith("https://")
    ) {
      return res.status(400).json({
        success: false,
        message: "A valid endpoint is required.",
      });
    }

    await PushSubscription.deleteOne({
      user: userId,
      endpoint,
    });

    return res.json({
      success: true,
      message: "Push subscription removed.",
    });
  } catch (error) {
    next(error);
  }
}