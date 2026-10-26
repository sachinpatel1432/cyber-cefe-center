
import { requireAuth, requireRole } from "./authMiddleware.js";

// Allow only authenticated users with the admin role.
export const requireAdmin = [requireAuth, requireRole("admin")];
