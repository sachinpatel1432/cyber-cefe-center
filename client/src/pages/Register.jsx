import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { registerUser } from "../services/authService";
import { getErrorMessage } from "../services/api";
import "../styles/register.css";

function safeReturnTo(value) {
  if (typeof value !== "string") return null;
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  if (value === "/login" || value === "/register") return null;
  return value;
}

function Register() {
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTimer = useRef(null);
  const returnTo = safeReturnTo(location.state?.returnTo);
  const serviceIntent = location.state?.serviceIntent;

  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => () => clearTimeout(redirectTimer.current), []);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((previous) => ({ ...previous, [name]: value }));
    setError("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    const fullName = formData.fullName.trim();
    const email = formData.email.trim().toLowerCase();
    const phone = formData.phone.trim();

    if (fullName.length < 2 || fullName.length > 80) {
      setError("Full name must contain 2 to 80 characters.");
      return;
    }
    if (phone && !/^\+?[1-9]\d{7,14}$/.test(phone)) {
      setError("Enter a valid phone number with country code, e.g. +919876543210.");
      return;
    }
    if (formData.password.length < 12 || formData.password.length > 72) {
      setError("Password must contain 12 to 72 characters.");
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const response = await registerUser({
        fullName,
        email,
        phone,
        password: formData.password,
      });
      const message = response.message || "Registration successful. Please check your email for verification.";
      setSuccess(message);
      setFormData({ fullName: "", email: "", phone: "", password: "", confirmPassword: "" });

      redirectTimer.current = window.setTimeout(() => {
        navigate("/login", {
          state: {
            message,
            returnTo,
            serviceIntent: serviceIntent || null,
          },
        });
      }, 1600);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  };

  const passwordLength = formData.password.length;
  const lengthProgress = passwordLength === 0 ? 0 : passwordLength < 12 ? 1 : passwordLength < 16 ? 2 : passwordLength < 24 ? 3 : 4;
  const passwordMismatch = Boolean(formData.confirmPassword) && formData.password !== formData.confirmPassword;

  return (
    <main className="cyber-register-page">
      <div className="cyber-register-glow cyber-register-glow-one" aria-hidden="true" />
      <div className="cyber-register-glow cyber-register-glow-two" aria-hidden="true" />

      <div className="cyber-register-shell">
        <aside className="cyber-register-aside">
          <Link to="/" className="cyber-register-brand" aria-label="CyberDesk home">
            <span className="cyber-register-brand-mark"><i className="bi bi-pc-display-horizontal" aria-hidden="true" /></span>
            <span>Cyber<span>Desk</span></span>
          </Link>

          <div className="cyber-register-aside-content">
            <span className="cyber-register-eyebrow"><i className="bi bi-stars" aria-hidden="true" /> YOUR DIGITAL WORKSPACE</span>
            <h1>Everyday digital tasks, <span>made simpler.</span></h1>
            <p>Create your account to manage service requests, submit documents and keep track of your progress in one place.</p>

            {serviceIntent?.name && (
              <div className="cyber-register-intent">
                <span className="cyber-register-intent-icon"><i className="bi bi-arrow-right-circle" aria-hidden="true" /></span>
                <div><small>YOUR SELECTED SERVICE</small><strong>{serviceIntent.name}</strong><span>We’ll keep this selection for your next step.</span></div>
              </div>
            )}

            <div className="cyber-register-benefits">
              <div><span><i className="bi bi-check2" aria-hidden="true" /></span><div><strong>One place to manage requests</strong><small>Follow each request from submission to delivery.</small></div></div>
              <div><span><i className="bi bi-shield-check" aria-hidden="true" /></span><div><strong>Account-first access</strong><small>Your account keeps your activity connected.</small></div></div>
              <div><span><i className="bi bi-folder-check" aria-hidden="true" /></span><div><strong>Document-ready workflow</strong><small>Keep required files and updates organized.</small></div></div>
            </div>
          </div>

          <div className="cyber-register-aside-footer"><i className="bi bi-lock-fill" aria-hidden="true" /> Secure account setup <span>•</span> CyberDesk</div>
        </aside>

        <section className="cyber-register-form-panel" aria-labelledby="register-title">
          <div className="cyber-register-mobile-brand">
            <Link to="/" className="cyber-register-brand">
              <span className="cyber-register-brand-mark"><i className="bi bi-pc-display-horizontal" aria-hidden="true" /></span>
              <span>Cyber<span>Desk</span></span>
            </Link>
          </div>

          <div className="cyber-register-form-heading">
            <span className="cyber-register-step">GET STARTED <span>01 / 01</span></span>
            <h2 id="register-title">Create your account</h2>
            <p>Enter your details below to get started with CyberDesk.</p>
          </div>

          {error && <div className="cyber-register-alert is-error" role="alert"><i className="bi bi-exclamation-circle-fill" aria-hidden="true" /><span>{error}</span><button type="button" onClick={() => setError("")} aria-label="Dismiss error">×</button></div>}
          {success && <div className="cyber-register-alert is-success" role="status"><i className="bi bi-check-circle-fill" aria-hidden="true" /><span>{success} Redirecting you to sign in…</span></div>}

          <form className="cyber-register-form" onSubmit={handleSubmit}>
            <div className="cyber-register-field">
              <label htmlFor="register-fullName">Full name <span>*</span></label>
              <div className="cyber-register-input-wrap"><i className="bi bi-person" aria-hidden="true" /><input id="register-fullName" name="fullName" type="text" placeholder="Enter your full name" autoComplete="name" value={formData.fullName} onChange={handleChange} minLength={2} maxLength={80} required disabled={loading || Boolean(success)} /></div>
            </div>

            <div className="cyber-register-field">
              <label htmlFor="register-email">Email address <span>*</span></label>
              <div className="cyber-register-input-wrap"><i className="bi bi-envelope" aria-hidden="true" /><input id="register-email" name="email" type="email" placeholder="you@example.com" autoComplete="email" value={formData.email} onChange={handleChange} maxLength={254} required disabled={loading || Boolean(success)} /></div>
              <small>Use an email address you can access to receive account updates.</small>
            </div>

            <div className="cyber-register-field">
              <label htmlFor="register-phone">Phone number <small>Optional</small></label>
              <div className="cyber-register-input-wrap"><i className="bi bi-phone" aria-hidden="true" /><input id="register-phone" name="phone" type="tel" placeholder="+919876543210" autoComplete="tel" value={formData.phone} onChange={handleChange} maxLength={16} disabled={loading || Boolean(success)} /></div>
              <small>Include your country code, for example +91.</small>
            </div>

            <div className="cyber-register-field">
              <label htmlFor="register-password">Password <span>*</span></label>
              <div className="cyber-register-input-wrap"><i className="bi bi-lock" aria-hidden="true" /><input id="register-password" name="password" type={showPassword ? "text" : "password"} placeholder="Create a password" autoComplete="new-password" value={formData.password} onChange={handleChange} minLength={12} maxLength={72} required disabled={loading || Boolean(success)} /><button type="button" className="cyber-register-toggle" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"} disabled={loading || Boolean(success)}><i className={`bi ${showPassword ? "bi-eye-slash" : "bi-eye"}`} aria-hidden="true" /></button></div>
              <div className="cyber-register-password-meter" aria-label={`Password length indicator: ${lengthProgress} of 4`}><div className={lengthProgress >= 1 ? "is-filled" : ""} /><div className={lengthProgress >= 2 ? "is-filled" : ""} /><div className={lengthProgress >= 3 ? "is-filled" : ""} /><div className={lengthProgress >= 4 ? "is-filled" : ""} /></div>
              <small>Use 12–72 characters. Longer, unique passwords are recommended.</small>
            </div>

            <div className="cyber-register-field">
              <label htmlFor="register-confirmPassword">Confirm password <span>*</span></label>
              <div className={`cyber-register-input-wrap ${passwordMismatch ? "has-error" : formData.confirmPassword && !passwordMismatch ? "has-success" : ""}`}><i className="bi bi-shield-lock" aria-hidden="true" /><input id="register-confirmPassword" name="confirmPassword" type={showConfirmPassword ? "text" : "password"} placeholder="Re-enter your password" autoComplete="new-password" value={formData.confirmPassword} onChange={handleChange} minLength={12} maxLength={72} required disabled={loading || Boolean(success)} /><button type="button" className="cyber-register-toggle" onClick={() => setShowConfirmPassword((value) => !value)} aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"} disabled={loading || Boolean(success)}><i className={`bi ${showConfirmPassword ? "bi-eye-slash" : "bi-eye"}`} aria-hidden="true" /></button></div>
              {passwordMismatch && <small className="cyber-register-field-error">Passwords do not match yet.</small>}
              {formData.confirmPassword && !passwordMismatch && <small className="cyber-register-field-success"><i className="bi bi-check-circle-fill" aria-hidden="true" /> Passwords match.</small>}
            </div>

            <button className="cyber-register-submit" type="submit" disabled={loading || Boolean(success)}>
              {loading ? <><span className="spinner-border spinner-border-sm" aria-hidden="true" /> Creating account…</> : success ? <>Account created <i className="bi bi-check-circle-fill" aria-hidden="true" /></> : <>Create account <i className="bi bi-arrow-right" aria-hidden="true" /></>}
            </button>
            <p className="cyber-register-terms"><i className="bi bi-info-circle" aria-hidden="true" /> You may need to verify your email before signing in.</p>
          </form>

          <div className="cyber-register-login-prompt">Already have an account? <Link to="/login" state={{ returnTo, serviceIntent }}>Sign in</Link></div>
          <Link to="/" className="cyber-register-home-link"><i className="bi bi-arrow-left" aria-hidden="true" /> Back to home</Link>
        </section>
      </div>
    </main>
  );
}

export default Register;
