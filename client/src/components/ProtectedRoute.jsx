
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const ProtectedRoute = ({ allowedRoles = ["customer"] }) => {
  const { user, initializing } = useAuth();
  const location = useLocation();

  // Wait until authentication/session initialization finishes
  if (initializing) {
    return (
      <div className="d-flex justify-content-center align-items-center min-vh-100">
        <div className="text-center">
          <div
            className="spinner-border text-primary"
            role="status"
            aria-label="Loading"
          >
            <span className="visually-hidden">
              Checking session...
            </span>
          </div>

          <p className="mt-3 mb-0 text-secondary">
            Checking your session...
          </p>
        </div>
      </div>
    );
  }

  // User must be authenticated
  if (!user) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location }}
      />
    );
  }

  // Redirect users to their own dashboard
  if (!allowedRoles.includes(user.role)) {
    const roleDestinations = {
      admin: "/admin",
      staff: "/staff/dashboard",
      customer: "/dashboard",
    };

    return (
      <Navigate
        to={roleDestinations[user.role] || "/login"}
        replace
      />
    );
  }

  return <Outlet />;
};

export default ProtectedRoute;
