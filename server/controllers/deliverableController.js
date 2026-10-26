import mongoose from "mongoose";
import { randomUUID } from "node:crypto";
import { v2 as cloudinary } from "cloudinary";

import ServiceRequest from "../models/ServiceRequest.js";

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

const MAX_PDF_SIZE = 10 * 1024 * 1024;
const DOWNLOAD_URL_LIFETIME_SECONDS = 60;
const MAX_DELIVERABLES_PER_REQUEST = 20;

const DOWNLOADABLE_STATUSES = [
  "ready_for_download",
  "completed",
  "delivered",
  "closed",
];

/**
 * Configure Cloudinary.
 *
 * Supports:
 * CLOUDINARY_URL
 * or CLOUDINARY_CLOUD_NAME + CLOUDINARY_API_KEY
 * + CLOUDINARY_API_SECRET
 */
const configureCloudinary = () => {
  if (
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  ) {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
      secure: true,
    });
  }

  const config = cloudinary.config();

  if (
    !config.cloud_name ||
    !config.api_key ||
    !config.api_secret
  ) {
    const error = new Error(
      "Cloudinary storage is not configured on the server."
    );

    error.status = 503;
    throw error;
  }

  return config;
};

/**
 * Send safe API errors without exposing Cloudinary credentials.
 */
const makeErrorResponse = (res, error) => {
  const status =
    Number.isInteger(error?.status) &&
    error.status >= 400 &&
    error.status <= 599
      ? error.status
      : 500;

  if (status >= 500) {
    console.error("Deliverable operation failed.");
  }

  return res.status(status).json({
    success: false,
    message:
      status === 503
        ? "File storage is temporarily unavailable."
        : "The file operation could not be completed.",
  });
};

/**
 * Normalize the display title.
 */
const createSafeFileTitle = (value) =>
  String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9 _-]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 120);

/**
 * Sanitize the filename used in storage.
 */
const createSafeFileName = (value) =>
  String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-zA-Z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 100) || "final-document";

/**
 * Upload PDF to authenticated Cloudinary storage.
 */
const uploadPdfBuffer = (buffer, publicId) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        resource_type: "image",
        type: "authenticated",
        public_id: publicId,
        overwrite: false,
        unique_filename: false,
      },
      (error, result) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(result);
      }
    );

    stream.end(buffer);
  });

/**
 * Clean up an uploaded asset if saving the request fails.
 */
const deleteCloudinaryAsset = async (publicId) => {
  if (!publicId) return;

  try {
    await cloudinary.uploader.destroy(publicId, {
      resource_type: "image",
      type: "authenticated",
      invalidate: true,
    });
  } catch {
    console.error(
      "Cloudinary cleanup failed for an uploaded asset."
    );
  }
};

/**
 * POST /api/staff/requests/:id/deliverables
 *
 * Upload a final PDF for a request assigned to the logged-in staff member.
 *
 * Multipart form fields:
 * file  - Required PDF, maximum 10 MB
 * title - Optional display title
 */
