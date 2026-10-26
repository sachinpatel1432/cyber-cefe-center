import { useCallback, useEffect, useState } from "react";
import "../../styles/admin-requests.css";

import {
  getAdminServiceRequests,
  getAssignableStaff,
  assignAdminServiceRequest,
  reassignAdminServiceRequest,
  updateAdminServiceRequestStatus,
} from "../../services/adminServiceRequestService";

const PAGE_SIZE = 20;

const money = (amount) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(amount) || 0);

const dateLabel = (date) => {
  if (!date) return "—";

  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) {
    return "—";
  }

  return parsedDate.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
};

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

const nextStatuses = {
  pending: ["rejected", "cancelled"],

  approved: [
    "documents_required",
    "in_progress",
    "rejected",
    "cancelled",
  ],

  documents_required: [
    "approved",
    "rejected",
    "cancelled",
  ],

  in_progress: [
    "documents_required",
    "ready_for_payment",
    "ready_for_download",
    "completed",
    "rejected",
    "cancelled",
  ],

  ready_for_payment: [],

  ready_for_download: [
    "delivered",
    "closed",
  ],

  completed: [
    "delivered",
    "closed",
  ],

  delivered: ["closed"],

  rejected: [],
  cancelled: [],
  closed: [],
};

const statusOptions = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  {
    value: "documents_required",
    label: "Documents Required",
  },
  { value: "in_progress", label: "In Progress" },
  {
    value: "ready_for_payment",
    label: "Ready for Payment",
  },
  {
    value: "ready_for_download",
    label: "Ready for Download",
  },
  { value: "completed", label: "Completed" },
  { value: "delivered", label: "Delivered" },
  { value: "rejected", label: "Rejected" },
  { value: "cancelled", label: "Cancelled" },
  { value: "closed", label: "Closed" },
];

const label = (value = "") =>
  String(value)
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const getStaffId = (staff) =>
  typeof staff === "object" && staff ? staff._id : staff || "";

const getErrorMessage = (
  error,
  fallback = "Something went wrong. Please try again."
) =>
  error?.response?.data?.message ||
  error?.message ||
  fallback;

const statusChartColors = {
  pending: "#f2a93b",
  approved: "#4b83f5",
  documents_required: "#e0a22f",
  in_progress: "#12a594",
  ready_for_payment: "#c68b18",
  ready_for_download: "#8b6ce8",
  completed: "#269b67",
  delivered: "#1f8e68",
  rejected: "#e15d67",
  cancelled: "#8893a6",
  closed: "#64748b",
};

