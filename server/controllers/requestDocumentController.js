import mongoose from "mongoose";
import { randomUUID } from "node:crypto";
import { v2 as cloudinary } from "cloudinary";

import ServiceRequest from "../models/ServiceRequest.js";

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
]);

const ACTIVE_UPLOAD_STATUSES = [
  "pending",
  "approved",
  "documents_required",
  "in_progress",
];

const ADDITIONAL_UPLOAD_STATUSES = [
  "requested",
  "rejected",
];

/**
 * Configure private Cloudinary storage.
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
      "Document storage is not configured."
    );

    error.status = 503;
    throw error;
  }

  return config;
};

/**
 * Sanitize filenames before using them in storage paths.
 */
const sanitizeFileName = (name) =>
  String(name || "document")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-zA-Z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 100) || "document";

/**
 * Normalize labels for required-document comparison.
 */
const normalizeLabel = (value) =>
  typeof value === "string"
    ? value.trim().toLowerCase().replace(/[^a-z0-9]/g, "")
    : "";

/**
 * Validate file signatures instead of trusting MIME type alone.
 */
const matchesFileSignature = (buffer, mimeType) => {
  if (!Buffer.isBuffer(buffer)) {
    return false;
  }

  if (mimeType === "application/pdf") {
    return buffer.subarray(0, 5).toString() === "%PDF-";
  }

  if (mimeType === "image/jpeg") {
    return (
      buffer.length >= 3 &&
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff
    );
  }

  if (mimeType === "image/png") {
    return (
      buffer.length >= 8 &&
      buffer
        .subarray(0, 8)
        .equals(
          Buffer.from([
            137, 80, 78, 71, 13, 10, 26, 10,
          ])
        )
    );
  }

  return false;
};

/**
 * Map MIME type to a normalized file extension.
 */
const getFileExtension = (mimeType) => {
  const extensions = {
    "application/pdf": "pdf",
    "image/jpeg": "jpg",
    "image/png": "png",
  };

  return extensions[mimeType] || null;
};

/**
 * Upload a file to authenticated Cloudinary storage.
 *
 * These files must not be stored as publicly accessible assets.
 */
const uploadPrivateFile = (buffer, publicId) =>
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
          return reject(error);
        }

        return resolve(result);
      }
    );

    stream.end(buffer);
  });

/**
 * Remove an uploaded private file when the database write fails.
 */
const removePrivateFile = async (publicId) => {
  if (!publicId) {
    return;
  }

  try {
    await cloudinary.uploader.destroy(publicId, {
      resource_type: "image",
      type: "authenticated",
      invalidate: true,
    });
  } catch {
    console.error(
      "Private document cleanup failed."
    );
  }
};

/**
 * Never return internal Cloudinary public IDs to customers.
 */
const toSafeDocument = (document) => ({
  _id: document._id,
  title: document.title,
  documentType: document.documentType,
  kind: document.kind,
  additionalDocumentRequestId:
    document.additionalDocumentRequestId,
  fileName: document.fileName,
  mimeType: document.mimeType,
  format: document.format,
  bytes: document.bytes,
  uploadedBy: document.uploadedBy,
  uploadedAt: document.uploadedAt,
  reviewStatus: document.reviewStatus,
  reviewedBy: document.reviewedBy,
  reviewedAt: document.reviewedAt,
  reviewNotes: document.reviewNotes,
});

/**
 * POST /api/service-requests/:id/documents
 *
 * Upload either:
 * 1. An initial required document.
 * 2. An additional document requested by staff.
 *
 * Required authentication:
 *   requireAuth + requireRole("customer")
 *
 * Multipart fields:
 *   file: required
 *   title: optional
 *   documentType: required for initial documents
 *   additionalDocumentRequestId: for additional documents
 */
