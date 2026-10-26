import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext";
import { getErrorMessage } from "../services/api";
import "../styles/login.css";

const ROLE_HOME = {
  customer: "/customer/dashboard",
  staff: "/staff/dashboard",
  admin: "/admin",
};

function safeReturnTo(value) {
  if (typeof value !== "string") return null;
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  if (value === "/login" || value.startsWith("/login?") || value === "/register" || value.startsWith("/register?")) return null;
  return value;
}

function getDestination(role, returnTo) {
  // Only customers may resume customer booking destinations. Staff/admin
  // always go to their own role dashboard, even if a crafted state is passed.
  if (role === "customer" && returnTo) return returnTo;
  return ROLE_HOME[role] || null;
}

export default function Login() {
  const { user, initializing, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const returnTo = safeReturnTo(location.state?.returnTo);
  const serviceIntent = location.state?.serviceIntent && typeof location.state.serviceIntent === "object"
    ? location.state.serviceIntent
    : null;
  const registrationMessage = typeof location.state?.message === "string"
    ? location.state.message
    : "";

  const [formData, setFormData] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(registrationMessage);

  // Keep the intended customer booking destination when a session already exists.
  useEffect(() => {
    if (initializing || !user?.role) return;
    const destination = getDestination(user.role, returnTo);
    if (destination) navigate(destination, { replace: true });
  }, [initializing, user, navigate, returnTo]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((previous) => ({ ...previous, [name]: value }));
    setError("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting) return;

    setError("");
    setNotice("");

    const email = formData.email.trim().toLowerCase();
    const password = formData.password;
    if (!email || !password) {
      setError("Please enter your email and password.");
      return;
    }
    if (password.length > 72) {
      setError("Password must not exceed 72 characters.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await login({ email, password });
      const loggedInUser = response?.user ?? response?.data?.user;
      const destination = getDestination(loggedInUser?.role, returnTo);

      if (!destination) {
        setError("Login succeeded, but a valid account role was not returned. Please refresh and try again.");
        return;
      }

      navigate(destination, { replace: true });
    } catch (requestError) {
      setError(getErrorMessage(requestError) || "Login failed. Please check your credentials and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="cyber-login-page">
      <div className="cyber-login-glow cyber-login-glow-one" aria-hidden="true" />
      <div className="cyber-login-glow cyber-login-glow-two" aria-hidden="true" />

      <div className="cyber-login-shell">
        <aside className="cyber-login-aside">
          <Link to="/" className="cyber-login-brand" aria-label="CyberDesk home">
            <span className="cyber-login-brand-mark"><i className="bi bi-pc-display-horizontal" aria-hidden="true" /></span>
            <span>Cyber<span>Desk</span></span>
          </Link>

          <div className="cyber-login-aside-content">
            <span className="cyber-login-eyebrow"><i className="bi bi-stars" aria-hidden="true" /> YOUR DIGITAL WORKSPACE</span>
            <h1>Your work, services and updates — <span>all in one place.</span></h1>
            <p>Sign in securely to track requests, submit documents and stay connected with the CyberDesk team.</p>

            {serviceIntent?.name && (
              <div className="cyber-login-intent">
                <span className="cyber-login-intent-icon"><i className="bi bi-arrow-right-circle" aria-hidden="true" /></span>
                <div>
                  <small>YOUR SELECTED SERVICE</small>
                  <strong>{String(serviceIntent.name).slice(0, 100)}</strong>
                  <span>After sign-in, you’ll return to continue this booking.</span>
                </div>
              </div>
            )}

            <div className="cyber-login-benefits">
              <div><span><i className="bi bi-check2" aria-hidden="true" /></span><div><strong>Track every request</strong><small>See status updates and next steps in one place.</small></div></div>
              <div><span><i className="bi bi-shield-check" aria-hidden="true" /></span><div><strong>Secure account access</strong><small>Your account and role determine where you go next.</small></div></div>
              <div><span><i className="bi bi-folder-check" aria-hidden="true" /></span><div><strong>Keep documents organized</strong><small>Upload files and review feedback through your portal.</small></div></div>
            </div>
          </div>

          <div className="cyber-login-aside-footer"><i className="bi bi-lock-fill" aria-hidden="true" /> Secure access <span>•</span> CyberDesk</div>
        </aside>

        <section className="cyber-login-form-panel" aria-labelledby="login-title">
          <div className="cyber-login-mobile-brand">
            <Link to="/" className="cyber-login-brand" aria-label="CyberDesk home">
              <span className="cyber-login-brand-mark"><i className="bi bi-pc-display-horizontal" aria-hidden="true" /></span>
              <span>Cyber<span>Desk</span></span>
            </Link>
          </div>

          <div className="cyber-login-form-heading">
            <span className="cyber-login-step">WELCOME BACK <span>SECURE SIGN IN</span></span>
            <h2 id="login-title">Sign in to CyberDesk</h2>
            <p>Use the email address and password linked to your account.</p>
          </div>

          {notice && <div className="cyber-login-alert is-notice" role="status"><i className="bi bi-info-circle-fill" aria-hidden="true" /><span>{notice}</span><button type="button" onClick={() => setNotice("")} aria-label="Dismiss message">×</button></div>}
          {error && <div className="cyber-login-alert is-error" role="alert"><i className="bi bi-exclamation-circle-fill" aria-hidden="true" /><span>{error}</span><button type="button" onClick={() => setError("")} aria-label="Dismiss error">×</button></div>}

          <form className="cyber-login-form" onSubmit={handleSubmit}>
            <div className="cyber-login-field">
              <label htmlFor="login-email">Email address <span>*</span></label>
              <div className="cyber-login-input-wrap"><i className="bi bi-envelope" aria-hidden="true" /><input id="login-email" name="email" type="email" placeholder="you@example.com" autoComplete="email" value={formData.email} onChange={handleChange} maxLength={254} required disabled={submitting || initializing} /></div>
            </div>

            <div className="cyber-login-field">
              <div className="cyber-login-label-row"><label htmlFor="login-password">Password <span>*</span></label><Link to="/forgot-password" className="cyber-login-text-link">Forgot password?</Link></div>
              <div className="cyber-login-input-wrap"><i className="bi bi-lock" aria-hidden="true" /><input id="login-password" name="password" type={showPassword ? "text" : "password"} placeholder="Enter your password" autoComplete="current-password" value={formData.password} onChange={handleChange} maxLength={72} required disabled={submitting || initializing} /><button type="button" className="cyber-login-toggle" onClick={() => setShowPassword((previous) => !previous)} aria-label={showPassword ? "Hide password" : "Show password"} disabled={submitting}><i className={`bi ${showPassword ? "bi-eye-slash" : "bi-eye"}`} aria-hidden="true" /></button></div>
            </div>

            <button className="cyber-login-submit" type="submit" disabled={submitting || initializing}>
              {submitting ? <><span className="spinner-border spinner-border-sm" aria-hidden="true" /> Signing in…</> : <>Sign in securely <i className="bi bi-arrow-right" aria-hidden="true" /></>}
            </button>
            <p className="cyber-login-security-note"><i className="bi bi-shield-lock" aria-hidden="true" /> You’ll be redirected to the correct workspace for your account.</p>
          </form>

          <div className="cyber-login-register-prompt">New to CyberDesk? <Link to="/register" state={{ returnTo, serviceIntent }}>Create an account</Link></div>
          <Link to="/" className="cyber-login-home-link"><i className="bi bi-arrow-left" aria-hidden="true" /> Back to home</Link>
        </section>
      </div>
    </main>
  );
}
