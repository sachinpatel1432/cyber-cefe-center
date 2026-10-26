
import mongoose from "mongoose";
import ServiceRequest from "../models/ServiceRequest.js";
import User from "../models/User.js";

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

const VALID_STATUSES = [
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

const STATUS_TRANSITIONS = {
  pending: ["rejected", "cancelled"],

  approved: [
    "documents_required",
    "in_progress",
    "rejected",
    "cancelled",
  ],

  documents_required: [
    "approved",
    "rejected",
    "cancelled",
  ],

  in_progress: [
    "documents_required",
    "ready_for_payment",
    "ready_for_download",
    "completed",
    "rejected",
    "cancelled",
  ],

  // A verified payment handler, not a manual status edit, should
  // normally move a paid request to ready_for_download.
  ready_for_payment: [],

  ready_for_download: ["delivered", "closed"],
  completed: ["delivered", "closed"],
  delivered: ["closed"],

  rejected: [],
  cancelled: [],
  closed: [],
};

const FINAL_OUTPUT_STATUSES = [
  "ready_for_payment",
  "ready_for_download",
  "completed",
  "delivered",
  "closed",
];

const PAYMENT_GATED_STATUSES = [
  "ready_for_download",
  "completed",
  "delivered",
  "closed",
];

const MAX_PAGE_SIZE = 50;

const parsePositiveInteger = (value, fallback, maximum) => {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    return fallback;
  }

  return Math.min(parsed, maximum);
};

const escapeRegex = (value) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const normalizeLabel = (value) =>
  typeof value === "string"
    ? value.trim().toLowerCase().replace(/[^a-z0-9]/g, "")
    : "";

const getMissingRequiredDocuments = (request) => {
  const requiredDocuments = request.requiredDocuments || [];
  const uploadedDocuments = request.documents || [];

  const missingInitialDocuments = requiredDocuments.filter(
    (requiredName) => {
      const requiredKey = normalizeLabel(requiredName);

      if (!requiredKey) return false;

      return !uploadedDocuments.some((document) => {
        if (document.reviewStatus !== "accepted") return false;

        return (
          normalizeLabel(document.documentType) === requiredKey ||
          normalizeLabel(document.title) === requiredKey
        );
      });
    }
  );

  const missingAdditionalDocuments = (
    request.additionalDocumentRequests || []
  )
    .filter(
      (documentRequest) =>
        documentRequest.isRequired &&
        !["accepted", "cancelled"].includes(documentRequest.status)
    )
    .map((documentRequest) => documentRequest.title);

  return [
    ...new Set([
      ...missingInitialDocuments,
      ...missingAdditionalDocuments,
    ]),
  ];
};

const validateNotes = (notes) =>
  notes === undefined ||
  (typeof notes === "string" && notes.trim().length <= 1000);

/*
|--------------------------------------------------------------------------
| GET /api/admin/requests
|--------------------------------------------------------------------------
| Lists requests for authorized administrators with filtering,
| search and pagination.
*/

export const getAdminServiceRequests = asyncHandler(
  async (req, res) => {
    const page = parsePositiveInteger(req.query.page, 1, 1000000);
    const limit = parsePositiveInteger(
      req.query.limit,
      20,
      MAX_PAGE_SIZE
    );

    const filter = {};

    const status =
      typeof req.query.status === "string"
        ? req.query.status.trim()
        : "all";

    if (status !== "all") {
      if (!VALID_STATUSES.includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid request status filter.",
        });
      }

      filter.status = status;
    }

    const search =
      typeof req.query.search === "string"
        ? req.query.search.trim().slice(0, 100)
        : "";

    if (search) {
      const escaped = escapeRegex(search);

      filter.$or = [
        { requestNumber: { $regex: escaped, $options: "i" } },
        { serviceName: { $regex: escaped, $options: "i" } },
        { category: { $regex: escaped, $options: "i" } },
      ];
    }

    const [requests, total] = await Promise.all([
      ServiceRequest.find(filter)
        .populate("customer", "fullName email phone")
        .populate("staff", "fullName email")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),

      ServiceRequest.countDocuments(filter),
    ]);

    return res.json({
      success: true,
      requests,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  }
);

/*
|--------------------------------------------------------------------------
| GET /api/admin/assignable-staff
|--------------------------------------------------------------------------
| Only active, verified staff accounts can be assigned.
*/

export const getAssignableStaff = asyncHandler(
  async (_req, res) => {
    const staff = await User.find({
      role: "staff",
      accountStatus: "active",
      emailVerified: true,
    })
      .select("_id fullName email")
      .sort({ fullName: 1 })
      .lean();

    return res.json({
      success: true,
      staff,
    });
  }
);

/*
|--------------------------------------------------------------------------
| GET /api/admin/requests/:id
|--------------------------------------------------------------------------
| Returns one request and its document, assignment and status metadata.
| File storage identifiers remain excluded by the model's JSON transform.
*/

