
import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { resetPassword } from "../services/authService";
import { getErrorMessage } from "../services/api";

function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const token = searchParams.get("token");

  const [formData, setFormData] = useState({
    password: "",
    confirmPassword: "",
  });

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (event) => {
    const { name, value } = event.target;

    setFormData((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (!token) {
      setError(
        "Reset token is missing. Please open the latest reset link from your email."
      );
      return;
    }

    if (
      formData.password.length < 12 ||
      formData.password.length > 72
    ) {
      setError("Password must contain 12 to 72 characters.");
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const response = await resetPassword({
        token,
        newPassword: formData.password,
        confirmPassword: formData.confirmPassword,
      });

      setSuccess(
        response.message ||
          "Password reset successfully. Please log in again."
      );

      setFormData({
        password: "",
        confirmPassword: "",
      });

      setTimeout(() => {
        navigate("/login", { replace: true });
      }, 1800);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container py-5">
      <div className="row justify-content-center align-items-center min-vh-75">
        <div className="col-12 col-sm-10 col-md-7 col-lg-5">
          <div className="card border-0 shadow-lg rounded-4">
            <div className="card-body p-4 p-md-5">
              {/* Branding */}
              <div className="text-center mb-4">
                <Link
                  to="/"
                  className="text-decoration-none text-dark"
                >
                  <i className="bi bi-pc-display-horizontal text-primary fs-1"></i>

                  <h2 className="fw-bold mt-2">
                    Cyber<span className="text-primary">Desk</span>
                  </h2>
                </Link>

                <div className="my-4">
                  <i className="bi bi-key text-primary display-3"></i>
                </div>

                <h4 className="fw-bold">Reset Your Password</h4>

                <p className="text-secondary">
                  Create a new password for your account.
                </p>
              </div>

              {/* Missing Token */}
              {!token && (
                <div className="alert alert-warning" role="alert">
                  Reset token is missing. Please open the complete
                  password reset link from your email.
                </div>
              )}

              {/* Error Message */}
              {error && (
                <div className="alert alert-danger" role="alert">
                  <i className="bi bi-exclamation-circle me-2"></i>
                  {error}
                </div>
              )}

              {/* Success Message */}
              {success && (
                <div className="alert alert-success" role="status">
                  <i className="bi bi-check-circle me-2"></i>
                  {success}
                </div>
              )}

              {/* Reset Password Form */}
              <form onSubmit={handleSubmit}>
                <div className="mb-3">
                  <label htmlFor="password" className="form-label">
                    New Password
                  </label>

                  <div className="input-group input-group-lg">
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      className="form-control"
                      placeholder="Enter new password"
                      autoComplete="new-password"
                      minLength={12}
                      maxLength={72}
                      value={formData.password}
                      onChange={handleChange}
                      required
                    />

                    <button
                      type="button"
                      className="btn btn-outline-secondary"
                      onClick={() =>
                        setShowPassword((previous) => !previous)
                      }
                      aria-label={
                        showPassword ? "Hide password" : "Show password"
                      }
                    >
                      <i
                        className={`bi ${
                          showPassword ? "bi-eye-slash" : "bi-eye"
                        }`}
                      ></i>
                    </button>
                  </div>

                  <small className="text-secondary">
                    Use 12 to 72 characters.
                  </small>
                </div>

                <div className="mb-4">
                  <label
                    htmlFor="confirmPassword"
                    className="form-label"
                  >
                    Confirm New Password
                  </label>

                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showPassword ? "text" : "password"}
                    className="form-control form-control-lg"
                    placeholder="Re-enter new password"
                    autoComplete="new-password"
                    minLength={12}
                    maxLength={72}
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="alert alert-light border small">
                  <i className="bi bi-shield-check text-primary me-2"></i>
                  Choose a password that is difficult to guess and
                  never share it with anyone.
                </div>

                <button
                  type="submit"
                  className="btn btn-primary btn-lg w-100"
                  disabled={loading || !token || Boolean(success)}
                >
                  {loading ? (
                    <>
                      <span
                        className="spinner-border spinner-border-sm me-2"
                        aria-hidden="true"
                      ></span>
                      Updating Password...
                    </>
                  ) : (
                    <>
                      Set New Password
                      <i className="bi bi-arrow-right ms-2"></i>
                    </>
                  )}
                </button>
              </form>

              <div className="text-center mt-4">
                <Link
                  to="/forgot-password"
                  className="text-decoration-none small"
                >
                  Request a new reset link
                </Link>
              </div>

              <div className="text-center mt-3">
                <Link
                  to="/login"
                  className="text-decoration-none fw-semibold"
                >
                  <i className="bi bi-arrow-left me-1"></i>
                  Back to Login
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ResetPassword;
