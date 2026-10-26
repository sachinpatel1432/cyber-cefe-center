import api from "./api";

/**
 * Validate an ID before making an API request.
 */
const validateId = (id, label) => {
  if (
    !id ||
    typeof id !== "string" ||
    !id.trim()
  ) {
    throw new Error(`${label} is required.`);
  }

  return encodeURIComponent(id.trim());
};

/**
 * Fetch messages for a service request.
 *
 * GET /api/requests/:requestId/messages
 *
 * @param {string} requestId
 * @param {Object} params - Optional page and limit.
 * @returns {Promise<Object>}
 */
export const getRequestMessages = async (
  requestId,
  params = {}
) => {
  const safeRequestId = validateId(
    requestId,
    "Service request ID"
  );

  const response = await api.get(
    `/requests/${safeRequestId}/messages`,
    {
      params: {
        page: params.page ?? 1,
        limit: params.limit ?? 30,
      },
    }
  );

  return response.data;
};

/**
 * Send a new message in a service request conversation.
 *
 * POST /api/requests/:requestId/messages
 *
 * @param {string} requestId
 * @param {string} message
 * @returns {Promise<Object>}
 */
export const sendRequestMessage = async (
  requestId,
  message
) => {
  const safeRequestId = validateId(
    requestId,
    "Service request ID"
  );

  if (typeof message !== "string" || !message.trim()) {
    throw new Error("Message cannot be empty.");
  }

  if (message.trim().length > 2000) {
    throw new Error("Message cannot exceed 2000 characters.");
  }

  const response = await api.post(
    `/requests/${safeRequestId}/messages`,
    {
      message: message.trim(),
    }
  );

  return response.data;
};

/**
 * Mark incoming messages as read for the logged-in user.
 *
 * PATCH /api/requests/:requestId/messages/read
 *
 * @param {string} requestId
 * @returns {Promise<Object>}
 */
export const markRequestMessagesRead = async (requestId) => {
  const safeRequestId = validateId(
    requestId,
    "Service request ID"
  );

  const response = await api.patch(
    `/requests/${safeRequestId}/messages/read`
  );

  return response.data;
};

/**
 * Fetch status and staff-assignment activity for a request.
 *
 * GET /api/requests/:requestId/activity
 *
 * @param {string} requestId
 * @returns {Promise<Object>}
 */
export const getRequestActivity = async (requestId) => {
  const safeRequestId = validateId(
    requestId,
    "Service request ID"
  );

  const response = await api.get(
    `/requests/${safeRequestId}/activity`
  );

  return response.data;
};