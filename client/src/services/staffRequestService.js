import api from "./api";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const encodeId = (id, label = "Service request ID") => {
  if (id === null || id === undefined || String(id).trim() === "") {
    throw new Error(`${label} is required.`);
  }

  return encodeURIComponent(String(id));
};

const getResponseData = (response) => response?.data ?? {};

/**
 * Fetch available pending requests and requests assigned to
 * the currently logged-in staff member.
 */
export const getStaffRequests = async (params = {}) => {
  const response = await api.get("/staff/requests", { params });
  return getResponseData(response);
};

/**
 * Read staff earning from supported API response formats.
 * Paise is converted into rupees.
 * This helper does not invent an amount when data is missing.
 */
export const getStaffEarningAmount = (request) => {
  if (!request || typeof request !== "object") {
    return null;
  }

  // Legacy API field: amount is already in rupees.
  const legacyAmount = request.staffEarningAmount;

  if (
    legacyAmount !== null &&
    legacyAmount !== undefined &&
    legacyAmount !== "" &&
    Number.isFinite(Number(legacyAmount))
  ) {
    return Number(legacyAmount);
  }

  // New pricing snapshot: amount is stored in paise.
  const snapshotPaise = request.pricingSnapshot?.staffEarningPaise;

  if (
    snapshotPaise !== null &&
    snapshotPaise !== undefined &&
    snapshotPaise !== "" &&
    Number.isFinite(Number(snapshotPaise))
  ) {
    return Number(snapshotPaise) / 100;
  }

  // Alternative flat API field: amount is stored in paise.
  const flatPaise = request.staffEarningPaise;

  if (
    flatPaise !== null &&
    flatPaise !== undefined &&
    flatPaise !== "" &&
    Number.isFinite(Number(flatPaise))
  ) {
    return Number(flatPaise) / 100;
  }

  return null;
};

/**
 * Claim an unassigned pending request.
 * Backend must enforce atomic claiming.
 */
export const claimStaffRequest = async (requestId) => {
  const id = encodeId(requestId);

  const response = await api.post(`/staff/requests/${id}/claim`);

  return getResponseData(response);
};

/**
 * Update the status of a request assigned to the current staff member.
 */
export const updateStaffRequestStatus = async (
  requestId,
  data = {}
) => {
  const id = encodeId(requestId);

  if (
    typeof data.status !== "string" ||
    !data.status.trim()
  ) {
    throw new Error("Request status is required.");
  }

  const response = await api.patch(
    `/staff/requests/${id}/status`,
    data
  );

  return getResponseData(response);
};

/**
 * Request an additional or corrected document from the customer.
 */
export const requestAdditionalDocument = async (
  requestId,
  data = {}
) => {
  const id = encodeId(requestId);

  const title =
    typeof data.title === "string" ? data.title.trim() : "";

  const reason =
    typeof data.reason === "string" ? data.reason.trim() : "";

  const instructions =
    typeof data.instructions === "string"
      ? data.instructions.trim()
      : "";

  if (title.length < 2 || title.length > 120) {
    throw new Error(
      "Document title must contain 2 to 120 characters."
    );
  }

  if (reason.length < 3 || reason.length > 1000) {
    throw new Error(
      "Document request reason must contain 3 to 1000 characters."
    );
  }

  if (instructions.length > 1000) {
    throw new Error(
      "Instructions cannot exceed 1000 characters."
    );
  }

  const payload = {
    title,
    reason,
    instructions,
  };

  if (data.dueDate) {
    payload.dueDate = data.dueDate;
  }

  const response = await api.post(
    `/staff/requests/${id}/additional-documents`,
    payload
  );

  return getResponseData(response);
};

/**
 * Review a customer-uploaded document.
 *
 * Supported statuses:
 * - accepted
 * - rejected
 * - changes_requested
 */
export const reviewCustomerDocument = async (
  requestId,
  documentId,
  data = {}
) => {
  const id = encodeId(requestId);
  const docId = encodeId(documentId, "Document ID");

  const allowedStatuses = [
    "accepted",
    "rejected",
    "changes_requested",
  ];

  if (!allowedStatuses.includes(data.status)) {
    throw new Error("Invalid document review status.");
  }

  const reviewNotes =
    typeof data.reviewNotes === "string"
      ? data.reviewNotes.trim()
      : "";

  if (reviewNotes.length > 1000) {
    throw new Error(
      "Review notes cannot exceed 1000 characters."
    );
  }

  if (
    ["rejected", "changes_requested"].includes(data.status) &&
    !reviewNotes
  ) {
    throw new Error(
      "Please provide a reason or correction instructions."
    );
  }

  const response = await api.patch(
    `/staff/requests/${id}/documents/${docId}/review`,
    {
      status: data.status,
      reviewNotes,
    }
  );

  return getResponseData(response);
};

/**
 * Get a permission-checked temporary URL for a customer-uploaded file.
 *
 * mode: "view" | "download"
 */
export const getStaffCustomerDocumentDownloadUrl = async (
  requestId,
  documentId,
  mode = "download"
) => {
  const id = encodeId(requestId);
  const docId = encodeId(documentId, "Document ID");

  const safeMode = mode === "view" ? "view" : "download";

  const response = await api.get(
    `/staff/requests/${id}/documents/${docId}/download`,
    {
      params: {
        mode: safeMode,
      },
    }
  );

  return getResponseData(response);
};

/**
 * Upload a final PDF deliverable for an assigned request.
 * The backend must independently validate file type and size.
 */
export const uploadStaffDeliverable = async (
  requestId,
  data = {}
) => {
  const id = encodeId(requestId);

  const file = data.file;

  const title =
    typeof data.title === "string" ? data.title.trim() : "";

  if (!file) {
    throw new Error("Please select a PDF file.");
  }

  if (
    file.type !== "application/pdf" ||
    !file.name?.toLowerCase().endsWith(".pdf")
  ) {
    throw new Error("Only PDF files are allowed.");
  }

  if (file.size <= 0 || file.size > MAX_FILE_SIZE) {
    throw new Error(
      "PDF size must be greater than 0 and 10 MB or less."
    );
  }

  if (title.length > 120) {
    throw new Error("PDF title cannot exceed 120 characters.");
  }

  const formData = new FormData();

  formData.append("file", file);

  if (title) {
    formData.append("title", title);
  }

  const response = await api.post(
    `/staff/requests/${id}/deliverables`,
    formData
  );

  return getResponseData(response);
};