export const uploadStaffDeliverable = asyncHandler(
  async (req, res) => {
    let uploadedPublicId = null;

    try {
      if (!mongoose.isValidObjectId(req.params.id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid request ID.",
        });
      }

      if (!req.file || !Buffer.isBuffer(req.file.buffer)) {
        return res.status(400).json({
          success: false,
          message: "Select a PDF file to upload.",
        });
      }

      const buffer = req.file.buffer;
      const fileSize = buffer.length;
      const originalName = String(
        req.file.originalname || ""
      );

      if (
        fileSize < 1 ||
        fileSize > MAX_PDF_SIZE ||
        (req.file.size && req.file.size > MAX_PDF_SIZE)
      ) {
        return res.status(400).json({
          success: false,
          message: "The PDF must be between 1 byte and 10 MB.",
        });
      }

      // Validate MIME type, extension and file signature.
      if (
        req.file.mimetype !== "application/pdf" ||
        !originalName.toLowerCase().endsWith(".pdf") ||
        buffer.subarray(0, 5).toString() !== "%PDF-"
      ) {
        return res.status(400).json({
          success: false,
          message: "The selected file is not a valid PDF.",
        });
      }

      const suppliedTitle =
        typeof req.body?.title === "string"
          ? req.body.title.trim()
          : "";

      if (suppliedTitle.length > 120) {
        return res.status(400).json({
          success: false,
          message:
            "Document title must be 120 characters or fewer.",
        });
      }

      /*
       * Verify that the request is assigned to the authenticated
       * staff member and is currently in progress.
       */
      const request = await ServiceRequest.findOne({
        _id: req.params.id,
        staff: req.authUser._id,
        status: "in_progress",
      }).select("_id staff status deliverables");

      if (!request) {
        return res.status(404).json({
          success: false,
          message:
            "An assigned in-progress request was not found.",
        });
      }

      if (
        (request.deliverables || []).length >=
        MAX_DELIVERABLES_PER_REQUEST
      ) {
        return res.status(409).json({
          success: false,
          message:
            "This request already has the maximum number of final files.",
        });
      }

      const fallbackTitle = originalName.replace(/\.pdf$/i, "");

      const title = createSafeFileTitle(
        suppliedTitle || fallbackTitle
      );

      if (title.length < 2) {
        return res.status(400).json({
          success: false,
          message:
            "Document title must contain at least 2 valid characters.",
        });
      }

      configureCloudinary();

      const safeBaseName = createSafeFileName(title);

      const publicId =
        `cyberdesk-deliverables/${request._id}/` +
        `${safeBaseName}-${randomUUID()}`;

      const uploadResult = await uploadPdfBuffer(
        buffer,
        publicId
      );

      uploadedPublicId = uploadResult?.public_id || null;

      // Fail closed if authenticated storage or PDF format is not confirmed.
      if (
        !uploadedPublicId ||
        uploadResult.resource_type !== "image" ||
        uploadResult.type !== "authenticated" ||
        String(uploadResult.format).toLowerCase() !== "pdf"
      ) {
        await deleteCloudinaryAsset(uploadedPublicId);
        uploadedPublicId = null;

        return res.status(502).json({
          success: false,
          message:
            "Secure PDF storage could not confirm the uploaded file.",
        });
      }

      const now = new Date();
      const deliverableId = new mongoose.Types.ObjectId();

      const newDeliverable = {
        _id: deliverableId,
        title,
        fileName: `${safeBaseName}.pdf`,
        mimeType: "application/pdf",
        format: "pdf",
        bytes: fileSize,
        storageProvider: "cloudinary",
        publicId: uploadedPublicId,
        resourceType: "image",
        uploadedBy: req.authUser._id,
        uploadedAt: now,
        downloadCount: 0,
        lastDownloadedAt: null,
      };

      /*
       * Atomic recheck of the staff assignment, request status
       * and maximum deliverable count.
       */
      const updatedRequest =
        await ServiceRequest.findOneAndUpdate(
          {
            _id: request._id,
            staff: req.authUser._id,
            status: "in_progress",
            "deliverables.19": { $exists: false },
          },
          {
            $push: {
              deliverables: newDeliverable,
            },
          },
          {
            new: true,
            runValidators: true,
          }
        ).select("_id");

      if (!updatedRequest) {
        await deleteCloudinaryAsset(uploadedPublicId);
        uploadedPublicId = null;

        return res.status(409).json({
          success: false,
          message:
            "The request changed or its file limit was reached. Refresh and try again.",
        });
      }

      // MongoDB now references the asset. Do not remove it in catch.
      uploadedPublicId = null;

      return res.status(201).json({
        success: true,
        message:
          "Final PDF uploaded securely. The request can now be completed if its other requirements are satisfied.",
        deliverable: {
          _id: deliverableId,
          title,
          fileName: `${safeBaseName}.pdf`,
          mimeType: "application/pdf",
          format: "pdf",
          bytes: fileSize,
          uploadedAt: now,
        },
      });
    } catch (error) {
      if (uploadedPublicId) {
        await deleteCloudinaryAsset(uploadedPublicId);
      }

      if (error?.name === "ValidationError") {
        return res.status(400).json({
          success: false,
          message:
            "The uploaded document metadata is invalid.",
        });
      }

      if (error?.code === "LIMIT_FILE_SIZE") {
        return res.status(413).json({
          success: false,
          message: "The PDF exceeds the 10 MB size limit.",
        });
      }

      return makeErrorResponse(res, error);
    }
  }
);

