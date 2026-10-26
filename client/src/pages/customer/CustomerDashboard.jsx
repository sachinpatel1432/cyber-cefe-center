import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { getActiveServices } from "../../services/serviceService";
import {
  createServiceRequest,
  getMyServiceRequests,
  getMyServiceRequestSummary,
  cancelMyServiceRequest,
} from "../../services/serviceRequestService";
import "../../styles/customer-dashboard.css";

const PAGE_SIZE = 10;

const formatMoney = (amount) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(amount) || 0);

const formatDate = (date) => {
  if (!date) return "Not selected";
  const parsedDate = new Date(date);
  if (Number.isNaN(parsedDate.getTime())) return "—";

  return parsedDate.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const formatDateTime = (date) => {
  if (!date) return "Date unavailable";
  const parsedDate = new Date(date);
  if (Number.isNaN(parsedDate.getTime())) return "Date unavailable";

  return parsedDate.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const getLocalDateString = () => {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
};

const STATUS_META = {
  pending: { label: "Pending", tone: "amber", icon: "bi-hourglass-split" },
  approved: { label: "Approved", tone: "blue", icon: "bi-check-circle" },
  documents_required: { label: "Documents required", tone: "amber", icon: "bi-file-earmark-exclamation" },
  in_progress: { label: "In progress", tone: "violet", icon: "bi-arrow-repeat" },
  ready_for_payment: { label: "Ready for payment", tone: "amber", icon: "bi-credit-card" },
  ready_for_download: { label: "Ready for download", tone: "green", icon: "bi-download" },
  completed: { label: "Completed", tone: "green", icon: "bi-check2-circle" },
  delivered: { label: "Delivered", tone: "green", icon: "bi-box-seam" },
  rejected: { label: "Rejected", tone: "red", icon: "bi-x-circle" },
  cancelled: { label: "Cancelled", tone: "slate", icon: "bi-slash-circle" },
  closed: { label: "Closed", tone: "slate", icon: "bi-archive" },
};

const SERVICE_TONES = ["violet", "blue", "cyan", "orange", "pink", "green"];
const SERVICE_ICONS = [
  "bi-file-earmark-text",
  "bi-person-vcard",
  "bi-printer",
  "bi-laptop",
  "bi-file-pdf",
  "bi-briefcase",
  "bi-folder2-open",
  "bi-globe2",
];

const getErrorMessage = (
  error,
  fallback = "Something went wrong. Please try again."
) =>
  error?.response?.data?.message || error?.message || fallback;

const getServiceName = (service) => service?.name || service?.title || "Service";
const getServicePrice = (service) => Number(service?.price ?? service?.unitPrice ?? 0);

function StatusBadge({ status }) {
  const meta = STATUS_META[status] || {
    label: String(status || "pending").replaceAll("_", " "),
    tone: "slate",
    icon: "bi-circle",
  };

  return (
    <span className={`cd-dash-status cd-dash-status-${meta.tone}`}>
      <i className={`bi ${meta.icon}`} aria-hidden="true" />
      {meta.label}
    </span>
  );
}

export default function CustomerDashboard() {
  const { user } = useAuth();

  const [services, setServices] = useState([]);
  const [requests, setRequests] = useState([]);
  const [summary, setSummary] = useState({
    totalRequests: 0,
    pendingRequests: 0,
    activeRequests: 0,
    completedRequests: 0,
  });

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const [selectedService, setSelectedService] = useState(null);
  const [quantity, setQuantity] = useState("1");
  const [preferredDate, setPreferredDate] = useState("");
  const [customerNotes, setCustomerNotes] = useState("");

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [cancellingId, setCancellingId] = useState(null);
  const [error, setError] = useState("");
  const [bookingError, setBookingError] = useState("");
  const [success, setSuccess] = useState("");

  const today = getLocalDateString();
  const firstName = (user?.fullName || user?.name || user?.email || "there").trim().split(/\s+/)[0];

  const loadDashboard = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);
    else setRefreshing(true);
    setError("");

    try {
      const [servicesResult, requestsResult, summaryResult] = await Promise.all([
        getActiveServices(),
        getMyServiceRequests({ page: 1, limit: PAGE_SIZE }),
        getMyServiceRequestSummary(),
      ]);

      setServices(Array.isArray(servicesResult?.services) ? servicesResult.services : []);
      setRequests(Array.isArray(requestsResult?.requests) ? requestsResult.requests : []);

      const serverSummary = summaryResult?.summary || {};
      setSummary({
        totalRequests: serverSummary.totalRequests ?? 0,
        pendingRequests: serverSummary.pendingRequests ?? 0,
        activeRequests: serverSummary.activeRequests ?? 0,
        completedRequests: serverSummary.completedRequests ?? 0,
      });
    } catch (err) {
      setError(getErrorMessage(err, "Dashboard load nahi hua. Please refresh karke try karein."));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    if (!selectedService) return undefined;

    const handleEscape = (event) => {
      if (event.key === "Escape" && !submitting) {
        setSelectedService(null);
        setBookingError("");
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [selectedService, submitting]);

  const categories = useMemo(() => {
    return [...new Set(
      services
        .map((service) => service.category)
        .filter((category) => typeof category === "string" && category.trim())
    )].sort((a, b) => a.localeCompare(b));
  }, [services]);

  const filteredServices = useMemo(() => {
    const query = search.trim().toLowerCase();

    return services.filter((service) => {
      const matchesCategory = categoryFilter === "all" || service.category === categoryFilter;
      const searchableText = [getServiceName(service), service.description, service.category]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return matchesCategory && (!query || searchableText.includes(query));
    });
  }, [services, search, categoryFilter]);

  const openBooking = (service) => {
    setSelectedService(service);
    setQuantity("1");
    setPreferredDate("");
    setCustomerNotes("");
    setBookingError("");
    setError("");
    setSuccess("");
  };

  const closeBooking = () => {
    if (submitting) return;
    setSelectedService(null);
    setBookingError("");
  };

  const handleBooking = async (event) => {
    event.preventDefault();
    if (!selectedService || submitting) return;

    const parsedQuantity = Number(quantity);

    if (!Number.isInteger(parsedQuantity) || parsedQuantity < 1 || parsedQuantity > 1000) {
      setBookingError("Quantity 1 se 1000 ke beech honi chahiye.");
      return;
    }

    if (preferredDate && preferredDate < today) {
      setBookingError("Please aaj ya future ki date select karein.");
      return;
    }

    if (customerNotes.trim().length > 1000) {
      setBookingError("Instructions 1000 characters se zyada nahi ho sakti.");
      return;
    }

    setSubmitting(true);
    setBookingError("");
    setError("");
    setSuccess("");

    try {
      const result = await createServiceRequest({
        serviceId: selectedService._id,
        quantity: parsedQuantity,
        preferredDate: preferredDate || null,
        customerNotes: customerNotes.trim(),
      });

      const requestNumber = result?.request?.requestNumber;
      setSelectedService(null);
      setSuccess(`Booking successfully submit ho gayi${requestNumber ? ` — ${requestNumber}` : ""}.`);
      await loadDashboard(false);
    } catch (err) {
      setBookingError(getErrorMessage(err, "Booking submit nahi hui. Please dobara try karein."));
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async (request) => {
    if (request.status !== "pending" || cancellingId || submitting) return;

    const confirmed = window.confirm(
      `Kya aap request ${request.requestNumber || request._id} cancel karna chahte hain?`
    );
    if (!confirmed) return;

    setError("");
    setSuccess("");
    setCancellingId(request._id);

    try {
      const result = await cancelMyServiceRequest(request._id);
      setSuccess(result?.message || "Request successfully cancel ho gayi.");
      await loadDashboard(false);
    } catch (err) {
      setError(getErrorMessage(err, "Request cancel nahi ho paayi. Please try again."));
    } finally {
      setCancellingId(null);
    }
  };

  if (loading) {
    return (
      <main className="cd-dashboard cd-dashboard-loading">
        <div className="cd-loading-orb" />
        <div className="cd-loading-spinner" role="status" aria-label="Loading customer dashboard" />
        <h1>Preparing your workspace</h1>
        <p>Services aur requests load ho rahi hain...</p>
      </main>
    );
  }

  const recentRequests = requests.slice(0, PAGE_SIZE);

  return (
    <main className="cd-dashboard">
      <div className="cd-dashboard-shell">
        {/* Welcome hero */}
        <section className="cd-dashboard-hero">
          <div className="cd-dashboard-hero-pattern" aria-hidden="true" />
          <div className="cd-dashboard-hero-copy">
            <div className="cd-dashboard-kicker">
              <span className="cd-dashboard-kicker-dot" />
              CUSTOMER WORKSPACE
            </div>
            <p className="cd-dashboard-greeting">Welcome back, {firstName} <span aria-hidden="true">✦</span></p>
            <h1>Your digital desk, <span>all in one place.</span></h1>
            <p className="cd-dashboard-hero-description">
              Book a service, keep documents organised and follow every request from one simple workspace.
            </p>
            <div className="cd-dashboard-hero-actions">
              <a className="cd-dash-button cd-dash-button-light" href="#cd-explore-services">
                <i className="bi bi-plus-circle" aria-hidden="true" />
                Book a service
              </a>
              <Link className="cd-dash-button cd-dash-button-ghost" to="/my-requests">
                <i className="bi bi-clipboard-check" aria-hidden="true" />
                My requests
                <i className="bi bi-arrow-up-right" aria-hidden="true" />
              </Link>
            </div>
          </div>

          <div className="cd-dashboard-hero-art" aria-hidden="true">
            <div className="cd-dashboard-art-ring cd-dashboard-art-ring-one" />
            <div className="cd-dashboard-art-ring cd-dashboard-art-ring-two" />
            <div className="cd-dashboard-art-card">
              <div className="cd-dashboard-art-top">
                <span className="cd-dashboard-art-icon"><i className="bi bi-grid-1x2-fill" /></span>
                <span className="cd-dashboard-art-dots"><i /><i /><i /></span>
              </div>
              <div className="cd-dashboard-art-heading">Workspace overview</div>
              <div className="cd-dashboard-art-row">
                <span className="cd-dashboard-art-row-icon violet"><i className="bi bi-file-earmark-text" /></span>
                <span className="cd-dashboard-art-lines"><i /><i /></span>
                <span className="cd-dashboard-art-check"><i className="bi bi-check2" /></span>
              </div>
              <div className="cd-dashboard-art-row">
                <span className="cd-dashboard-art-row-icon cyan"><i className="bi bi-chat-dots" /></span>
                <span className="cd-dashboard-art-lines"><i /><i /></span>
                <span className="cd-dashboard-art-progress"><i /></span>
              </div>
              <div className="cd-dashboard-art-row">
                <span className="cd-dashboard-art-row-icon green"><i className="bi bi-folder2-open" /></span>
                <span className="cd-dashboard-art-lines"><i /><i /></span>
                <span className="cd-dashboard-art-check"><i className="bi bi-check2" /></span>
              </div>
            </div>
            <div className="cd-dashboard-float cd-dashboard-float-top">
              <span><i className="bi bi-lightning-charge-fill" /></span>
              <div><strong>Quick access</strong><small>Everyday services</small></div>
            </div>
            <div className="cd-dashboard-float cd-dashboard-float-bottom">
              <span><i className="bi bi-check2-circle" /></span>
              <div><strong>Stay on track</strong><small>Request updates</small></div>
            </div>
          </div>
        </section>

        {/* Alerts */}
        {error && (
          <div className="cd-dash-alert cd-dash-alert-error" role="alert">
            <i className="bi bi-exclamation-triangle-fill" aria-hidden="true" />
            <span>{error}</span>
            <button type="button" aria-label="Dismiss error" onClick={() => setError("")}><i className="bi bi-x-lg" /></button>
          </div>
        )}
        {success && (
          <div className="cd-dash-alert cd-dash-alert-success" role="status">
            <i className="bi bi-check-circle-fill" aria-hidden="true" />
            <span>{success}</span>
            <button type="button" aria-label="Dismiss message" onClick={() => setSuccess("")}><i className="bi bi-x-lg" /></button>
          </div>
        )}

        {/* Summary */}
        <section className="cd-dashboard-stats" aria-label="Request summary">
          {[
            { label: "Total requests", value: summary.totalRequests, icon: "bi-stack", tone: "violet", hint: "All your bookings" },
            { label: "Pending", value: summary.pendingRequests, icon: "bi-hourglass-split", tone: "orange", hint: "Awaiting next step" },
            { label: "In progress", value: summary.activeRequests, icon: "bi-arrow-repeat", tone: "blue", hint: "Currently active" },
            { label: "Completed", value: summary.completedRequests, icon: "bi-check2-circle", tone: "green", hint: "Finished requests" },
          ].map((item, index) => (
            <article className="cd-dashboard-stat" key={item.label} style={{ "--cd-card-index": index }}>
              <div className={`cd-dashboard-stat-icon cd-dashboard-stat-${item.tone}`}>
                <i className={`bi ${item.icon}`} aria-hidden="true" />
              </div>
              <div className="cd-dashboard-stat-main">
                <span>{item.label}</span>
                <strong>{item.value}</strong>
                <small>{item.hint}</small>
              </div>
              <span className="cd-dashboard-stat-decoration" aria-hidden="true"><i className="bi bi-arrow-up-right" /></span>
            </article>
          ))}
        </section>

        {/* Explore services */}
        <section className="cd-dashboard-section" id="cd-explore-services">
          <div className="cd-dashboard-section-heading">
            <div>
              <span className="cd-dash-eyebrow">FIND WHAT YOU NEED</span>
              <h2>Explore services<span>.</span></h2>
              <p>Choose a service to start a new request.</p>
            </div>
            <div className="cd-dash-heading-actions">
              <span className="cd-dash-results-count"><strong>{filteredServices.length}</strong> available</span>
              <button type="button" className="cd-dash-icon-button" onClick={() => loadDashboard(false)} disabled={refreshing || Boolean(cancellingId)} aria-label="Refresh dashboard">
                <i className={`bi bi-arrow-clockwise ${refreshing ? "cd-spin" : ""}`} aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="cd-service-toolbar">
            <label className="cd-service-search" htmlFor="cd-service-search-input">
              <i className="bi bi-search" aria-hidden="true" />
              <input
                id="cd-service-search-input"
                type="search"
                placeholder="Search services by name or keyword..."
                value={search}
                maxLength={100}
                onChange={(event) => setSearch(event.target.value)}
              />
              {search && <button type="button" aria-label="Clear search" onClick={() => setSearch("")}><i className="bi bi-x-circle-fill" /></button>}
            </label>

            <label className="cd-service-category" htmlFor="cd-service-category-select">
              <i className="bi bi-sliders2" aria-hidden="true" />
              <select id="cd-service-category-select" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
                <option value="all">All categories</option>
                {categories.map((category) => <option key={category} value={category}>{category}</option>)}
              </select>
              <i className="bi bi-chevron-down cd-service-select-chevron" aria-hidden="true" />
            </label>
          </div>

          {filteredServices.length === 0 ? (
            <div className="cd-dash-empty">
              <div className="cd-dash-empty-icon"><i className="bi bi-search" /></div>
              <h3>No services found</h3>
              <p>Try another keyword or clear your category filters.</p>
              <button type="button" className="cd-dash-button cd-dash-button-outline" onClick={() => { setSearch(""); setCategoryFilter("all"); }}>
                Clear filters
              </button>
            </div>
          ) : (
            <div className="cd-dashboard-service-grid">
              {filteredServices.map((service, index) => {
                const price = getServicePrice(service);
                const requiredDocuments = Array.isArray(service.requiredDocuments) ? service.requiredDocuments : [];
                const tone = SERVICE_TONES[index % SERVICE_TONES.length];
                const icon = service.icon || SERVICE_ICONS[index % SERVICE_ICONS.length];

                return (
                  <article className={`cd-dashboard-service-card cd-service-tone-${tone}`} key={service._id} style={{ "--cd-card-index": index }}>
                    <div className="cd-dashboard-service-card-top">
                      <div className="cd-dashboard-service-icon"><i className={`bi ${icon}`} aria-hidden="true" /></div>
                      <span className="cd-dashboard-service-arrow"><i className="bi bi-arrow-up-right" aria-hidden="true" /></span>
                    </div>
                    <div className="cd-dashboard-service-meta">
                      <span>{service.category || "General"}</span>
                      {service.requiresDigitalDelivery && <span className="cd-digital-tag"><i className="bi bi-cloud-check" /> Digital</span>}
                    </div>
                    <h3>{getServiceName(service)}</h3>
                    <p className="cd-dashboard-service-description">
                      {service.description || "Service details aur booking options ke liye continue karein."}
                    </p>
                    {requiredDocuments.length > 0 && (
                      <div className="cd-required-documents">
                        <span><i className="bi bi-file-earmark-text" /> Required documents</span>
                        <p>{requiredDocuments.slice(0, 3).join(", ")}{requiredDocuments.length > 3 ? ` +${requiredDocuments.length - 3} more` : ""}</p>
                      </div>
                    )}
                    <div className="cd-dashboard-service-bottom">
                      <div>
                        <small>Price per unit</small>
                        <strong>{formatMoney(price)}</strong>
                      </div>
                      {service.estimatedDurationMinutes && <span className="cd-service-duration"><i className="bi bi-clock" /> {service.estimatedDurationMinutes} min</span>}
                    </div>
                    <button type="button" className="cd-service-book-button" onClick={() => openBooking(service)} disabled={price < 0}>
                      Book this service
                      <i className="bi bi-arrow-right" aria-hidden="true" />
                    </button>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {/* Recent requests */}
        <section className="cd-dashboard-section cd-recent-requests-section" id="cd-recent-requests">
          <div className="cd-dashboard-section-heading">
            <div>
              <span className="cd-dash-eyebrow">YOUR ACTIVITY</span>
              <h2>Recent requests<span>.</span></h2>
              <p>Pick up where you left off and keep track of your services.</p>
            </div>
            <Link to="/my-requests" className="cd-dash-button cd-dash-button-outline">
              View all requests <i className="bi bi-arrow-up-right" aria-hidden="true" />
            </Link>
          </div>

          {recentRequests.length === 0 ? (
            <div className="cd-dash-empty cd-dash-empty-requests">
              <div className="cd-dash-empty-icon"><i className="bi bi-inbox" /></div>
              <h3>Your first request starts here</h3>
              <p>Choose a service above to create a request. Your recent activity will appear here.</p>
              <a href="#cd-explore-services" className="cd-dash-button cd-dash-button-primary">Explore services <i className="bi bi-arrow-up-right" /></a>
            </div>
          ) : (
            <div className="cd-dashboard-request-list">
              {recentRequests.map((request, index) => (
                <article className="cd-dashboard-request-card" key={request._id} style={{ "--cd-card-index": index }}>
                  <div className="cd-request-main-icon"><i className="bi bi-file-earmark-text" aria-hidden="true" /></div>
                  <div className="cd-request-content">
                    <div className="cd-request-title-row">
                      <div className="cd-request-title-copy">
                        <span className="cd-request-number">{request.requestNumber || request._id}</span>
                        <h3>{request.serviceName || "Service request"}</h3>
                      </div>
                      <StatusBadge status={request.status} />
                    </div>
                    <div className="cd-request-meta">
                      <span><i className="bi bi-calendar3" aria-hidden="true" /> Submitted {formatDateTime(request.createdAt)}</span>
                      <span><i className="bi bi-stack" aria-hidden="true" /> Quantity: {request.quantity ?? "—"}</span>
                      <span><i className="bi bi-calendar-event" aria-hidden="true" /> Preferred: {formatDate(request.preferredDate)}</span>
                    </div>
                  </div>
                  <div className="cd-request-total">
                    <small>Total amount</small>
                    <strong>{formatMoney(request.totalPrice)}</strong>
                  </div>
                  <div className="cd-request-actions">
                    <Link to={`/requests/${encodeURIComponent(String(request._id))}/workspace`} className="cd-request-chat-button" title="Open conversation">
                      <i className="bi bi-chat-dots" aria-hidden="true" />
                      <span>Conversation</span>
                    </Link>
                    <Link to="/my-requests" className="cd-request-view-button">Details</Link>
                    {request.status === "pending" && (
                      <button type="button" className="cd-request-cancel-button" disabled={Boolean(cancellingId) || submitting} onClick={() => handleCancel(request)}>
                        {cancellingId === request._id ? <><span className="cd-small-spinner" /> Cancelling</> : "Cancel"}
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}

          {requests.length >= PAGE_SIZE && (
            <div className="cd-request-history-link">
              <span>Showing your {recentRequests.length} most recent requests</span>
              <Link to="/my-requests">Open complete history <i className="bi bi-arrow-right" /></Link>
            </div>
          )}
        </section>

        {/* Helpful note */}
        <section className="cd-dashboard-help-strip">
          <div className="cd-dashboard-help-icon"><i className="bi bi-lightbulb" aria-hidden="true" /></div>
          <div>
            <strong>Need help with an existing request?</strong>
            <p>Open its conversation to send a message or review updates connected to that request.</p>
          </div>
          <Link to="/my-requests" aria-label="Go to my requests"><i className="bi bi-arrow-up-right" /></Link>
        </section>
      </div>

      {/* Booking modal */}
      {selectedService && (
        <div
          className="cd-booking-overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeBooking();
          }}
        >
          <section className="cd-booking-dialog" role="dialog" aria-modal="true" aria-labelledby="cd-booking-title">
            <form onSubmit={handleBooking} className="cd-booking-form">
              <header className="cd-booking-header">
                <div>
                  <span className="cd-dash-eyebrow">NEW SERVICE REQUEST</span>
                  <h2 id="cd-booking-title">Book a service</h2>
                  <p>{getServiceName(selectedService)}</p>
                </div>
                <button type="button" className="cd-booking-close" onClick={closeBooking} disabled={submitting} aria-label="Close booking form"><i className="bi bi-x-lg" /></button>
              </header>

              <div className="cd-booking-body">
                {bookingError && <div className="cd-dash-alert cd-dash-alert-error" role="alert"><i className="bi bi-exclamation-circle" /><span>{bookingError}</span></div>}

                <div className="cd-booking-price-card">
                  <div className="cd-booking-price-service-icon"><i className={`bi ${selectedService.icon || "bi-file-earmark-text"}`} /></div>
                  <div className="cd-booking-price-copy"><span>Price per unit</span><strong>{formatMoney(getServicePrice(selectedService))}</strong></div>
                  <div className="cd-booking-total"><span>Estimated total</span><strong>{formatMoney(getServicePrice(selectedService) * Math.max(0, Number(quantity) || 0))}</strong></div>
                </div>
                <p className="cd-booking-price-note"><i className="bi bi-info-circle" /> Final price and request details will be verified by the service system.</p>

                <div className="cd-booking-fields">
                  <div className="cd-booking-field">
                    <label htmlFor="cd-booking-quantity">Quantity <span>*</span></label>
                    <input id="cd-booking-quantity" type="number" min="1" max="1000" step="1" required value={quantity} disabled={submitting} onChange={(event) => setQuantity(event.target.value)} />
                    <small>Enter a quantity between 1 and 1000.</small>
                  </div>
                  <div className="cd-booking-field">
                    <label htmlFor="cd-booking-date">Preferred date <span className="cd-optional-label">OPTIONAL</span></label>
                    <input id="cd-booking-date" type="date" min={today} value={preferredDate} disabled={submitting} onChange={(event) => setPreferredDate(event.target.value)} />
                    <small>This is a preference, not a confirmed appointment.</small>
                  </div>
                  <div className="cd-booking-field cd-booking-field-full">
                    <label htmlFor="cd-booking-notes">Additional instructions <span className="cd-optional-label">OPTIONAL</span></label>
                    <textarea id="cd-booking-notes" rows="4" maxLength={1000} value={customerNotes} disabled={submitting} onChange={(event) => setCustomerNotes(event.target.value)} placeholder="Tell us about any details that may help with your request..." />
                    <div className="cd-booking-character-count">{customerNotes.length}/1000</div>
                  </div>
                </div>

                {Array.isArray(selectedService.requiredDocuments) && selectedService.requiredDocuments.length > 0 && (
                  <div className="cd-booking-documents">
                    <div><i className="bi bi-folder2-open" /><strong>Documents you may need</strong></div>
                    <ul>{selectedService.requiredDocuments.map((document, index) => <li key={`${document}-${index}`}>{document}</li>)}</ul>
                    <p>You can upload documents later from the relevant request workspace if supported.</p>
                  </div>
                )}
              </div>

              <footer className="cd-booking-footer">
                <button type="button" className="cd-dash-button cd-dash-button-outline" disabled={submitting} onClick={closeBooking}>Cancel</button>
                <button type="submit" className="cd-dash-button cd-dash-button-primary" disabled={submitting}>
                  {submitting ? <><span className="cd-small-spinner" /> Submitting request...</> : <>Submit request <i className="bi bi-arrow-up-right" /></>}
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
