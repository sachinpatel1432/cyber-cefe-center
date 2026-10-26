import { Router } from "express";
import multer from "multer";

import {
  getStaffRequests,
  claimStaffRequest,
  updateStaffRequestStatus,
  requestAdditionalDocument,
  reviewCustomerDocument,
} from "../controllers/staffRequestController.js";

import {
  uploadStaffDeliverable,
} from "../controllers/deliverableController.js";

import {
  getStaffCustomerDocumentDownloadUrl,
} from "../controllers/staffDocumentController.js";

import {
  requireAuth,
  requireRole,
} from "../middleware/authMiddleware.js";

const router = Router();

const MAX_FILE_SIZE = 10 * 1024 * 1024;

/**
 * Final staff deliverable upload.
 * PDF only, maximum 10 MB.
 */
const pdfUpload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1,
  },

  fileFilter: (req, file, callback) => {
    const extension = file.originalname
      ?.split(".")
      .pop()
      ?.toLowerCase();

    if (
      file.mimetype !== "application/pdf" ||
      extension !== "pdf"
    ) {
      const error = new Error("Only PDF files are allowed.");
      error.statusCode = 400;
      error.code = "INVALID_FILE_TYPE";

      return callback(error);
    }

    return callback(null, true);
  },
});

// All staff routes require authentication and staff role.
router.use(requireAuth);
router.use(requireRole("staff"));

/**
 * GET /api/staff/requests
 * Available requests and current staff assignments.
 */
router.get("/", getStaffRequests);

/**
 * POST /api/staff/requests/:id/claim
 * Claim one available pending request.
 */
router.post("/:id/claim", claimStaffRequest);

/**
 * PATCH /api/staff/requests/:id/status
 * Update the status of an assigned request.
 */
router.patch("/:id/status", updateStaffRequestStatus);

/**
 * POST /api/staff/requests/:id/additional-documents
 * Ask the customer for another or corrected document.
 */
router.post(
  "/:id/additional-documents",
  requestAdditionalDocument
);

/**
 * PATCH /api/staff/requests/:id/documents/:documentId/review
 * Accept, reject or request corrections for a document.
 */
router.patch(
  "/:id/documents/:documentId/review",
  reviewCustomerDocument
);

/**
 * GET /api/staff/requests/:id/documents/:documentId/download?mode=view
 * GET /api/staff/requests/:id/documents/:documentId/download?mode=download
 *
 * Generate a secure temporary URL for a customer-uploaded document.
 */
router.get(
  "/:id/documents/:documentId/download",
  getStaffCustomerDocumentDownloadUrl
);

/**
 * POST /api/staff/requests/:id/deliverables
 * Upload the final PDF for an assigned request.
 */
router.post(
  "/:id/deliverables",
  pdfUpload.single("file"),
  uploadStaffDeliverable
);

export default router;