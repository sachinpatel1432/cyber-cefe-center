import mongoose from "mongoose";
import ServiceRequest from "../models/ServiceRequest.js";

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

const ALLOWED_STATUSES = [
  "pending",
  "approved",
  "documents_required",
  "in_progress",
  "ready_for_payment",
  "ready_for_download",
  "completed",
  "rejected",
  "cancelled",
  "delivered",
  "closed",
];

const STAFF_TRANSITIONS = {
  approved: ["in_progress", "rejected"],
  in_progress: ["completed"],
};

const MAX_PAGE_SIZE = 50;

const ACTIVE_UPLOAD_STATUSES = [
  "pending",
  "approved",
  "documents_required",
  "in_progress",
];

const parsePositiveInteger = (value, fallback, maximum) => {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    return fallback;
  }

  return Math.min(parsed, maximum);
};

const normalizeLabel = (value) =>
  typeof value === "string"
    ? value.trim().toLowerCase().replace(/[^a-z0-9]/g, "")
    : "";

const validateNotes = (notes) =>
  notes === undefined ||
  (typeof notes === "string" && notes.trim().length <= 1000);

/**
 * Serialize a ServiceRequest for staff responses.
 *
 * pricingSnapshot may be hidden by the model's toJSON transform.
 * Use toObject({ transform: false }) so we can read its earning,
 * then expose only the staff earning amount in rupees.
 *
 * Legacy requests without a saved snapshot return null. We never
 * calculate historical earnings using the current service price.
 */
const serializeStaffRequest = (request) => {
  if (!request) return request;

  const data =
    typeof request.toObject === "function"
      ? request.toObject({ transform: false })
      : { ...request };

  const snapshot = data.pricingSnapshot;
  const earningPaise = snapshot?.staffEarningPaise;

  data.staffEarningAmount =
    earningPaise !== null &&
    earningPaise !== undefined &&
    Number.isFinite(Number(earningPaise))
      ? Number(earningPaise) / 100
      : null;

  // Staff sees their own estimate, not the full pricing breakdown.
  delete data.pricingSnapshot;

  return data;
};

/**
 * Return outstanding required document names.
 *
 * A required initial document is satisfied only when staff accepts it.
 * A required additional document is satisfied when accepted or cancelled.
 */
const getMissingRequiredDocuments = (request) => {
  const requiredDocuments = request.requiredDocuments || [];
  const documents = request.documents || [];

  const missingInitialDocuments = requiredDocuments.filter(
    (requiredName) => {
      const requiredKey = normalizeLabel(requiredName);

      if (!requiredKey) {
        return false;
      }

      return !documents.some((document) => {
        if (document.reviewStatus !== "accepted") {
          return false;
        }

        return (
          normalizeLabel(document.documentType) === requiredKey ||
          normalizeLabel(document.title) === requiredKey
        );
      });
    }
  );

  const outstandingAdditionalDocuments = (
    request.additionalDocumentRequests || []
  )
    .filter(
      (documentRequest) =>
        documentRequest.isRequired &&
        !["accepted", "cancelled"].includes(documentRequest.status)
    )
    .map((documentRequest) => documentRequest.title);

  return [
    ...missingInitialDocuments,
    ...outstandingAdditionalDocuments,
  ];
};

/**
 * GET /api/staff/requests
 *
 * Staff can view:
 * 1. Unassigned pending requests.
 * 2. Requests assigned to their own account.
 *
 * A staff member cannot access another staff member's assigned requests.
 */
export const getStaffRequests = asyncHandler(async (req, res) => {
  const page = parsePositiveInteger(
    req.query.page,
    1,
    1000000
  );

  const limit = parsePositiveInteger(
    req.query.limit,
    20,
    MAX_PAGE_SIZE
  );

  const filters = [
    {
      $or: [
        {
          status: "pending",
          staff: null,
        },
        {
          staff: req.authUser._id,
        },
      ],
    },
  ];

  const status =
    typeof req.query.status === "string"
      ? req.query.status.trim()
      : "all";

  if (status !== "all") {
    if (!ALLOWED_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid request status filter.",
      });
    }

    filters.push({ status });
  }

  const filter = { $and: filters };

  const [requests, total] = await Promise.all([
    ServiceRequest.find(filter)
      .populate("customer", "fullName email phone")
      .populate("staff", "fullName email")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),

    ServiceRequest.countDocuments(filter),
  ]);

  return res.status(200).json({
    success: true,
    requests: requests.map(serializeStaffRequest),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
});

