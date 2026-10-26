import { Router } from "express";

import { requireAdmin } from "../middleware/adminMiddleware.js";

import {
  getAdminDashboard,
  getAdminUsers,
  updateAdminUserStatus,
  getAdminUserDetails,
  deleteAdminUser,
  createAdminStaff,
} from "../controllers/adminController.js";

import {
  getAdminServiceRequests,
  getAssignableStaff,
  getAdminServiceRequestDetails,
  assignAdminServiceRequest,
  reassignAdminServiceRequest,
  updateAdminServiceRequestStatus,
} from "../controllers/adminServiceRequestController.js";

const router = Router();

/**
 * Protect all admin routes.
 * Only authenticated admin users can access these endpoints.
 */
router.use(...requireAdmin);

/**
 * Health check
 * GET /api/admin/health
 */
router.get("/health", (req, res) => {
  return res.status(200).json({
    success: true,
    message: "Admin routes are protected and working.",
  });
});

/**
 * Admin dashboard
 * GET /api/admin/dashboard
 */
router.get("/dashboard", getAdminDashboard);

/**
 * User management
 * GET    /api/admin/users
 * GET    /api/admin/users/:id
 * PATCH  /api/admin/users/:id/status
 * DELETE /api/admin/users/:id
 */
router.get("/users", getAdminUsers);
router.get("/users/:id", getAdminUserDetails);
router.patch("/users/:id/status", updateAdminUserStatus);
router.delete("/users/:id", deleteAdminUser);

/**
 * Create staff account
 * POST /api/admin/users
 * POST /api/admin/staff
 *
 * Both endpoints are kept for compatibility with existing frontend calls.
 */
router.post("/users", createAdminStaff);
router.post("/staff", createAdminStaff);

/**
 * Staff management
 * GET /api/admin/assignable-staff
 */
router.get("/assignable-staff", getAssignableStaff);

/**
 * Service request management
 * GET /api/admin/requests
 * GET /api/admin/requests/:id
 */
router.get("/requests", getAdminServiceRequests);
router.get("/requests/:id", getAdminServiceRequestDetails);

/**
 * Assign staff to an unassigned service request
 * PATCH /api/admin/requests/:id/assign
 */
router.patch(
  "/requests/:id/assign",
  assignAdminServiceRequest
);

/**
 * Reassign a request to another staff member
 * PATCH /api/admin/requests/:id/reassign
 *
 * Controller expects:
 * {
 *   "staffId": "STAFF_USER_ID",
 *   "reason": "Reason for reassignment"
 * }
 */
router.patch(
  "/requests/:id/reassign",
  reassignAdminServiceRequest
);

/**
 * Update service request status
 * PATCH /api/admin/requests/:id/status
 */
router.patch(
  "/requests/:id/status",
  updateAdminServiceRequestStatus
);

export default router;