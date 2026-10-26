import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";

import {
  getStaffRequests,
  claimStaffRequest,
  updateStaffRequestStatus,
  requestAdditionalDocument,
  reviewCustomerDocument,
  getStaffCustomerDocumentDownloadUrl,
  uploadStaffDeliverable,
} from "../../services/staffRequestService";
import "../../styles/staff-dashboard.css";


const PAGE_SIZE = 50;
const MAX_FILE_SIZE = 10 * 1024 * 1024;

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

const formatStatus = (value = "pending") =>
  String(value)
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const formatMoney = (amount) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(amount) || 0);

/**
 * Read staff earning from supported API response formats.
 * Legacy staffEarningAmount is already in rupees; snapshot/flat paise fields
 * are converted to rupees for display. Never infer an earning from today's
 * service price because historical pricing may have changed.
 */
const getStaffEarningAmount = (request) => {
  const rupeeCandidates = [
    request?.staffEarningAmount,
    request?.estimatedStaffEarning,
    request?.pricingSnapshot?.staffEarningAmount,
  ];

  for (const value of rupeeCandidates) {
    if (value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value))) {
      return Number(value);
    }
  }

  const paiseCandidates = [
    request?.pricingSnapshot?.staffEarningPaise,
    request?.staffEarningPaise,
  ];

  for (const value of paiseCandidates) {
    if (value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value))) {
      return Number(value) / 100;
    }
  }

  return null;
};

const formatDate = (value) => {
  if (!value) return "Not specified";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
};

const getLocalDate = () => {
  const now = new Date();

  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
};

const getErrorMessage = (
  error,
  fallback = "Action complete nahi hui. Please dobara try karein."
) =>
  error?.response?.data?.message ||
  error?.message ||
  fallback;

const getStaffId = (staff) =>
  typeof staff === "object" && staff ? staff._id : staff || "";

const getFileSize = (bytes) => {
  const size = Number(bytes) || 0;

  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;

  return `${(size / (1024 * 1024)).toFixed(2)} MB`;
};

const initialAdditionalForm = {
  title: "",
  reason: "",
  instructions: "",
  dueDate: "",
};

const initialDeliverableForm = {
  title: "",
  file: null,
};

const StaffQueueDonut = ({ items, total }) => {
  const radius = 43;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="staff-donut-layout">
      <div className="staff-donut-wrap" role="img" aria-label={`Current request queue distribution: ${total} requests`}>
        <svg viewBox="0 0 120 120" className="staff-donut-svg" aria-hidden="true">
          <circle cx="60" cy="60" r={radius} fill="none" stroke="#edf1f7" strokeWidth="13" />
          {items.filter((item) => item.value > 0 && total > 0).map((item) => {
            const segment = (item.value / total) * circumference;
            const circle = (
              <circle
                key={item.label}
                cx="60"
                cy="60"
                r={radius}
                fill="none"
                stroke={item.color}
                strokeWidth="13"
                strokeLinecap="butt"
                strokeDasharray={`${segment} ${circumference - segment}`}
                strokeDashoffset={-offset}
                transform="rotate(-90 60 60)"
              />
            );
            offset += segment;
            return circle;
          })}
        </svg>
        <div className="staff-donut-center">
          <strong>{total}</strong>
          <span>Requests</span>
        </div>
      </div>

      <div className="staff-donut-legend">
        {items.map((item) => (
          <div className="staff-legend-row" key={item.label}>
            <span className="staff-legend-label">
              <i style={{ backgroundColor: item.color }} aria-hidden="true" />
              {item.label}
            </span>
            <strong>{item.value}</strong>
          </div>
        ))}
      </div>
    </div>
  );
};

const StaffQueueBars = ({ items }) => {
  const maxValue = Math.max(...items.map((item) => item.value), 1);

  return (
    <div className="staff-queue-bars">
      {items.map((item) => (
        <div className="staff-queue-bar-row" key={item.label}>
          <div className="staff-queue-bar-meta">
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </div>
          <div className="staff-queue-bar-track" aria-label={`${item.label}: ${item.value}`}>
            <span
              className="staff-queue-bar-fill"
              style={{ width: `${(item.value / maxValue) * 100}%`, backgroundColor: item.color }}
            />
          </div>
        </div>
      ))}
    </div>
  );
};

