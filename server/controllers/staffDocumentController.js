import mongoose from "mongoose";
import { v2 as cloudinary } from "cloudinary";

import ServiceRequest from "../models/ServiceRequest.js";

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

const DOWNLOAD_URL_LIFETIME_SECONDS = 60;

const ALLOWED_FORMATS = new Set([
  "pdf",
  "jpg",
  "jpeg",
  "png",
]);

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
    const error = new Error("Cloudinary is not configured.");
    error.status = 503;
    throw error;
  }
};

/**
 * GET /api/staff/requests/:id/documents/:documentId/download
 *
 * Query:
 *   mode=view     -> Opens a compatible file inline
 *   mode=download -> Requests download as an attachment
 *
 * Only the staff member currently assigned to the request
 * can access the uploaded customer document.
 */
export const getStaffCustomerDocumentDownloadUrl = asyncHandler(
  async (req, res) => {
    try {
      const { id, documentId } = req.params;

      if (
        !mongoose.isValidObjectId(id) ||
        !mongoose.isValidObjectId(documentId)
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid request or document ID.",
        });
      }

      const request = await ServiceRequest.findOne({
        _id: id,
        staff: req.authUser._id,
      }).select("+documents.publicId");

      if (!request) {
        return res.status(404).json({
          success: false,
          message: "Assigned service request not found.",
        });
      }

      const document = request.documents.id(documentId);

      if (!document) {
        return res.status(404).json({
          success: false,
          message: "Uploaded customer document not found.",
        });
      }

      if (
        !document.publicId ||
        document.storageProvider !== "cloudinary" ||
        document.resourceType !== "image"
      ) {
        return res.status(409).json({
          success: false,
          message:
            "This document is not configured for secure viewing or download.",
        });
      }

      const format = String(
        document.format || ""
      ).toLowerCase();

      if (!ALLOWED_FORMATS.has(format)) {
        return res.status(415).json({
          success: false,
          message: "This document format is not supported.",
        });
      }

      configureCloudinary();

      const mode =
        req.query.mode === "view" ? "view" : "download";

      const expiresAt =
        Math.floor(Date.now() / 1000) +
        DOWNLOAD_URL_LIFETIME_SECONDS;

      const url = cloudinary.utils.private_download_url(
        document.publicId,
        format,
        {
          resource_type: "image",
          type: "authenticated",
          expires_at: expiresAt,
          attachment: mode === "download",
        }
      );

      return res.status(200).json({
        success: true,
        url,
        fileName: document.fileName || document.title || "document",
        mimeType: document.mimeType || "application/octet-stream",
        mode,
        expiresInSeconds: DOWNLOAD_URL_LIFETIME_SECONDS,
      });
    } catch (error) {
      if (error?.status === 503) {
        return res.status(503).json({
          success: false,
          message: "Document storage is temporarily unavailable.",
        });
      }

      console.error("Staff document access failed.");

      return res.status(500).json({
        success: false,
        message: "Unable to prepare the document. Please try again.",
      });
    }
  }
);