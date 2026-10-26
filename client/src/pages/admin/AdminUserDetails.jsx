import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getAdminUserDetails } from "../../services/adminService";
import "../../styles/admin-user-details.css";

const formatDate = (date) => {
  if (!date) return "—";
  const value = new Date(date);
  return Number.isNaN(value.getTime())
    ? "—"
    : value.toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
};

const statusTone = (status) => {
  if (status === "active") return "is-active";
  if (status === "suspended") return "is-suspended";
  if (status === "pending") return "is-pending";
  return "is-neutral";
};

const roleTone = (role) => {
  if (role === "admin") return "is-admin";
  if (role === "staff") return "is-staff";
  if (role === "customer") return "is-customer";
  return "is-neutral";
};

const titleCase = (value = "Unknown") =>
  String(value)
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

function DetailItem({ icon, label, value, wide = false }) {
  const displayValue =
    value === undefined || value === null || value === "" ? "—" : value;

  return (
    <div className={`aud-detail-item${wide ? " aud-detail-item-wide" : ""}`}>
      <span className="aud-detail-icon" aria-hidden="true">
        <i className={`bi ${icon}`} />
      </span>
      <div className="aud-detail-content">
        <div className="aud-detail-label">{label}</div>
        <div className="aud-detail-value">{String(displayValue)}</div>
      </div>
    </div>
  );
}

