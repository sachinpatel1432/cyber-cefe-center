import { Router } from "express";

import {
  getRequestMessages,
  sendRequestMessage,
  markRequestMessagesRead,
  getRequestActivity,
} from "../controllers/ServiceRequestConversationController.js";

import {
  requireAuth,
  requireRole,
} from "../middleware/authMiddleware.js";

const router = Router();

/**
 * All conversation endpoints require authentication.
 */
router.use(requireAuth);

/**
 * Only customer, assigned staff and admin roles can use
 * request conversation endpoints.
 *
 * Individual request ownership/assignment is verified
 * inside the controller.
 */
router.use(requireRole("customer", "staff", "admin"));

/**
 * GET /api/requests/:requestId/messages
 * Retrieve messages for one service request.
 */
router.get(
  "/:requestId/messages",
  getRequestMessages
);

/**
 * POST /api/requests/:requestId/messages
 * Send a message.
 *
 * Request body:
 * {
 *   "message": "Please check my uploaded document."
 * }
 */
router.post(
  "/:requestId/messages",
  sendRequestMessage
);

/**
 * PATCH /api/requests/:requestId/messages/read
 * Mark incoming messages as read.
 */
router.patch(
  "/:requestId/messages/read",
  markRequestMessagesRead
);

/**
 * GET /api/requests/:requestId/activity
 * Retrieve request status and assignment history.
 */
router.get(
  "/:requestId/activity",
  getRequestActivity
);

export default router;