import mongoose from "mongoose";
import { randomBytes } from "node:crypto";

import Service from "../models/Service.js";
import ServiceRequest from "../models/ServiceRequest.js";

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

const makeRequestNumber = () => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = randomBytes(4).toString("hex").toUpperCase();

  return `CD-${timestamp}-${random}`;
};

const parsePositiveInteger = (value, fallback, maximum) => {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    return fallback;
  }

  return Math.min(parsed, maximum);
};

const normalizeRequiredDocuments = (documents) => {
  if (!Array.isArray(documents)) return [];

  return documents
    .filter((item) => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0 && item.length <= 100)
    .slice(0, 30);
};

// Accept date-only values from HTML date inputs.
// Today is allowed; earlier calendar dates are rejected.
const parsePreferredDate = (value) => {
  if (value === undefined || value === null || value === "") {
    return { date: null };
  }

  if (typeof value !== "string") {
    return { error: "Please choose a valid preferred date." };
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return {
      error: "Preferred date must be in YYYY-MM-DD format.",
    };
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return { error: "Please choose a valid preferred date." };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(12, 0, 0, 0);

  if (date < today) {
    return {
      error: "Preferred date cannot be in the past.",
    };
  }

  return { date };
};

/*
|--------------------------------------------------------------------------
| Create customer booking
|--------------------------------------------------------------------------
| The client cannot choose the trusted price, fee percentage, customer ID,
| request status, payment status, or assigned staff.
|
| Monetary values in pricingSnapshot are stored in integer paise.
| Legacy unitPrice and totalPrice continue to be stored in INR rupees.
*/

export const createServiceRequest = asyncHandler(
  async (req, res) => {
    const {
      serviceId,
      quantity = 1,
      preferredDate,
      customerNotes = "",
    } = req.body;

    if (!mongoose.isValidObjectId(serviceId)) {
      return res.status(400).json({
        success: false,
        message: "Please select a valid service.",
      });
    }

    const parsedQuantity = Number(quantity);

    if (
      !Number.isSafeInteger(parsedQuantity) ||
      parsedQuantity < 1 ||
      parsedQuantity > 1000
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Quantity must be a whole number between 1 and 1000.",
      });
    }

    if (
      typeof customerNotes !== "string" ||
      customerNotes.trim().length > 1000
    ) {
      return res.status(400).json({
        success: false,
        message: "Instructions must be 1000 characters or fewer.",
      });
    }

    const parsedDate = parsePreferredDate(preferredDate);

    if (parsedDate.error) {
      return res.status(400).json({
        success: false,
        message: parsedDate.error,
      });
    }

    // Always load the authoritative service from the database.
    const service = await Service.findOne({
      _id: serviceId,
      active: true,
      isClosed: false,
      deletedAt: null,
    });

    if (!service) {
      return res.status(404).json({
        success: false,
        message: "This service is currently unavailable.",
      });
    }

    const unitPrice = Number(service.price);
    const platformFeePercent = Number(service.platformFeePercent);

    if (
      !Number.isFinite(unitPrice) ||
      unitPrice < 0 ||
      Math.round(unitPrice * 100) !== unitPrice * 100
    ) {
      return res.status(409).json({
        success: false,
        message: "This service has an invalid configured price.",
      });
    }

    if (
      !Number.isInteger(platformFeePercent) ||
      platformFeePercent < 0 ||
      platformFeePercent > 100
    ) {
      return res.status(409).json({
        success: false,
        message: "This service has an invalid platform fee configuration.",
      });
    }

    // Convert to integer paise before calculating the total.
    const unitPricePaise = Math.round(unitPrice * 100);
    const customerAmountPaise = unitPricePaise * parsedQuantity;

    if (
      !Number.isSafeInteger(unitPricePaise) ||
      !Number.isSafeInteger(customerAmountPaise)
    ) {
      return res.status(400).json({
        success: false,
        message: "Unable to calculate the booking total safely.",
      });
    }

    const totalPrice = customerAmountPaise / 100;

    // Fee is rounded to the nearest paise.
    const platformFeePaise = Math.round(
      (customerAmountPaise * platformFeePercent) / 100
    );

    // Difference calculation ensures the split always balances.
    const staffEarningPaise =
      customerAmountPaise - platformFeePaise;

    const requiredDocuments = normalizeRequiredDocuments(
      service.requiredDocuments
    );

    const requiresDigitalDelivery =
      service.requiresDigitalDelivery === true ||
      service.category === "Online Forms";

    const snapshotAt = new Date();

    const pricingSnapshot = {
      version: 1,
      currency: "INR",
      customerAmountPaise,
      platformFeePercent,
      platformFeePaise,
      staffEarningPaise,
      earningStatus: "held",
      snapshotAt,
      sourceServiceUpdatedAt: service.updatedAt || null,
    };

    // Retry if the unique request-number index detects a collision.
    let request = null;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        request = await ServiceRequest.create({
          requestNumber: makeRequestNumber(),

          // Identity comes from the authenticated user.
          customer: req.authUser._id,

          service: service._id,
          serviceName: service.name,
          category: service.category,

          // Legacy fields retained for existing frontend compatibility.
          unitPrice,
          quantity: parsedQuantity,
          totalPrice,

          // Immutable order-time price/fee breakdown.
          pricingSnapshot,

          preferredDate: parsedDate.date,
          customerNotes: customerNotes.trim(),
          requiredDocuments,
          requiresDigitalDelivery,

          status: "pending",
          staff: null,

          statusHistory: [
            {
              fromStatus: null,
              toStatus: "pending",
              changedBy: req.authUser._id,
              note: "Customer submitted the service request.",
              changedAt: snapshotAt,
            },
          ],

          // No payment is collected by this controller yet.
          payment: {
            currency: "INR",
            advance: {
              required: false,
              amount: 0,
              status: "not_required",
              provider: "none",
            },
            final: {
              required: false,
              amount: 0,
              status: "not_required",
              provider: "none",
            },
          },
        });

        break;
      } catch (error) {
        const isRequestNumberCollision =
          error.code === 11000 &&
          (
            error.keyPattern?.requestNumber ||
            error.keyValue?.requestNumber
          );

        if (isRequestNumberCollision && attempt < 2) {
          continue;
        }

        throw error;
      }
    }

    if (!request) {
      return res.status(503).json({
        success: false,
        message:
          "Unable to create a unique request number. Please retry.",
      });
    }

    return res.status(201).json({
      success: true,
      message: "Service request submitted successfully.",
      request,
    });
  }
);

