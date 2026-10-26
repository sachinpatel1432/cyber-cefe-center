import mongoose from "mongoose";
import Service from "../models/Service.js";

const CATEGORIES = [
  "Printing",
  "Photocopy",
  "Scanning",
  "Online Forms",
  "Typing",
  "Passport Photos",
  "Lamination",
  "Internet",
  "Other",
];

const fail = (res, status, message) =>
  res.status(status).json({
    success: false,
    message,
  });

const hasOwn = (object, key) =>
  Object.prototype.hasOwnProperty.call(object, key);

/* -------------------------------------------------------------------------- */
/*                               HELPER METHODS                               */
/* -------------------------------------------------------------------------- */

const parseBoolean = (value) => {
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;
  return null;
};

const cleanDocuments = (value) => {
  if (!Array.isArray(value) || value.length > 30) {
    return null;
  }

  if (
    value.some(
      (item) =>
        typeof item !== "string" ||
        !item.trim() ||
        item.trim().length > 100
    )
  ) {
    return null;
  }

  return [...new Set(value.map((item) => item.trim()))];
};

const isValidMoney = (value) => {
  if (
    value === "" ||
    value === null ||
    value === undefined ||
    !Number.isFinite(Number(value))
  ) {
    return false;
  }

  const amount = Number(value);

  return (
    amount >= 0 &&
    amount <= 10000000 &&
    Math.abs(amount * 100 - Math.round(amount * 100)) < 0.000001
  );
};

/**
 * Validates service input.
 *
 * partial = false:
 *   Required fields are checked, suitable for creating a service.
 *
 * partial = true:
 *   Only provided fields are checked, suitable for updating a service.
 */
const validateFields = (body, partial = false) => {
  const data = {};

  /* ------------------------------- Name ---------------------------------- */

  if (!partial || body.name !== undefined) {
    if (
      typeof body.name !== "string" ||
      body.name.trim().length < 2 ||
      body.name.trim().length > 100
    ) {
      return { error: "Enter a valid service name." };
    }

    data.name = body.name.trim();
  }

  /* ----------------------------- Category -------------------------------- */

  if (!partial || body.category !== undefined) {
    if (!CATEGORIES.includes(body.category)) {
      return { error: "Select a valid category." };
    }

    data.category = body.category;
  }

  /* ---------------------------- Description ------------------------------ */

  if (!partial || body.description !== undefined) {
    if (
      typeof body.description !== "string" ||
      !body.description.trim() ||
      body.description.trim().length > 1000
    ) {
      return { error: "Enter a valid description." };
    }

    data.description = body.description.trim();
  }

  /* -------------------------------- Price -------------------------------- */

  if (!partial || body.price !== undefined) {
    if (!isValidMoney(body.price)) {
      return {
        error:
          "Enter a valid price between ₹0 and ₹1,00,00,000 with at most 2 decimal places.",
      };
    }

    data.price = Number(body.price);
  }

  /* --------------------------- Platform Fee ------------------------------ */

  if (body.platformFeePercent !== undefined) {
    if (
      body.platformFeePercent === "" ||
      body.platformFeePercent === null ||
      !Number.isInteger(Number(body.platformFeePercent)) ||
      Number(body.platformFeePercent) < 0 ||
      Number(body.platformFeePercent) > 100
    ) {
      return {
        error: "Platform fee must be a whole number between 0 and 100.",
      };
    }

    data.platformFeePercent = Number(body.platformFeePercent);
  }

  /* ---------------------- Estimated Duration ----------------------------- */

  if (!partial || body.estimatedDurationMinutes !== undefined) {
    const duration = Number(body.estimatedDurationMinutes);

    if (
      body.estimatedDurationMinutes === "" ||
      body.estimatedDurationMinutes === null ||
      body.estimatedDurationMinutes === undefined ||
      !Number.isInteger(duration) ||
      duration < 1 ||
      duration > 10080
    ) {
      return {
        error: "Enter a valid duration between 1 and 10080 minutes.",
      };
    }

    data.estimatedDurationMinutes = duration;
  }

  /* ------------------------- Required Documents -------------------------- */

  if (!partial || body.requiredDocuments !== undefined) {
    const docs = cleanDocuments(body.requiredDocuments ?? []);

    if (docs === null) {
      return {
        error:
          "Required documents must be an array of up to 30 valid strings.",
      };
    }

    data.requiredDocuments = docs;
  }

  /* ---------------------- Digital Delivery Setting ----------------------- */

  if (body.requiresDigitalDelivery !== undefined) {
    const value = parseBoolean(body.requiresDigitalDelivery);

    if (value === null) {
      return {
        error: "requiresDigitalDelivery must be true or false.",
      };
    }

    data.requiresDigitalDelivery = value;
  }

  /* ---------------------- Advance Payment Setting ------------------------ */

  if (body.advancePaymentRequired !== undefined) {
    const value = parseBoolean(body.advancePaymentRequired);

    if (value === null) {
      return {
        error: "advancePaymentRequired must be true or false.",
      };
    }

    data.advancePaymentRequired = value;
  }

  if (body.advanceAmount !== undefined) {
    if (!isValidMoney(body.advanceAmount)) {
      return {
        error: "Enter a valid advance amount with at most 2 decimal places.",
      };
    }

    data.advanceAmount = Number(body.advanceAmount);
  }

  /* ----------------------- Final Payment Setting ------------------------- */

  if (body.finalPaymentRequired !== undefined) {
    const value = parseBoolean(body.finalPaymentRequired);

    if (value === null) {
      return {
        error: "finalPaymentRequired must be true or false.",
      };
    }

    data.finalPaymentRequired = value;
  }

  /* --------------------------- Active Setting ---------------------------- */

  if (body.active !== undefined) {
    const value = parseBoolean(body.active);

    if (value === null) {
      return {
        error: "active must be true or false.",
      };
    }

    data.active = value;
  }

  /* --------------------------- Closed Setting ---------------------------- */

  if (body.isClosed !== undefined) {
    const value = parseBoolean(body.isClosed);

    if (value === null) {
      return {
        error: "isClosed must be true or false.",
      };
    }

    data.isClosed = value;
  }

  /* ---------------------------- Closure Reason --------------------------- */

  if (body.closureReason !== undefined) {
    if (
      typeof body.closureReason !== "string" ||
      body.closureReason.trim().length > 300
    ) {
      return {
        error: "Closure reason must be a string of at most 300 characters.",
      };
    }

    data.closureReason = body.closureReason.trim();
  }

  return { data };
};