function RequestStatusDonut({ items, total }) {
  const radius = 43;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="admin-requests-donut-layout">
      <div
        className="admin-requests-donut-wrap"
        role="img"
        aria-label={`Request status distribution for ${total} requests on this page`}
      >
        <svg viewBox="0 0 120 120" className="admin-requests-donut-svg" aria-hidden="true">
          <circle cx="60" cy="60" r={radius} fill="none" stroke="#edf1f7" strokeWidth="13" />
          {items.filter((item) => item.value > 0 && total > 0).map((item) => {
            const segment = (item.value / total) * circumference;
            const circle = (
              <circle
                key={item.key}
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
        <div className="admin-requests-donut-center">
          <strong>{total}</strong>
          <span>On this page</span>
        </div>
      </div>
      <div className="admin-requests-donut-legend">
        {items.filter((item) => item.value > 0).length ? items.filter((item) => item.value > 0).map((item) => (
          <div className="admin-requests-legend-row" key={item.key}>
            <span className="admin-requests-legend-label">
              <i style={{ backgroundColor: item.color }} aria-hidden="true" />
              {item.label}
            </span>
            <strong>{item.value}</strong>
          </div>
        )) : <p className="small text-secondary mb-0">No requests on this page yet.</p>}
      </div>
    </div>
  );
}

function RequestWorkflowBars({ items }) {
  const maxValue = Math.max(...items.map((item) => item.value), 1);

  return (
    <div className="admin-requests-workflow-bars">
      {items.map((item) => (
        <div className="admin-requests-workflow-row" key={item.label}>
          <div className="admin-requests-workflow-meta">
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </div>
          <div className="admin-requests-workflow-track" role="img" aria-label={`${item.label}: ${item.value}`}>
            <span
              className="admin-requests-workflow-fill"
              style={{ width: `${(item.value / maxValue) * 100}%`, backgroundColor: item.color }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function AdminRequests() {
  const [requests, setRequests] = useState([]);
  const [staff, setStaff] = useState([]);

  const [pagination, setPagination] = useState({
    page: 1,
    limit: PAGE_SIZE,
    total: 0,
    totalPages: 0,
  });

  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");

  const [staffSelections, setStaffSelections] = useState({});
  const [statusSelections, setStatusSelections] = useState({});

  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  /**
   * Load service requests and assignable staff.
   */
  const loadRequests = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [requestResult, staffResult] = await Promise.all([
        getAdminServiceRequests({
          page,
          limit: PAGE_SIZE,
          status,
          search: appliedSearch,
        }),
        getAssignableStaff(),
      ]);

      const fetchedRequests = Array.isArray(requestResult?.requests)
        ? requestResult.requests
        : [];

      const fetchedStaff = Array.isArray(staffResult?.staff)
        ? staffResult.staff
        : [];

      setRequests(fetchedRequests);
      setStaff(fetchedStaff);

      setPagination(
        requestResult?.pagination || {
          page,
          limit: PAGE_SIZE,
          total: fetchedRequests.length,
          totalPages: 1,
        }
      );

      // Preserve a user's unsaved selection where possible.
      // Otherwise, default to the currently assigned staff member.
      setStaffSelections((previous) => {
        const next = {};

        for (const request of fetchedRequests) {
          next[request._id] =
            previous[request._id] !== undefined
              ? previous[request._id]
              : getStaffId(request.staff);
        }

        return next;
      });

      // Remove status selections for requests no longer on this page.
      const visibleRequestIds = new Set(
        fetchedRequests.map((request) => request._id)
      );

      setStatusSelections((previous) =>
        Object.fromEntries(
          Object.entries(previous).filter(([requestId]) =>
            visibleRequestIds.has(requestId)
          )
        )
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
  }, [page, status, appliedSearch]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  /**
   * Apply text search.
   */
  const applySearch = (event) => {
    event.preventDefault();

    setPage(1);
    setAppliedSearch(search.trim());
    setError("");
    setSuccess("");
  };

  /**
   * Reset filters and search.
   */
  const resetFilters = () => {
    setSearch("");
    setAppliedSearch("");
    setStatus("all");
    setPage(1);
    setError("");
    setSuccess("");
  };

  /**
   * Assign a staff member to a pending, unassigned request.
   * Reassign an eligible request through the separate reassignment API.
   */
  const handleAssign = async (request) => {
    const staffId = staffSelections[request._id];
    const currentStaffId = getStaffId(request.staff);

    if (!staffId) {
      setError("Pehle staff member select karein.");
      return;
    }

    if (currentStaffId && String(currentStaffId) === String(staffId)) {
      setError("Ye staff member already assigned hai.");
      return;
    }

    let assignmentType = "";

    if (request.status === "pending" && !currentStaffId) {
      assignmentType = "assign";
    } else if (
      currentStaffId &&
      ["approved", "documents_required"].includes(request.status)
    ) {
      assignmentType = "reassign";
    } else {
      setError(
        "Is request ko current status mein assign ya reassign nahi kar sakte."
      );
      return;
    }

    let reason = "";

    if (assignmentType === "reassign") {
      const enteredReason = window.prompt(
        "Staff reassignment ka reason enter karein:"
      );

      if (enteredReason === null) {
        return;
      }

      reason = enteredReason.trim();

      if (!reason) {
        setError("Reassignment reason required hai.");
        return;
      }

      if (reason.length > 1000) {
        setError("Reassignment reason 1000 characters se zyada nahi ho sakta.");
        return;
      }
    }

    setBusyId(request._id);
    setError("");
    setSuccess("");

    try {
      let result;

      if (assignmentType === "assign") {
        result = await assignAdminServiceRequest(
          request._id,
          staffId
        );
      } else {
        result = await reassignAdminServiceRequest(
          request._id,
          staffId,
          reason
        );
      }

      setSuccess(
        result?.message ||
          (assignmentType === "assign"
            ? "Staff assigned successfully."
            : "Staff reassigned successfully.")
      );

      await loadRequests();
    } catch (err) {
      setError(
        getErrorMessage(
          err,
          assignmentType === "assign"
            ? "Staff assign nahi hua. Please dobara try karein."
            : "Staff reassign nahi hua. Please dobara try karein."
        )
      );
    } finally {
      setBusyId(null);
    }
  };

  /**
   * Update request status.
   */
  const handleStatusUpdate = async (request) => {
    const nextStatus = statusSelections[request._id];

    if (!nextStatus) {
      setError("Pehle new status select karein.");
      return;
    }

    const validNextStatuses = nextStatuses[request.status] || [];

    if (!validNextStatuses.includes(nextStatus)) {
      setError(
        `Status ${label(request.status)} se ${label(nextStatus)} mein change nahi ho sakta.`
      );
      return;
    }

    let note = "";

    const requiresNote = [
      "rejected",
      "cancelled",
      "completed",
      "delivered",
      "closed",
      "documents_required",
    ].includes(nextStatus);

    if (requiresNote) {
      const enteredNote = window.prompt(
        nextStatus === "rejected"
          ? "Rejection reason enter karein:"
          : nextStatus === "cancelled"
            ? "Cancellation reason enter karein:"
            : nextStatus === "documents_required"
              ? "Customer se kaun se documents chahiye? Note enter karein:"
              : nextStatus === "completed"
                ? "Completion notes enter karein:"
                : nextStatus === "delivered"
                  ? "Delivery notes enter karein:"
                  : "Closure notes enter karein:",
        ""
      );

      if (enteredNote === null) {
        return;
      }

      note = enteredNote.trim();

      if (note.length > 1000) {
        setError("Notes 1000 characters se zyada nahi ho sakte.");
        return;
      }

      if (
        ["rejected", "cancelled", "documents_required"].includes(nextStatus) &&
        !note
      ) {
        setError("Is status ke liye reason ya note enter karna zaroori hai.");
        return;
      }
    }

    setBusyId(request._id);
    setError("");
    setSuccess("");

    try {
      const result = await updateAdminServiceRequestStatus(
        request._id,
        {
          status: nextStatus,
          note,
          staffNotes: note,
        }
      );

      setSuccess(
        result?.message || "Request status update ho gaya."
      );

      setStatusSelections((previous) => ({
        ...previous,
        [request._id]: "",
      }));

      await loadRequests();
    } catch (err) {
      setError(
        getErrorMessage(
          err,
          "Status update nahi hua. Please dobara try karein."
        )
      );
    } finally {
      setBusyId(null);
    }
  };

  /**
   * Current page statistics.
   */
  const pendingOnPage = requests.filter(
    (request) => request.status === "pending"
  ).length;

  const progressOnPage = requests.filter(
    (request) => request.status === "in_progress"
  ).length;

  const completedOnPage = requests.filter((request) =>
    ["completed", "delivered", "closed"].includes(request.status)
  ).length;

  const assignedOnPage = requests.filter(
    (request) => Boolean(getStaffId(request.staff))
  ).length;

  const totalPages = Math.max(1, Number(pagination.totalPages) || 1);
  const statusDistribution = statusOptions.map((option) => ({
    key: option.value,
    label: option.label,
    value: requests.filter((request) => request.status === option.value).length,
    color: statusChartColors[option.value] || "#8893a6",
  }));
  const statusDistributionTotal = requests.length;
  const workflowItems = [
    {
      label: "Awaiting review",
      value: requests.filter((request) => request.status === "pending").length,
      color: "#f2a93b",
    },
    {
      label: "Ready to start",
      value: requests.filter((request) => ["approved", "documents_required"].includes(request.status)).length,
      color: "#4b83f5",
    },
    {
      label: "Work in progress",
      value: requests.filter((request) => request.status === "in_progress").length,
      color: "#12a594",
    },
    {
      label: "Payment / delivery stage",
      value: requests.filter((request) => ["ready_for_payment", "ready_for_download", "completed"].includes(request.status)).length,
      color: "#8b6ce8",
    },
    {
      label: "Resolved / closed",
      value: requests.filter((request) => ["delivered", "closed", "rejected", "cancelled"].includes(request.status)).length,
      color: "#8893a6",
    },
  ];

  return (
    <main className="cyber-admin-requests container-fluid px-3 px-lg-4 py-4 py-lg-5">
      {/* Page heading */}
      <header className="admin-requests-hero d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
        <div>
          <span className="admin-requests-eyebrow mb-3"><span className="admin-requests-live-dot" /> ADMIN CONTROL PANEL</span>

          <h1 className="h2 fw-bold mb-2">
            Service Request Management
          </h1>

          <p className="text-secondary mb-0">
            Customer bookings review karein, staff assign ya reassign
            karein aur request status manage karein.
          </p>
        </div>

        <button
          type="button"
          className="btn btn-outline-primary admin-requests-refresh"
          onClick={loadRequests}
          disabled={loading || Boolean(busyId)}
        >
          <i
            className="bi bi-arrow-clockwise me-2"
            aria-hidden="true"
          />
          Refresh
        </button>
      </header>

      {/* Feedback */}
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
              aria-label="Dismiss success message"
              onClick={() => setSuccess("")}
            />
          </div>
        </div>
      )}

      {/* Summary cards */}
      <section
        className="row g-3 mb-4 admin-requests-stats"
        aria-label="Service request summary"
      >
        {[
          {
            title: "Total Matching Requests",
            value: pagination.total,
            icon: "bi-clipboard-data",
          },
          {
            title: "Pending on This Page",
            value: pendingOnPage,
            icon: "bi-hourglass-split",
          },
          {
            title: "In Progress on This Page",
            value: progressOnPage,
            icon: "bi-arrow-repeat",
          },
          {
            title: "Resolved / Closed",
            value: completedOnPage,
            icon: "bi-check-circle",
          },
          {
            title: "Assigned on This Page",
            value: assignedOnPage,
            icon: "bi-person-check",
          },
        ].map((item) => (
          <div
            className="col-6 col-xl"
            key={item.title}
          >
            <div className="admin-requests-stat-card card h-100 border-0 shadow-sm">
              <div className="card-body">
                <span className="admin-requests-stat-icon" aria-hidden="true">
                  <i className={`bi ${item.icon}`} />
                </span>

                <p className="text-secondary small mt-3 mb-1">
                  {item.title}
                </p>

                <div className="h3 fw-bold mb-0">
                  {item.value}
                </div>
              </div>
            </div>
          </div>
        ))}
      </section>

      {/* Analytics snapshot: based only on the currently loaded page, not historical trends. */}
      <section className="admin-requests-analytics mb-4" aria-label="Request analytics">
        <div className="admin-requests-section-heading d-flex flex-wrap justify-content-between align-items-end gap-2 mb-3">
          <div>
            <span className="admin-requests-section-kicker">OPERATIONS OVERVIEW</span>
            <h2 className="h4 fw-bold mb-1">Request analytics</h2>
            <p className="text-secondary mb-0">A snapshot of the current filtered page. Use status filters for a closer review.</p>
          </div>
          <span className="admin-requests-data-note"><i className="bi bi-info-circle me-1" aria-hidden="true" /> {requests.length} requests loaded</span>
        </div>
        <div className="row g-3">
          <div className="col-12 col-xl-5">
            <article className="admin-requests-analytics-card h-100">
              <div className="admin-requests-analytics-heading">
                <div>
                  <h3>Status distribution</h3>
                  <p>Request statuses on the current page</p>
                </div>
                <span className="admin-requests-chart-icon"><i className="bi bi-pie-chart" /></span>
              </div>
              <RequestStatusDonut items={statusDistribution} total={statusDistributionTotal} />
            </article>
          </div>
          <div className="col-12 col-xl-7">
            <article className="admin-requests-analytics-card h-100">
              <div className="admin-requests-analytics-heading">
                <div>
                  <h3>Workflow workload</h3>
                  <p>Grouped by the operational stage</p>
                </div>
                <span className="admin-requests-chart-icon admin-requests-chart-icon-teal"><i className="bi bi-bar-chart-line" /></span>
              </div>
              <RequestWorkflowBars items={workflowItems} />
              <div className="admin-requests-chart-footnote">
                <i className="bi bi-info-circle me-2" aria-hidden="true" /> Charts reflect the current page and active filters, not all-time totals.
              </div>
            </article>
          </div>
        </div>
      </section>

      {/* Search and filters */}
      <section className="admin-requests-filter-card card border-0 shadow-sm mb-4">
        <div className="card-body p-3 p-lg-4">
          <div className="admin-requests-filter-title mb-3"><h2 className="h5 fw-bold mb-1">Find and filter requests</h2><p className="small text-secondary mb-0">Search by request ID, service name or category, then filter by status.</p></div>
          <form
            className="row g-3 align-items-end"
            onSubmit={applySearch}
          >
            <div className="col-lg-6">
              <label
                className="form-label"
                htmlFor="request-search"
              >
                Search requests
              </label>

              <input
                id="request-search"
                className="form-control"
                value={search}
                maxLength={100}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Request ID, service name or category"
              />
            </div>

            <div className="col-lg-3">
              <label
                className="form-label"
                htmlFor="request-filter"
              >
                Request status
              </label>

              <select
                id="request-filter"
                className="form-select"
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value);
                  setPage(1);
                  setError("");
                  setSuccess("");
                }}
              >
                <option value="all">All statuses</option>

                {statusOptions.map((option) => (
                  <option
                    key={option.value}
                    value={option.value}
                  >
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-lg-3 d-flex gap-2">
              <button
                type="submit"
                className="btn btn-primary flex-grow-1"
              >
                <i
                  className="bi bi-search me-2"
                  aria-hidden="true"
                />
                Search
              </button>

              <button
                type="button"
                className="btn btn-light"
                onClick={resetFilters}
              >
                Reset
              </button>
            </div>
          </form>
        </div>
      </section>

      {/* Request table */}
      <section className="admin-requests-table-card card border-0 shadow-sm">
        <div className="card-header bg-white border-0 p-3 p-lg-4">
          <h2 className="h5 fw-bold mb-1">
            All Customer Requests
          </h2>

          <p className="text-secondary small mb-0">
            Request details, assignments, payment-related statuses
            aur workflow yahin se manage karein.
          </p>
        </div>

        {loading ? (
          <div className="text-center py-5">
            <div
              className="spinner-border text-primary"
              role="status"
            >
              <span className="visually-hidden">
                Loading...
              </span>
            </div>

            <p className="text-secondary mt-3 mb-0">
              Requests load ho rahi hain...
            </p>
          </div>
        ) : requests.length === 0 ? (
          <div className="text-center py-5 px-3">
            <i
              className="bi bi-inbox fs-1 text-secondary"
              aria-hidden="true"
            />

            <h3 className="h5 mt-3">
              No requests found
            </h3>

            <p className="text-secondary mb-0">
              Search ya status filter change karke dekhein.
            </p>
          </div>
        ) : (
          <>
            <div className="table-responsive admin-requests-table-wrap">
              <table className="table table-hover align-middle mb-0 admin-requests-table">
                <thead className="table-light">
                  <tr>
                    <th scope="col">Request</th>
                    <th scope="col">Customer</th>
                    <th scope="col">Service</th>
                    <th scope="col">Amount</th>
                    <th scope="col">Assigned Staff</th>
                    <th scope="col">Status</th>
                    <th
                      scope="col"
                      style={{ minWidth: "240px" }}
                    >
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {requests.map((request) => {
                    const actions = nextStatuses[request.status] || [];
                    const busy = busyId === request._id;

                    const assignedStaff = getStaffId(request.staff);
                    const selectedStaff =
                      staffSelections[request._id] ?? assignedStaff;

                    const isUnassignedPending =
                      request.status === "pending" && !assignedStaff;

                    const canReassign =
                      Boolean(assignedStaff) &&
                      ["approved", "documents_required"].includes(
                        request.status
                      );

                    const canManageAssignment =
                      isUnassignedPending || canReassign;

                    const assignmentButtonLabel = assignedStaff
                      ? "Reassign Staff"
                      : "Assign Staff";

                    return (
                      <tr key={request._id}>
                        {/* Request information */}
                        <td>
                          <strong>
                            {request.requestNumber || request._id}
                          </strong>

                          <div className="small text-secondary mt-1">
                            {dateLabel(request.createdAt)}
                          </div>

                          {request.preferredDate && (
                            <div className="small mt-1">
                              Preferred:{" "}
                              {dateLabel(request.preferredDate)}
                            </div>
                          )}

                          <div className="small text-secondary mt-1">
                            ID: {request._id}
                          </div>
                        </td>

                        {/* Customer */}
                        <td>
                          <div className="fw-semibold">
                            {request.customer?.fullName ||
                              request.customer?.name ||
                              "Customer"}
                          </div>

                          <div className="small text-secondary">
                            {request.customer?.email || "—"}
                          </div>
                        </td>

                        {/* Service details */}
                        <td>
                          <div className="fw-semibold">
                            {request.serviceName || "Service"}
                          </div>

                          <div className="small text-secondary">
                            {request.category || "—"} · Qty:{" "}
                            {request.quantity ?? "—"}
                          </div>

                          {request.customerNotes && (
                            <details className="small mt-2">
                              <summary>
                                Customer instructions
                              </summary>

                              <p className="mt-1 mb-0 text-break">
                                {request.customerNotes}
                              </p>
                            </details>
                          )}

                          {request.staffNotes && (
                            <details className="small mt-2">
                              <summary>Staff notes</summary>

                              <p className="mt-1 mb-0 text-break">
                                {request.staffNotes}
                              </p>
                            </details>
                          )}

                          {request.requiresDigitalDelivery && (
                            <div className="mt-2">
                              <span className="badge text-bg-info">
                                Digital Delivery
                              </span>
                            </div>
                          )}
                        </td>

                        {/* Amount */}
                        <td>
                          <div className="fw-semibold">
                            {money(request.totalPrice)}
                          </div>

                          <div className="small text-secondary">
                            Unit: {money(request.unitPrice)}
                          </div>

                          {request.payment?.final?.required && (
                            <div className="small mt-1">
                              Final payment:{" "}
                              {label(
                                request.payment.final.status || "pending"
                              )}
                            </div>
                          )}
                        </td>

                        {/* Assignment controls */}
                        <td style={{ minWidth: "210px" }}>
                          <div className="small mb-2">
                            <span className="text-secondary">
                              Current staff:
                            </span>{" "}

                            <strong>
                              {request.staff?.fullName ||
                                request.staff?.name ||
                                "Unassigned"}
                            </strong>
                          </div>

                          {canManageAssignment ? (
                            <>
                              <label
                                className="visually-hidden"
                                htmlFor={`staff-${request._id}`}
                              >
                                Select staff for{" "}
                                {request.requestNumber || request._id}
                              </label>

                              <select
                                id={`staff-${request._id}`}
                                className="form-select form-select-sm"
                                value={selectedStaff}
                                disabled={Boolean(busyId)}
                                onChange={(event) =>
                                  setStaffSelections((previous) => ({
                                    ...previous,
                                    [request._id]: event.target.value,
                                  }))
                                }
                              >
                                <option value="">
                                  Select staff...
                                </option>

                                {staff.map((person) => (
                                  <option
                                    key={person._id}
                                    value={person._id}
                                  >
                                    {person.fullName ||
                                      person.name ||
                                      person.email}{" "}
                                    {person.email
                                      ? `(${person.email})`
                                      : ""}
                                  </option>
                                ))}
                              </select>

                              <button
                                type="button"
                                className={`btn btn-sm mt-2 w-100 ${
                                  assignedStaff
                                    ? "btn-outline-primary"
                                    : "btn-primary"
                                }`}
                                disabled={
                                  Boolean(busyId) ||
                                  !selectedStaff ||
                                  String(selectedStaff) ===
                                    String(assignedStaff)
                                }
                                onClick={() => handleAssign(request)}
                              >
                                {busy
                                  ? "Saving..."
                                  : assignmentButtonLabel}
                              </button>

                              {canReassign && (
                                <div className="small text-secondary mt-2">
                                  Reassignment is allowed only while
                                  the request remains eligible under
                                  server-side workflow rules.
                                </div>
                              )}
                            </>
                          ) : (
                            <div className="small text-secondary">
                              {assignedStaff
                                ? "Assignment changes are not available at this stage."
                                : "Staff can be assigned when the request is pending."}
                            </div>
                          )}
                        </td>

                        {/* Current request status */}
                        <td>
                          <span
                            className={`badge text-bg-${
                              statusStyles[request.status] || "secondary"
                            }`}
                          >
                            {label(request.status || "unknown")}
                          </span>

                          {request.statusHistory?.length > 0 && (
                            <details className="small mt-2">
                              <summary>Status history</summary>

                              <ul className="ps-3 mt-2 mb-0">
                                {request.statusHistory
                                  .slice(-4)
                                  .reverse()
                                  .map((entry, index) => (
                                    <li
                                      key={
                                        entry._id ||
                                        `${entry.toStatus}-${entry.changedAt}-${index}`
                                      }
                                      className="mb-2"
                                    >
                                      <strong>
                                        {label(entry.toStatus)}
                                      </strong>

                                      <div className="text-secondary">
                                        {dateLabel(entry.changedAt)}
                                      </div>

                                      {entry.note && (
                                        <div className="text-break">
                                          {entry.note}
                                        </div>
                                      )}
                                    </li>
                                  ))}
                              </ul>
                            </details>
                          )}
                        </td>

                        {/* Status management */}
                        <td style={{ minWidth: "240px" }}>
                          {actions.length > 0 ? (
                            <div className="d-flex flex-column gap-2">
                              <label
                                className="visually-hidden"
                                htmlFor={`status-${request._id}`}
                              >
                                Select next status for{" "}
                                {request.requestNumber || request._id}
                              </label>

                              <select
                                id={`status-${request._id}`}
                                className="form-select form-select-sm"
                                value={
                                  statusSelections[request._id] || ""
                                }
                                disabled={Boolean(busyId)}
                                onChange={(event) =>
                                  setStatusSelections((previous) => ({
                                    ...previous,
                                    [request._id]: event.target.value,
                                  }))
                                }
                              >
                                <option value="">
                                  Choose next status...
                                </option>

                                {actions.map((action) => (
                                  <option
                                    key={action}
                                    value={action}
                                  >
                                    {label(action)}
                                  </option>
                                ))}
                              </select>

                              <button
                                type="button"
                                className="btn btn-sm btn-primary"
                                disabled={
                                  Boolean(busyId) ||
                                  !statusSelections[request._id]
                                }
                                onClick={() => handleStatusUpdate(request)}
                              >
                                {busy
                                  ? "Updating..."
                                  : "Update Status"}
                              </button>

                              <small className="text-secondary">
                                Server workflow rules still apply.
                              </small>
                            </div>
                          ) : (
                            <span className="small text-secondary">
                              No manual status changes available.
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="card-footer bg-white d-flex flex-wrap justify-content-between align-items-center gap-3">
              <span className="small text-secondary">
                Page {pagination.page || page} of {totalPages}
                {" · "}
                {pagination.total || 0} matching requests
              </span>

              <div className="d-flex gap-2">
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  disabled={page <= 1 || loading || Boolean(busyId)}
                  onClick={() =>
                    setPage((current) => Math.max(1, current - 1))
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
                    page >= totalPages ||
                    loading ||
                    Boolean(busyId)
                  }
                  onClick={() =>
                    setPage((current) =>
                      Math.min(totalPages, current + 1)
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
          </>
        )}
      </section>
    </main>
  );
}