/**
 * POST /api/staff/requests/:id/claim
 *
 * Atomically claim a pending, unassigned request.
 * Only one staff member can successfully claim the same request.
 */
export const claimStaffRequest = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({
      success: false,
      message: "Invalid request ID.",
    });
  }

  const now = new Date();
  const staffId = req.authUser._id;

  const request = await ServiceRequest.findOneAndUpdate(
    {
      _id: req.params.id,
      status: "pending",
      staff: null,
    },
    {
      $set: {
        staff: staffId,
        status: "approved",
        acceptedAt: now,
      },

      $push: {
        assignmentHistory: {
          staff: staffId,
          assignedBy: staffId,
          assignmentType: "staff_claim",
          reason: "Claimed by staff.",
          assignedAt: now,
        },

        statusHistory: {
          fromStatus: "pending",
          toStatus: "approved",
          changedBy: staffId,
          note: "Request claimed by staff.",
          changedAt: now,
        },
      },
    },
    {
      new: true,
      runValidators: true,
    }
  )
    .populate("customer", "fullName email phone")
    .populate("staff", "fullName email");

  if (!request) {
    return res.status(409).json({
      success: false,
      code: "REQUEST_ALREADY_CLAIMED",
      message:
        "This request is no longer available. Another staff member may have claimed or been assigned it.",
    });
  }

  return res.status(200).json({
    success: true,
    message: "Request claimed successfully.",
    request: serializeStaffRequest(request),
  });
});

/**
 * POST /api/staff/requests/:id/additional-documents
 *
 * Request additional or corrected documents from the customer.
 * The existing request ID, staff assignment and price remain unchanged.
 */
export const requestAdditionalDocument = asyncHandler(
  async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid request ID.",
      });
    }

    const {
      title,
      reason,
      instructions = "",
      dueDate,
    } = req.body;

    if (
      typeof title !== "string" ||
      title.trim().length < 2 ||
      title.trim().length > 120
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Document title must be between 2 and 120 characters.",
      });
    }

    if (
      typeof reason !== "string" ||
      reason.trim().length < 3 ||
      reason.trim().length > 1000
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Please provide a reason for requesting the document.",
      });
    }

    if (
      typeof instructions !== "string" ||
      instructions.trim().length > 1000
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Instructions must be 1000 characters or fewer.",
      });
    }

    let parsedDueDate = null;

    if (
      dueDate !== undefined &&
      dueDate !== null &&
      dueDate !== ""
    ) {
      parsedDueDate = new Date(dueDate);

      if (Number.isNaN(parsedDueDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: "Invalid document due date.",
        });
      }
    }

    const request = await ServiceRequest.findOne({
      _id: req.params.id,
      staff: req.authUser._id,
      status: {
        $in: [
          "approved",
          "in_progress",
          "documents_required",
        ],
      },
    });

    if (!request) {
      return res.status(404).json({
        success: false,
        message:
          "Assigned request not found or it cannot accept additional document requests.",
      });
    }

    const existingOpenRequest =
      request.additionalDocumentRequests.find(
        (item) =>
          normalizeLabel(item.title) === normalizeLabel(title) &&
          item.isRequired &&
          ["requested", "uploaded"].includes(item.status)
      );

    if (existingOpenRequest) {
      return res.status(409).json({
        success: false,
        message:
          "An open request for this document already exists.",
      });
    }

    const oldStatus = request.status;
    const now = new Date();

    request.additionalDocumentRequests.push({
      title: title.trim(),
      reason: reason.trim(),
      instructions: instructions.trim(),
      isRequired: true,
      status: "requested",
      requestedBy: req.authUser._id,
      requestedAt: now,
      dueDate: parsedDueDate,
    });

    if (oldStatus !== "documents_required") {
      request.status = "documents_required";

      request.statusHistory.push({
        fromStatus: oldStatus,
        toStatus: "documents_required",
        changedBy: req.authUser._id,
        note: `Additional document requested: ${title.trim()}`,
        changedAt: now,
      });
    }

    await request.save();

    return res.status(201).json({
      success: true,
      message:
        "Additional document requested. The customer must upload it in the same request.",
      request: serializeStaffRequest(request),
    });
  }
);

