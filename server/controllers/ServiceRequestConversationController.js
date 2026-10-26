import mongoose from "mongoose";

import ServiceRequest from "../models/ServiceRequest.js";
import RequestMessage from "../models/RequestMessage.js";

import {
  notifyRequestConversationParticipants,
} from "../services/webPushService.js";

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

const DEFAULT_PAGE_SIZE = 30;
const MAX_PAGE_SIZE = 100;
const MAX_MESSAGE_LENGTH = 2000;

/**
 * Validate MongoDB IDs.
 */
const isValidId = (id) =>
  mongoose.isValidObjectId(id);

/**
 * Parse pagination input safely.
 */
const parsePositiveInteger = (
  value,
  fallback,
  maximum
) => {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    return fallback;
  }

  return Math.min(parsed, maximum);
};

/**
 * Verify request ownership and permissions.
 *
 * Customer: own requests only.
 * Staff: requests currently assigned to them.
 * Admin: administrative access.
 */
const canAccessRequest = (request, user) => {
  if (!request || !user?._id) {
    return false;
  }

  const userId = String(user._id);

  if (user.role === "admin") {
    return true;
  }

  if (user.role === "customer") {
    return String(request.customer) === userId;
  }

  if (user.role === "staff") {
    return (
      Boolean(request.staff) &&
      String(request.staff) === userId
    );
  }

  return false;
};

/**
 * Load the request and verify access before returning it.
 */
const getAccessibleRequest = async (
  requestId,
  user
) => {
  const request = await ServiceRequest.findById(requestId)
    .select(
      "_id customer staff status requestNumber statusHistory assignmentHistory createdAt updatedAt"
    )
    .lean();

  if (!canAccessRequest(request, user)) {
    return null;
  }

  return request;
};

/**
 * Return a safe display name for activity items.
 */
const getActorName = (actor) => {
  if (!actor) {
    return "System";
  }

  if (typeof actor === "string") {
    return "User";
  }

  return (
    actor.fullName ||
    actor.name ||
    actor.email ||
    "User"
  );
};

/*
|--------------------------------------------------------------------------
| GET REQUEST MESSAGES
|--------------------------------------------------------------------------
| GET /api/requests/:requestId/messages?page=1&limit=30
*/

export const getRequestMessages = asyncHandler(
  async (req, res) => {
    const { requestId } = req.params;

    if (!isValidId(requestId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid service request ID.",
      });
    }

    const request = await getAccessibleRequest(
      requestId,
      req.authUser
    );

    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Service request not found.",
      });
    }

    const page = parsePositiveInteger(
      req.query.page,
      1,
      1000000
    );

    const limit = parsePositiveInteger(
      req.query.limit,
      DEFAULT_PAGE_SIZE,
      MAX_PAGE_SIZE
    );

    const filter = {
      request: request._id,
    };

    const [
      latestFirst,
      total,
      unreadCount,
    ] = await Promise.all([
      RequestMessage.find(filter)
        .populate(
          "sender",
          "fullName name email role profileImage"
        )
        .sort({
          createdAt: -1,
          _id: -1,
        })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),

      RequestMessage.countDocuments(filter),

      RequestMessage.countDocuments({
        request: request._id,

        sender: {
          $ne: req.authUser._id,
        },

        readBy: {
          $ne: req.authUser._id,
        },
      }),
    ]);

    // Display the current page in chronological order.
    const messages = latestFirst.reverse();

    return res.status(200).json({
      success: true,
      messages,

      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },

      unreadCount,

      request: {
        _id: request._id,
        requestNumber: request.requestNumber,
        status: request.status,
      },
    });
  }
);

/*
|--------------------------------------------------------------------------
| SEND REQUEST MESSAGE
|--------------------------------------------------------------------------
| POST /api/requests/:requestId/messages
|
| Body:
| {
|   "message": "Please check my uploaded document."
| }
*/

