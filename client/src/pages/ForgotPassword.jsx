import { useState } from "react";
import { Link } from "react-router-dom";
import { forgotPassword } from "../services/authService";
import { getErrorMessage } from "../services/api";
import "../styles/forgot-password.css";

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (loading) return;

    setMessage("");
    setError("");

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setError("Please enter your registered email address.");
      return;
    }

    setLoading(true);

    try {
      const response = await forgotPassword(normalizedEmail);
      setMessage(
        response?.message ||
          "If an account exists for this email, password reset instructions will be sent. Check your inbox and spam folder."
      );
    } catch (err) {
      setError(getErrorMessage(err) || "Unable to submit your reset request. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="cyber-auth-page cyber-forgot-page">
      <div className="cyber-auth-shell cyber-forgot-shell">
        <aside className="cyber-auth-aside cyber-forgot-aside">
          <Link to="/" className="cyber-auth-brand" aria-label="CyberDesk home">
            <span className="cyber-auth-brand-mark">
              <i className="bi bi-pc-display-horizontal" aria-hidden="true" />
            </span>
            <span>Cyber<span>Desk</span></span>
          </Link>

          <div className="cyber-auth-aside-content">
            <span className="cyber-auth-eyebrow">
              <i className="bi bi-shield-check me-2" aria-hidden="true" />ACCOUNT RECOVERY
            </span>
            <h1>Get back to<br />your digital desk.</h1>
            <p>
              Request a secure password reset link and return to your CyberDesk services.
            </p>

            <div className="cyber-recovery-steps">
              <div className="cyber-recovery-step">
                <span className="cyber-recovery-step-icon"><i className="bi bi-envelope" aria-hidden="true" /></span>
                <div><strong>Enter your email</strong><small>Use the email linked to your account.</small></div>
              </div>
              <div className="cyber-recovery-step">
                <span className="cyber-recovery-step-icon"><i className="bi bi-link-45deg" aria-hidden="true" /></span>
                <div><strong>Check your inbox</strong><small>Follow the reset instructions if an account matches.</small></div>
              </div>
              <div className="cyber-recovery-step">
                <span className="cyber-recovery-step-icon"><i className="bi bi-key" aria-hidden="true" /></span>
                <div><strong>Create a new password</strong><small>Choose a strong password you have not reused.</small></div>
              </div>
            </div>
          </div>

          <div className="cyber-auth-aside-footer">
            <i className="bi bi-shield-lock me-2" aria-hidden="true" />Secure account recovery
          </div>
        </aside>

        <section className="cyber-auth-main">
          <div className="cyber-auth-mobile-brand">
            <Link to="/" className="cyber-auth-brand" aria-label="CyberDesk home">
              <span className="cyber-auth-brand-mark"><i className="bi bi-pc-display-horizontal" aria-hidden="true" /></span>
              <span>Cyber<span>Desk</span></span>
            </Link>
          </div>

          <div className="cyber-auth-form-wrap">
            <div className="cyber-forgot-icon">
              <i className="bi bi-shield-lock" aria-hidden="true" />
            </div>
            <span className="cyber-form-kicker">PASSWORD ASSISTANCE</span>
            <h2>Forgot your password?</h2>
            <p className="cyber-auth-description">
              No worries. Enter your registered email and we’ll help you reset your password.
            </p>

            {message && (
              <div className="cyber-auth-alert cyber-auth-alert-success" role="status">
                <i className="bi bi-check-circle-fill" aria-hidden="true" />
                <div><strong>Request submitted</strong><span>{message}</span></div>
              </div>
            )}

            {error && (
              <div className="cyber-auth-alert cyber-auth-alert-error" role="alert">
                <i className="bi bi-exclamation-circle-fill" aria-hidden="true" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate>
              <div className="cyber-auth-field">
                <label htmlFor="forgot-email">Registered email address</label>
                <div className="cyber-auth-input-wrap">
                  <i className="bi bi-envelope" aria-hidden="true" />
                  <input
                    id="forgot-email"
                    name="email"
                    type="email"
                    placeholder="you@example.com"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => {
                      setEmail(event.target.value);
                      setError("");
                      setMessage("");
                    }}
                    maxLength={254}
                    required
                    disabled={loading}
                    autoFocus
                  />
                </div>
                <small>We’ll send reset instructions only if an account matches this email.</small>
              </div>

              <button type="submit" className="cyber-auth-submit" disabled={loading || !email.trim()}>
                {loading ? (
                  <><span className="spinner-border spinner-border-sm me-2" aria-hidden="true" />Sending request...</>
                ) : (
                  <>Send reset instructions <i className="bi bi-arrow-right" aria-hidden="true" /></>
                )}
              </button>
            </form>

            <div className="cyber-forgot-divider"><span>Remembered your password?</span></div>
            <Link to="/login" className="cyber-auth-secondary-link">
              <i className="bi bi-arrow-left" aria-hidden="true" /> Back to Login
            </Link>
          </div>

          <p className="cyber-auth-legal">
            <i className="bi bi-shield-check me-1" aria-hidden="true" />Your account security matters to us.
          </p>
        </section>
      </div>
    </main>
  );
}

export default ForgotPassword;