/**
 * GET /api/service-requests/:requestId/deliverables/:deliverableId/download
 *
 * This endpoint must be mounted inside the authenticated customer router.
 *
 * Verifies:
 * - Request ownership
 * - Downloadable request status
 * - Final payment status when payment is required
 * - The specific PDF deliverable
 *
 * Returns a temporary download URL.
 */
export const getCustomerDeliverableDownload = asyncHandler(
  async (req, res) => {
    try {
      const { requestId, deliverableId } = req.params;

      if (
        !mongoose.isValidObjectId(requestId) ||
        !mongoose.isValidObjectId(deliverableId)
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid request or document ID.",
        });
      }

      const request = await ServiceRequest.findOne({
        _id: requestId,
        customer: req.authUser._id,
      }).select("+deliverables.publicId");

      // Do not disclose another customer's request.
      if (!request) {
        return res.status(404).json({
          success: false,
          message:
            "Request or downloadable document not found.",
        });
      }

      if (!DOWNLOADABLE_STATUSES.includes(request.status)) {
        return res.status(409).json({
          success: false,
          message:
            "The final document is not available for download yet.",
        });
      }

      const finalPayment = request.payment?.final;

      if (
        finalPayment?.required === true &&
        finalPayment.status !== "paid"
      ) {
        return res.status(402).json({
          success: false,
          code: "FINAL_PAYMENT_REQUIRED",
          message:
            "Complete and verify the final payment before downloading the document.",
        });
      }

      const deliverable = request.deliverables.id(
        deliverableId
      );

      if (
        !deliverable ||
        deliverable.format !== "pdf"
      ) {
        return res.status(404).json({
          success: false,
          message:
            "Request or downloadable document not found.",
        });
      }

      if (
        !deliverable.publicId ||
        deliverable.storageProvider !== "cloudinary" ||
        deliverable.resourceType !== "image"
      ) {
        return res.status(503).json({
          success: false,
          message:
            "This document is not configured for secure downloads.",
        });
      }

      configureCloudinary();

      const now = new Date();

      const expiresAt =
        Math.floor(Date.now() / 1000) +
        DOWNLOAD_URL_LIFETIME_SECONDS;

      const url = cloudinary.utils.private_download_url(
        deliverable.publicId,
        "pdf",
        {
          resource_type: "image",
          type: "authenticated",
          expires_at: expiresAt,
          attachment: true,
        }
      );

      /*
       * Recheck eligibility and update the download counter atomically.
       * This also handles a request being cancelled/changed during
       * URL generation.
       */
      const updatedRequest =
        await ServiceRequest.findOneAndUpdate(
          {
            _id: requestId,
            customer: req.authUser._id,
            status: { $in: DOWNLOADABLE_STATUSES },

            $and: [
              {
                $or: [
                  { "payment.final.required": { $ne: true } },
                  { "payment.final.status": "paid" },
                ],
              },
              {
                deliverables: {
                  $elemMatch: {
                    _id: new mongoose.Types.ObjectId(
                      deliverableId
                    ),
                    publicId: deliverable.publicId,
                    format: "pdf",
                    storageProvider: "cloudinary",
                    resourceType: "image",
                  },
                },
              },
            ],
          },
          {
            $inc: {
              "deliverables.$.downloadCount": 1,
            },
            $set: {
              "deliverables.$.lastDownloadedAt": now,
            },
          },
          {
            new: true,
            runValidators: true,
          }
        ).select("_id");

      if (!updatedRequest) {
        return res.status(409).json({
          success: false,
          message:
            "Download eligibility changed. Refresh the request and try again.",
        });
      }

      return res.status(200).json({
        success: true,
        url,
        fileName: deliverable.fileName,
        expiresInSeconds: DOWNLOAD_URL_LIFETIME_SECONDS,
      });
    } catch (error) {
      return makeErrorResponse(res, error);
    }
  }
);