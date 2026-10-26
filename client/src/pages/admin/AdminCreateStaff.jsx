import { useState } from "react";
import { Link } from "react-router-dom";
import { createAdminStaff } from "../../services/adminService";
import "../../styles/admin-create-staff.css";

const initialForm = {
  fullName: "",
  email: "",
  phone: "",
};

function AdminCreateStaff() {
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [invitedEmail, setInvitedEmail] = useState("");

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
    if (error) setError("");
    if (success) setSuccess("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (loading) return;

    setError("");
    setSuccess("");

    const payload = {
      fullName: form.fullName.trim().replace(/\s+/g, " "),
      email: form.email.trim().toLowerCase(),
      phone: form.phone.trim(),
    };

    if (payload.fullName.length < 2 || payload.fullName.length > 100) {
      setError("Full name must be between 2 and 100 characters.");
      return;
    }

    if (!payload.email || payload.email.length > 254) {
      setError("Please enter a valid email address (maximum 254 characters).");
      return;
    }

    setLoading(true);
    try {
      const response = await createAdminStaff(payload);
      const message =
        response?.message ||
        response?.data?.message ||
        "Staff account created and invitation sent.";

      setSuccess(message);
      setInvitedEmail(payload.email);
      setForm(initialForm);
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Unable to create the staff invitation. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="admin-create-staff container-fluid px-3 px-lg-4 py-4 py-lg-5">
      <header className="acs-page-header d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
        <div>
          <div className="acs-eyebrow mb-2">
            <span className="acs-eyebrow-dot" aria-hidden="true" />
            CYBERDESK ADMINISTRATION
          </div>
          <h1 className="acs-title mb-2">Create staff invitation</h1>
          <p className="acs-subtitle mb-0">
            Invite a team member to securely activate their CyberDesk account.
          </p>
        </div>

        <Link to="/admin/users" className="btn acs-secondary-button">
          <i className="bi bi-arrow-left me-2" aria-hidden="true" />
          Back to Users
        </Link>
      </header>

      {error && (
        <div className="acs-alert acs-alert-error mb-4" role="alert" aria-live="assertive">
          <i className="bi bi-exclamation-triangle-fill" aria-hidden="true" />
          <span>{error}</span>
          <button
            type="button"
            className="acs-alert-dismiss"
            aria-label="Dismiss error"
            onClick={() => setError("")}
          >
            <i className="bi bi-x-lg" aria-hidden="true" />
          </button>
        </div>
      )}

      {success && (
        <div className="acs-alert acs-alert-success mb-4" role="status" aria-live="polite">
          <i className="bi bi-check-circle-fill" aria-hidden="true" />
          <div className="acs-alert-content">
            <strong>Invitation request completed</strong>
            <span>{success}</span>
            {invitedEmail && (
              <span className="acs-invited-email">
                <i className="bi bi-envelope me-2" aria-hidden="true" />
                {invitedEmail}
              </span>
            )}
            <span className="small">
              Ask the staff member to check their inbox and spam folder for the invitation email.
            </span>
          </div>
          <button
            type="button"
            className="acs-alert-dismiss"
            aria-label="Dismiss success message"
            onClick={() => setSuccess("")}
          >
            <i className="bi bi-x-lg" aria-hidden="true" />
          </button>
        </div>
      )}

      <div className="row g-4 align-items-start">
        <div className="col-12 col-xl-8">
          <section className="acs-panel">
            <div className="acs-panel-heading">
              <div className="acs-heading-icon" aria-hidden="true">
                <i className="bi bi-person-plus-fill" />
              </div>
              <div>
                <h2 className="h5 mb-1">Staff details</h2>
                <p className="mb-0">Enter the contact details for the person you want to invite.</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} noValidate>
              <div className="acs-form-grid">
                <div className="acs-field acs-field-full">
                  <label htmlFor="fullName" className="form-label">
                    Full name <span className="acs-required">*</span>
                  </label>
                  <div className="acs-input-wrap">
                    <i className="bi bi-person" aria-hidden="true" />
                    <input
                      id="fullName"
                      name="fullName"
                      type="text"
                      className="form-control"
                      value={form.fullName}
                      onChange={handleChange}
                      minLength={2}
                      maxLength={100}
                      autoComplete="name"
                      placeholder="e.g. Rahul Sharma"
                      required
                      disabled={loading}
                      aria-describedby="fullName-help"
                    />
                  </div>
                  <div id="fullName-help" className="form-text">Use the name you want displayed in the staff workspace.</div>
                </div>

                <div className="acs-field acs-field-full">
                  <label htmlFor="email" className="form-label">
                    Work email address <span className="acs-required">*</span>
                  </label>
                  <div className="acs-input-wrap">
                    <i className="bi bi-envelope" aria-hidden="true" />
                    <input
                      id="email"
                      name="email"
                      type="email"
                      className="form-control"
                      value={form.email}
                      onChange={handleChange}
                      maxLength={254}
                      autoComplete="email"
                      placeholder="name@example.com"
                      required
                      disabled={loading}
                      aria-describedby="email-help"
                    />
                  </div>
                  <div id="email-help" className="form-text">The invitation will be associated with this email address.</div>
                </div>

                <div className="acs-field acs-field-full">
                  <label htmlFor="phone" className="form-label">Phone number <span className="acs-optional">Optional</span></label>
                  <div className="acs-input-wrap">
                    <i className="bi bi-telephone" aria-hidden="true" />
                    <input
                      id="phone"
                      name="phone"
                      type="tel"
                      className="form-control"
                      value={form.phone}
                      onChange={handleChange}
                      maxLength={20}
                      autoComplete="tel"
                      placeholder="e.g. +91 98765 43210"
                      disabled={loading}
                      aria-describedby="phone-help"
                    />
                  </div>
                  <div id="phone-help" className="form-text">Include the country code if you provide a phone number.</div>
                </div>
              </div>

              <div className="acs-security-note mt-4" role="note">
                <div className="acs-security-icon" aria-hidden="true">
                  <i className="bi bi-shield-lock-fill" />
                </div>
                <div>
                  <strong>Secure account activation</strong>
                  <p className="mb-0">The staff member sets their own password through the invitation link. Do not ask them to send you their password.</p>
                </div>
              </div>

              <div className="acs-form-actions mt-4">
                <button type="submit" className="btn acs-primary-button" disabled={loading}>
                  {loading ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" aria-hidden="true" />
                      Sending invitation…
                    </>
                  ) : (
                    <>
                      <i className="bi bi-send-fill me-2" aria-hidden="true" />
                      Create &amp; Send Invitation
                    </>
                  )}
                </button>
                <button
                  type="button"
                  className="btn acs-text-button"
                  onClick={() => {
                    setForm(initialForm);
                    setError("");
                    setSuccess("");
                    setInvitedEmail("");
                  }}
                  disabled={loading || (!form.fullName && !form.email && !form.phone)}
                >
                  Clear form
                </button>
              </div>
            </form>
          </section>
        </div>

        <aside className="col-12 col-xl-4">
          <section className="acs-guide-panel">
            <div className="acs-guide-top-icon" aria-hidden="true">
              <i className="bi bi-envelope-paper-fill" />
            </div>
            <span className="acs-guide-kicker">HOW IT WORKS</span>
            <h2 className="h5 fw-bold mt-2 mb-2">From invitation to first login</h2>
            <p className="acs-guide-intro">A simple, password-safe onboarding process for every staff member.</p>

            <ol className="acs-steps">
              <li>
                <span className="acs-step-number">1</span>
                <div><strong>Create invitation</strong><p>Enter the staff member’s name and email, then send the invitation.</p></div>
              </li>
              <li>
                <span className="acs-step-number">2</span>
                <div><strong>Staff opens their email</strong><p>They follow the invitation link sent to the email address entered here.</p></div>
              </li>
              <li>
                <span className="acs-step-number">3</span>
                <div><strong>Set password &amp; sign in</strong><p>They complete account setup and then sign in to access their staff dashboard.</p></div>
              </li>
            </ol>

            <div className="acs-guide-footnote">
              <i className="bi bi-info-circle-fill" aria-hidden="true" />
              <span>If an email does not arrive, check the email service configuration and server logs before sending another invitation.</span>
            </div>
          </section>
        </aside>
      </div>
    </main>
  );
}

export default AdminCreateStaff;