export default function StaffDashboard() {
  const [requests, setRequests] = useState([]);
  const [activeQueue, setActiveQueue] = useState("available");
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedRequestId, setExpandedRequestId] = useState(null);

  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [openDocumentFormId, setOpenDocumentFormId] = useState(null);
  const [additionalForms, setAdditionalForms] = useState({});
  const [deliverableForms, setDeliverableForms] = useState({});
  const [fileInputVersion, setFileInputVersion] = useState(0);

  const today = getLocalDate();

  /**
   * Load available pending requests and current staff assignments.
   */
  const loadRequests = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const result = await getStaffRequests({
        page: 1,
        limit: PAGE_SIZE,
        status: "all",
      });

      setRequests(
        Array.isArray(result?.requests) ? result.requests : []
      );
    } catch (err) {
      setError(
        getErrorMessage(
          err,
          "Requests load nahi hui. Please refresh karke try karein."
        )
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const refreshAfterAction = async () => {
    await loadRequests();
  };

  /**
   * Claim an available request.
   * The backend decides the winner atomically if multiple staff claim it.
   */
  const handleClaim = async (request) => {
    if (busyId) return;

    setBusyId(request._id);
    setError("");
    setSuccess("");

    try {
      const result = await claimStaffRequest(request._id);

      setSuccess(
        result?.message || "Request successfully claim ho gayi."
      );

      await refreshAfterAction();
      setActiveQueue("active");
      setExpandedRequestId(request._id);
    } catch (err) {
      setError(getErrorMessage(err));
      await refreshAfterAction();
    } finally {
      setBusyId(null);
    }
  };

  /**
   * Update the assigned request's work status.
   */
  const handleStatusUpdate = async (request, nextStatus) => {
    if (busyId) return;

    let staffNotes = "";

    if (nextStatus === "rejected" || nextStatus === "completed") {
      const answer = window.prompt(
        nextStatus === "rejected"
          ? "Rejection reason enter karein:"
          : "Completion notes (optional):",
        ""
      );

      if (answer === null) return;

      staffNotes = answer.trim();

      if (nextStatus === "rejected" && !staffNotes) {
        setError("Rejection reason required hai.");
        return;
      }

      if (staffNotes.length > 1000) {
        setError("Notes 1000 characters se zyada nahi ho sakte.");
        return;
      }
    }

    setBusyId(request._id);
    setError("");
    setSuccess("");

    try {
      const result = await updateStaffRequestStatus(request._id, {
        status: nextStatus,
        staffNotes,
      });

      setSuccess(
        result?.message ||
          `Request status ${formatStatus(nextStatus)} ho gaya.`
      );

      await refreshAfterAction();
      if (nextStatus === "completed" || nextStatus === "delivered") {
        setActiveQueue("waiting");
      } else if (["rejected", "cancelled", "closed"].includes(nextStatus)) {
        setActiveQueue("history");
      }
      setExpandedRequestId(request._id);
    } catch (err) {
      setError(getErrorMessage(err));
      await refreshAfterAction();
    } finally {
      setBusyId(null);
    }
  };

  /**
   * Open or close the additional-document form for a request.
   */
  const toggleAdditionalForm = (requestId) => {
    setError("");
    setSuccess("");

    setOpenDocumentFormId((current) =>
      current === requestId ? null : requestId
    );

    setAdditionalForms((previous) => ({
      ...previous,
      [requestId]: previous[requestId] || {
        ...initialAdditionalForm,
      },
    }));
  };

  /**
   * Update an additional-document form field.
   */
  const handleAdditionalFieldChange = (
    requestId,
    field,
    value
  ) => {
    setAdditionalForms((previous) => ({
      ...previous,
      [requestId]: {
        ...initialAdditionalForm,
        ...previous[requestId],
        [field]: value,
      },
    }));

    setError("");
  };

  /**
   * Submit additional-document request using a real form rather than prompts.
   */
  const handleAdditionalFormSubmit = async (event, request) => {
    event.preventDefault();

    if (busyId) return;

    const form = additionalForms[request._id] || initialAdditionalForm;

    const title = form.title.trim();
    const reason = form.reason.trim();
    const instructions = form.instructions.trim();
    const dueDate = form.dueDate;

    if (title.length < 2 || title.length > 120) {
      setError("Document title 2 se 120 characters ka hona chahiye.");
      return;
    }

    if (reason.length < 3 || reason.length > 1000) {
      setError("Reason 3 se 1000 characters ka hona chahiye.");
      return;
    }

    if (instructions.length > 1000) {
      setError("Instructions 1000 characters se zyada nahi ho sakti.");
      return;
    }

    if (dueDate && dueDate < today) {
      setError("Due date aaj ya future ki honi chahiye.");
      return;
    }

    setBusyId(request._id);
    setError("");
    setSuccess("");

    try {
      const result = await requestAdditionalDocument(request._id, {
        title,
        reason,
        instructions,
        dueDate: dueDate || undefined,
      });

      setSuccess(
        result?.message ||
          "Additional-document request customer ko send kar di gayi."
      );

      setAdditionalForms((previous) => ({
        ...previous,
        [request._id]: { ...initialAdditionalForm },
      }));

      setOpenDocumentFormId(null);
      await refreshAfterAction();
    } catch (err) {
      setError(
        getErrorMessage(
          err,
          "Additional-document request create nahi ho paayi."
        )
      );
    } finally {
      setBusyId(null);
    }
  };

  /**
   * Review one uploaded document.
   */
  const handleDocumentReview = async (
    request,
    document,
    reviewStatus
  ) => {
    if (busyId) return;

    let reviewNotes = "";

    if (reviewStatus !== "accepted") {
      const answer = window.prompt(
        reviewStatus === "rejected"
          ? "Document reject karne ka reason:"
          : "Customer ko kya correction karna hai?",
        ""
      );

      if (answer === null) return;

      reviewNotes = answer.trim();

      if (!reviewNotes) {
        setError("Review reason ya correction instructions required hain.");
        return;
      }

      if (reviewNotes.length > 1000) {
        setError("Review notes 1000 characters se zyada nahi ho sakte.");
        return;
      }
    }

    setBusyId(request._id);
    setError("");
    setSuccess("");

    try {
      const result = await reviewCustomerDocument(
        request._id,
        document._id,
        {
          status: reviewStatus,
          reviewNotes,
        }
      );

      setSuccess(
        result?.message || "Document review update ho gaya."
      );

      await refreshAfterAction();
    } catch (err) {
      setError(
        getErrorMessage(err, "Document review complete nahi hua.")
      );

      await refreshAfterAction();
    } finally {
      setBusyId(null);
    }
  };

  /**
   * Open a temporary browser tab immediately, then request the secured URL.
   * This reduces popup blocking after the API request completes.
   */
  const handleCustomerDocumentAccess = async (
    request,
    document,
    mode
  ) => {
    if (busyId) return;

    const newTab = window.open("about:blank", "_blank");

    if (!newTab) {
      setError(
        "Browser ne new tab block kiya hai. Pop-ups allow karke try karein."
      );
      return;
    }

    // Prevent the opened tab from controlling the staff dashboard.
    newTab.opener = null;

    setBusyId(request._id);
    setError("");
    setSuccess("");

    try {
      const result = await getStaffCustomerDocumentDownloadUrl(
        request._id,
        document._id,
        mode
      );

      const fileUrl = result?.url;

      if (!fileUrl) {
        throw new Error(
          "Backend response mein document URL nahi mila."
        );
      }

      const parsedUrl = new URL(fileUrl);

      if (parsedUrl.protocol !== "https:") {
        throw new Error("Secure document URL nahi mila.");
      }

      newTab.location.replace(fileUrl);
    } catch (err) {
      newTab.close();

      setError(
        getErrorMessage(
          err,
          "Document open/download nahi ho saka."
        )
      );
    } finally {
      setBusyId(null);
    }
  };

  /**
   * Update final PDF form state.
   */
  const handleDeliverableFieldChange = (
    requestId,
    field,
    value
  ) => {
    setDeliverableForms((previous) => ({
      ...previous,
      [requestId]: {
        ...initialDeliverableForm,
        ...previous[requestId],
        [field]: value,
      },
    }));

    setError("");
  };

  /**
   * Upload final PDF for an assigned in-progress request.
   */
  const handleDeliverableSubmit = async (event, request) => {
    event.preventDefault();

    if (busyId) return;

    const form =
      deliverableForms[request._id] || initialDeliverableForm;

    const file = form.file;
    const title = (form.title || "").trim();

    if (request.status !== "in_progress") {
      setError("Final PDF sirf In Progress request mein upload kar sakte hain.");
      return;
    }

    if (!file) {
      setError("Upload karne ke liye PDF file select karein.");
      return;
    }

    if (
      file.type !== "application/pdf" ||
      !file.name.toLowerCase().endsWith(".pdf") ||
      file.size <= 0 ||
      file.size > MAX_FILE_SIZE
    ) {
      setError("Valid PDF file 10 MB ya usse chhoti honi chahiye.");
      return;
    }

    if (title.length > 120) {
      setError("PDF title 120 characters se zyada nahi ho sakta.");
      return;
    }

    setBusyId(request._id);
    setError("");
    setSuccess("");

    try {
      const result = await uploadStaffDeliverable(request._id, {
        file,
        title,
      });

      setSuccess(
        result?.message || "Final PDF successfully upload ho gayi."
      );

      setDeliverableForms((previous) => ({
        ...previous,
        [request._id]: { ...initialDeliverableForm },
      }));

      setFileInputVersion((current) => current + 1);
      await refreshAfterAction();
    } catch (err) {
      setError(getErrorMessage(err, "PDF upload nahi hui."));
    } finally {
      setBusyId(null);
    }
  };

  // The API intentionally returns only unclaimed requests plus requests assigned to this staff account.
  // Separate those results into work queues so staff do not need to scan one endless list.
  const availableRequests = requests.filter(
    (request) => request.status === "pending" && !getStaffId(request.staff)
  );

  const assignedRequests = requests.filter((request) => Boolean(getStaffId(request.staff)));

  // Completion is not closure in this product: customer payment/download and delivery confirmation may still be pending.
  const waitingStatuses = ["completed", "ready_for_payment", "ready_for_download", "delivered"];
  const historyStatuses = ["rejected", "cancelled", "closed"];

  const activeRequests = assignedRequests.filter(
    (request) => !waitingStatuses.includes(request.status) && !historyStatuses.includes(request.status)
  );

  const waitingRequests = assignedRequests.filter(
    (request) => waitingStatuses.includes(request.status)
  );

  const historyRequests = assignedRequests.filter(
    (request) => historyStatuses.includes(request.status)
  );

  const queueConfig = [
    { id: "available", label: "Available", description: "New requests to claim", requests: availableRequests, icon: "bi-inbox" },
    { id: "active", label: "My Work", description: "Assigned work in progress", requests: activeRequests, icon: "bi-briefcase" },
    { id: "waiting", label: "Awaiting Customer", description: "Payment, download or delivery confirmation", requests: waitingRequests, icon: "bi-hourglass-split" },
    { id: "history", label: "Closed / Rejected", description: "Cancelled or closed requests", requests: historyRequests, icon: "bi-check2-circle" },
  ];

  const selectedQueue = queueConfig.find((queue) => queue.id === activeQueue) || queueConfig[0];
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const displayedRequests = selectedQueue.requests.filter((request) => {
    if (!normalizedSearch) return true;
    const haystack = [
      request.requestNumber,
      request.serviceName,
      request.category,
      request.status,
      request.customer?.fullName,
      request.customer?.name,
      request.customer?.email,
    ].filter(Boolean).join(" ").toLowerCase();
    return haystack.includes(normalizedSearch);
  });

  const pendingCount = availableRequests.length;
  const assignedCount = assignedRequests.length;
  const inProgressCount = assignedRequests.filter(
    (request) => request.status === "in_progress"
  ).length;
  const pendingDocumentCount = assignedRequests.reduce(
    (count, request) => count + (Array.isArray(request.documents) ? request.documents : []).filter(
      (document) => document.reviewStatus === "pending_review"
    ).length,
    0
  );

  // All chart values are calculated from the currently loaded staff request list.
  // Do not display invented historical trends when the API does not provide a time series.
  const queueChartItems = [
    { label: "Available", value: availableRequests.length, color: "#5375f5" },
    { label: "My Work", value: activeRequests.length, color: "#16a6a0" },
    { label: "Awaiting Customer", value: waitingRequests.length, color: "#e6a23c" },
    { label: "Closed / Rejected", value: historyRequests.length, color: "#8b95a7" },
  ];
  const queueChartTotal = queueChartItems.reduce((total, item) => total + item.value, 0);
  const workflowChartItems = [
    { label: "Available to claim", value: availableRequests.length, color: "#5375f5" },
    { label: "In progress", value: inProgressCount, color: "#16a6a0" },
    { label: "Documents to review", value: pendingDocumentCount, color: "#e6a23c" },
    { label: "Awaiting customer", value: waitingRequests.length, color: "#8d72e8" },
  ];

  return (
    <main className="cyber-staff-dashboard container-fluid px-3 px-lg-4 py-4 py-lg-5">
      {/* Header */}
      <header className="staff-dashboard-hero d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
        <div>
          <div className="staff-hero-eyebrow mb-3">
            <span className="staff-hero-live-dot" /> STAFF OPERATIONS
          </div>

          <h1 className="h2 fw-bold mb-2">Staff Dashboard</h1>

          <p className="text-secondary mb-0">
            Monitor your workload, manage service requests and keep customer deliverables moving.
          </p>
        </div>

        <button
          type="button"
          className="btn btn-outline-primary"
          disabled={loading || Boolean(busyId)}
          onClick={loadRequests}
        >
          <i className="bi bi-arrow-clockwise me-2" />
          Refresh
        </button>
      </header>

      {/* Alerts */}
      {error && (
        <div className="alert alert-danger" role="alert">
          <div className="d-flex justify-content-between gap-3">
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
          <div className="d-flex justify-content-between gap-3">
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

      {/* Summary cards */}
      <section className="row g-3 mb-4">
        {[
          {
            label: "Available Requests",
            value: pendingCount,
            icon: "bi-inbox",
            color: "primary",
          },
          {
            label: "Assigned Requests",
            value: assignedCount,
            icon: "bi-person-check",
            color: "info",
          },
          {
            label: "In Progress",
            value: inProgressCount,
            icon: "bi-arrow-repeat",
            color: "warning",
          },
          {
            label: "Documents To Review",
            value: pendingDocumentCount,
            icon: "bi-file-earmark-check",
            color: "success",
          },
        ].map((item) => (
          <div className="col-6 col-xl-3" key={item.label}>
            <article className="staff-stat-card card border-0 shadow-sm h-100">
              <div className="card-body">
                <i
                  className={`bi ${item.icon} fs-3 text-${item.color}`}
                  aria-hidden="true"
                />
                <p className="small text-secondary mt-3 mb-1">
                  {item.label}
                </p>
                <div className="h3 fw-bold mb-0">{item.value}</div>
              </div>
            </article>
          </div>
        ))}
      </section>

      {/* Analytics: snapshot only; based on requests returned by the staff API. */}
      <section className="staff-analytics-section mb-4" aria-label="Staff workload analytics">
        <div className="staff-section-heading d-flex flex-wrap justify-content-between align-items-end gap-2 mb-3">
          <div>
            <span className="staff-section-kicker">PERFORMANCE SNAPSHOT</span>
            <h2 className="h4 fw-bold mb-1">Workload analytics</h2>
            <p className="text-secondary mb-0">A live snapshot of the requests currently available to your account.</p>
          </div>
          <span className="staff-data-note"><i className="bi bi-arrow-repeat me-1" /> Updates when you refresh requests</span>
        </div>

        <div className="row g-3">
          <div className="col-12 col-xl-5">
            <article className="staff-analytics-card h-100">
              <div className="staff-analytics-card-heading">
                <div>
                  <h3>Queue distribution</h3>
                  <p>Where the current requests sit in the workflow</p>
                </div>
                <span className="staff-chart-icon"><i className="bi bi-pie-chart" /></span>
              </div>
              <StaffQueueDonut items={queueChartItems} total={queueChartTotal} />
              {queueChartTotal === 0 && <p className="staff-chart-empty mb-0">No requests are available for this snapshot yet.</p>}
            </article>
          </div>

          <div className="col-12 col-xl-7">
            <article className="staff-analytics-card h-100">
              <div className="staff-analytics-card-heading">
                <div>
                  <h3>Operational workload</h3>
                  <p>Compare the current workload by action area</p>
                </div>
                <span className="staff-chart-icon staff-chart-icon-teal"><i className="bi bi-bar-chart-line" /></span>
              </div>
              <StaffQueueBars items={workflowChartItems} />
              <div className="staff-analytics-footnote">
                <i className="bi bi-info-circle me-2" aria-hidden="true" />
                Document reviews count individual files; other bars count requests. They are workload indicators, not a combined total.
              </div>
            </article>
          </div>
        </div>
      </section>

      {/* Request queues: each queue has one clear purpose */}
      <section className="staff-request-browser mb-4" aria-label="Request inbox">
        <div className="staff-request-browser-heading d-flex flex-wrap justify-content-between align-items-end gap-3 mb-3">
          <div>
            <h2 className="h4 fw-bold mb-1">Request inbox</h2>
            <p className="text-secondary mb-0">Work is separated by its current stage. Open a request only when you need its documents or detailed actions.</p>
          </div>
          <div className="staff-request-search">
            <label htmlFor="staff-request-search" className="form-label small fw-semibold mb-1">Find a request</label>
            <div className="input-group">
              <span className="input-group-text"><i className="bi bi-search" aria-hidden="true" /></span>
              <input
                id="staff-request-search"
                type="search"
                className="form-control"
                placeholder="Request no., service or customer"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="staff-queue-tabs" role="tablist" aria-label="Request queues">
          {queueConfig.map((queue) => (
            <button
              key={queue.id}
              type="button"
              role="tab"
              aria-selected={activeQueue === queue.id}
              className={`staff-queue-tab ${activeQueue === queue.id ? "is-active" : ""}`}
              onClick={() => {
                setActiveQueue(queue.id);
                setExpandedRequestId(null);
              }}
            >
              <span className="staff-queue-tab-icon"><i className={`bi ${queue.icon}`} aria-hidden="true" /></span>
              <span className="staff-queue-tab-copy">
                <strong>{queue.label}</strong>
                <small>{queue.description}</small>
              </span>
              <span className="staff-queue-count">{queue.requests.length}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Requests */}
      {loading ? (
        <div className="card border-0 shadow-sm">
          <div className="card-body text-center py-5">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading requests...</span>
            </div>
            <p className="text-secondary mt-3 mb-0">
              Requests load ho rahi hain...
            </p>
          </div>
        </div>
      ) : displayedRequests.length === 0 ? (
        <div className="card border-0 shadow-sm">
          <div className="card-body text-center py-5">
            <i className="bi bi-inbox fs-1 text-secondary" />
            <h2 className="h5 mt-3">{normalizedSearch ? "No matching requests" : `No ${selectedQueue.label.toLowerCase()} requests`}</h2>
            <p className="text-secondary mb-0">
              {normalizedSearch ? "Search text change karke dobara try karein." : selectedQueue.id === "available" ? "Abhi koi new request claim karne ke liye nahi hai." : selectedQueue.id === "active" ? "Aapke paas abhi koi active assigned request nahi hai." : selectedQueue.id === "waiting" ? "Koi request payment, download ya delivery confirmation ka wait nahi kar rahi." : "Yahan abhi koi closed, rejected ya cancelled request nahi hai."}
            </p>
          </div>
        </div>
      ) : (
        <div className="d-flex flex-column gap-4">
          {displayedRequests.map((request) => {
            const busy = busyId === request._id;
            const assignedStaffId = getStaffId(request.staff);
            const isAssignedToMe = Boolean(assignedStaffId);

            const documents = Array.isArray(request.documents)
              ? request.documents
              : [];

            const additionalRequests = Array.isArray(
              request.additionalDocumentRequests
            )
              ? request.additionalDocumentRequests
              : [];

            const deliverables = Array.isArray(request.deliverables)
              ? request.deliverables
              : [];

            const additionalForm =
              additionalForms[request._id] || initialAdditionalForm;

            const deliverableForm =
              deliverableForms[request._id] || initialDeliverableForm;

            const canReviewDocuments =
              isAssignedToMe &&
              [
                "approved",
                "documents_required",
                "in_progress",
              ].includes(request.status);

            const canRequestDocuments = canReviewDocuments;

            const canUploadDeliverable =
              isAssignedToMe && request.status === "in_progress";

            return (
              <article
                className="staff-request-card card border-0 shadow-sm rounded-4 overflow-hidden"
                key={request._id}
              >
                {/* Compact request summary. Heavy workflow details stay collapsed until needed. */}
                <div className="staff-request-card-header card-header border-0 p-3 p-lg-4">
                  <div className="staff-request-summary-row">
                    <div className="staff-request-main-summary">
                      <div className="small text-secondary mb-1">REQUEST {request.requestNumber || String(request._id).slice(-8).toUpperCase()}</div>
                      <h3 className="h5 fw-bold mb-2">{request.serviceName || "Service request"}</h3>
                      <div className="staff-request-summary-meta">
                        <span><i className="bi bi-person me-1" aria-hidden="true" />{request.customer?.fullName || request.customer?.name || "Customer"}</span>
                        <span><i className="bi bi-calendar3 me-1" aria-hidden="true" />{formatDate(request.preferredDate)}</span>
                        <span><i className="bi bi-clock-history me-1" aria-hidden="true" />Received {formatDate(request.createdAt)}</span>
                      </div>
                    </div>

                    <div className="staff-request-summary-side">
                      <span className={`badge text-bg-${statusStyles[request.status] || "secondary"}`}>
                        {formatStatus(request.status)}
                      </span>
                      <div className="small text-secondary mb-1">Your estimated earning</div>
                      <div className="staff-request-price">{getStaffEarningAmount(request) == null ? "Not configured" : formatMoney(getStaffEarningAmount(request))}</div>
                      <div className="small text-secondary">{request.category || "Service"}{request.quantity != null ? ` · Qty ${request.quantity}` : ""}</div>
                      <div className="d-flex flex-wrap justify-content-end gap-2 mt-2">
                        {request.status === "pending" && !getStaffId(request.staff) && (
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            disabled={Boolean(busyId)}
                            onClick={() => handleClaim(request)}
                          >
                            {busy ? "Claiming..." : <><i className="bi bi-hand-index-thumb me-1" aria-hidden="true" />Claim request</>}
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn btn-outline-primary btn-sm"
                          aria-expanded={expandedRequestId === request._id}
                          onClick={() => setExpandedRequestId((current) => current === request._id ? null : request._id)}
                        >
                          <i className={`bi ${expandedRequestId === request._id ? "bi-chevron-up" : "bi-chevron-down"} me-1`} aria-hidden="true" />
                          {expandedRequestId === request._id ? "Hide details" : "Open details"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {expandedRequestId === request._id && (
                <div className="card-body p-3 p-lg-4 staff-request-details">
                  {/* Basic information */}
                  <div className="row g-3 mb-4">
                    <div className="col-md-6 col-xl-3">
                      <div className="small text-secondary mb-1">
                        Customer
                      </div>
                      <div className="fw-semibold">
                        {request.customer?.fullName ||
                          request.customer?.name ||
                          "Customer"}
                      </div>
                      <div className="small text-secondary text-break">
                        {request.customer?.email || "—"}
                      </div>
                      {request.customer?.phone && (
                        <div className="small text-secondary">
                          {request.customer.phone}
                        </div>
                      )}
                    </div>

                    <div className="col-md-6 col-xl-3">
                      <div className="small text-secondary mb-1">
                        Service
                      </div>
                      <div className="fw-semibold">
                        {request.serviceName || "Service"}
                      </div>
                      <div className="small text-secondary">
                        {request.category || "—"} · Qty:{" "}
                        {request.quantity ?? "—"}
                      </div>
                    </div>

                    <div className="col-md-6 col-xl-3">
                      <div className="small text-secondary mb-1">
                        Your estimated earning
                      </div>
                      <div className="fw-semibold">
                        {getStaffEarningAmount(request) == null
                          ? "Not configured for this older request"
                          : formatMoney(getStaffEarningAmount(request))}
                      </div>
                    </div>

                    <div className="col-md-6 col-xl-3">
                      <div className="small text-secondary mb-1">
                        Preferred date
                      </div>
                      <div className="fw-semibold">
                        {formatDate(request.preferredDate)}
                      </div>
                    </div>
                  </div>

                  {/* Notes */}
                  {(request.customerNotes || request.staffNotes) && (
                    <div className="row g-3 mb-4">
                      {request.customerNotes && (
                        <div className="col-lg-6">
                          <div className="border rounded-3 p-3 h-100">
                            <div className="fw-semibold mb-2">
                              Customer instructions
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

                  {/* Claim / status controls */}
                  <section className="mb-4">
                    <h3 className="h6 fw-bold mb-3">Request actions</h3>

                    <div className="d-flex flex-wrap gap-2">
                      {request.status === "approved" &&
                        isAssignedToMe && (
                          <>
                            <button
                              type="button"
                              className="btn btn-primary"
                              disabled={Boolean(busyId)}
                              onClick={() =>
                                handleStatusUpdate(request, "in_progress")
                              }
                            >
                              {busy ? "Updating..." : "Start Work"}
                            </button>

                            <button
                              type="button"
                              className="btn btn-outline-danger"
                              disabled={Boolean(busyId)}
                              onClick={() =>
                                handleStatusUpdate(request, "rejected")
                              }
                            >
                              Reject Request
                            </button>
                          </>
                        )}

                      {request.status === "in_progress" &&
                        isAssignedToMe && (
                          <button
                            type="button"
                            className="btn btn-success"
                            disabled={Boolean(busyId)}
                            onClick={() =>
                              handleStatusUpdate(request, "completed")
                            }
                          >
                            {busy ? "Updating..." : "Mark Completed"}
                          </button>
                        )}

                      {isAssignedToMe && (
                        <>
                          <span className="small text-secondary align-self-center">
                            Assigned to:{" "}
                            {request.staff?.fullName ||
                              request.staff?.name ||
                              "You"}
                          </span>

                          <Link
                            to={`/requests/${encodeURIComponent(String(request._id))}/workspace`}
                            className="btn btn-outline-primary btn-sm"
                          >
                            <i className="bi bi-chat-dots me-2" aria-hidden="true" />
                            Open Conversation
                          </Link>
                        </>
                      )}
                    </div>
                  </section>

                  {/* Uploaded customer documents */}
                  <section className="border rounded-3 p-3 p-lg-4 mb-4">
                    <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
                      <div>
                        <h3 className="h6 fw-bold mb-1">
                          <i className="bi bi-folder2-open me-2 text-primary" />
                          Customer Documents
                        </h3>
                        <p className="small text-secondary mb-0">
                          Uploaded files, review status, and secure access.
                        </p>
                      </div>

                      <span className="badge text-bg-light border text-dark">
                        {documents.length} file(s)
                      </span>
                    </div>

                    {documents.length === 0 ? (
                      <div className="alert alert-light border mb-0">
                        Customer ne abhi koi document upload nahi kiya.
                      </div>
                    ) : (
                      <div className="d-flex flex-column gap-3">
                        {documents.map((document, index) => (
                          <div
                            className="border rounded-3 p-3"
                            key={
                              document._id ||
                              `${document.title}-${index}`
                            }
                          >
                            <div className="d-flex flex-wrap justify-content-between align-items-start gap-3">
                              <div className="d-flex gap-3">
                                <div
                                  className="rounded-3 bg-light border d-flex align-items-center justify-content-center flex-shrink-0"
                                  style={{ width: 48, height: 48 }}
                                >
                                  <i
                                    className={`bi ${
                                      document.format === "pdf"
                                        ? "bi-file-earmark-pdf"
                                        : "bi-file-earmark-image"
                                    } fs-4 text-primary`}
                                  />
                                </div>

                                <div>
                                  <div className="fw-semibold text-break">
                                    {document.title ||
                                      document.fileName ||
                                      "Customer document"}
                                  </div>

                                  <div className="small text-secondary">
                                    {document.fileName || "File name unavailable"}
                                  </div>

                                  <div className="small text-secondary mt-1">
                                    Type: {document.documentType || "—"}
                                    {" · "}
                                    {String(document.format || "file").toUpperCase()}
                                    {" · "}
                                    {getFileSize(document.bytes)}
                                  </div>

                                  <div className="small text-secondary mt-1">
                                    Uploaded: {formatDate(document.uploadedAt)}
                                  </div>

                                  {document.reviewNotes && (
                                    <div className="small mt-2">
                                      <strong>Review feedback:</strong>{" "}
                                      {document.reviewNotes}
                                    </div>
                                  )}
                                </div>
                              </div>

                              <span
                                className={`badge text-bg-${
                                  reviewStyles[document.reviewStatus] ||
                                  "secondary"
                                }`}
                              >
                                {formatStatus(
                                  document.reviewStatus || "pending_review"
                                )}
                              </span>
                            </div>

                            {/* Secure view/download */}
                            {isAssignedToMe && (
                              <div className="d-flex flex-wrap gap-2 mt-3">
                                <button
                                  type="button"
                                  className="btn btn-sm btn-outline-primary"
                                  disabled={Boolean(busyId)}
                                  onClick={() =>
                                    handleCustomerDocumentAccess(
                                      request,
                                      document,
                                      "view"
                                    )
                                  }
                                >
                                  <i className="bi bi-eye me-2" />
                                  View Document
                                </button>

                                <button
                                  type="button"
                                  className="btn btn-sm btn-primary"
                                  disabled={Boolean(busyId)}
                                  onClick={() =>
                                    handleCustomerDocumentAccess(
                                      request,
                                      document,
                                      "download"
                                    )
                                  }
                                >
                                  <i className="bi bi-download me-2" />
                                  Download
                                </button>
                              </div>
                            )}

                            {/* Review controls */}
                            {canReviewDocuments &&
                              document.reviewStatus === "pending_review" && (
                                <div className="d-flex flex-wrap gap-2 mt-3 pt-3 border-top">
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-success"
                                    disabled={Boolean(busyId)}
                                    onClick={() =>
                                      handleDocumentReview(
                                        request,
                                        document,
                                        "accepted"
                                      )
                                    }
                                  >
                                    <i className="bi bi-check2-circle me-1" />
                                    Accept
                                  </button>

                                  <button
                                    type="button"
                                    className="btn btn-sm btn-outline-danger"
                                    disabled={Boolean(busyId)}
                                    onClick={() =>
                                      handleDocumentReview(
                                        request,
                                        document,
                                        "rejected"
                                      )
                                    }
                                  >
                                    Reject
                                  </button>

                                  <button
                                    type="button"
                                    className="btn btn-sm btn-outline-secondary"
                                    disabled={Boolean(busyId)}
                                    onClick={() =>
                                      handleDocumentReview(
                                        request,
                                        document,
                                        "changes_requested"
                                      )
                                    }
                                  >
                                    Request Correction
                                  </button>
                                </div>
                              )}
                          </div>
                        ))}
                      </div>
                    )}
                  </section>

                  {/* Additional document requests */}
                  <section className="border rounded-3 p-3 p-lg-4 mb-4">
                    <div className="d-flex flex-wrap justify-content-between align-items-center gap-3">
                      <div>
                        <h3 className="h6 fw-bold mb-1">
                          <i className="bi bi-file-earmark-plus me-2 text-primary" />
                          Additional Document Requests
                        </h3>
                        <p className="small text-secondary mb-0">
                          Customer se extra ya corrected document maangein.
                        </p>
                      </div>

                      {canRequestDocuments && (
                        <button
                          type="button"
                          className="btn btn-outline-primary"
                          disabled={Boolean(busyId)}
                          onClick={() =>
                            toggleAdditionalForm(request._id)
                          }
                        >
                          <i
                            className={`bi ${
                              openDocumentFormId === request._id
                                ? "bi-x-circle"
                                : "bi-plus-circle"
                            } me-2`}
                          />
                          {openDocumentFormId === request._id
                            ? "Close Form"
                            : "Request Document"}
                        </button>
                      )}
                    </div>

                    {/* Inline form replaces window.prompt */}
                    {openDocumentFormId === request._id &&
                      canRequestDocuments && (
                        <form
                          className="bg-light border rounded-3 p-3 mt-3"
                          onSubmit={(event) =>
                            handleAdditionalFormSubmit(event, request)
                          }
                        >
                          <h4 className="h6 fw-bold mb-3">
                            New Document Request
                          </h4>

                          <div className="row g-3">
                            <div className="col-md-6">
                              <label
                                htmlFor={`additional-title-${request._id}`}
                                className="form-label"
                              >
                                Document name <span className="text-danger">*</span>
                              </label>

                              <input
                                id={`additional-title-${request._id}`}
                                type="text"
                                className="form-control"
                                value={additionalForm.title}
                                minLength={2}
                                maxLength={120}
                                required
                                disabled={Boolean(busyId)}
                                placeholder="e.g. Updated Aadhaar Card"
                                onChange={(event) =>
                                  handleAdditionalFieldChange(
                                    request._id,
                                    "title",
                                    event.target.value
                                  )
                                }
                              />
                            </div>

                            <div className="col-md-6">
                              <label
                                htmlFor={`additional-due-${request._id}`}
                                className="form-label"
                              >
                                Due date (optional)
                              </label>

                              <input
                                id={`additional-due-${request._id}`}
                                type="date"
                                className="form-control"
                                min={today}
                                value={additionalForm.dueDate}
                                disabled={Boolean(busyId)}
                                onChange={(event) =>
                                  handleAdditionalFieldChange(
                                    request._id,
                                    "dueDate",
                                    event.target.value
                                  )
                                }
                              />
                            </div>

                            <div className="col-12">
                              <label
                                htmlFor={`additional-reason-${request._id}`}
                                className="form-label"
                              >
                                Why is this document required?{" "}
                                <span className="text-danger">*</span>
                              </label>

                              <textarea
                                id={`additional-reason-${request._id}`}
                                className="form-control"
                                rows={3}
                                minLength={3}
                                maxLength={1000}
                                required
                                value={additionalForm.reason}
                                disabled={Boolean(busyId)}
                                placeholder="Explain why the customer must submit this document..."
                                onChange={(event) =>
                                  handleAdditionalFieldChange(
                                    request._id,
                                    "reason",
                                    event.target.value
                                  )
                                }
                              />

                              <div className="form-text text-end">
                                {additionalForm.reason.length}/1000
                              </div>
                            </div>

                            <div className="col-12">
                              <label
                                htmlFor={`additional-instructions-${request._id}`}
                                className="form-label"
                              >
                                Instructions for customer (optional)
                              </label>

                              <textarea
                                id={`additional-instructions-${request._id}`}
                                className="form-control"
                                rows={3}
                                maxLength={1000}
                                value={additionalForm.instructions}
                                disabled={Boolean(busyId)}
                                placeholder="Explain accepted format, required details, or corrections..."
                                onChange={(event) =>
                                  handleAdditionalFieldChange(
                                    request._id,
                                    "instructions",
                                    event.target.value
                                  )
                                }
                              />

                              <div className="form-text text-end">
                                {additionalForm.instructions.length}/1000
                              </div>
                            </div>
                          </div>

                          <div className="d-flex flex-wrap justify-content-end gap-2 mt-3">
                            <button
                              type="button"
                              className="btn btn-light border"
                              disabled={Boolean(busyId)}
                              onClick={() =>
                                setOpenDocumentFormId(null)
                              }
                            >
                              Cancel
                            </button>

                            <button
                              type="submit"
                              className="btn btn-primary"
                              disabled={Boolean(busyId)}
                            >
                              {busy ? (
                                <>
                                  <span className="spinner-border spinner-border-sm me-2" />
                                  Sending...
                                </>
                              ) : (
                                <>
                                  <i className="bi bi-send me-2" />
                                  Send Document Request
                                </>
                              )}
                            </button>
                          </div>
                        </form>
                      )}

                    {/* Existing additional-document requests */}
                    {additionalRequests.length > 0 && (
                      <div className="d-flex flex-column gap-2 mt-3">
                        {additionalRequests.map((item, index) => (
                          <div
                            key={item._id || `${item.title}-${index}`}
                            className="border rounded-3 p-3"
                          >
                            <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
                              <strong>{item.title}</strong>

                              <span className="badge text-bg-light border text-dark">
                                {formatStatus(item.status)}
                              </span>
                            </div>

                            {item.reason && (
                              <p className="small mt-2 mb-1">
                                <strong>Reason: </strong>
                                {item.reason}
                              </p>
                            )}

                            {item.instructions && (
                              <p className="small text-secondary mb-1">
                                {item.instructions}
                              </p>
                            )}

                            <div className="small text-secondary">
                              Requested: {formatDate(item.requestedAt)}
                              {item.dueDate
                                ? ` · Due: ${formatDate(item.dueDate)}`
                                : ""}
                            </div>

                            {item.reviewNotes && (
                              <div className="small mt-2">
                                <strong>Review feedback:</strong>{" "}
                                {item.reviewNotes}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </section>

                  {/* Final deliverable upload */}
                  {canUploadDeliverable && (
                    <section className="border rounded-3 p-3 p-lg-4 mb-4">
                      <h3 className="h6 fw-bold mb-1">
                        <i className="bi bi-file-earmark-pdf me-2 text-primary" />
                        Upload Final PDF
                      </h3>

                      <p className="small text-secondary mb-3">
                        PDF only. Maximum size 10 MB.
                      </p>

                      <form
                        onSubmit={(event) =>
                          handleDeliverableSubmit(event, request)
                        }
                      >
                        <div className="row g-3">
                          <div className="col-md-5">
                            <label
                              htmlFor={`deliverable-title-${request._id}`}
                              className="form-label"
                            >
                              Document title
                            </label>

                            <input
                              id={`deliverable-title-${request._id}`}
                              type="text"
                              className="form-control"
                              maxLength={120}
                              value={deliverableForm.title}
                              disabled={Boolean(busyId)}
                              placeholder="e.g. Completed Application"
                              onChange={(event) =>
                                handleDeliverableFieldChange(
                                  request._id,
                                  "title",
                                  event.target.value
                                )
                              }
                            />
                          </div>

                          <div className="col-md-7">
                            <label
                              htmlFor={`deliverable-file-${request._id}-${fileInputVersion}`}
                              className="form-label"
                            >
                              Select final PDF
                            </label>

                            <input
                              key={`${request._id}-${fileInputVersion}`}
                              id={`deliverable-file-${request._id}-${fileInputVersion}`}
                              type="file"
                              className="form-control"
                              accept=".pdf,application/pdf"
                              disabled={Boolean(busyId)}
                              onChange={(event) =>
                                handleDeliverableFieldChange(
                                  request._id,
                                  "file",
                                  event.target.files?.[0] || null
                                )
                              }
                            />

                            {deliverableForm.file && (
                              <div className="small text-secondary mt-1">
                                Selected: {deliverableForm.file.name}
                              </div>
                            )}
                          </div>
                        </div>

                        <button
                          type="submit"
                          className="btn btn-primary mt-3"
                          disabled={Boolean(busyId)}
                        >
                          {busy ? "Uploading..." : "Upload Final PDF"}
                        </button>
                      </form>
                    </section>
                  )}

                  {/* Previously uploaded deliverables */}
                  {deliverables.length > 0 && (
                    <section className="mb-3">
                      <h3 className="h6 fw-bold mb-3">
                        <i className="bi bi-files me-2 text-primary" />
                        Final Deliverables
                      </h3>

                      <div className="d-flex flex-column gap-2">
                        {deliverables.map((item, index) => (
                          <div
                            className="border rounded-3 p-3 d-flex flex-wrap justify-content-between align-items-center gap-3"
                            key={item._id || `${item.fileName}-${index}`}
                          >
                            <div>
                              <div className="fw-semibold">
                                {item.title || item.fileName || "PDF"}
                              </div>
                              <div className="small text-secondary">
                                {item.fileName || "Final file"}
                                {" · "}
                                {getFileSize(item.bytes)}
                                {" · "}
                                {formatDate(item.uploadedAt)}
                              </div>
                            </div>

                            <span className="badge text-bg-success">
                              Uploaded
                            </span>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}
                </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      <p className="small text-secondary mt-4 mb-0">
        Private file access, request ownership, document reviews, and status
        changes are verified by the backend. A button being visible does not
        bypass server permissions.
      </p>
    </main>
  );
}