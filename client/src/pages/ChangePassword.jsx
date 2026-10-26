import { useState } from "react";
import { Link } from "react-router-dom";
import { changePassword } from "../services/authService";
import { getErrorMessage } from "../services/api";
import "../styles/auth-flow.css";

const INITIAL_FORM = { currentPassword: "", newPassword: "", confirmPassword: "" };

export default function ChangePassword() {
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [showPasswords, setShowPasswords] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

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

    if (!formData.currentPassword) {
      setError("Please enter your current password.");
      return;
    }
    if (formData.newPassword.length < 12 || formData.newPassword.length > 72) {
      setError("New password must contain 12 to 72 characters.");
      return;
    }
    if (formData.newPassword !== formData.confirmPassword) {
      setError("New password and confirmation do not match.");
      return;
    }
    if (formData.currentPassword === formData.newPassword) {
      setError("Your new password must be different from the current password.");
      return;
    }

    setLoading(true);
    try {
      const response = await changePassword({
        currentPassword: formData.currentPassword,
        newPassword: formData.newPassword,
        confirmPassword: formData.confirmPassword,
      });
      setSuccess(response?.message || "Password changed successfully.");
      setFormData(INITIAL_FORM);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const passwordFields = [
    { name: "currentPassword", label: "Current password", placeholder: "Enter your current password", autoComplete: "current-password", hint: "Used to verify your identity." },
    { name: "newPassword", label: "New password", placeholder: "Create a new password", autoComplete: "new-password", hint: "Use 12–72 characters." },
    { name: "confirmPassword", label: "Confirm new password", placeholder: "Enter the new password again", autoComplete: "new-password", hint: "Must match your new password." },
  ];

  return (
    <main className="cd-auth-page">
      <div className="cd-auth-layout cd-auth-layout-narrow">
        <aside className="cd-auth-aside">
          <Link to="/" className="cd-auth-brand" aria-label="CyberDesk home"><span className="cd-brand-mark"><i className="bi bi-pc-display-horizontal" /></span><span>Cyber<span>Desk</span></span></Link>
          <div className="cd-auth-aside-copy">
            <span className="cd-auth-eyebrow">SECURITY CENTER</span>
            <h2>A stronger password starts here.</h2>
            <p>Protect your profile, service requests and account information with a password only you know.</p>
            <div className="cd-auth-benefit"><i className="bi bi-key" /><span>Choose a password you do not use elsewhere.</span></div>
            <div className="cd-auth-benefit"><i className="bi bi-eye-slash" /><span>Never share your password with anyone.</span></div>
          </div>
          <span className="cd-auth-aside-footer">Secure account management · CyberDesk</span>
        </aside>

        <section className="cd-auth-content">
          <div className="cd-auth-mobile-brand"><span className="cd-brand-mark"><i className="bi bi-pc-display-horizontal" /></span><span>Cyber<span>Desk</span></span></div>
          <Link to="/profile" className="cd-auth-back"><i className="bi bi-arrow-left" /> Back to profile</Link>
          <div className="cd-auth-heading">
            <div className="cd-auth-icon"><i className="bi bi-shield-lock" /></div>
            <span className="cd-auth-eyebrow">PROFILE SETTINGS</span>
            <h1>Change password</h1>
            <p>Confirm your current password, then choose a new one.</p>
          </div>
          {error && <div className="cd-auth-alert cd-auth-alert-error" role="alert"><i className="bi bi-exclamation-circle-fill" /><span>{error}</span></div>}
          {success && <div className="cd-auth-alert cd-auth-alert-success" role="status"><i className="bi bi-check-circle-fill" /><span>{success}</span></div>}

          <form onSubmit={handleSubmit} className="cd-auth-form">
            {passwordFields.map((field, index) => (
              <div className="cd-form-field" key={field.name}>
                <label htmlFor={field.name}>{field.label}</label>
                <div className="cd-input-wrap cd-input-with-action"><i className={`bi ${index === 0 ? "bi-lock" : "bi-key"}`} /><input id={field.name} name={field.name} type={showPasswords ? "text" : "password"} className="cd-input" placeholder={field.placeholder} autoComplete={field.autoComplete} value={formData[field.name]} onChange={handleChange} minLength={index === 0 ? undefined : 12} maxLength={index === 0 ? undefined : 72} required disabled={loading} /><button type="button" className="cd-password-toggle" onClick={() => setShowPasswords((value) => !value)} aria-label={showPasswords ? "Hide passwords" : "Show passwords"} disabled={loading}><i className={`bi ${showPasswords ? "bi-eye-slash" : "bi-eye"}`} /></button></div>
                <small>{field.hint}</small>
              </div>
            ))}
            <div className="cd-password-strength" aria-live="polite">
              <div className="cd-password-strength-header"><span>Password length</span><strong>{formData.newPassword.length}/72</strong></div>
              <div className="cd-password-meter"><span className={formData.newPassword.length >= 12 && formData.newPassword.length <= 72 ? "is-valid" : ""} style={{ width: `${Math.min((formData.newPassword.length / 12) * 100, 100)}%` }} /></div>
              <small>{formData.newPassword.length >= 12 ? "Minimum length reached." : "Enter at least 12 characters."}</small>
            </div>
            <div className="cd-auth-note"><i className="bi bi-shield-check" /><p>Never reuse or share your password. Password rules are also enforced by the server.</p></div>
            <button className="cd-auth-submit" type="submit" disabled={loading}>{loading ? <><span className="spinner-border spinner-border-sm" aria-hidden="true" /> Updating password...</> : <>Update password <i className="bi bi-arrow-right" /></>}</button>
          </form>
          <p className="cd-auth-bottom">Forgot your current password? <Link to="/forgot-password">Reset it here</Link></p>
        </section>
      </div>
    </main>
  );
}
