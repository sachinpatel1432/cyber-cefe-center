import { useState } from "react";
import { Link } from "react-router-dom";
import { changeEmail } from "../services/authService";
import { getErrorMessage } from "../services/api";
import "../styles/auth-flow.css";

export default function ChangeEmail() {
  const [formData, setFormData] = useState({ newEmail: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((previous) => ({ ...previous, [name]: value }));
    setError("");
    setSuccess("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    const newEmail = formData.newEmail.trim().toLowerCase();
    if (!newEmail) {
      setError("Please enter your new email address.");
      return;
    }
    if (!formData.password) {
      setError("Please enter your current password to confirm this change.");
      return;
    }

    setLoading(true);
    try {
      const response = await changeEmail({ newEmail, password: formData.password });
      setSuccess(
        response?.message ||
          "If the request is eligible, verification instructions will be sent to your new email address."
      );
      setFormData({ newEmail: "", password: "" });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="cd-auth-page">
      <div className="cd-auth-layout cd-auth-layout-narrow">
        <aside className="cd-auth-aside">
          <Link to="/" className="cd-auth-brand" aria-label="CyberDesk home">
            <span className="cd-brand-mark"><i className="bi bi-pc-display-horizontal" /></span>
            <span>Cyber<span>Desk</span></span>
          </Link>
          <div className="cd-auth-aside-copy">
            <span className="cd-auth-eyebrow">ACCOUNT SECURITY</span>
            <h2>Keep your account connected to the right inbox.</h2>
            <p>Your email is used for account notifications and important security updates.</p>
            <div className="cd-auth-benefit"><i className="bi bi-shield-check" /><span>Confirm the change with your password.</span></div>
            <div className="cd-auth-benefit"><i className="bi bi-envelope-check" /><span>Verify the new address from your inbox.</span></div>
          </div>
          <span className="cd-auth-aside-footer">Secure account management · CyberDesk</span>
        </aside>

        <section className="cd-auth-content">
          <div className="cd-auth-mobile-brand">
            <span className="cd-brand-mark"><i className="bi bi-pc-display-horizontal" /></span>
            <span>Cyber<span>Desk</span></span>
          </div>
          <Link to="/profile" className="cd-auth-back"><i className="bi bi-arrow-left" /> Back to profile</Link>
          <div className="cd-auth-heading">
            <div className="cd-auth-icon"><i className="bi bi-envelope-at" /></div>
            <span className="cd-auth-eyebrow">PROFILE SETTINGS</span>
            <h1>Change email</h1>
            <p>Enter your new email address and confirm your current password.</p>
          </div>

          {error && <div className="cd-auth-alert cd-auth-alert-error" role="alert"><i className="bi bi-exclamation-circle-fill" /><span>{error}</span></div>}
          {success && <div className="cd-auth-alert cd-auth-alert-success" role="status"><i className="bi bi-check-circle-fill" /><span>{success}</span></div>}

          <form onSubmit={handleSubmit} className="cd-auth-form">
            <div className="cd-form-field">
              <label htmlFor="newEmail">New email address</label>
              <div className="cd-input-wrap"><i className="bi bi-envelope" /><input id="newEmail" name="newEmail" type="email" placeholder="name@example.com" autoComplete="email" value={formData.newEmail} onChange={handleChange} maxLength={254} required disabled={loading} /></div>
            </div>
            <div className="cd-form-field">
              <label htmlFor="change-email-password">Current password</label>
              <div className="cd-input-wrap cd-input-with-action"><i className="bi bi-lock" /><input id="change-email-password" name="password" type={showPassword ? "text" : "password"} placeholder="Enter your current password" autoComplete="current-password" value={formData.password} onChange={handleChange} required disabled={loading} /><button type="button" className="cd-password-toggle" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"} disabled={loading}><i className={`bi ${showPassword ? "bi-eye-slash" : "bi-eye"}`} /></button></div>
            </div>
            <div className="cd-auth-note"><i className="bi bi-info-circle-fill" /><p>For security, your email address should only change after the new address is verified.</p></div>
            <button className="cd-auth-submit" type="submit" disabled={loading}>
              {loading ? <><span className="spinner-border spinner-border-sm" aria-hidden="true" /> Sending request...</> : <>Request email change <i className="bi bi-arrow-right" /></>}
            </button>
          </form>
          <p className="cd-auth-bottom">Need to review your details? <Link to="/profile">Return to profile</Link></p>
        </section>
      </div>
    </main>
  );
}
