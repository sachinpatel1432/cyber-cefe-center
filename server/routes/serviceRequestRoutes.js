import { Router } from "express";
import multer from "multer";

import {
  createServiceRequest,
  getMyServiceRequests,
  getMyServiceRequestSummary,
  cancelMyServiceRequest,
} from "../controllers/serviceRequestController.js";

import {
  uploadCustomerDocument,
} from "../controllers/requestDocumentController.js";

import {
  getCustomerDeliverableDownload,
} from "../controllers/deliverableController.js";

import {
  requireAuth,
  requireRole,
} from "../middleware/authMiddleware.js";

const router = Router();

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const documentUpload = multer({
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

    const allowedTypes = {
      "application/pdf": ["pdf"],
      "image/jpeg": ["jpg", "jpeg"],
      "image/png": ["png"],
    };

    const extensions = allowedTypes[file.mimetype];

    if (!extensions || !extensions.includes(extension)) {
      const error = new Error(
        "Only PDF, JPG, JPEG and PNG files are allowed."
      );

      error.status = 400;
      error.code = "INVALID_FILE_TYPE";

      return callback(error);
    }

    return callback(null, true);
  },
});

// All endpoints below require customer authentication.
router.use(requireAuth);
router.use(requireRole("customer"));

// Dashboard summary
router.get("/summary", getMyServiceRequestSummary);

// Customer request history
router.get("/my", getMyServiceRequests);

// Create a new service request
router.post("/", createServiceRequest);

// Cancel an eligible pending request
router.patch("/:id/cancel", cancelMyServiceRequest);

// Upload an initial or additional document
router.post(
  "/:id/documents",
  documentUpload.single("file"),
  uploadCustomerDocument
);

// Request a secure final-deliverable download URL
router.get(
  "/:requestId/deliverables/:deliverableId/download",
  getCustomerDeliverableDownload
);

export default router;