/**
 * Validates payment settings against the complete service configuration.
 * This matters during PATCH because only some fields may be provided.
 */
const validatePaymentSettings = (serviceValues) => {
  const advanceRequired = serviceValues.advancePaymentRequired ?? false;
  const advanceAmount = Number(serviceValues.advanceAmount ?? 0);
  const price = Number(serviceValues.price ?? 0);

  if (!Number.isFinite(advanceAmount) || advanceAmount < 0) {
    return "Advance amount cannot be negative.";
  }

  if (!advanceRequired && advanceAmount !== 0) {
    return "Advance amount must be ₹0 when advance payment is disabled.";
  }

  if (advanceRequired && advanceAmount <= 0) {
    return "Advance amount must be greater than ₹0 when advance payment is enabled.";
  }

  if (advanceAmount > price) {
    return "Advance amount cannot be greater than the service price.";
  }

  return null;
};

/**
 * Only returns services which have not been soft-deleted.
 */
const findService = (id) => {
  if (!mongoose.isValidObjectId(id)) {
    return null;
  }

  return Service.findOne({
    _id: id,
    deletedAt: null,
  });
};

/* -------------------------------------------------------------------------- */
/*                            PUBLIC SERVICE LIST                             */
/* -------------------------------------------------------------------------- */

// GET /api/services
// Public: only active, open, non-deleted services.
export const getActiveServices = async (req, res, next) => {
  try {
    const services = await Service.find({
      active: true,
      isClosed: false,
      deletedAt: null,
    })
      .select("-__v -createdBy -updatedBy -closureReason")
      .sort({ name: 1 })
      .lean();

    return res.json({
      success: true,
      services,
    });
  } catch (error) {
    next(error);
  }
};

/* -------------------------------------------------------------------------- */
/*                         ADMIN SERVICE MANAGEMENT                           */
/* -------------------------------------------------------------------------- */