export const getAdminServiceRequestDetails = asyncHandler(
  async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid request ID.",
      });
    }

    const request = await ServiceRequest.findById(req.params.id)
      .populate("customer", "fullName email phone")
      .populate("staff", "fullName email")
      .populate("service", "name category price")
      .populate("documents.uploadedBy", "fullName email")
      .populate("documents.reviewedBy", "fullName email")
      .populate(
        "additionalDocumentRequests.requestedBy",
        "fullName email"
      )
      .populate(
        "additionalDocumentRequests.reviewedBy",
        "fullName email"
      )
      .populate("deliverables.uploadedBy", "fullName email")
      .populate("assignmentHistory.staff", "fullName email")
      .populate("assignmentHistory.assignedBy", "fullName email")
      .populate("statusHistory.changedBy", "fullName email");

    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Service request not found.",
      });
    }

    return res.json({
      success: true,
      request,
    });
  }
);

/*
|--------------------------------------------------------------------------
| PATCH /api/admin/requests/:id/assign
|--------------------------------------------------------------------------
| Initial assignment only.
|
| This does not overwrite an existing staff assignment. The atomic
| filter ensures an admin and staff claimant cannot both win the race.
*/

export const assignAdminServiceRequest = asyncHandler(
  async (req, res) => {
    const { staffId } = req.body;

    if (
      !mongoose.isValidObjectId(req.params.id) ||
      !mongoose.isValidObjectId(staffId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Valid request ID and staff ID are required.",
      });
    }

    const staff = await User.findOne({
      _id: staffId,
      role: "staff",
      accountStatus: "active",
      emailVerified: true,
    }).select("_id");

    if (!staff) {
      return res.status(400).json({
        success: false,
        message:
          "Selected staff account is not active and verified.",
      });
    }

    const now = new Date();

    const request = await ServiceRequest.findOneAndUpdate(
      {
        _id: req.params.id,
        status: "pending",
        staff: null,
      },
      {
        $set: {
          staff: staff._id,
          status: "approved",
          acceptedAt: now,
        },

        $push: {
          assignmentHistory: {
            staff: staff._id,
            assignedBy: req.authUser._id,
            assignmentType: "admin_assignment",
            reason: "Initially assigned by admin.",
            assignedAt: now,
          },

          statusHistory: {
            fromStatus: "pending",
            toStatus: "approved",
            changedBy: req.authUser._id,
            note: "Admin assigned the request to a staff member.",
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
        code: "REQUEST_ALREADY_ASSIGNED",
        message:
          "This request is no longer unassigned and pending. Use the separate admin reassignment action if reassignment is allowed.",
      });
    }

    return res.json({
      success: true,
      message: "Staff assigned successfully.",
      request,
    });
  }
);

/*
|--------------------------------------------------------------------------
| PATCH /api/admin/requests/:id/reassign
|--------------------------------------------------------------------------
| Separate, intentional reassignment for an existing assignee.
|
| Allowed before work starts, with a mandatory reason.
| This route must be registered separately in adminRoutes.js.
*/

export const reassignAdminServiceRequest = asyncHandler(
  async (req, res) => {
    const { staffId, reason } = req.body;

    if (
      !mongoose.isValidObjectId(req.params.id) ||
      !mongoose.isValidObjectId(staffId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Valid request ID and staff ID are required.",
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
          "Reassignment reason must contain 3 to 1000 characters.",
      });
    }

    const newStaff = await User.findOne({
      _id: staffId,
      role: "staff",
      accountStatus: "active",
      emailVerified: true,
    }).select("_id fullName email");

    if (!newStaff) {
      return res.status(400).json({
        success: false,
        message:
          "Selected staff account is not active and verified.",
      });
    }

    const request = await ServiceRequest.findById(req.params.id);

    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Service request not found.",
      });
    }

    if (!request.staff) {
      return res.status(409).json({
        success: false,
        message:
          "This request is unassigned. Use the initial assignment action.",
      });
    }

    if (request.staff.toString() === newStaff._id.toString()) {
      return res.status(400).json({
        success: false,
        message: "This staff member is already assigned.",
      });
    }

    if (
      !["approved", "documents_required"].includes(request.status) ||
      request.processingStartedAt ||
      (request.deliverables || []).length > 0
    ) {
      return res.status(409).json({
        success: false,
        message:
          "Reassignment is allowed only before work starts and before a final result has been uploaded.",
      });
    }

    const previousStaffId = request.staff;
    const oldStatus = request.status;
    const now = new Date();

    // Close the previous active assignment-history entry, if present.
    const previousAssignment = [...request.assignmentHistory]
      .reverse()
      .find(
        (item) =>
          item.staff?.toString() === previousStaffId.toString() &&
          item.endedAt == null
      );

    if (previousAssignment) {
      previousAssignment.endedAt = now;
    }

    request.staff = newStaff._id;

    request.assignmentHistory.push({
      staff: newStaff._id,
      assignedBy: req.authUser._id,
      assignmentType: "admin_reassignment",
      reason: reason.trim(),
      assignedAt: now,
    });

    request.statusHistory.push({
      fromStatus: oldStatus,
      toStatus: oldStatus,
      changedBy: req.authUser._id,
      note:
        `Assignment transferred from ${previousStaffId.toString()} ` +
        `to ${newStaff._id.toString()}. Reason: ${reason.trim()}`,
      changedAt: now,
    });

    try {
      await request.save();
    } catch (error) {
      if (
        error?.name === "VersionError" ||
        error?.code === 112
      ) {
        return res.status(409).json({
          success: false,
          message:
            "This request changed during reassignment. Refresh and try again.",
        });
      }

      throw error;
    }

    await request.populate([
      { path: "customer", select: "fullName email phone" },
      { path: "staff", select: "fullName email" },
    ]);

    return res.json({
      success: true,
      message: "Request reassigned successfully.",
      request,
    });
  }
);