export const sendRequestMessage = asyncHandler(
  async (req, res) => {
    const { requestId } = req.params;

    if (!isValidId(requestId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid service request ID.",
      });
    }

    if (
      typeof req.body?.message !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message: "Message is required.",
      });
    }

    const messageText = req.body.message.trim();

    if (!messageText) {
      return res.status(400).json({
        success: false,
        message: "Message cannot be empty.",
      });
    }

    if (messageText.length > MAX_MESSAGE_LENGTH) {
      return res.status(400).json({
        success: false,
        message: `Message cannot exceed ${MAX_MESSAGE_LENGTH} characters.`,
      });
    }

    const request = await getAccessibleRequest(
      requestId,
      req.authUser
    );

    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Service request not found.",
      });
    }

    const senderRole = req.authUser.role;

    if (
      !["customer", "staff", "admin"].includes(
        senderRole
      )
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Your account cannot send request messages.",
      });
    }

    /*
     * Save the message first.
     * If saving fails, no push notification will be sent.
     */
    const message = await RequestMessage.create({
      request: request._id,
      sender: req.authUser._id,
      senderRole,
      message: messageText,
      readBy: [req.authUser._id],
    });

    const populatedMessage =
      await RequestMessage.findById(message._id)
        .populate(
          "sender",
          "fullName name email role profileImage"
        );

    /*
     * Send push asynchronously.
     * Push failure must not undo the saved chat message.
     *
     * Pass messageText so the notification can show a preview.
     */
    void notifyRequestConversationParticipants({
      request,

      sender:
        populatedMessage?.sender || req.authUser,

      message: messageText,
    }).catch((error) => {
      console.error(
        "Chat push notification failed:",
        error?.message || error
      );
    });

    return res.status(201).json({
      success: true,
      message: "Message sent successfully.",

      data: {
        message: populatedMessage,
      },
    });
  }
);

/*
|--------------------------------------------------------------------------
| MARK REQUEST MESSAGES AS READ
|--------------------------------------------------------------------------
| PATCH /api/requests/:requestId/messages/read
*/

export const markRequestMessagesRead = asyncHandler(
  async (req, res) => {
    const { requestId } = req.params;

    if (!isValidId(requestId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid service request ID.",
      });
    }

    const request = await getAccessibleRequest(
      requestId,
      req.authUser
    );

    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Service request not found.",
      });
    }

    const result = await RequestMessage.updateMany(
      {
        request: request._id,

        sender: {
          $ne: req.authUser._id,
        },

        readBy: {
          $ne: req.authUser._id,
        },
      },
      {
        $addToSet: {
          readBy: req.authUser._id,
        },
      }
    );

    return res.status(200).json({
      success: true,
      message: "Messages marked as read.",
      modifiedCount: result.modifiedCount,
    });
  }
);

/*
|--------------------------------------------------------------------------
| GET REQUEST ACTIVITY TIMELINE
|--------------------------------------------------------------------------
| GET /api/requests/:requestId/activity
*/

export const getRequestActivity = asyncHandler(
  async (req, res) => {
    const { requestId } = req.params;

    if (!isValidId(requestId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid service request ID.",
      });
    }

    const request = await ServiceRequest.findById(
      requestId
    )
      .populate(
        "statusHistory.changedBy",
        "fullName name email role"
      )
      .populate(
        "assignmentHistory.staff",
        "fullName name email role"
      )
      .populate(
        "assignmentHistory.assignedBy",
        "fullName name email role"
      )
      .select(
        "_id customer staff requestNumber status createdAt statusHistory assignmentHistory"
      );

    if (!canAccessRequest(request, req.authUser)) {
      return res.status(404).json({
        success: false,
        message: "Service request not found.",
      });
    }

    const statusActivities = (
      request.statusHistory || []
    ).map((entry) => ({
      id: String(entry._id),

      type: "status_change",

      title: "Request status updated",

      fromStatus: entry.fromStatus || null,

      toStatus: entry.toStatus,

      description: entry.note || "",

      actor: getActorName(entry.changedBy),

      actorRole:
        entry.changedBy?.role || "system",

      timestamp: entry.changedAt || null,
    }));

    const assignmentActivities = (
      request.assignmentHistory || []
    ).map((entry) => ({
      id: String(entry._id),

      type: "staff_assignment",

      title:
        entry.assignmentType === "admin_reassignment"
          ? "Staff reassigned"
          : entry.assignmentType === "staff_claim"
            ? "Request claimed by staff"
            : "Staff assigned",

      description: entry.reason || "",

      actor: getActorName(entry.assignedBy),

      actorRole:
        entry.assignedBy?.role || "system",

      assignedStaff: getActorName(entry.staff),

      assignmentType: entry.assignmentType,

      timestamp: entry.assignedAt || null,

      endedAt: entry.endedAt || null,
    }));

    const activity = [
      ...statusActivities,
      ...assignmentActivities,
    ].sort((a, b) => {
      const first = a.timestamp
        ? new Date(a.timestamp).getTime()
        : 0;

      const second = b.timestamp
        ? new Date(b.timestamp).getTime()
        : 0;

      return first - second;
    });

    return res.status(200).json({
      success: true,

      request: {
        _id: request._id,
        requestNumber: request.requestNumber,
        status: request.status,
        createdAt: request.createdAt,
      },

      activity,
    });
  }
);