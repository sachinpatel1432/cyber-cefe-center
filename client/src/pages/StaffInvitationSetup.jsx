import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import api from "../services/api";
import "../styles/staff-invitation-setup.css";

function PasswordField({
  id,
  label,
  value,
  onChange,
  visible,
  onToggleVisibility,
  disabled,
  autoComplete = "new-password",
  hint,
  invalid,
}) {
  return (
    <div className="staff-setup-field">
      <label htmlFor={id} className="form-label">
        {label}
      </label>
      <div className={`staff-setup-input-wrap ${invalid ? "is-invalid" : ""}`}>
        <span className="staff-setup-input-icon" aria-hidden="true">
          <i className="bi bi-lock" />
        </span>
        <input
          id={id}
          name={id}
          type={visible ? "text" : "password"}
          className="form-control"
          value={value}
          onChange={onChange}
          minLength={12}
          maxLength={72}
          autoComplete={autoComplete}
          required
          disabled={disabled}
          aria-describedby={hint ? `${id}-hint` : undefined}
        />
        <button
          type="button"
          className="staff-setup-password-toggle"
          onClick={onToggleVisibility}
          disabled={disabled}
          aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
        >
          <i className={`bi ${visible ? "bi-eye-slash" : "bi-eye"}`} aria-hidden="true" />
        </button>
      </div>
      {hint && <div className="form-text" id={`${id}-hint`}>{hint}</div>}
    </div>
  );
}

