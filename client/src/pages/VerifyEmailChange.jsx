import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { verifyEmailChange } from "../services/authService";
import { getErrorMessage } from "../services/api";
import { useAuth } from "../context/AuthContext";
import "../styles/auth-flow.css";

export default function VerifyEmailChange() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const { refreshUser } = useAuth();
  const [status, setStatus] = useState("loading");
  const [message, setMessage] = useState("Verifying your new email address...");

  useEffect(() => {
    let active = true;
    const verify = async () => {
      if (!token) {
        setStatus("error");
        setMessage("The verification token is missing. Open the complete link from your email.");
        return;
      }
      setStatus("loading");
      setMessage("Verifying your new email address...");
      try {
        const response = await verifyEmailChange(token);
        if (!active) return;
        await refreshUser();
        if (!active) return;
        setStatus("success");
        setMessage(response?.message || "Your new email address has been verified successfully.");
      } catch (err) {
        if (!active) return;
        setStatus("error");
        setMessage(getErrorMessage(err));
      }
    };
    verify();
    return () => { active = false; };
  }, [token, refreshUser]);

  const isSuccess = status === "success";
  const isError = status === "error";

  return (
    <main className="cd-auth-page cd-verification-page">
      <section className="cd-verification-card">
        <Link to="/" className="cd-auth-brand cd-verification-brand" aria-label="CyberDesk home"><span className="cd-brand-mark"><i className="bi bi-pc-display-horizontal" /></span><span>Cyber<span>Desk</span></span></Link>
        <div className={`cd-verification-symbol ${status === "loading" ? "is-loading" : isSuccess ? "is-success" : "is-error"}`} aria-hidden="true">
          {status === "loading" ? <span className="spinner-border" /> : <i className={`bi ${isSuccess ? "bi-check-lg" : "bi-x-lg"}`} />}
        </div>
        <span className="cd-auth-eyebrow">EMAIL CHANGE CONFIRMATION</span>
        <h1>{status === "loading" ? "Confirming your new email" : isSuccess ? "Email address updated" : "Verification unsuccessful"}</h1>
        <p className="cd-verification-message" role="status">{message}</p>
        {status === "loading" && <div className="cd-verification-progress"><span /></div>}
        {isSuccess && <div className="cd-verification-next"><i className="bi bi-patch-check" /><span>Your account profile has been refreshed with the latest email information.</span></div>}
        {isError && <div className="cd-verification-next is-warning"><i className="bi bi-info-circle" /><span>Use the latest email-change link. If it has expired, submit a new email-change request from your profile.</span></div>}
        <div className="cd-verification-actions">
          {isSuccess && <Link to="/profile" className="cd-auth-submit">View updated profile <i className="bi bi-arrow-right" /></Link>}
          {isError && <Link to="/profile" className="cd-auth-submit">Return to profile <i className="bi bi-arrow-right" /></Link>}
          {status === "loading" && <Link to="/profile" className="cd-auth-secondary-link">Return to profile</Link>}
        </div>
        <Link to="/" className="cd-auth-bottom-link"><i className="bi bi-house" /> Back to home</Link>
      </section>
    </main>
  );
}
