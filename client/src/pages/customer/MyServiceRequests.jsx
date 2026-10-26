import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import "../../styles/my-service-requests.css";

import {
  getMyServiceRequests,
  cancelMyServiceRequest,
  uploadCustomerDocument,
  getDeliverableDownloadUrl,
} from "../../services/serviceRequestService";

const PAGE_SIZE = 10;

const formatMoney = (amount) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(amount) || 0);

const formatDate = (date) => {
  if (!date) return "Not available";

  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) return "—";

  return parsedDate.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
};

const formatStatus = (value = "pending") =>
  String(value)
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const statusStyles = {
  pending: "warning",
  approved: "info",
  documents_required: "warning",
  in_progress: "primary",
  ready_for_payment: "warning",
  ready_for_download: "success",
  completed: "success",
  delivered: "success",
  rejected: "danger",
  cancelled: "secondary",
  closed: "secondary",
};

const reviewStyles = {
  pending_review: "warning",
  accepted: "success",
  rejected: "danger",
  changes_requested: "warning",
};

const paymentStyles = {
  not_required: "secondary",
  pending: "warning",
  processing: "info",
  paid: "success",
  failed: "danger",
  refunded: "secondary",
};

const uploadableStatuses = [
  "pending",
  "approved",
  "documents_required",
  "in_progress",
];

const isValidUploadFile = (file) => {
  if (!file) return false;

  const allowedTypes = [
    "application/pdf",
    "image/jpeg",
    "image/png",
  ];

  const extension = file.name.split(".").pop()?.toLowerCase();

  const validExtension = [
    "pdf",
    "jpg",
    "jpeg",
    "png",
  ].includes(extension);

  return allowedTypes.includes(file.type) && validExtension;
};

const getErrorMessage = (error, fallback) =>
  error?.response?.data?.message ||
  error?.message ||
  fallback;

