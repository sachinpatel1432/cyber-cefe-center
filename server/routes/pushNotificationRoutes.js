import { Router } from "express";

import {
  requireAuth,
} from "../middleware/authMiddleware.js";

import {
  getPushPublicKey,
  savePushSubscription,
  removePushSubscription,
} from "../controllers/pushSubscriptionController.js";

const router = Router();

// Public key is not secret, so this endpoint can be public.
router.get(
  "/public-key",
  getPushPublicKey
);

// All subscription management must be authenticated.
router.use(requireAuth);

router.post(
  "/subscribe",
  savePushSubscription
);

router.delete(
  "/subscribe",
  removePushSubscription
);

export default router;