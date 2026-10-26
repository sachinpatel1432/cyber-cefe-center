
import { useCallback, useEffect, useState } from "react";
import { getActiveServices } from "../services/serviceService";
import {
  createServiceRequest,
  getMyServiceRequests,
  getMyServiceRequestSummary,
  cancelMyServiceRequest,
} from "../services/serviceRequestService";

const formatMoney = (amount) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(amount) || 0);

const formatDate = (date) => {
  if (!date) return "Not selected";

  return new Date(date).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const statusClass = {
  pending: "warning",
  approved: "info",
  in_progress: "primary",
  completed: "success",
  rejected: "danger",
  cancelled: "secondary",
};

function CustomerDashboard() {
  const [services, setServices] = useState([]);
  const [requests, setRequests] = useState([]);

  const [summary, setSummary] = useState({
    totalRequests: 0,
    pendingRequests: 0,
    activeRequests: 0,
    completedRequests: 0,
  });

  const [selectedService, setSelectedService] = useState(null);
  const [quantity, setQuantity] = useState("1");
  const [preferredDate, setPreferredDate] = useState("");
  const [customerNotes, setCustomerNotes] = useState("");

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [cancellingId, setCancellingId] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadDashboard = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);
    setError("");

    try {
      const [servicesResult, requestsResult, summaryResult] =
        await Promise.all([
          getActiveServices(),
          getMyServiceRequests({ page: 1, limit: 10 }),
          getMyServiceRequestSummary(),
        ]);

      setServices(servicesResult.services || []);
      setRequests(requestsResult.requests || []);
      setSummary({
        totalRequests: summaryResult.summary?.totalRequests ?? 0,
        pendingRequests: summaryResult.summary?.pendingRequests ?? 0,
        activeRequests: summaryResult.summary?.activeRequests ?? 0,
        completedRequests: summaryResult.summary?.completedRequests ?? 0,
      });
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Dashboard load nahi hua. Please refresh karke try karein."
      );
    } finally {
      if (showLoader) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const openBooking = (service) => {
    setSelectedService(service);
    setQuantity("1");
    setPreferredDate("");
    setCustomerNotes("");
    setError("");
    setSuccess("");
  };

  const closeBooking = () => {
    if (!submitting) {
      setSelectedService(null);
    }
  };

  const handleBooking = async (event) => {
    event.preventDefault();

    if (!selectedService) return;

    const parsedQuantity = Number(quantity);

    if (
      !Number.isInteger(parsedQuantity) ||
      parsedQuantity < 1 ||
      parsedQuantity > 1000
    ) {
      setError("Quantity 1 se 1000 ke beech honi chahiye.");
      return;
    }

    if (
      preferredDate &&
      preferredDate < new Date().toLocaleDateString("en-CA")
    ) {
      setError("Please future date select karein.");
      return;
    }

    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      const result = await createServiceRequest({
        serviceId: selectedService._id,
        quantity: parsedQuantity,
        preferredDate: preferredDate || null,
        customerNotes: customerNotes.trim(),
      });

      setSuccess(
        `Request successfully submit ho gayi${
          result.request?.requestNumber
            ? ` — ${result.request.requestNumber}`
            : ""
        }.`
      );

      setSelectedService(null);
      await loadDashboard(false);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Booking submit nahi hui. Please dobara try karein."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async (request) => {
    if (request.status !== "pending" || cancellingId) return;

    const confirmed = window.confirm(
      `Kya aap request ${request.requestNumber} cancel karna chahte hain?`
    );

    if (!confirmed) return;

    setError("");
    setSuccess("");
    setCancellingId(request._id);

    try {
      const result = await cancelMyServiceRequest(request._id);
      setSuccess(result.message || "Request cancel ho gayi.");
      await loadDashboard(false);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Request cancel nahi ho paayi."
      );
    } finally {
      setCancellingId(null);
    }
  };

  const today = new Date();
  const minDate = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0"),
  ].join("-");

  if (loading) {
    return (
      <main className="container py-5 text-center">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
        <p className="mt-3">Customer dashboard load ho raha hai...</p>
      </main>
    );
  }

  return (
    <main className="container py-4 py-lg-5">
      {/* Welcome banner */}
      <section className="rounded-4 bg-dark text-white p-4 p-lg-5 mb-4">
        <span className="badge text-bg-primary mb-3">
          CyberDesk Customer Portal
        </span>

        <h1 className="display-6 fw-bold">
          Welcome to Your Dashboard!
        </h1>

        <p className="text-white-50 mb-0">
          Services explore karein, booking submit karein aur apni
          requests ka status track karein.
        </p>
      </section>

      {/* Alerts */}
      {error && !selectedService && (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      )}

      {success && (
        <div className="alert alert-success" role="status">
          {success}
        </div>
      )}

      {/* Summary cards */}
      <section className="row g-3 mb-5">
        {[
          {
            label: "Total Requests",
            value: summary.totalRequests,
            icon: "bi-clipboard-check",
          },
          {
            label: "Pending",
            value: summary.pendingRequests,
            icon: "bi-hourglass-split",
          },
          {
            label: "In Progress",
            value: summary.activeRequests,
            icon: "bi-arrow-repeat",
          },
          {
            label: "Completed",
            value: summary.completedRequests,
            icon: "bi-check-circle",
          },
        ].map((item) => (
          <div className="col-6 col-lg-3" key={item.label}>
            <div className="card border-0 shadow-sm h-100">
              <div className="card-body">
                <i
                  className={`bi ${item.icon} fs-3 text-primary`}
                  aria-hidden="true"
                />
                <p className="text-secondary mt-3 mb-1">
                  {item.label}
                </p>
                <h2 className="h3 fw-bold mb-0">{item.value}</h2>
              </div>
            </div>
          </div>
        ))}
      </section>

      {/* Active services */}
      <section className="mb-5">
        <div className="mb-3">
          <h2 className="h4 fw-bold mb-1">Available Services</h2>
          <p className="text-secondary">
            Apni requirement ke hisaab se service select karein.
          </p>
        </div>

        {services.length === 0 ? (
          <div className="alert alert-info">
            Abhi koi active service available nahi hai.
          </div>
        ) : (
          <div className="row g-4">
            {services.map((service) => (
              <div className="col-md-6 col-xl-4" key={service._id}>
                <article className="card h-100 border-0 shadow-sm">
                  <div className="card-body d-flex flex-column">
                    <span className="badge text-bg-primary align-self-start mb-3">
                      {service.category}
                    </span>

                    <h3 className="h5 fw-bold">{service.name}</h3>

                    <p className="text-secondary flex-grow-1">
                      {service.description}
                    </p>

                    <div className="d-flex justify-content-between align-items-center mb-3">
                      <div>
                        <div className="h5 fw-bold mb-0">
                          {formatMoney(service.price)}
                        </div>
                        <small className="text-secondary">
                          Per unit
                        </small>
                      </div>

                      <small className="text-secondary">
                        <i className="bi bi-clock me-1" />
                        {service.estimatedDurationMinutes} min
                      </small>
                    </div>

                    {service.requiredDocuments?.length > 0 && (
                      <div className="small mb-3">
                        <strong>Required documents:</strong>
                        <ul className="mt-1 mb-0">
                          {service.requiredDocuments.map((document) => (
                            <li key={document}>{document}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <button
                      type="button"
                      className="btn btn-primary w-100 mt-auto"
                      onClick={() => openBooking(service)}
                    >
                      <i className="bi bi-calendar-check me-2" />
                      Book This Service
                    </button>
                  </div>
                </article>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Service request history */}
      <section className="mb-5">
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
          <div>
            <h2 className="h4 fw-bold mb-1">My Service Requests</h2>
            <p className="text-secondary mb-0">
              Apni recent bookings ka status dekhein.
            </p>
          </div>

          <button
            type="button"
            className="btn btn-outline-secondary"
            onClick={() => loadDashboard()}
          >
            <i className="bi bi-arrow-clockwise me-2" />
            Refresh
          </button>
        </div>

        {requests.length === 0 ? (
          <div className="card border-0 shadow-sm">
            <div className="card-body text-center py-5">
              <i className="bi bi-inbox fs-1 text-secondary" />
              <h3 className="h5 mt-3">No requests yet</h3>
              <p className="text-secondary mb-0">
                Pehli booking ke liye koi service select karein.
              </p>
            </div>
          </div>
        ) : (
          <div className="table-responsive bg-white rounded shadow-sm">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th>Request ID</th>
                  <th>Service</th>
                  <th>Total</th>
                  <th>Preferred Date</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {requests.map((request) => (
                  <tr key={request._id}>
                    <td>
                      <span className="fw-semibold">
                        {request.requestNumber}
                      </span>
                      <div className="small text-secondary">
                        {formatDate(request.createdAt)}
                      </div>
                    </td>

                    <td>
                      {request.serviceName}
                      <div className="small text-secondary">
                        Quantity: {request.quantity}
                      </div>
                    </td>

                    <td className="fw-semibold">
                      {formatMoney(request.totalPrice)}
                    </td>

                    <td>{formatDate(request.preferredDate)}</td>

                    <td>
                      <span
                        className={`badge text-bg-${
                          statusClass[request.status] || "secondary"
                        }`}
                      >
                        {(request.status || "pending")
                          .replaceAll("_", " ")
                          .replace(/\b\w/g, (letter) =>
                            letter.toUpperCase()
                          )}
                      </span>
                    </td>

                    <td>
                      {request.status === "pending" ? (
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-danger"
                          disabled={Boolean(cancellingId)}
                          onClick={() => handleCancel(request)}
                        >
                          {cancellingId === request._id
                            ? "Cancelling..."
                            : "Cancel"}
                        </button>
                      ) : (
                        <span className="text-secondary">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Booking modal with independently scrollable body */}
      {selectedService && (
        <div
          className="modal d-block"
          role="dialog"
          aria-modal="true"
          aria-labelledby="booking-modal-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeBooking();
            }
          }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1055,
            background: "rgba(0, 0, 0, 0.55)",
            overflowY: "auto",
            padding: "12px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            className="modal-dialog"
            style={{
              width: "100%",
              maxWidth: "560px",
              margin: "auto",
              display: "flex",
              flexDirection: "column",
              minHeight: 0,
            }}
          >
            <div
              className="modal-content border-0 shadow"
              style={{
                display: "flex",
                flexDirection: "column",
                maxHeight: "calc(100vh - 24px)",
                maxHeight: "calc(100dvh - 24px)",
                minHeight: 0,
                overflow: "hidden",
              }}
            >
              <form
                onSubmit={handleBooking}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  minHeight: 0,
                  overflow: "hidden",
                }}
              >
                {/* Fixed header */}
                <div className="modal-header flex-shrink-0">
                  <div>
                    <h2
                      className="modal-title fs-5"
                      id="booking-modal-title"
                    >
                      Book Service
                    </h2>
                    <p className="text-secondary mb-0 small">
                      {selectedService.name}
                    </p>
                  </div>

                  <button
                    type="button"
                    className="btn-close"
                    aria-label="Close"
                    disabled={submitting}
                    onClick={closeBooking}
                  />
                </div>

                {/* Only this area scrolls */}
                <div
                  className="modal-body"
                  style={{
                    overflowY: "auto",
                    WebkitOverflowScrolling: "touch",
                    overscrollBehavior: "contain",
                    minHeight: 0,
                    flex: "1 1 auto",
                  }}
                >
                  {error && (
                    <div className="alert alert-danger" role="alert">
                      {error}
                    </div>
                  )}

                  <div className="border rounded-3 p-3 mb-3">
                    <div className="d-flex justify-content-between gap-3">
                      <span>Price per unit</span>
                      <strong>
                        {formatMoney(selectedService.price)}
                      </strong>
                    </div>

                    <div className="d-flex justify-content-between gap-3 mt-2">
                      <span>Quantity</span>
                      <strong>{quantity || 0}</strong>
                    </div>

                    <hr />

                    <div className="d-flex justify-content-between align-items-center gap-3">
                      <span>Estimated total</span>
                      <strong className="text-primary fs-5">
                        {formatMoney(
                          Number(selectedService.price) *
                            Math.max(0, Number(quantity) || 0)
                        )}
                      </strong>
                    </div>

                    <small className="text-secondary d-block mt-2">
                      Final price server par verify hogi.
                    </small>
                  </div>

                  <div className="mb-3">
                    <label
                      className="form-label"
                      htmlFor="booking-quantity"
                    >
                      Quantity
                    </label>
                    <input
                      id="booking-quantity"
                      type="number"
                      className="form-control"
                      min="1"
                      max="1000"
                      step="1"
                      required
                      value={quantity}
                      onChange={(event) => setQuantity(event.target.value)}
                    />
                  </div>

                  <div className="mb-3">
                    <label
                      className="form-label"
                      htmlFor="booking-date"
                    >
                      Preferred date (optional)
                    </label>
                    <input
                      id="booking-date"
                      type="date"
                      className="form-control"
                      min={minDate}
                      value={preferredDate}
                      onChange={(event) =>
                        setPreferredDate(event.target.value)
                      }
                    />
                    <small className="text-secondary">
                      Ye preferred date hai, confirmed appointment nahi.
                    </small>
                  </div>

                  <div className="mb-3">
                    <label
                      className="form-label"
                      htmlFor="booking-notes"
                    >
                      Additional instructions (optional)
                    </label>
                    <textarea
                      id="booking-notes"
                      className="form-control"
                      rows="4"
                      maxLength="1000"
                      value={customerNotes}
                      onChange={(event) =>
                        setCustomerNotes(event.target.value)
                      }
                      placeholder="Apni requirement likhein..."
                    />
                    <div className="form-text text-end">
                      {customerNotes.length}/1000
                    </div>
                  </div>

                  {selectedService.requiredDocuments?.length > 0 && (
                    <div className="alert alert-info small mb-0">
                      <strong>Required documents</strong>
                      <ul className="mb-0 mt-2">
                        {selectedService.requiredDocuments.map((document) => (
                          <li key={document}>{document}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Fixed footer: always visible */}
                <div className="modal-footer flex-shrink-0">
                  <button
                    type="button"
                    className="btn btn-light"
                    disabled={submitting}
                    onClick={closeBooking}
                  >
                    Close
                  </button>

                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={submitting}
                  >
                    {submitting ? (
                      <>
                        <span
                          className="spinner-border spinner-border-sm me-2"
                          aria-hidden="true"
                        />
                        Submitting...
                      </>
                    ) : (
                      "Submit Request"
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default CustomerDashboard;