function StaffInvitationSetup() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const passwordLengthValid = newPassword.length >= 12 && newPassword.length <= 72;
  const passwordsMatch = confirmPassword.length > 0 && newPassword === confirmPassword;

  const passwordProgress = useMemo(() => {
    if (!newPassword) return 0;
    if (newPassword.length < 8) return 1;
    if (newPassword.length < 12) return 2;
    return 3;
  }, [newPassword]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!token) {
      setError("Invitation token is missing. Please open the latest email link.");
      return;
    }

    if (newPassword.length < 12 || newPassword.length > 72) {
      setError("Password must contain 12–72 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const response = await api.post("/auth/staff-invitation/complete", {
        token,
        newPassword,
        confirmPassword,
      });

      setSuccess(response.data.message || "Account activated. You can now log in.");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to complete setup. The invitation may have expired. Please open the latest invitation email."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="staff-setup-page">
      <div className="staff-setup-decoration staff-setup-decoration-one" aria-hidden="true" />
      <div className="staff-setup-decoration staff-setup-decoration-two" aria-hidden="true" />

      <div className="staff-setup-shell">
        <header className="staff-setup-brand-row">
          <Link to="/" className="staff-setup-brand" aria-label="CyberDesk home">
            <span className="staff-setup-brand-mark"><i className="bi bi-grid-1x2-fill" aria-hidden="true" /></span>
            <span>Cyber<span>Desk</span><small>STAFF PORTAL</small></span>
          </Link>
          <span className="staff-setup-secure-label"><i className="bi bi-shield-check me-1" aria-hidden="true" />Secure setup</span>
        </header>

        <div className="staff-setup-layout">
          <section className="staff-setup-intro" aria-labelledby="staff-setup-intro-title">
            <div className="staff-setup-eyebrow"><span className="staff-setup-eyebrow-dot" /> TEAM ONBOARDING</div>
            <h1 id="staff-setup-intro-title">Let’s get your<br /><span>workspace ready.</span></h1>
            <p className="staff-setup-intro-copy">
              Set a strong password to activate your CyberDesk staff account and securely manage your assigned service requests.
            </p>

            <div className="staff-setup-steps" aria-label="Account setup steps">
              <div className="staff-setup-step is-complete">
                <span className="staff-setup-step-icon"><i className="bi bi-envelope-check" aria-hidden="true" /></span>
                <span><strong>Invitation received</strong><small>Use the secure link from your email</small></span>
                <i className="bi bi-check-circle-fill staff-setup-step-check" aria-hidden="true" />
              </div>
              <div className="staff-setup-step is-current">
                <span className="staff-setup-step-icon"><i className="bi bi-shield-lock" aria-hidden="true" /></span>
                <span><strong>Create your password</strong><small>Choose a password between 12 and 72 characters</small></span>
                <span className="staff-setup-step-number">02</span>
              </div>
              <div className="staff-setup-step">
                <span className="staff-setup-step-icon"><i className="bi bi-person-check" aria-hidden="true" /></span>
                <span><strong>Sign in to CyberDesk</strong><small>Access your staff workspace after activation</small></span>
                <span className="staff-setup-step-number">03</span>
              </div>
            </div>

            <div className="staff-setup-security-note">
              <span className="staff-setup-security-icon"><i className="bi bi-shield-lock-fill" aria-hidden="true" /></span>
              <p><strong>Your account, protected.</strong><br />Never share your password or invitation link with anyone.</p>
            </div>
          </section>

          <section className="staff-setup-form-card" aria-labelledby="staff-setup-title">
            {!success ? (
              <>
                <div className="staff-setup-form-heading">
                  <span className="staff-setup-form-icon"><i className="bi bi-person-lock" aria-hidden="true" /></span>
                  <span className={`staff-setup-token-state ${token ? "is-ready" : "is-missing"}`}>
                    <span /> {token ? "Invitation link detected" : "Invitation link missing"}
                  </span>
                  <h2 id="staff-setup-title">Set up your account</h2>
                  <p>Create a password to finish activating your staff account.</p>
                </div>

                {error && <div className="alert alert-danger staff-setup-alert" role="alert"><i className="bi bi-exclamation-triangle-fill me-2" aria-hidden="true" />{error}</div>}

                {!token && !error && (
                  <div className="staff-setup-inline-warning" role="status">
                    <i className="bi bi-info-circle" aria-hidden="true" />
                    <span>This page needs the token from your invitation email. Open the latest invitation link to continue.</span>
                  </div>
                )}

                <form onSubmit={handleSubmit} noValidate>
                  <PasswordField
                    id="newPassword"
                    label="New password"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    visible={showNewPassword}
                    onToggleVisibility={() => setShowNewPassword((visible) => !visible)}
                    disabled={loading}
                    hint="Use 12–72 characters. A longer, unique password is recommended."
                    invalid={Boolean(newPassword) && !passwordLengthValid}
                  />

                  <div className="staff-setup-password-meter" aria-label={`Password length indicator: ${passwordProgress} of 3`}>
                    {[1, 2, 3].map((step) => <span key={step} className={passwordProgress >= step ? `level-${passwordProgress}` : ""} />)}
                  </div>
                  <div className="staff-setup-meter-caption">
                    <span>Password length</span>
                    <span className={passwordLengthValid ? "is-valid" : ""}>{newPassword.length}/72 characters</span>
                  </div>

                  <PasswordField
                    id="confirmPassword"
                    label="Confirm password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    visible={showConfirmPassword}
                    onToggleVisibility={() => setShowConfirmPassword((visible) => !visible)}
                    disabled={loading}
                    hint={confirmPassword ? (passwordsMatch ? "Passwords match." : "Enter the same password in both fields.") : "Re-enter your new password to confirm."}
                    invalid={Boolean(confirmPassword) && !passwordsMatch}
                  />

                  <button type="submit" className="btn staff-setup-submit w-100" disabled={loading || !token}>
                    {loading ? <><span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />Activating account...</> : <>Verify email &amp; activate <i className="bi bi-arrow-right ms-2" aria-hidden="true" /></>}
                  </button>
                  <p className="staff-setup-form-footnote"><i className="bi bi-lock-fill me-1" aria-hidden="true" /> Your password is submitted over the configured authenticated API connection.</p>
                </form>
              </>
            ) : (
              <div className="staff-setup-success-view" role="status">
                <span className="staff-setup-success-icon"><i className="bi bi-check-lg" aria-hidden="true" /></span>
                <span className="staff-setup-success-kicker">SETUP COMPLETE</span>
                <h2>You're all set.</h2>
                <p>{success}</p>
                <Link to="/login" className="btn staff-setup-submit w-100">Go to login <i className="bi bi-arrow-right ms-2" aria-hidden="true" /></Link>
              </div>
            )}

            <div className="staff-setup-bottom-link">
              Need a fresh invitation? Contact your CyberDesk administrator.<br />
              <Link to="/login"><i className="bi bi-arrow-left me-1" aria-hidden="true" /> Back to login</Link>
            </div>
          </section>
        </div>

        <footer className="staff-setup-footer">
          <span>© {new Date().getFullYear()} CyberDesk</span>
          <span><i className="bi bi-shield-check me-1" aria-hidden="true" /> Staff account activation</span>
        </footer>
      </div>
    </main>
  );
}

export default StaffInvitationSetup;