/*
|--------------------------------------------------------------------------
| Customer request list
|--------------------------------------------------------------------------
| A customer may see only requests owned by their authenticated account.
*/

export const getMyServiceRequests = asyncHandler(
  async (req, res) => {
    const page = parsePositiveInteger(req.query.page, 1, 1000000);
    const limit = parsePositiveInteger(req.query.limit, 10, 50);

    const filter = {
      customer: req.authUser._id,
    };

    const requestedStatus =
      typeof req.query.status === "string"
        ? req.query.status.trim()
        : "all";

    if (
      requestedStatus &&
      requestedStatus !== "all" &&
      !VALID_STATUSES.includes(requestedStatus)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid request status filter.",
      });
    }

    if (requestedStatus && requestedStatus !== "all") {
      filter.status = requestedStatus;
    }

    const [requests, total] = await Promise.all([
      ServiceRequest.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate("staff", "fullName email"),

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
| Customer dashboard summary
|--------------------------------------------------------------------------
*/

export const getMyServiceRequestSummary = asyncHandler(
  async (req, res) => {
    const customerId = req.authUser._id;

    const [
      statusCounts,
      totalRequests,
      recentRequests,
    ] = await Promise.all([
      ServiceRequest.aggregate([
        {
          $match: {
            customer: new mongoose.Types.ObjectId(
              customerId.toString()
            ),
          },
        },
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
          },
        },
      ]),

      ServiceRequest.countDocuments({
        customer: customerId,
      }),

      ServiceRequest.find({
        customer: customerId,
      })
        .sort({ createdAt: -1 })
        .limit(5)
        .select(
          [
            "requestNumber",
            "serviceName",
            "category",
            "totalPrice",
            "quantity",
            "unitPrice",
            "status",
            "createdAt",
            "preferredDate",
            "requiresDigitalDelivery",
            "deliverables",
            "staff",
          ].join(" ")
        )
        .populate("staff", "fullName email"),
    ]);

    const counts = Object.fromEntries(
      VALID_STATUSES.map((status) => [status, 0])
    );

    for (const item of statusCounts) {
      counts[item._id] = item.count;
    }

    const activeStatuses = [
      "approved",
      "documents_required",
      "in_progress",
      "ready_for_payment",
      "ready_for_download",
    ];

    const completedStatuses = [
      "completed",
      "delivered",
      "closed",
    ];

    const activeRequests = activeStatuses.reduce(
      (sum, status) => sum + counts[status],
      0
    );

    const completedRequests = completedStatuses.reduce(
      (sum, status) => sum + counts[status],
      0
    );

    return res.json({
      success: true,

      summary: {
        totalRequests,
        pendingRequests: counts.pending,
        documentsRequiredRequests: counts.documents_required,
        activeRequests,
        readyForPaymentRequests: counts.ready_for_payment,
        completedRequests,
        counts,
      },

      recentRequests,
    });
  }
);

/*
|--------------------------------------------------------------------------
| Cancel customer's own pending request
|--------------------------------------------------------------------------
| The conditional database update prevents cancelling a request that
| staff/admin accepted concurrently.
*/

export const cancelMyServiceRequest = asyncHandler(
  async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid request ID.",
      });
    }

    const now = new Date();

    const request = await ServiceRequest.findOneAndUpdate(
      {
        _id: req.params.id,
        customer: req.authUser._id,
        status: "pending",
        staff: null,
      },
      {
        $set: {
          status: "cancelled",
          cancelledAt: now,
        },
        $push: {
          statusHistory: {
            fromStatus: "pending",
            toStatus: "cancelled",
            changedBy: req.authUser._id,
            note: "Cancelled by customer.",
            changedAt: now,
          },
        },
      },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!request) {
      const existing = await ServiceRequest.findOne({
        _id: req.params.id,
        customer: req.authUser._id,
      }).select("_id status staff");

      if (!existing) {
        return res.status(404).json({
          success: false,
          message: "Service request not found.",
        });
      }

      return res.status(409).json({
        success: false,
        message:
          "Only unassigned pending requests can be cancelled. This request may already be assigned or processing.",
      });
    }

    return res.json({
      success: true,
      message: "Service request cancelled successfully.",
      request,
    });
  }
);