import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "./Footer.css";

const DASHBOARD_PATHS = {
  admin: "/admin",
  staff: "/staff/dashboard",
  customer: "/customer/dashboard",
};

function Footer() {
  const { user } = useAuth();
  const year = new Date().getFullYear();

  const dashboardPath =
    DASHBOARD_PATHS[user?.role] || "/profile";

  const handleBackToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  return (
    <footer className="cyber-footer">
      {/* Decorative top line */}
      <div className="cyber-footer-top-line" />

      <div className="cyber-footer-container">
        {/* Main footer content */}
        <div className="cyber-footer-main">
          {/* Brand and description */}
          <div className="cyber-footer-brand-column">
            <Link
              to="/"
              className="cyber-footer-brand"
              aria-label="CyberDesk home"
            >
              <span className="cyber-footer-brand-icon">
                <i
                  className="bi bi-pc-display-horizontal"
                  aria-hidden="true"
                />
              </span>

              <span className="cyber-footer-brand-name">
                Cyber<span>Desk</span>
              </span>
            </Link>

            <p className="cyber-footer-description">
              Your digital service workspace. Explore services,
              manage requests, share documents and keep track of
              your next steps in one convenient place.
            </p>

            <div className="cyber-footer-brand-badge">
              <span className="cyber-footer-brand-badge-dot" />
              Your digital service partner
            </div>

            <Link
              to={user ? dashboardPath : "/register"}
              className="cyber-footer-cta"
            >
              {user ? "Open your workspace" : "Get started"}

              <i
                className="bi bi-arrow-up-right"
                aria-hidden="true"
              />
            </Link>
          </div>

          {/* Explore links */}
          <div className="cyber-footer-column">
            <h2 className="cyber-footer-heading">
              Explore
            </h2>

            <ul className="cyber-footer-links">
              <li>
                <Link to="/">
                  <i className="bi bi-house-door" />
                  Home
                </Link>
              </li>

              <li>
                <Link to="/services">
                  <i className="bi bi-grid" />
                  Services
                </Link>
              </li>

              <li>
                <Link to="/#about">
                  <i className="bi bi-info-circle" />
                  About CyberDesk
                </Link>
              </li>

              <li>
                <Link to="/#how-it-works">
                  <i className="bi bi-diagram-3" />
                  How it works
                </Link>
              </li>
            </ul>
          </div>

          {/* Account links */}
          <div className="cyber-footer-column">
            <h2 className="cyber-footer-heading">
              Your Workspace
            </h2>

            <ul className="cyber-footer-links">
              <li>
                <Link to={user ? dashboardPath : "/login"}>
                  <i className="bi bi-speedometer2" />
                  {user ? "My Dashboard" : "Sign In"}
                </Link>
              </li>

              {user?.role === "customer" && (
                <li>
                  <Link to="/my-requests">
                    <i className="bi bi-clipboard-check" />
                    My Requests
                  </Link>
                </li>
              )}

              {user && (
                <li>
                  <Link to="/profile">
                    <i className="bi bi-person-circle" />
                    My Profile
                  </Link>
                </li>
              )}

              {!user && (
                <li>
                  <Link to="/register">
                    <i className="bi bi-person-plus" />
                    Create Account
                  </Link>
                </li>
              )}

              <li>
                <Link to="/#faq">
                  <i className="bi bi-question-circle" />
                  Frequently Asked Questions
                </Link>
              </li>
            </ul>
          </div>

          {/* Help section */}
          <div className="cyber-footer-column cyber-footer-help-column">
            <h2 className="cyber-footer-heading">
              Need a Hand?
            </h2>

            <p className="cyber-footer-help-text">
              Find a service, review your request or sign in to
              access the options available for your account.
            </p>

            <Link
              to="/services"
              className="cyber-footer-help-link"
            >
              <span className="cyber-footer-help-icon">
                <i className="bi bi-headset" />
              </span>

              <span>
                <strong>Explore available services</strong>
                <small>
                  Find the right service for your task
                </small>
              </span>

              <i className="bi bi-arrow-up-right ms-auto" />
            </Link>

            <div className="cyber-footer-security-note">
              <i className="bi bi-shield-check" />

              <span>
                Sign in to access your personal workspace.
              </span>
            </div>
          </div>
        </div>

        {/* Footer divider */}
        <div className="cyber-footer-divider" />

        {/* Bottom footer bar */}
        <div className="cyber-footer-bottom">
          <div className="cyber-footer-copyright">
            <span className="cyber-footer-copyright-mark">
              ©
            </span>

            <span>
              {year} CyberDesk. All rights reserved.
            </span>
          </div>

          <p className="cyber-footer-bottom-tagline">
            <i className="bi bi-stars" />

            Making digital services easier to manage.
          </p>

          <button
            type="button"
            className="cyber-footer-top-button"
            onClick={handleBackToTop}
          >
            Back to top

            <span>
              <i className="bi bi-arrow-up" />
            </span>
          </button>
        </div>
      </div>
    </footer>
  );
}

export default Footer;