export const uploadCustomerDocument = asyncHandler(
  async (req, res) => {
    let uploadedPublicId = null;

    try {
      // Validate request ID.
      if (!mongoose.isValidObjectId(req.params.id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid service request ID.",
        });
      }

      // Validate the uploaded file.
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "Please select a document to upload.",
        });
      }

      const buffer = req.file.buffer;
      const mimeType = req.file.mimetype;
      const fileSize = buffer?.length || 0;

      if (
        !Buffer.isBuffer(buffer) ||
        fileSize < 1 ||
        fileSize > MAX_FILE_SIZE ||
        (req.file.size && req.file.size > MAX_FILE_SIZE)
      ) {
        return res.status(400).json({
          success: false,
          message:
            "File size must be between 1 byte and 10 MB.",
        });
      }

      if (
        !ALLOWED_MIME_TYPES.has(mimeType) ||
        !matchesFileSignature(buffer, mimeType)
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Only valid PDF, JPEG and PNG documents are accepted.",
        });
      }

      const extension = getFileExtension(mimeType);

      if (!extension) {
        return res.status(400).json({
          success: false,
          message: "Unsupported document format.",
        });
      }

      // Find the request owned by this authenticated customer.
      const request = await ServiceRequest.findOne({
        _id: req.params.id,
        customer: req.authUser._id,
      });

      // Do not disclose another customer's request.
      if (!request) {
        return res.status(404).json({
          success: false,
          message: "Service request not found.",
        });
      }

      if (!ACTIVE_UPLOAD_STATUSES.includes(request.status)) {
        return res.status(409).json({
          success: false,
          message:
            "Documents cannot be uploaded in the current request status.",
        });
      }

      const additionalRequestId =
        typeof req.body.additionalDocumentRequestId === "string"
          ? req.body.additionalDocumentRequestId.trim()
          : "";

      const isAdditional = Boolean(additionalRequestId);

      let additionalRequest = null;
      let documentType = "";

      // Validate additional-document request.
      if (isAdditional) {
        if (!mongoose.isValidObjectId(additionalRequestId)) {
          return res.status(400).json({
            success: false,
            message:
              "Invalid additional-document request ID.",
          });
        }

        additionalRequest =
          request.additionalDocumentRequests.id(
            additionalRequestId
          );

        if (!additionalRequest) {
          return res.status(404).json({
            success: false,
            message:
              "Additional-document request not found.",
          });
        }

        if (
          !ADDITIONAL_UPLOAD_STATUSES.includes(
            additionalRequest.status
          )
        ) {
          return res.status(409).json({
            success: false,
            message:
              "This document is not currently awaiting upload or correction.",
          });
        }

        documentType = additionalRequest.title;
      } else {
        // Validate initial-document type.
        if (
          typeof req.body.documentType !== "string" ||
          !req.body.documentType.trim() ||
          req.body.documentType.trim().length > 100
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Please select or enter a valid document type.",
          });
        }

        documentType = req.body.documentType.trim();

        // If the service specifies required documents,
        // initial uploads must match one of those requirements.
        const requiredDocuments =
          request.requiredDocuments || [];

        if (requiredDocuments.length > 0) {
          const matchesRequiredDocument =
            requiredDocuments.some(
              (requiredName) =>
                normalizeLabel(requiredName) ===
                normalizeLabel(documentType)
            );

          if (!matchesRequiredDocument) {
            return res.status(400).json({
              success: false,
              message:
                "Choose a document type from this service's required-document list. Additional files must be requested by staff.",
            });
          }
        }
      }

      // Validate optional display title.
      const suppliedTitle =
        typeof req.body.title === "string"
          ? req.body.title.trim()
          : "";

      if (suppliedTitle.length > 120) {
        return res.status(400).json({
          success: false,
          message:
            "Document title must be 120 characters or fewer.",
        });
      }

      const originalBaseName = sanitizeFileName(
        req.file.originalname
      );

      const title =
        suppliedTitle ||
        documentType ||
        originalBaseName;

      // Configure storage before uploading anything.
      configureCloudinary();

      const publicId =
        `cyberdesk-documents/${request._id}/` +
        `${randomUUID()}-${originalBaseName}`;

      const uploadResult = await uploadPrivateFile(
        buffer,
        publicId
      );

      uploadedPublicId = uploadResult?.public_id || null;

      if (
        !uploadedPublicId ||
        uploadResult.resource_type !== "image" ||
        uploadResult.type !== "authenticated"
      ) {
        await removePrivateFile(uploadedPublicId);
        uploadedPublicId = null;

        return res.status(502).json({
          success: false,
          message:
            "Private document storage failed to confirm the upload.",
        });
      }

      // Construct a new document ID before writing to MongoDB.
      // The same ID is used by additionalDocumentRequests.latestDocument.
      const documentId = new mongoose.Types.ObjectId();
      const now = new Date();

      const documentData = {
        _id: documentId,
        title,
        documentType,
        kind: isAdditional ? "additional" : "initial",
        additionalDocumentRequestId: isAdditional
          ? new mongoose.Types.ObjectId(additionalRequestId)
          : null,
        fileName: `${originalBaseName}.${extension}`,
        mimeType,
        format: extension,
        bytes: fileSize,
        storageProvider: "cloudinary",
        publicId: uploadedPublicId,
        resourceType: "image",
        uploadedBy: req.authUser._id,
        uploadedAt: now,
        reviewStatus: "pending_review",
      };

      /*
       * Atomically check customer ownership, request status and,
       * when applicable, the additional-document request status.
       *
       * This prevents two concurrent uploads from both satisfying
       * the same "requested" additional-document state.
       */
      const filter = {
        _id: request._id,
        customer: req.authUser._id,
        status: {
          $in: ACTIVE_UPLOAD_STATUSES,
        },
      };

      const update = {
        $push: {
          documents: documentData,
        },
      };

      if (isAdditional) {
        filter.additionalDocumentRequests = {
          $elemMatch: {
            _id: new mongoose.Types.ObjectId(
              additionalRequestId
            ),
            status: {
              $in: ADDITIONAL_UPLOAD_STATUSES,
            },
          },
        };

        update.$set = {
          "additionalDocumentRequests.$.status": "uploaded",
          "additionalDocumentRequests.$.latestDocument":
            documentId,
          "additionalDocumentRequests.$.respondedAt": now,
          "additionalDocumentRequests.$.reviewNotes": "",
        };
      }

      const updatedRequest =
        await ServiceRequest.findOneAndUpdate(
          filter,
          update,
          {
            new: true,
            runValidators: true,
          }
        );

      if (!updatedRequest) {
        await removePrivateFile(uploadedPublicId);
        uploadedPublicId = null;

        return res.status(409).json({
          success: false,
          message:
            "The request or document-upload state changed. Refresh and try again.",
        });
      }

      const savedDocument =
        updatedRequest.documents.id(documentId);

      if (!savedDocument) {
        // Defensive consistency check.
        await removePrivateFile(uploadedPublicId);
        uploadedPublicId = null;

        return res.status(500).json({
          success: false,
          message:
            "The document could not be confirmed after saving.",
        });
      }

      // MongoDB now references the file, so do not remove it in catch.
      uploadedPublicId = null;

      return res.status(201).json({
        success: true,
        message: isAdditional
          ? "Additional document uploaded successfully. Staff will review it."
          : "Document uploaded successfully. Staff will review it.",
        requestId: updatedRequest._id,
        document: toSafeDocument(savedDocument),
      });
    } catch (error) {
      if (uploadedPublicId) {
        await removePrivateFile(uploadedPublicId);
      }

      if (error?.name === "ValidationError") {
        return res.status(400).json({
          success: false,
          message:
            "Document metadata failed validation.",
        });
      }

      if (error?.status === 503) {
        return res.status(503).json({
          success: false,
          message:
            "Document storage is not configured. Please contact support.",
        });
      }

      if (error?.code === "LIMIT_FILE_SIZE") {
        return res.status(413).json({
          success: false,
          message:
            "The uploaded file exceeds the 10 MB limit.",
        });
      }

      // Avoid returning provider credentials, public IDs or internal errors.
      console.error("Customer document upload failed.");

      return res.status(500).json({
        success: false,
        message:
          "Document upload failed. Please try again.",
      });
    }
  }
);