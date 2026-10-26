
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getServiceDetails } from "../../services/serviceService";

function formatDate(value) {
  if (!value) return "Not available";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Not available";

  return date.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function getStatus(service) {
  if (service.deletedAt) return "Deleted";
  if (!service.active) return "Inactive";
  if (service.isClosed) return "Temporarily Closed";
  return "Available";
}

function getStatusClass(service) {
  if (service.deletedAt) return "text-bg-danger";
  if (!service.active) return "text-bg-secondary";
  if (service.isClosed) return "text-bg-warning";
  return "text-bg-success";
}

export default function AdminServiceDetails() {
  const { id } = useParams();

  const [service, setService] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadDetails() {
      setLoading(true);
      setError("");

      try {
        const response = await getServiceDetails(id);

        if (!cancelled) {
          setService(response.service);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err.response?.data?.message ||
              "Unable to load service details."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadDetails();

    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="container py-5 text-center">
        <div className="spinner-border text-primary" role="status" />
        <p className="text-secondary mt-3">
          Loading service details...
        </p>
      </div>
    );
  }

  if (error || !service) {
    return (
      <main className="container py-5">
        <div className="alert alert-danger" role="alert">
          {error || "Service not found."}
        </div>

        <Link
          to="/admin/services"
          className="btn btn-outline-primary"
        >
          <i className="bi bi-arrow-left me-2" />
          Back to All Services
        </Link>
      </main>
    );
  }

  return (
    <main className="container py-4 py-lg-5">
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
        <div>
          <Link
            to="/admin/services"
            className="text-decoration-none small"
          >
            <i className="bi bi-arrow-left me-1" />
            All Services
          </Link>

          <h2 className="fw-bold mt-2 mb-1">
            Service Details
          </h2>

          <p className="text-secondary mb-0">
            Review the complete service information.
          </p>
        </div>

        <div className="d-flex flex-wrap gap-2">
          <Link
            to="/admin/services"
            className="btn btn-outline-secondary"
          >
            Manage Services
          </Link>
        </div>
      </div>

      <div className="card border-0 shadow-sm rounded-4 mb-4">
        <div className="card-body p-4 p-lg-5">
          <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
            <div>
              <span className="text-secondary small">
                Service name
              </span>

              <h3 className="fw-bold mt-1 mb-2">
                {service.name}
              </h3>

              <span className="badge text-bg-light border">
                {service.category}
              </span>
            </div>

            <span
              className={`badge fs-6 ${getStatusClass(service)}`}
            >
              {getStatus(service)}
            </span>
          </div>

          <hr />

          <div className="row g-4">
            <div className="col-12">
              <h6 className="fw-bold">Description</h6>
              <p className="text-secondary mb-0">
                {service.description}
              </p>
            </div>

            <div className="col-12 col-md-6 col-lg-4">
              <div className="bg-body-tertiary rounded-3 p-3 h-100">
                <span className="text-secondary small">
                  Service Price
                </span>
                <h4 className="fw-bold mt-2 mb-0">
                  ₹{Number(service.price).toFixed(2)}
                </h4>
              </div>
            </div>

            <div className="col-12 col-md-6 col-lg-4">
              <div className="bg-body-tertiary rounded-3 p-3 h-100">
                <span className="text-secondary small">
                  Estimated Duration
                </span>
                <h4 className="fw-bold mt-2 mb-0">
                  {service.estimatedDurationMinutes} minutes
                </h4>
              </div>
            </div>

            <div className="col-12 col-md-6 col-lg-4">
              <div className="bg-body-tertiary rounded-3 p-3 h-100">
                <span className="text-secondary small">
                  Activation
                </span>
                <h5 className="fw-bold mt-2 mb-0">
                  {service.active ? "Active" : "Inactive"}
                </h5>
              </div>
            </div>

            <div className="col-12 col-md-6">
              <h6 className="fw-bold">Required Documents</h6>

              {service.requiredDocuments?.length ? (
                <ul className="list-group list-group-flush">
                  {service.requiredDocuments.map(
                    (document, index) => (
                      <li
                        className="list-group-item px-0"
                        key={`${document}-${index}`}
                      >
                        <i className="bi bi-file-earmark-text me-2 text-primary" />
                        {document}
                      </li>
                    )
                  )}
                </ul>
              ) : (
                <p className="text-secondary mb-0">
                  No required documents specified.
                </p>
              )}
            </div>

            <div className="col-12 col-md-6">
              <h6 className="fw-bold">Availability</h6>

              <p className="mb-2">
                <span className="text-secondary">Status: </span>
                {getStatus(service)}
              </p>

              {service.isClosed && service.closureReason && (
                <p className="mb-0">
                  <span className="text-secondary">
                    Closure reason:{" "}
                  </span>
                  {service.closureReason}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="card border-0 shadow-sm rounded-4">
        <div className="card-body p-4">
          <h5 className="fw-bold mb-3">Record Information</h5>

          <div className="row g-3">
            <div className="col-12 col-md-6">
              <span className="text-secondary small">
                Service ID
              </span>
              <div className="text-break fw-medium">
                {service._id}
              </div>
            </div>

            <div className="col-12 col-md-6">
              <span className="text-secondary small">
                Created By (Admin ID)
              </span>
              <div className="text-break fw-medium">
                {service.createdBy?._id ||
                  service.createdBy ||
                  "Not available"}
              </div>
            </div>

            <div className="col-12 col-md-6">
              <span className="text-secondary small">
                Created At
              </span>
              <div className="fw-medium">
                {formatDate(service.createdAt)}
              </div>
            </div>

            <div className="col-12 col-md-6">
              <span className="text-secondary small">
                Last Updated
              </span>
              <div className="fw-medium">
                {formatDate(service.updatedAt)}
              </div>
            </div>

            {service.deletedAt && (
              <div className="col-12">
                <span className="text-secondary small">
                  Removed At
                </span>
                <div className="fw-medium">
                  {formatDate(service.deletedAt)}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
