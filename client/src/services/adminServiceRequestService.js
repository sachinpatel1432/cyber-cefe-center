import api from "./api";

/**
 * Get admin service requests with optional filters and pagination.
 */
export const getAdminServiceRequests = async (params = {}) => {
  const response = await api.get("/admin/requests", {
    params,
  });

  return response.data;
};

/**
 * Get staff members eligible for assignment.
 */
export const getAssignableStaff = async () => {
  const response = await api.get("/admin/assignable-staff");

  return response.data;
};

/**
 * Get complete details for a service request.
 */
export const getAdminServiceRequestDetails = async (requestId) => {
  if (!requestId) {
    throw new Error("Service request ID is required.");
  }

  const response = await api.get(
    `/admin/requests/${encodeURIComponent(requestId)}`
  );

  return response.data;
};

/**
 * Assign staff to an unassigned request.
 */
export const assignAdminServiceRequest = async (
  requestId,
  staffId
) => {
  if (!requestId) {
    throw new Error("Service request ID is required.");
  }

  if (!staffId) {
    throw new Error("Please select a staff member.");
  }

  const response = await api.patch(
    `/admin/requests/${encodeURIComponent(requestId)}/assign`,
    {
      staffId,
    }
  );

  return response.data;
};

/**
 * Reassign an eligible request to another staff member.
 *
 * Backend expects:
 * {
 *   staffId: string,
 *   reason: string
 * }
 */
export const reassignAdminServiceRequest = async (
  requestId,
  staffId,
  reason
) => {
  if (!requestId) {
    throw new Error("Service request ID is required.");
  }

  if (!staffId) {
    throw new Error("Please select a staff member.");
  }

  if (typeof reason !== "string" || !reason.trim()) {
    throw new Error("Reassignment reason is required.");
  }

  if (reason.trim().length > 1000) {
    throw new Error(
      "Reassignment reason cannot exceed 1000 characters."
    );
  }

  const response = await api.patch(
    `/admin/requests/${encodeURIComponent(requestId)}/reassign`,
    {
      staffId,
      reason: reason.trim(),
    }
  );

  return response.data;
};

/**
 * Update the status of a service request.
 */
export const updateAdminServiceRequestStatus = async (
  requestId,
  data = {}
) => {
  if (!requestId) {
    throw new Error("Service request ID is required.");
  }

  if (!data.status) {
    throw new Error("Request status is required.");
  }

  const response = await api.patch(
    `/admin/requests/${encodeURIComponent(requestId)}/status`,
    data
  );

  return response.data;
};