/**
 * PATCH /api/staff/requests/:id/documents/:documentId/review
 *
 * Request body:
 * {
 *   "status": "accepted" | "rejected" | "changes_requested",
 *   "reviewNotes": "Optional review feedback"
 * }
 */
export const reviewCustomerDocument = asyncHandler(
  async (req, res) => {
    const { id, documentId } = req.params;

    const {
      status,
      reviewNotes = "",
    } = req.body;

    if (
      !mongoose.isValidObjectId(id) ||
      !mongoose.isValidObjectId(documentId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid request or document ID.",
      });
    }

    const supportedReviewStatuses = [
      "accepted",
      "rejected",
      "changes_requested",
    ];

    if (!supportedReviewStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid document review status.",
      });
    }

    if (!validateNotes(reviewNotes)) {
      return res.status(400).json({
        success: false,
        message:
          "Review notes must be 1000 characters or fewer.",
      });
    }

    const request = await ServiceRequest.findOne({
      _id: id,
      staff: req.authUser._id,
    });

    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Assigned request not found.",
      });
    }

    if (
      ![
        "approved",
        "documents_required",
        "in_progress",
      ].includes(request.status)
    ) {
      return res.status(409).json({
        success: false,
        message:
          "Documents cannot be reviewed in this request state.",
      });
    }

    const document = request.documents.id(documentId);

    if (!document) {
      return res.status(404).json({
        success: false,
        message: "Uploaded document not found.",
      });
    }

    if (document.reviewStatus !== "pending_review") {
      return res.status(409).json({
        success: false,
        message:
          "This document has already been reviewed. The customer must upload a new version for another review.",
      });
    }

    // An additional-document request must still be awaiting review.
    let additionalRequest = null;

    if (document.additionalDocumentRequestId) {
      additionalRequest =
        request.additionalDocumentRequests.id(
          document.additionalDocumentRequestId
        );

      if (
        !additionalRequest ||
        additionalRequest.status !== "uploaded"
      ) {
        return res.status(409).json({
          success: false,
          message:
            "The additional-document request is no longer awaiting review.",
        });
      }
    }

    const oldStatus = request.status;
    const now = new Date();
    const normalizedReviewNotes = reviewNotes.trim();

    document.reviewStatus = status;
    document.reviewedBy = req.authUser._id;
    document.reviewedAt = now;
    document.reviewNotes = normalizedReviewNotes;

    if (additionalRequest) {
      additionalRequest.latestDocument = document._id;
      additionalRequest.reviewedBy = req.authUser._id;
      additionalRequest.reviewedAt = now;
      additionalRequest.reviewNotes = normalizedReviewNotes;

      if (status === "accepted") {
        additionalRequest.status = "accepted";
        additionalRequest.respondedAt = now;
      } else if (status === "rejected") {
        additionalRequest.status = "rejected";
        additionalRequest.respondedAt = now;
      } else {
        // Keep the requirement open for a corrected upload.
        additionalRequest.status = "requested";
        additionalRequest.respondedAt = now;
      }
    }

    if (status !== "accepted") {
      if (oldStatus !== "documents_required") {
        request.status = "documents_required";

        request.statusHistory.push({
          fromStatus: oldStatus,
          toStatus: "documents_required",
          changedBy: req.authUser._id,
          note:
            `Document changes required: ${document.title}. ` +
            normalizedReviewNotes,
          changedAt: now,
        });
      }
    } else if (request.status === "documents_required") {
      const missingDocuments =
        getMissingRequiredDocuments(request);

      if (missingDocuments.length === 0) {
        request.status = "approved";

        request.statusHistory.push({
          fromStatus: "documents_required",
          toStatus: "approved",
          changedBy: req.authUser._id,
          note: "Required documents have been accepted.",
          changedAt: now,
        });
      }
    }

    await request.save();

    return res.status(200).json({
      success: true,
      message:
        status === "accepted"
          ? "Document accepted."
          : status === "rejected"
            ? "Document rejected."
            : "Correction requested. The customer can upload a corrected version.",
      request: serializeStaffRequest(request),
    });
  }
);

