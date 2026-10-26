import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { verifyEmail } from "../services/authService";
import { getErrorMessage } from "../services/api";
import "../styles/auth-flow.css";

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const [status, setStatus] = useState("loading");
  const [message, setMessage] = useState("Verifying your email address...");

  useEffect(() => {
    let active = true;
    const verify = async () => {
      if (!token) {
        setStatus("error");
        setMessage("The verification token is missing. Open the complete link from your email.");
        return;
      }
      setStatus("loading");
      setMessage("Verifying your email address...");
      try {
        const response = await verifyEmail(token);
        if (!active) return;
        setStatus("success");
        setMessage(response?.message || "Your email has been verified successfully.");
      } catch (err) {
        if (!active) return;
        setStatus("error");
        setMessage(getErrorMessage(err));
      }
    };
    verify();
    return () => { active = false; };
  }, [token]);

  const isSuccess = status === "success";
  const isError = status === "error";

  return (
    <main className="cd-auth-page cd-verification-page">
      <section className="cd-verification-card">
        <Link to="/" className="cd-auth-brand cd-verification-brand" aria-label="CyberDesk home"><span className="cd-brand-mark"><i className="bi bi-pc-display-horizontal" /></span><span>Cyber<span>Desk</span></span></Link>
        <div className={`cd-verification-symbol ${status === "loading" ? "is-loading" : isSuccess ? "is-success" : "is-error"}`} aria-hidden="true">
          {status === "loading" ? <span className="spinner-border" /> : <i className={`bi ${isSuccess ? "bi-check-lg" : "bi-x-lg"}`} />}
        </div>
        <span className="cd-auth-eyebrow">EMAIL VERIFICATION</span>
        <h1>{status === "loading" ? "Confirming your email" : isSuccess ? "Email verified" : "Verification unsuccessful"}</h1>
        <p className="cd-verification-message" role="status">{message}</p>
        {status === "loading" && <div className="cd-verification-progress"><span /></div>}
        {isSuccess && <div className="cd-verification-next"><i className="bi bi-shield-check" /><span>Your email verification status has been updated.</span></div>}
        {isError && <div className="cd-verification-next is-warning"><i className="bi bi-info-circle" /><span>Check that you used the latest verification email and that its link has not expired.</span></div>}
        <div className="cd-verification-actions">
          {isSuccess && <Link to="/login" className="cd-auth-submit">Continue to login <i className="bi bi-arrow-right" /></Link>}
          {isError && <Link to="/register" className="cd-auth-submit">Back to registration <i className="bi bi-arrow-right" /></Link>}
          {status === "loading" && <Link to="/" className="cd-auth-secondary-link">Cancel and return home</Link>}
        </div>
        <Link to="/" className="cd-auth-bottom-link"><i className="bi bi-arrow-left" /> Back to home</Link>
      </section>
    </main>
  );
}
