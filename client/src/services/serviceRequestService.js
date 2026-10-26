import api from "./api";

/**
 * Create a new service request.
 */
export const createServiceRequest = async (data) => {
  const response = await api.post("/service-requests", data);
  return response.data;
};

/**
 * Get the logged-in customer's service requests.
 */
export const getMyServiceRequests = async (params = {}) => {
  const response = await api.get("/service-requests/my", {
    params,
  });

  return response.data;
};

/**
 * Get customer dashboard summary.
 */
export const getMyServiceRequestSummary = async () => {
  const response = await api.get("/service-requests/summary");
  return response.data;
};

/**
 * Cancel an eligible pending request.
 */
export const cancelMyServiceRequest = async (id) => {
  if (!id) {
    throw new Error("Service request ID is required.");
  }

  const response = await api.patch(
    `/service-requests/${encodeURIComponent(id)}/cancel`
  );

  return response.data;
};

/**
 * Upload an initial or additional customer document.
 *
 * documentData:
 * {
 *   file: File,
 *   title?: string,
 *   documentType?: string,
 *   additionalDocumentRequestId?: string
 * }
 */
export const uploadCustomerDocument = async (
  requestId,
  documentData = {}
) => {
  if (!requestId) {
    throw new Error("Service request ID is required.");
  }

  if (!documentData.file) {
    throw new Error("Please select a document to upload.");
  }

  const formData = new FormData();

  formData.append("file", documentData.file);

  if (documentData.title?.trim()) {
    formData.append("title", documentData.title.trim());
  }

  if (documentData.documentType) {
    formData.append("documentType", documentData.documentType);
  }

  if (documentData.additionalDocumentRequestId) {
    formData.append(
      "additionalDocumentRequestId",
      documentData.additionalDocumentRequestId
    );
  }

  const response = await api.post(
    `/service-requests/${encodeURIComponent(requestId)}/documents`,
    formData
  );

  return response.data;
};

/**
 * Get a secure download URL for a final PDF deliverable.
 *
 * Backend route:
 * GET /api/service-requests/:requestId/deliverables/:deliverableId/download
 *
 * The backend response contains:
 * {
 *   success: true,
 *   url: "...",
 *   fileName: "...",
 *   expiresInSeconds: 60
 * }
 */
export const getDeliverableDownloadUrl = async (
  requestId,
  deliverableId
) => {
  if (!requestId || !deliverableId) {
    throw new Error(
      "Service request ID and deliverable ID are required."
    );
  }

  const response = await api.get(
    `/service-requests/${encodeURIComponent(requestId)}/deliverables/${encodeURIComponent(deliverableId)}/download`
  );

  return response.data;
};