export default function AdminUserDetails() {
  const { id } = useParams();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [imageError, setImageError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadUser() {
      setLoading(true);
      setError("");
      setImageError(false);
      setUser(null);

      try {
        const response = await getAdminUserDetails(id);
        if (!cancelled) setUser(response?.user || null);
      } catch (err) {
        if (!cancelled) {
          setError(
            err.response?.data?.message ||
              "Unable to load user details. Please try again.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadUser();
    return () => {
      cancelled = true;
    };
  }, [id, retryKey]);

  const address = user?.address
    ? [
        user.address.street,
        user.address.city,
        user.address.state,
        user.address.pincode,
      ]
        .filter(Boolean)
        .join(", ")
    : "";

  const initials = (user?.fullName || "U")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

  return (
    <main className="aud-page container-fluid px-3 px-lg-4 py-4 py-lg-5">
      <header className="aud-page-header">
        <div>
          <div className="aud-breadcrumb">
            <Link to="/admin">Admin Dashboard</Link>
            <i className="bi bi-chevron-right" aria-hidden="true" />
            <Link to="/admin/users">User Management</Link>
            <i className="bi bi-chevron-right" aria-hidden="true" />
            <span>User Details</span>
          </div>
          <div className="aud-eyebrow"><span /> ADMINISTRATION</div>
          <h1>User profile</h1>
          <p>Review account identity, contact information and account metadata.</p>
        </div>
        <div className="aud-header-actions">
          <button
            type="button"
            className="btn aud-refresh-btn"
            onClick={() => setRetryKey((current) => current + 1)}
            disabled={loading}
          >
            <i className={`bi ${loading ? "bi-arrow-repeat" : "bi-arrow-clockwise"} me-2`} aria-hidden="true" />
            Refresh details
          </button>
          <Link to="/admin/users" className="btn aud-back-btn">
            <i className="bi bi-arrow-left me-2" aria-hidden="true" />
            Back to users
          </Link>
        </div>
      </header>

      {loading ? (
        <section className="aud-state-card" aria-live="polite">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading user details...</span>
          </div>
          <h2>Loading user profile</h2>
          <p>Fetching the latest account information.</p>
          <div className="aud-skeleton-grid" aria-hidden="true">
            <span /><span /><span /><span />
          </div>
        </section>
      ) : error ? (
        <section className="aud-state-card aud-state-error" role="alert">
          <div className="aud-state-symbol"><i className="bi bi-exclamation-triangle" aria-hidden="true" /></div>
          <h2>Could not load this profile</h2>
          <p>{error}</p>
          <button type="button" className="btn btn-primary" onClick={() => setRetryKey((current) => current + 1)}>
            <i className="bi bi-arrow-clockwise me-2" aria-hidden="true" />Try again
          </button>
        </section>
      ) : user ? (
        <div className="aud-content">
          <section className="aud-profile-hero">
            <div className="aud-profile-main">
              <div className="aud-avatar-wrap">
                {user.profileImage?.url && !imageError ? (
                  <img
                    src={user.profileImage.url}
                    alt={`${user.fullName || "User"} profile`}
                    className="aud-avatar"
                    onError={() => setImageError(true)}
                  />
                ) : (
                  <div className="aud-avatar aud-avatar-fallback" role="img" aria-label="Default user avatar">
                    {initials || <i className="bi bi-person-fill" aria-hidden="true" />}
                  </div>
                )}
                <span className={`aud-avatar-presence ${user.accountStatus === "active" ? "is-online" : ""}`} title={titleCase(user.accountStatus)} />
              </div>
              <div className="aud-identity">
                <span className="aud-identity-kicker">USER ACCOUNT</span>
                <h2>{user.fullName || "Unnamed user"}</h2>
                <p><i className="bi bi-envelope me-2" aria-hidden="true" />{user.email || "Email not provided"}</p>
                <div className="aud-badges">
                  <span className={`aud-status-pill ${roleTone(user.role)}`}>
                    <i className="bi bi-person-badge me-1" aria-hidden="true" />{titleCase(user.role)}
                  </span>
                  <span className={`aud-status-pill ${statusTone(user.accountStatus)}`}>
                    <span className="aud-pill-dot" />{titleCase(user.accountStatus)}
                  </span>
                  <span className={`aud-status-pill ${user.emailVerified ? "is-verified" : "is-unverified"}`}>
                    <i className={`bi ${user.emailVerified ? "bi-patch-check-fill" : "bi-clock-history"} me-1`} aria-hidden="true" />
                    {user.emailVerified ? "Email verified" : "Email not verified"}
                  </span>
                </div>
              </div>
            </div>
            <div className="aud-profile-aside">
              <span className="aud-aside-label">Account ID</span>
              <code title={user._id || id}>{user._id || id || "—"}</code>
              <span className="aud-aside-note"><i className="bi bi-shield-lock me-1" aria-hidden="true" />Administrative view</span>
            </div>
          </section>

          <div className="aud-detail-grid">
            <section className="aud-panel">
              <div className="aud-panel-heading">
                <div className="aud-panel-icon aud-icon-blue"><i className="bi bi-person-lines-fill" aria-hidden="true" /></div>
                <div><h3>Personal information</h3><p>Basic identity details for this account</p></div>
              </div>
              <div className="aud-info-grid">
                <DetailItem icon="bi-person" label="Full name" value={user.fullName} />
                <DetailItem icon="bi-telephone" label="Phone number" value={user.phone} />
                <DetailItem icon="bi-envelope" label="Email address" value={user.email} wide />
                <DetailItem icon="bi-card-text" label="Bio" value={user.bio} wide />
              </div>
            </section>

            <section className="aud-panel">
              <div className="aud-panel-heading">
                <div className="aud-panel-icon aud-icon-violet"><i className="bi bi-geo-alt" aria-hidden="true" /></div>
                <div><h3>Address</h3><p>Saved location information</p></div>
              </div>
              {address ? (
                <div className="aud-address-card">
                  <i className="bi bi-pin-map" aria-hidden="true" />
                  <div>
                    <strong>{[user.address.street, user.address.city].filter(Boolean).join(", ") || "Saved address"}</strong>
                    <p>{[user.address.state, user.address.pincode].filter(Boolean).join(" · ") || "Additional location details not provided"}</p>
                    <span>{address}</span>
                  </div>
                </div>
              ) : (
                <div className="aud-empty-inline">
                  <i className="bi bi-geo" aria-hidden="true" />
                  <div><strong>No address provided</strong><p>This account does not have a saved address.</p></div>
                </div>
              )}
            </section>

            <section className="aud-panel aud-panel-wide">
              <div className="aud-panel-heading">
                <div className="aud-panel-icon aud-icon-teal"><i className="bi bi-shield-check" aria-hidden="true" /></div>
                <div><h3>Account & security</h3><p>Current access and verification state</p></div>
              </div>
              <div className="aud-security-grid">
                <div className="aud-security-item">
                  <span className="aud-security-symbol"><i className="bi bi-person-gear" aria-hidden="true" /></span>
                  <div><span>Role</span><strong>{titleCase(user.role)}</strong><small>Assigned account type</small></div>
                </div>
                <div className="aud-security-item">
                  <span className={`aud-security-symbol ${user.accountStatus === "suspended" ? "tone-red" : ""}`}><i className="bi bi-person-lock" aria-hidden="true" /></span>
                  <div><span>Account status</span><strong>{titleCase(user.accountStatus)}</strong><small>Current account access state</small></div>
                </div>
                <div className="aud-security-item">
                  <span className={`aud-security-symbol ${user.emailVerified ? "tone-green" : "tone-amber"}`}><i className={`bi ${user.emailVerified ? "bi-patch-check" : "bi-envelope-exclamation"}`} aria-hidden="true" /></span>
                  <div><span>Email verification</span><strong>{user.emailVerified ? "Verified" : "Pending verification"}</strong><small>{user.emailVerified ? "Email verification completed" : "Email verification not completed"}</small></div>
                </div>
              </div>
            </section>

            <section className="aud-panel aud-panel-wide">
              <div className="aud-panel-heading">
                <div className="aud-panel-icon aud-icon-amber"><i className="bi bi-clock-history" aria-hidden="true" /></div>
                <div><h3>Account activity</h3><p>Record creation and latest update timestamps</p></div>
              </div>
              <div className="aud-timeline-grid">
                <div className="aud-timeline-item">
                  <span className="aud-timeline-point"><i className="bi bi-plus-lg" aria-hidden="true" /></span>
                  <div><span>Account created</span><strong>{formatDate(user.createdAt)}</strong></div>
                </div>
                <div className="aud-timeline-item">
                  <span className="aud-timeline-point aud-timeline-point-update"><i className="bi bi-arrow-repeat" aria-hidden="true" /></span>
                  <div><span>Last updated</span><strong>{formatDate(user.updatedAt)}</strong></div>
                </div>
              </div>
            </section>
          </div>
        </div>
      ) : (
        <section className="aud-state-card">
          <div className="aud-state-symbol"><i className="bi bi-person-exclamation" aria-hidden="true" /></div>
          <h2>User not found</h2>
          <p>The account may have been removed or the link may be invalid.</p>
          <Link to="/admin/users" className="btn btn-primary">Back to user management</Link>
        </section>
      )}
    </main>
  );
}