/**
 * PATCH /api/staff/requests/:id/status
 *
 * Only the currently assigned staff member can update work status.
 */
export const updateStaffRequestStatus = asyncHandler(
  async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid request ID.",
      });
    }

    const { status, staffNotes } = req.body;

    if (
      typeof status !== "string" ||
      !["in_progress", "completed", "rejected"].includes(status)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid status update.",
      });
    }

    if (!validateNotes(staffNotes)) {
      return res.status(400).json({
        success: false,
        message:
          "Staff notes must be 1000 characters or fewer.",
      });
    }

    const request = await ServiceRequest.findOne({
      _id: req.params.id,
      staff: req.authUser._id,
    });

    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Assigned request not found.",
      });
    }

    const oldStatus = request.status;

    const possibleNextStatuses =
      STAFF_TRANSITIONS[oldStatus] || [];

    if (!possibleNextStatuses.includes(status)) {
      return res.status(409).json({
        success: false,
        message:
          `Cannot change status from ${oldStatus} to ${status}.`,
      });
    }

    // All required initial and additional documents must be resolved.
    if (status === "in_progress" || status === "completed") {
      const missingDocuments =
        getMissingRequiredDocuments(request);

      if (missingDocuments.length > 0) {
        return res.status(409).json({
          success: false,
          code: "DOCUMENTS_NOT_READY",
          message:
            status === "in_progress"
              ? "Required documents must be uploaded and accepted before work starts."
              : "Outstanding required documents must be resolved before completion.",
          missingDocuments,
        });
      }
    }

    // Digital-delivery requests need at least one deliverable before completion.
    if (
      status === "completed" &&
      request.requiresDigitalDelivery &&
      (!request.deliverables ||
        request.deliverables.length === 0)
    ) {
      return res.status(409).json({
        success: false,
        code: "FINAL_DELIVERABLE_REQUIRED",
        message:
          "Upload the final PDF before completing this request.",
      });
    }

    const now = new Date();
    const updates = { status };

    if (staffNotes !== undefined) {
      updates.staffNotes = staffNotes.trim();
    }

    if (status === "in_progress") {
      updates.processingStartedAt = now;
    }

    if (status === "completed") {
      // Actual delivery and payment state are managed separately.
      updates.deliveredAt = null;
    }

    const updatedRequest =
      await ServiceRequest.findOneAndUpdate(
        {
          _id: request._id,
          staff: req.authUser._id,
          status: oldStatus,
        },
        {
          $set: updates,

          $push: {
            statusHistory: {
              fromStatus: oldStatus,
              toStatus: status,
              changedBy: req.authUser._id,
              note: staffNotes?.trim() || "",
              changedAt: now,
            },
          },
        },
        {
          new: true,
          runValidators: true,
        }
      )
        .populate("customer", "fullName email phone")
        .populate("staff", "fullName email");

    if (!updatedRequest) {
      return res.status(409).json({
        success: false,
        message:
          "Request status changed elsewhere. Refresh the queue and try again.",
      });
    }

    return res.status(200).json({
      success: true,
      message:
        `Request status updated to ${status.replaceAll("_", " ")}.`,
      request: serializeStaffRequest(updatedRequest),
    });
  }
);