/*
|--------------------------------------------------------------------------
| PATCH /api/admin/requests/:id/status
|--------------------------------------------------------------------------
| Validates transitions and required document/payment/delivery gates.
*/

export const updateAdminServiceRequestStatus = asyncHandler(
  async (req, res) => {
    const { status, staffNotes } = req.body;

    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid request ID.",
      });
    }

    if (
      typeof status !== "string" ||
      !VALID_STATUSES.includes(status)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid status.",
      });
    }

    if (!validateNotes(staffNotes)) {
      return res.status(400).json({
        success: false,
        message: "Notes must be 1000 characters or fewer.",
      });
    }

    const existing = await ServiceRequest.findById(
      req.params.id
    );

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Service request not found.",
      });
    }

    const oldStatus = existing.status;
    const possibleNextStatuses =
      STATUS_TRANSITIONS[oldStatus] || [];

    if (!possibleNextStatuses.includes(status)) {
      return res.status(409).json({
        success: false,
        message:
          `Cannot change status from ${oldStatus} to ${status}.`,
      });
    }

    if (
      [
        "in_progress",
        "ready_for_payment",
        "ready_for_download",
        "completed",
        "delivered",
        "closed",
      ].includes(status) &&
      !existing.staff
    ) {
      return res.status(409).json({
        success: false,
        message: "Assign a staff member before processing the request.",
      });
    }

    // A request cannot be approved for processing while required
    // documents remain missing, rejected, or awaiting review.
    if (
      ["approved", "in_progress", ...FINAL_OUTPUT_STATUSES].includes(
        status
      )
    ) {
      const missingDocuments =
        getMissingRequiredDocuments(existing);

      if (missingDocuments.length > 0) {
        return res.status(409).json({
          success: false,
          code: "DOCUMENTS_NOT_READY",
          message:
            "Required documents must be uploaded and accepted first.",
          missingDocuments,
        });
      }
    }

    // Digital-result services require a stored final deliverable.
    if (
      FINAL_OUTPUT_STATUSES.includes(status) &&
      existing.requiresDigitalDelivery &&
      (!existing.deliverables || existing.deliverables.length === 0)
    ) {
      return res.status(409).json({
        success: false,
        code: "FINAL_DELIVERABLE_REQUIRED",
        message:
          "Upload the final PDF before marking the work ready or complete.",
      });
    }

    const finalPayment = existing.payment?.final;

    if (
      status === "ready_for_payment" &&
      (!finalPayment || finalPayment.required !== true)
    ) {
      return res.status(409).json({
        success: false,
        message:
          "A final payment is not configured for this request. Use the appropriate delivery status instead.",
      });
    }

    // Only the verified payment handler should unlock a paywalled output.
    if (
      PAYMENT_GATED_STATUSES.includes(status) &&
      finalPayment?.required === true &&
      finalPayment.status !== "paid"
    ) {
      return res.status(409).json({
        success: false,
        code: "FINAL_PAYMENT_REQUIRED",
        message:
          "Final payment must be verified before download-ready, completed, or delivered status.",
      });
    }

    const now = new Date();

    const updates = { status };

    if (staffNotes !== undefined) {
      updates.staffNotes = staffNotes.trim();
    }

    if (status === "in_progress" && !existing.processingStartedAt) {
      updates.processingStartedAt = now;
    }

    if (status === "ready_for_payment" && !existing.readyForPaymentAt) {
      updates.readyForPaymentAt = now;
    }

    if (status === "delivered" && !existing.deliveredAt) {
      updates.deliveredAt = now;
    }

    if (status === "closed" && !existing.closedAt) {
      updates.closedAt = now;
    }

    if (status === "cancelled" && !existing.cancelledAt) {
      updates.cancelledAt = now;
    }

    const historyNote =
      typeof req.body.reason === "string"
        ? req.body.reason.trim().slice(0, 1000)
        : staffNotes?.trim() || "";

    const request = await ServiceRequest.findOneAndUpdate(
      {
        _id: existing._id,
        status: oldStatus,
        staff: existing.staff,
      },
      {
        $set: updates,

        $push: {
          statusHistory: {
            fromStatus: oldStatus,
            toStatus: status,
            changedBy: req.authUser._id,
            note: historyNote,
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
        message:
          "The request changed while you were updating it. Refresh and try again.",
      });
    }

    return res.json({
      success: true,
      message: `Request status updated to ${status.replaceAll("_", " ")}.`,
      request,
    });
  }
);