// GET /api/services/manage
// Admin: filters and pagination.
export const getManageableServices = async (req, res, next) => {
  try {
    const page = Math.max(
      1,
      Number.parseInt(req.query.page, 10) || 1
    );

    const limit = Math.min(
      50,
      Math.max(1, Number.parseInt(req.query.limit, 10) || 10)
    );

    const filter = {
      deletedAt: null,
    };

    if (["true", "false"].includes(req.query.active)) {
      filter.active = req.query.active === "true";
    }

    if (["true", "false"].includes(req.query.isClosed)) {
      filter.isClosed = req.query.isClosed === "true";
    }

    if (CATEGORIES.includes(req.query.category)) {
      filter.category = req.query.category;
    }

    if (
      typeof req.query.search === "string" &&
      req.query.search.trim()
    ) {
      const escaped = req.query.search
        .trim()
        .slice(0, 100)
        .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

      filter.$or = [
        {
          name: {
            $regex: escaped,
            $options: "i",
          },
        },
        {
          description: {
            $regex: escaped,
            $options: "i",
          },
        },
      ];
    }

    const [services, total] = await Promise.all([
      Service.find(filter)
        .select("-__v")
        .sort({ updatedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),

      Service.countDocuments(filter),
    ]);

    return res.json({
      success: true,
      services,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/services/manage/:id
// Admin: service details.
export const getServiceDetails = async (req, res, next) => {
  try {
    const service = await findService(req.params.id);

    if (!service) {
      return fail(res, 404, "Service not found.");
    }

    return res.json({
      success: true,
      service,
    });
  } catch (error) {
    next(error);
  }
};

/* -------------------------------------------------------------------------- */
/*                              CREATE SERVICE                                */
/* -------------------------------------------------------------------------- */

// POST /api/services
export const createService = async (req, res, next) => {
  try {
    if (!req.authUser?._id) {
      return fail(res, 401, "Admin authentication required.");
    }

    const { data, error } = validateFields(req.body);

    if (error) {
      return fail(res, 400, error);
    }

    /*
     * If platformFeePercent is not supplied, the Service model's default
     * should apply. Configure that default as 20 in models/Service.js.
     */

    const paymentError = validatePaymentSettings({
      price: data.price,
      advancePaymentRequired:
        data.advancePaymentRequired ?? false,
      advanceAmount: data.advanceAmount ?? 0,
    });

    if (paymentError) {
      return fail(res, 400, paymentError);
    }

    data.createdBy = req.authUser._id;
    data.updatedBy = req.authUser._id;

    const service = await Service.create(data);

    return res.status(201).json({
      success: true,
      message: "Service created successfully.",
      service,
    });
  } catch (error) {
    if (error.name === "ValidationError" || error.name === "CastError") {
      return fail(res, 400, error.message);
    }

    next(error);
  }
};

/* -------------------------------------------------------------------------- */
/*                              UPDATE SERVICE                                */
/* -------------------------------------------------------------------------- */

// PATCH /api/services/manage/:id
export const updateService = async (req, res, next) => {
  try {
    if (!req.authUser?._id) {
      return fail(res, 401, "Admin authentication required.");
    }

    const allowed = [
      "name",
      "category",
      "description",
      "price",
      "platformFeePercent",
      "estimatedDurationMinutes",
      "requiredDocuments",
      "requiresDigitalDelivery",
      "advancePaymentRequired",
      "advanceAmount",
      "finalPaymentRequired",
      "active",
      "isClosed",
      "closureReason",
    ];

    const keys = Object.keys(req.body ?? {});

    if (!keys.length || keys.some((key) => !allowed.includes(key))) {
      return fail(res, 400, "Empty or unsupported update fields.");
    }

    const { data, error } = validateFields(req.body, true);

    if (error) {
      return fail(res, 400, error);
    }

    const service = await findService(req.params.id);

    if (!service) {
      return fail(res, 404, "Service not found.");
    }

    /*
     * Validate the combined settings, not just the fields sent in PATCH.
     * For example, changing the price must not leave the advance amount
     * greater than the new price.
     */
    const paymentError = validatePaymentSettings({
      price: data.price ?? service.price,
      advancePaymentRequired:
        data.advancePaymentRequired ?? service.advancePaymentRequired,
      advanceAmount: data.advanceAmount ?? service.advanceAmount,
    });

    if (paymentError) {
      return fail(res, 400, paymentError);
    }

    if (data.isClosed === false) {
      data.closureReason = "";
    }

    data.updatedBy = req.authUser._id;

    Object.assign(service, data);

    await service.save();

    return res.json({
      success: true,
      message: "Service updated successfully.",
      service,
    });
  } catch (error) {
    if (error.name === "ValidationError" || error.name === "CastError") {
      return fail(res, 400, error.message);
    }

    next(error);
  }
};

/* -------------------------------------------------------------------------- */
/*                                CLOSE SERVICE                               */
/* -------------------------------------------------------------------------- */

// PATCH /api/services/manage/:id/close
export const closeService = async (req, res, next) => {
  try {
    if (!req.authUser?._id) {
      return fail(res, 401, "Admin authentication required.");
    }

    if (
      req.body.reason !== undefined &&
      (
        typeof req.body.reason !== "string" ||
        req.body.reason.trim().length > 300
      )
    ) {
      return fail(res, 400, "Invalid closure reason.");
    }

    const service = await findService(req.params.id);

    if (!service) {
      return fail(res, 404, "Service not found.");
    }

    service.isClosed = true;
    service.closureReason = (req.body.reason || "").trim();
    service.updatedBy = req.authUser._id;

    await service.save();

    return res.json({
      success: true,
      message: "Service closed temporarily.",
      service,
    });
  } catch (error) {
    if (error.name === "ValidationError" || error.name === "CastError") {
      return fail(res, 400, error.message);
    }

    next(error);
  }
};

/* -------------------------------------------------------------------------- */
/*                               REOPEN SERVICE                               */
/* -------------------------------------------------------------------------- */

// PATCH /api/services/manage/:id/reopen
export const reopenService = async (req, res, next) => {
  try {
    if (!req.authUser?._id) {
      return fail(res, 401, "Admin authentication required.");
    }

    const service = await findService(req.params.id);

    if (!service) {
      return fail(res, 404, "Service not found.");
    }

    service.isClosed = false;
    service.closureReason = "";
    service.updatedBy = req.authUser._id;

    await service.save();

    return res.json({
      success: true,
      message: service.active
        ? "Service reopened."
        : "Service reopened, but remains inactive.",
      service,
    });
  } catch (error) {
    if (error.name === "ValidationError" || error.name === "CastError") {
      return fail(res, 400, error.message);
    }

    next(error);
  }
};

/* -------------------------------------------------------------------------- */
/*                              ACTIVATE SERVICE                              */
/* -------------------------------------------------------------------------- */

// PATCH /api/services/manage/:id/activate
export const activateService = async (req, res, next) => {
  try {
    if (!req.authUser?._id) {
      return fail(res, 401, "Admin authentication required.");
    }

    const service = await findService(req.params.id);

    if (!service) {
      return fail(res, 404, "Service not found.");
    }

    service.active = true;
    service.updatedBy = req.authUser._id;

    await service.save();

    return res.json({
      success: true,
      message: "Service activated.",
      service,
    });
  } catch (error) {
    if (error.name === "ValidationError" || error.name === "CastError") {
      return fail(res, 400, error.message);
    }

    next(error);
  }
};

/* -------------------------------------------------------------------------- */
/*                             DEACTIVATE SERVICE                             */
/* -------------------------------------------------------------------------- */

// PATCH /api/services/manage/:id/deactivate
export const deactivateService = async (req, res, next) => {
  try {
    if (!req.authUser?._id) {
      return fail(res, 401, "Admin authentication required.");
    }

    const service = await findService(req.params.id);

    if (!service) {
      return fail(res, 404, "Service not found.");
    }

    service.active = false;
    service.updatedBy = req.authUser._id;

    await service.save();

    return res.json({
      success: true,
      message: "Service deactivated.",
      service,
    });
  } catch (error) {
    if (error.name === "ValidationError" || error.name === "CastError") {
      return fail(res, 400, error.message);
    }

    next(error);
  }
};

/* -------------------------------------------------------------------------- */
/*                               DELETE SERVICE                               */
/* -------------------------------------------------------------------------- */

// DELETE /api/services/manage/:id
// Soft delete: preserves the service record for existing request history.
export const deleteService = async (req, res, next) => {
  try {
    if (!req.authUser?._id) {
      return fail(res, 401, "Admin authentication required.");
    }

    const service = await findService(req.params.id);

    if (!service) {
      return fail(res, 404, "Service not found.");
    }

    service.active = false;
    service.isClosed = true;
    service.deletedAt = new Date();
    service.updatedBy = req.authUser._id;

    await service.save();

    return res.json({
      success: true,
      message: "Service removed from the catalog.",
    });
  } catch (error) {
    if (error.name === "ValidationError" || error.name === "CastError") {
      return fail(res, 400, error.message);
    }

    next(error);
  }
};