export default function MyServiceRequests() {
  const [requests, setRequests] = useState([]);

  const [status, setStatus] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedRequestId, setExpandedRequestId] = useState(null);
  const [page, setPage] = useState(1);

  const [pagination, setPagination] = useState({
    page: 1,
    limit: PAGE_SIZE,
    total: 0,
    totalPages: 0,
  });

  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [fileInputVersion, setFileInputVersion] = useState(0);

  const [uploadForms, setUploadForms] = useState({});
  const [additionalFiles, setAdditionalFiles] = useState({});

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  /**
   * Load requests belonging to the authenticated customer.
   */
  const loadRequests = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const result = await getMyServiceRequests({
        page,
        limit: PAGE_SIZE,
        status,
      });

      const resultRequests = Array.isArray(result?.requests)
        ? result.requests
        : [];

      const resultPagination = result?.pagination || {};

      if (resultRequests.length === 0 && page > 1) {
        setPage((currentPage) => Math.max(1, currentPage - 1));
        return;
      }

      setRequests(resultRequests);

      setPagination({
        page: resultPagination.page ?? page,
        limit: resultPagination.limit ?? PAGE_SIZE,
        total: resultPagination.total ?? resultRequests.length,
        totalPages: resultPagination.totalPages ?? 0,
      });
    } catch (err) {
      setError(
        getErrorMessage(
          err,
          "Your requests could not be loaded. Please try again."
        )
      );
    } finally {
      setLoading(false);
    }
  }, [page, status, refreshKey]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  /**
   * Refresh request data.
   */
  const handleRefresh = () => {
    setError("");
    setSuccess("");
    setRefreshKey((current) => current + 1);
  };

  /**
   * Change the request status filter.
   */
  const handleStatusChange = (newStatus) => {
    setStatus(newStatus);
    setPage(1);
    setSuccess("");
    setError("");
  };

  /**
   * Cancel a pending booking.
   */
  const handleCancel = async (request) => {
    if (request.status !== "pending" || busyId) return;

    const confirmed = window.confirm(
      `Kya aap request ${
        request.requestNumber || request._id
      } cancel karna chahte hain?`
    );

    if (!confirmed) return;

    setBusyId(request._id);
    setError("");
    setSuccess("");

    try {
      const result = await cancelMyServiceRequest(request._id);

      setSuccess(
        result?.message || "Request successfully cancelled."
      );

      setRefreshKey((current) => current + 1);
    } catch (err) {
      setError(
        getErrorMessage(
          err,
          "Request cancel nahi ho paayi. Please try again."
        )
      );
    } finally {
      setBusyId(null);
    }
  };

  /**
   * Update the initial-document upload form for a request.
   */
  const updateUploadForm = (requestId, field, value) => {
    setUploadForms((previous) => ({
      ...previous,
      [requestId]: {
        ...previous[requestId],
        [field]: value,
      },
    }));
  };

  /**
   * Upload an initial customer document.
   */
  const handleInitialDocumentUpload = async (event, request) => {
    event.preventDefault();

    if (busyId) return;

    const form = uploadForms[request._id] || {};

    // Read directly from the submitted form first. This avoids a stale
    // React state value causing "Please select a document" when a file
    // is visibly selected in the input.
    const selectedInputFile =
      event.currentTarget.querySelector('input[type="file"]')?.files?.[0] || null;
    const file = selectedInputFile || form.file || null;
    const title = (form.title || "").trim();
    const documentType = (form.documentType || "").trim();

    if (!uploadableStatuses.includes(request.status)) {
      setError(
        "Is request ke current status mein document upload allowed nahi hai."
      );
      return;
    }

    if (!file) {
      setError("Please select a file in this request card, then click Upload Document.");
      return;
    }

    if (!isValidUploadFile(file)) {
      setError("Only valid PDF, JPEG and PNG files are allowed.");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError("File size must not exceed 10 MB.");
      return;
    }

    if (!documentType) {
      setError("Please select or enter the document type.");
      return;
    }

    if (documentType.length > 100) {
      setError("Document type cannot exceed 100 characters.");
      return;
    }

    if (title.length > 150) {
      setError("Document title cannot exceed 150 characters.");
      return;
    }

    setBusyId(request._id);
    setError("");
    setSuccess("");

    try {
      const result = await uploadCustomerDocument(request._id, {
        file,
        title: title || documentType,
        documentType,
      });

      setSuccess(
        result?.message ||
          "Document uploaded successfully. It may require staff review."
      );

      setUploadForms((previous) => ({
        ...previous,
        [request._id]: {
          title: "",
          documentType: "",
          file: null,
        },
      }));

      setFileInputVersion((current) => current + 1);
      setRefreshKey((current) => current + 1);
    } catch (err) {
      setError(
        getErrorMessage(
          err,
          "Document upload failed. Please try again."
        )
      );
    } finally {
      setBusyId(null);
    }
  };

  /**
   * Upload a document requested by staff.
   */
  const handleAdditionalDocumentUpload = async (
    event,
    request,
    documentRequest
  ) => {
    event.preventDefault();

    if (busyId) return;

    // Prefer the file currently selected in this form, then fall back
    // to component state.
    const selectedInputFile =
      event.currentTarget.querySelector('input[type="file"]')?.files?.[0] || null;
    const file = selectedInputFile || additionalFiles[documentRequest._id] || null;

    if (!uploadableStatuses.includes(request.status)) {
      setError(
        "Is request ke current status mein document upload allowed nahi hai."
      );
      return;
    }

    if (!file) {
      setError("Please select a file in this additional-document form, then upload it.");
      return;
    }

    if (!isValidUploadFile(file)) {
      setError("Only valid PDF, JPEG and PNG files are allowed.");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError("File size must not exceed 10 MB.");
      return;
    }

    setBusyId(request._id);
    setError("");
    setSuccess("");

    try {
      const result = await uploadCustomerDocument(request._id, {
        file,
        title: documentRequest.title,
        documentType: documentRequest.title,
        additionalDocumentRequestId: documentRequest._id,
      });

      setSuccess(
        result?.message ||
          "Additional document uploaded successfully."
      );

      setAdditionalFiles((previous) => ({
        ...previous,
        [documentRequest._id]: null,
      }));

      setFileInputVersion((current) => current + 1);
      setRefreshKey((current) => current + 1);
    } catch (err) {
      setError(
        getErrorMessage(
          err,
          "Additional document upload failed. Please try again."
        )
      );
    } finally {
      setBusyId(null);
    }
  };

  /**
   * Request a secure download URL for a deliverable.
   * The backend remains responsible for ownership, status and payment checks.
   */
  const handleDownload = async (request, deliverable) => {
    if (busyId) return;

    setBusyId(request._id);
    setError("");
    setSuccess("");

    try {
      const result = await getDeliverableDownloadUrl(
        request._id,
        deliverable._id
      );

      const downloadUrl =
        result?.downloadUrl ||
        result?.url ||
        result?.data?.downloadUrl ||
        result?.data?.url;

      if (!downloadUrl) {
        throw new Error(
          "Backend response did not contain a download URL. Please check the download controller response."
        );
      }

      // Use only the URL returned by the authenticated backend.
      window.location.assign(downloadUrl);
    } catch (err) {
      setError(
        getErrorMessage(
          err,
          "Download link could not be generated. Check payment and request status."
        )
      );

      setBusyId(null);
    }
  };

  const getStatusBadge = (value) => (
    <span
      className={`badge text-bg-${
        statusStyles[value] || "secondary"
      }`}
    >
      {formatStatus(value)}
    </span>
  );

  const getReviewBadge = (value) => (
    <span
      className={`badge text-bg-${
        reviewStyles[value] || "secondary"
      }`}
    >
      {formatStatus(value || "pending_review")}
    </span>
  );

  const canUploadDocuments = (request) =>
    uploadableStatuses.includes(request.status);

  const normalizedSearch = searchQuery.trim().toLowerCase();
  const visibleRequests = requests.filter((request) => {
    if (!normalizedSearch) return true;
    const searchable = [
      request.requestNumber,
      request.serviceName,
      request.category,
      request.status,
      request.customerNotes,
      request.staffNotes,
      request.staff?.fullName,
      request.staff?.name,
    ].filter(Boolean).join(" ").toLowerCase();
    return searchable.includes(normalizedSearch);
  });

  return (
    <main className="cyber-my-requests container-fluid px-3 px-lg-4 py-4 py-lg-5">
      {/* Page header */}
      <header className="my-requests-hero d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
        <div>
          <span className="my-requests-eyebrow mb-2">
            <i className="bi bi-grid-1x2 me-2" aria-hidden="true" /> CUSTOMER PORTAL
          </span>

          <h1 className="display-6 fw-bold mb-2">
            My Service Requests
          </h1>

          <p className="text-secondary mb-0">
            Apni bookings, document submissions, payments aur
            digital deliverables track karein.
          </p>
        </div>

        <div className="d-flex flex-wrap gap-2">
          <Link
            to="/services"
            className="btn btn-primary"
          >
            <i className="bi bi-plus-lg me-2" aria-hidden="true" />
            New booking
          </Link>
          <Link
            to="/customer/dashboard"
            className="btn btn-outline-primary"
          >
            <i className="bi bi-grid me-2" aria-hidden="true" />
            Dashboard
          </Link>

          <button
            type="button"
            className="btn btn-primary"
            onClick={handleRefresh}
            disabled={loading || Boolean(busyId)}
          >
            <i
              className="bi bi-arrow-clockwise me-2"
              aria-hidden="true"
            />
            Refresh
          </button>
        </div>
      </header>

      {/* Alerts */}
      {error && (
        <div className="alert alert-danger" role="alert">
          <div className="d-flex justify-content-between align-items-start gap-3">
            <span>{error}</span>

            <button
              type="button"
              className="btn-close"
              aria-label="Dismiss error"
              onClick={() => setError("")}
            />
          </div>
        </div>
      )}

      {success && (
        <div className="alert alert-success" role="status">
          <div className="d-flex justify-content-between align-items-start gap-3">
            <span>{success}</span>

            <button
              type="button"
              className="btn-close"
              aria-label="Dismiss success"
              onClick={() => setSuccess("")}
            />
          </div>
        </div>
      )}

      {/* Booking history */}
      <section className="card border-0 shadow-sm rounded-4">
        <div className="card-header bg-white border-0 p-3 p-lg-4">
          <div className="row align-items-end g-3">
            <div className="col-12 col-md-4">
              <h2 className="h5 fw-bold mb-1">
                Booking History
              </h2>

              <p className="small text-secondary mb-0">
                {pagination.total} matching{" "}
                {pagination.total === 1 ? "request" : "requests"}
                {normalizedSearch ? ` · ${visibleRequests.length} shown on this page` : ""}
              </p>
            </div>

            <div className="col-12 col-md-3">
              <label
                className="form-label small fw-semibold"
                htmlFor="my-request-status"
              >
                Filter by status
              </label>

              <select
                id="my-request-status"
                className="form-select"
                value={status}
                disabled={loading}
                onChange={(event) =>
                  handleStatusChange(event.target.value)
                }
              >
                <option value="all">All Requests</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="documents_required">
                  Documents Required
                </option>
                <option value="in_progress">In Progress</option>
                <option value="ready_for_payment">
                  Ready for Payment
                </option>
                <option value="ready_for_download">
                  Ready for Download
                </option>
                <option value="completed">Completed</option>
                <option value="delivered">Delivered</option>
                <option value="rejected">Rejected</option>
                <option value="cancelled">Cancelled</option>
                <option value="closed">Closed</option>
              </select>
            </div>

            <div className="col-12 col-md-5">
              <label className="form-label small fw-semibold" htmlFor="my-request-search">
                Search current page
              </label>
              <div className="input-group">
                <span className="input-group-text"><i className="bi bi-search" aria-hidden="true" /></span>
                <input
                  id="my-request-search"
                  type="search"
                  className="form-control"
                  placeholder="Request number, service or status"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                />
                {searchQuery && (
                  <button type="button" className="btn btn-outline-secondary" onClick={() => setSearchQuery("")} aria-label="Clear request search">
                    <i className="bi bi-x-lg" aria-hidden="true" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Loading */}
        {loading ? (
          <div className="text-center py-5">
            <div
              className="spinner-border text-primary"
              role="status"
            >
              <span className="visually-hidden">
                Loading requests...
              </span>
            </div>

            <p className="text-secondary mt-3 mb-0">
              Loading your service requests...
            </p>
          </div>
        ) : visibleRequests.length === 0 ? (
          /* Empty state */
          <div className="text-center py-5 px-3">
            <i
              className="bi bi-inbox fs-1 text-secondary"
              aria-hidden="true"
            />

            <h3 className="h5 mt-3">{normalizedSearch ? "No matching requests" : "No requests found"}</h3>

            <p className="text-secondary mb-3">
              {normalizedSearch ? "Try another keyword or clear the search." : "Is status filter mein koi booking nahi mili."}
            </p>

            <Link
              to="/services"
              className="btn btn-primary"
            >
              <i
                className="bi bi-plus-circle me-2"
                aria-hidden="true"
              />
              Browse Services
            </Link>
          </div>
        ) : (
          <div className="p-3 p-lg-4">
            <div className="d-flex flex-column gap-4">
              {visibleRequests.map((request) => {
                const busy = busyId === request._id;

                const form = uploadForms[request._id] || {};

                const requiredDocuments = Array.isArray(
                  request.requiredDocuments
                )
                  ? request.requiredDocuments
                  : [];

                const uploadedDocuments = Array.isArray(
                  request.documents
                )
                  ? request.documents
                  : [];

                const additionalRequests = Array.isArray(
                  request.additionalDocumentRequests
                )
                  ? request.additionalDocumentRequests
                  : [];

                const deliverables = Array.isArray(
                  request.deliverables
                )
                  ? request.deliverables
                  : [];

                const uploadableAdditionalRequests =
                  additionalRequests.filter((item) =>
                    ["requested", "rejected"].includes(item.status)
                  );

                return (
                  <article
                    key={request._id}
                    className={`my-request-card card border-0 shadow-sm rounded-4 overflow-hidden ${expandedRequestId === request._id ? "is-expanded" : ""}`}
                  >
                    {/* Request title and status */}
                    <div className="my-request-card-header card-header border-0 p-3 p-lg-4">
                      <div className="d-flex flex-wrap justify-content-between align-items-start gap-3">
                        <div>
                          <div className="small text-secondary mb-1">
                            Request number
                          </div>

                          <h3 className="h5 fw-bold mb-1">
                            {request.requestNumber || request._id}
                          </h3>

                          <div className="small text-secondary">
                            Booked: {formatDate(request.createdAt)}
                          </div>
                        </div>

                        <div className="d-flex flex-wrap gap-2">
                          {getStatusBadge(request.status)}

                          {request.requiresDigitalDelivery && (
                            <span className="badge text-bg-info">
                              Digital Delivery
                            </span>
                          )}
                          {request.status === "pending" && (
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-danger"
                              disabled={Boolean(busyId)}
                              onClick={() => handleCancel(request)}
                            >
                              <i className="bi bi-x-circle me-1" aria-hidden="true" />
                              {busy ? "Cancelling..." : "Cancel"}
                            </button>
                          )}
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-primary my-request-toggle"
                            aria-expanded={expandedRequestId === request._id}
                            aria-controls={`request-details-${request._id}`}
                            onClick={() => setExpandedRequestId((current) => current === request._id ? null : request._id)}
                          >
                            <i className={`bi ${expandedRequestId === request._id ? "bi-chevron-up" : "bi-chevron-down"} me-1`} aria-hidden="true" />
                            {expandedRequestId === request._id ? "Hide details" : "View details"}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="my-request-summary px-3 px-lg-4 py-3">
                      <div className="row g-3 align-items-center">
                        <div className="col-6 col-lg-3">
                          <div className="my-request-summary-label">Service</div>
                          <div className="fw-semibold">{request.serviceName || "Service"}</div>
                          <div className="small text-secondary">{request.category || "—"}</div>
                        </div>
                        <div className="col-6 col-lg-3">
                          <div className="my-request-summary-label">Total amount</div>
                          <div className="fw-bold my-request-price">{formatMoney(request.totalPrice)}</div>
                          <div className="small text-secondary">Qty: {request.quantity ?? "—"}</div>
                        </div>
                        <div className="col-6 col-lg-3">
                          <div className="my-request-summary-label">Preferred date</div>
                          <div className="fw-semibold">{formatDate(request.preferredDate)}</div>
                        </div>
                        <div className="col-6 col-lg-3">
                          <div className="my-request-summary-label">Assigned staff</div>
                          <div className="fw-semibold">{request.staff?.fullName || request.staff?.name || "Awaiting assignment"}</div>
                        </div>
                      </div>
                      <div className="my-request-summary-footer d-flex flex-wrap justify-content-between align-items-center gap-2 mt-3 pt-3">
                        <span className="small text-secondary"><i className="bi bi-file-earmark-text me-1" aria-hidden="true" />{Array.isArray(request.documents) ? request.documents.length : 0} submitted document(s) · {Array.isArray(request.deliverables) ? request.deliverables.length : 0} deliverable(s)</span>
                        <div className="d-flex flex-wrap align-items-center gap-3">
                          {request.staff && (
                            <Link to={`/requests/${encodeURIComponent(String(request._id))}/workspace`} className="small fw-semibold text-decoration-none">
                              <i className="bi bi-chat-dots me-1" aria-hidden="true" /> Open conversation
                            </Link>
                          )}
                          <span className="small text-secondary">{expandedRequestId === request._id ? "Full booking details are open below" : "Open details to manage documents, payment and delivery"}</span>
                        </div>
                      </div>
                    </div>

                    {expandedRequestId === request._id && (
                    <div id={`request-details-${request._id}`} className="card-body p-3 p-lg-4 my-request-details">
                      {/* Basic request information */}
                      <div className="row g-3 mb-4">
                        <div className="col-md-6 col-lg-3">
                          <div className="small text-secondary mb-1">
                            Service
                          </div>

                          <div className="fw-semibold">
                            {request.serviceName || "Service"}
                          </div>

                          <div className="small text-secondary">
                            {request.category || "—"}
                          </div>
                        </div>

                        <div className="col-md-6 col-lg-3">
                          <div className="small text-secondary mb-1">
                            Total amount
                          </div>

                          <div className="fw-bold">
                            {formatMoney(request.totalPrice)}
                          </div>

                          <div className="small text-secondary">
                            Unit: {formatMoney(request.unitPrice)}
                            {" · "}
                            Qty: {request.quantity ?? "—"}
                          </div>
                        </div>

                        <div className="col-md-6 col-lg-3">
                          <div className="small text-secondary mb-1">
                            Preferred date
                          </div>

                          <div className="fw-semibold">
                            {formatDate(request.preferredDate)}
                          </div>
                        </div>

                        <div className="col-md-6 col-lg-3">
                          <div className="small text-secondary mb-1">
                            Assigned staff
                          </div>

                          <div className="fw-semibold">
                            {request.staff?.fullName ||
                              request.staff?.name ||
                              "Awaiting assignment"}
                          </div>
                        </div>
                      </div>

                      {/* Customer and staff notes */}
                      {(request.customerNotes || request.staffNotes) && (
                        <div className="row g-3 mb-4">
                          {request.customerNotes && (
                            <div className="col-lg-6">
                              <div className="border rounded-3 p-3 h-100">
                                <div className="fw-semibold mb-2">
                                  Your instructions
                                </div>

                                <p className="small mb-0 text-break">
                                  {request.customerNotes}
                                </p>
                              </div>
                            </div>
                          )}

                          {request.staffNotes && (
                            <div className="col-lg-6">
                              <div className="border rounded-3 p-3 h-100">
                                <div className="fw-semibold mb-2">
                                  Staff notes
                                </div>

                                <p className="small mb-0 text-break">
                                  {request.staffNotes}
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Payment status */}
                      {request.payment && (
                        <section className="mb-4">
                          <h4 className="h6 fw-bold">
                            <i
                              className="bi bi-credit-card me-2"
                              aria-hidden="true"
                            />
                            Payment information
                          </h4>

                          <div className="row g-3">
                            {["advance", "final"].map((stage) => {
                              const payment =
                                request.payment?.[stage];

                              if (!payment) return null;

                              return (
                                <div
                                  className="col-md-6"
                                  key={stage}
                                >
                                  <div className="border rounded-3 p-3">
                                    <div className="d-flex justify-content-between align-items-center gap-2">
                                      <span className="fw-semibold">
                                        {formatStatus(stage)} Payment
                                      </span>

                                      <span
                                        className={`badge text-bg-${
                                          paymentStyles[
                                            payment.status
                                          ] || "secondary"
                                        }`}
                                      >
                                        {formatStatus(
                                          payment.status || "pending"
                                        )}
                                      </span>
                                    </div>

                                    <div className="mt-2">
                                      {formatMoney(payment.amount)}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {request.status === "ready_for_payment" && (
                            <div className="alert alert-warning mt-3 mb-0">
                              Your request is awaiting payment. A payment
                              action must be provided by the configured
                              payment workflow before the deliverable can
                              be downloaded.
                            </div>
                          )}
                        </section>
                      )}

                      {/* Required documents */}
                      {requiredDocuments.length > 0 && (
                        <section className="mb-4">
                          <h4 className="h6 fw-bold">
                            <i
                              className="bi bi-file-earmark-text me-2"
                              aria-hidden="true"
                            />
                            Required documents
                          </h4>

                          <div className="d-flex flex-wrap gap-2">
                            {requiredDocuments.map((item, index) => {
                              const uploaded = uploadedDocuments.some(
                                (document) =>
                                  document.kind !== "additional" &&
                                  (
                                    document.documentType === item ||
                                    document.title === item
                                  )
                              );

                              return (
                                <span
                                  key={`${item}-${index}`}
                                  className={`badge ${
                                    uploaded
                                      ? "text-bg-success"
                                      : "text-bg-light border text-dark"
                                  }`}
                                >
                                  {uploaded ? "✓ " : ""}
                                  {item}
                                </span>
                              );
                            })}
                          </div>
                        </section>
                      )}

                      {/* Customer document uploads */}
                      {canUploadDocuments(request) && (
                        <section className="border rounded-3 p-3 p-lg-4 mb-4">
                          <h4 className="h6 fw-bold mb-1">
                            <i
                              className="bi bi-cloud-arrow-up me-2"
                              aria-hidden="true"
                            />
                            Upload a document
                          </h4>

                          <p className="small text-secondary mb-3">
                            Supported files: PDF, JPG, JPEG and PNG.
                            Maximum size: 10 MB.
                          </p>

                          <form
                            onSubmit={(event) =>
                              handleInitialDocumentUpload(
                                event,
                                request
                              )
                            }
                          >
                            <div className="row g-3">
                              <div className="col-lg-4">
                                <label
                                  className="form-label"
                                  htmlFor={`doc-type-${request._id}`}
                                >
                                  Document type
                                </label>

                                {requiredDocuments.length > 0 ? (
                                  <select
                                    id={`doc-type-${request._id}`}
                                    className="form-select"
                                    value={form.documentType || ""}
                                    disabled={Boolean(busyId)}
                                    onChange={(event) =>
                                      updateUploadForm(
                                        request._id,
                                        "documentType",
                                        event.target.value
                                      )
                                    }
                                  >
                                    <option value="">
                                      Select required document
                                    </option>

                                    {requiredDocuments.map(
                                      (item, index) => (
                                        <option
                                          key={`${item}-${index}`}
                                          value={item}
                                        >
                                          {item}
                                        </option>
                                      )
                                    )}
                                  </select>
                                ) : (
                                  <input
                                    id={`doc-type-${request._id}`}
                                    type="text"
                                    className="form-control"
                                    maxLength={100}
                                    value={form.documentType || ""}
                                    placeholder="e.g. Identity Proof"
                                    disabled={Boolean(busyId)}
                                    onChange={(event) =>
                                      updateUploadForm(
                                        request._id,
                                        "documentType",
                                        event.target.value
                                      )
                                    }
                                  />
                                )}
                              </div>

                              <div className="col-lg-4">
                                <label
                                  className="form-label"
                                  htmlFor={`doc-title-${request._id}`}
                                >
                                  Document title
                                </label>

                                <input
                                  id={`doc-title-${request._id}`}
                                  type="text"
                                  className="form-control"
                                  maxLength={150}
                                  value={form.title || ""}
                                  placeholder="Optional title"
                                  disabled={Boolean(busyId)}
                                  onChange={(event) =>
                                    updateUploadForm(
                                      request._id,
                                      "title",
                                      event.target.value
                                    )
                                  }
                                />
                              </div>

                              <div className="col-lg-4">
                                <label
                                  className="form-label"
                                  htmlFor={`doc-file-${request._id}-${fileInputVersion}`}
                                >
                                  Choose file
                                </label>

                                <input
                                  key={`${request._id}-${fileInputVersion}`}
                                  id={`doc-file-${request._id}-${fileInputVersion}`}
                                  type="file"
                                  className="form-control"
                                  accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                                  disabled={Boolean(busyId)}
                                  onChange={(event) => {
                                    const selectedFile =
                                      event.currentTarget.files?.[0] || null;

                                    updateUploadForm(
                                      request._id,
                                      "file",
                                      selectedFile
                                    );
                                    setError("");
                                    setSuccess("");
                                  }}
                                />
                                {form.file?.name && (
                                  <div className="form-text text-break mt-1">
                                    Selected: {form.file.name}
                                  </div>
                                )}
                              </div>
                            </div>

                            <button
                              type="submit"
                              className="btn btn-primary mt-3"
                              disabled={Boolean(busyId)}
                            >
                              {busy
                                ? "Uploading..."
                                : "Upload Document"}
                            </button>
                          </form>
                        </section>
                      )}

                      {/* Additional document requests from staff */}
                      {additionalRequests.length > 0 && (
                        <section className="mb-4">
                          <h4 className="h6 fw-bold mb-3">
                            <i
                              className="bi bi-file-earmark-plus me-2"
                              aria-hidden="true"
                            />
                            Additional document requests
                          </h4>

                          <div className="d-flex flex-column gap-3">
                            {additionalRequests.map(
                              (documentRequest) => {
                                const canUploadAgain = [
                                  "requested",
                                  "rejected",
                                ].includes(documentRequest.status);

                                return (
                                  <div
                                    key={documentRequest._id}
                                    className="border rounded-3 p-3"
                                  >
                                    <div className="d-flex flex-wrap justify-content-between gap-2 mb-2">
                                      <strong>
                                        {documentRequest.title}
                                      </strong>

                                      <span
                                        className={`badge text-bg-${
                                          documentRequest.status ===
                                          "accepted"
                                            ? "success"
                                            : documentRequest.status ===
                                                "rejected"
                                              ? "danger"
                                              : documentRequest.status ===
                                                  "uploaded"
                                                ? "info"
                                                : "warning"
                                        }`}
                                      >
                                        {formatStatus(
                                          documentRequest.status
                                        )}
                                      </span>
                                    </div>

                                    {documentRequest.reason && (
                                      <p className="small mb-1">
                                        <strong>Reason: </strong>
                                        {documentRequest.reason}
                                      </p>
                                    )}

                                    {documentRequest.instructions && (
                                      <p className="small text-secondary mb-2">
                                        {documentRequest.instructions}
                                      </p>
                                    )}

                                    {documentRequest.dueDate && (
                                      <p className="small text-secondary mb-2">
                                        Due:{" "}
                                        {formatDate(
                                          documentRequest.dueDate
                                        )}
                                      </p>
                                    )}

                                    {documentRequest.reviewNotes && (
                                      <div className="alert alert-warning py-2 small">
                                        <strong>Review feedback: </strong>
                                        {documentRequest.reviewNotes}
                                      </div>
                                    )}

                                    {canUploadAgain &&
                                      canUploadDocuments(request) && (
                                        <form
                                          onSubmit={(event) =>
                                            handleAdditionalDocumentUpload(
                                              event,
                                              request,
                                              documentRequest
                                            )
                                          }
                                        >
                                          <label
                                            className="form-label small fw-semibold"
                                            htmlFor={`additional-file-${documentRequest._id}-${fileInputVersion}`}
                                          >
                                            Select requested document
                                          </label>

                                          <input
                                            key={`${documentRequest._id}-${fileInputVersion}`}
                                            id={`additional-file-${documentRequest._id}-${fileInputVersion}`}
                                            type="file"
                                            className="form-control"
                                            accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                                            disabled={Boolean(busyId)}
                                            onChange={(event) => {
                                              const selectedFile =
                                                event.currentTarget.files?.[0] || null;

                                              setAdditionalFiles((previous) => ({
                                                ...previous,
                                                [documentRequest._id]: selectedFile,
                                              }));
                                              setError("");
                                              setSuccess("");
                                            }}
                                          />
                                          {additionalFiles[documentRequest._id]?.name && (
                                            <div className="form-text text-break mt-1">
                                              Selected: {additionalFiles[documentRequest._id].name}
                                            </div>
                                          )}

                                          <button
                                            type="submit"
                                            className="btn btn-sm btn-outline-primary mt-2"
                                            disabled={Boolean(busyId)}
                                          >
                                            {busy
                                              ? "Uploading..."
                                              : "Upload Requested Document"}
                                          </button>
                                        </form>
                                      )}
                                  </div>
                                );
                              }
                            )}
                          </div>
                        </section>
                      )}

                      {/* Uploaded document list */}
                      {uploadedDocuments.length > 0 && (
                        <section className="mb-4">
                          <h4 className="h6 fw-bold mb-3">
                            <i
                              className="bi bi-files me-2"
                              aria-hidden="true"
                            />
                            Submitted documents
                          </h4>

                          <div className="table-responsive">
                            <table className="table table-sm align-middle">
                              <thead className="table-light">
                                <tr>
                                  <th>Document</th>
                                  <th>Type</th>
                                  <th>Uploaded</th>
                                  <th>Review status</th>
                                </tr>
                              </thead>

                              <tbody>
                                {uploadedDocuments.map(
                                  (document, index) => (
                                    <tr
                                      key={
                                        document._id ||
                                        `${document.title}-${index}`
                                      }
                                    >
                                      <td>
                                        <div className="fw-semibold">
                                          {document.title ||
                                            document.fileName ||
                                            "Document"}
                                        </div>

                                        {document.reviewNotes && (
                                          <div className="small text-secondary mt-1">
                                            {document.reviewNotes}
                                          </div>
                                        )}
                                      </td>

                                      <td>
                                        {document.documentType ||
                                          formatStatus(
                                            document.kind || "initial"
                                          )}
                                      </td>

                                      <td className="small">
                                        {formatDate(
                                          document.uploadedAt
                                        )}
                                      </td>

                                      <td>
                                        {getReviewBadge(
                                          document.reviewStatus
                                        )}
                                      </td>
                                    </tr>
                                  )
                                )}
                              </tbody>
                            </table>
                          </div>
                        </section>
                      )}

                      {/* Digital deliverables */}
                      {deliverables.length > 0 && (
                        <section className="mb-4">
                          <h4 className="h6 fw-bold mb-3">
                            <i
                              className="bi bi-file-earmark-pdf me-2"
                              aria-hidden="true"
                            />
                            Digital deliverables
                          </h4>

                          <div className="d-flex flex-column gap-2">
                            {deliverables.map((deliverable, index) => (
                              <div
                                key={
                                  deliverable._id ||
                                  `${deliverable.title}-${index}`
                                }
                                className="border rounded-3 p-3 d-flex flex-wrap justify-content-between align-items-center gap-3"
                              >
                                <div>
                                  <div className="fw-semibold">
                                    {deliverable.title ||
                                      deliverable.fileName ||
                                      "Downloadable PDF"}
                                  </div>

                                  <div className="small text-secondary">
                                    {deliverable.fileName || "PDF file"}
                                    {deliverable.uploadedAt
                                      ? ` · ${formatDate(
                                          deliverable.uploadedAt
                                        )}`
                                      : ""}
                                  </div>
                                </div>

                                <button
                                  type="button"
                                  className="btn btn-sm btn-primary"
                                  disabled={Boolean(busyId)}
                                  onClick={() =>
                                    handleDownload(
                                      request,
                                      deliverable
                                    )
                                  }
                                >
                                  <i
                                    className="bi bi-download me-2"
                                    aria-hidden="true"
                                  />

                                  {busy
                                    ? "Preparing..."
                                    : "Download PDF"}
                                </button>
                              </div>
                            ))}
                          </div>

                          <p className="small text-secondary mt-2 mb-0">
                            Download access is checked by the server.
                            Required payments and request-status conditions
                            must be satisfied.
                          </p>
                        </section>
                      )}

                      {/* Request actions */}
                      <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 border-top pt-3">
                        <div className="small text-secondary">
                          Preferred date:{" "}
                          {formatDate(request.preferredDate)}
                        </div>

                        <span className="small text-secondary">
                          {request.status === "pending"
                            ? "You can cancel a pending request from its card header."
                            : request.status === "ready_for_download" || request.status === "completed" || request.status === "delivered"
                              ? "Check the deliverables section for available files."
                              : "Request actions depend on its current status."}
                        </span>
                      </div>
                    </div>
                    )}
                  </article>
                );
              })}
            </div>
          </div>
        )}

        {/* Pagination */}
        {!loading && pagination.totalPages > 1 && (
          <div className="card-footer bg-white d-flex flex-wrap justify-content-between align-items-center gap-3">
            <span className="small text-secondary">
              Page {pagination.page} of {pagination.totalPages}
              {" · "}
              {pagination.total} requests
            </span>

            <div className="d-flex gap-2">
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                disabled={page <= 1 || Boolean(busyId)}
                onClick={() =>
                  setPage((currentPage) =>
                    Math.max(1, currentPage - 1)
                  )
                }
              >
                <i
                  className="bi bi-chevron-left me-1"
                  aria-hidden="true"
                />
                Previous
              </button>

              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                disabled={
                  page >= pagination.totalPages ||
                  Boolean(busyId)
                }
                onClick={() =>
                  setPage((currentPage) =>
                    Math.min(
                      pagination.totalPages,
                      currentPage + 1
                    )
                  )
                }
              >
                Next
                <i
                  className="bi bi-chevron-right ms-1"
                  aria-hidden="true"
                />
              </button>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}