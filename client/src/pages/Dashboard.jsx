
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const quickActions = [
  {
    title: "My Profile",
    description: "View and update your personal information.",
    icon: "bi-person-circle",
    color: "primary",
    link: "/profile",
  },
  {
    title: "Online Forms",
    description: "Get assistance with online applications.",
    icon: "bi-file-earmark-text",
    color: "success",
    link: "/services",
  },
  {
    title: "Print & Documents",
    description: "Explore printing and document services.",
    icon: "bi-printer",
    color: "warning",
    link: "/services",
  },
  {
    title: "Account Security",
    description: "Manage your password and account security.",
    icon: "bi-shield-lock",
    color: "danger",
    link: "/change-password",
  },
];

function Dashboard() {
  const { user, initializing } = useAuth();

  // Wait until the authentication state is loaded.
  if (initializing) {
    return (
      <div className="container py-5 text-center">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
        <p className="text-secondary mt-3">
          Loading your dashboard...
        </p>
      </div>
    );
  }

  // Handle unauthenticated users.
  if (!user) {
    return (
      <div className="container py-5">
        <div className="alert alert-warning">
          Please sign in to access your dashboard.
          <Link to="/login" className="alert-link ms-2">
            Login
          </Link>
        </div>
      </div>
    );
  }

  // Redirect administrators to their dedicated dashboard.
  if (user.role === "admin") {
    return <Navigate to="/admin" replace />;
  }

  const displayName = user.fullName || user.name || "User";
  const role = user.role || "customer";

  return (
    <div className="container py-4 py-md-5">
      {/* Welcome Header */}
      <div className="rounded-4 bg-dark text-white p-4 p-md-5 mb-4">
        <div className="row align-items-center g-4">
          <div className="col-md-8">
            <span className="badge bg-primary mb-3">
              <i className="bi bi-grid me-1"></i>
              CyberDesk Dashboard
            </span>

            <h1 className="fw-bold mb-2">
              Welcome, {displayName}!
            </h1>

            <p className="text-white-50 mb-3">
              Manage your account and explore available digital services.
            </p>

            <span className="badge bg-secondary text-capitalize">
              {role.replace(/[_-]/g, " ")}
            </span>
          </div>

          <div className="col-md-4 text-md-end">
            <div
              className="d-inline-flex align-items-center justify-content-center rounded-circle bg-primary bg-opacity-25 overflow-hidden"
              style={{ width: 100, height: 100 }}
            >
              {user.profileImage?.url || user.profileImage ? (
                <img
                  src={
                    typeof user.profileImage === "string"
                      ? user.profileImage
                      : user.profileImage.url
                  }
                  alt="Profile"
                  className="rounded-circle w-100 h-100 object-fit-cover"
                />
              ) : (
                <i className="bi bi-person-fill fs-1 text-info"></i>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Account Overview */}
      <div className="row g-3 mb-5">
        <div className="col-sm-6 col-lg-4">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body p-4">
              <div className="d-flex align-items-center gap-3">
                <div className="rounded-3 bg-primary bg-opacity-10 text-primary p-3">
                  <i className="bi bi-person-check fs-4"></i>
                </div>

                <div>
                  <p className="text-secondary mb-1">Account</p>
                  <h5 className="fw-bold mb-0">Active Session</h5>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="col-sm-6 col-lg-4">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body p-4">
              <div className="d-flex align-items-center gap-3">
                <div className="rounded-3 bg-success bg-opacity-10 text-success p-3">
                  <i className="bi bi-envelope-check fs-4"></i>
                </div>

                <div>
                  <p className="text-secondary mb-1">Email</p>
                  <h5 className="fw-bold mb-0">
                    {user.emailVerified ? "Verified" : "Not Verified"}
                  </h5>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="col-sm-6 col-lg-4">
          <Link
            to="/services"
            className="card border-0 shadow-sm h-100 text-decoration-none text-dark"
          >
            <div className="card-body p-4">
              <div className="d-flex align-items-center gap-3">
                <div className="rounded-3 bg-warning bg-opacity-10 text-warning p-3">
                  <i className="bi bi-lightning-charge fs-4"></i>
                </div>

                <div>
                  <p className="text-secondary mb-1">Services</p>
                  <h5 className="fw-bold mb-0">Explore Services</h5>
                </div>
              </div>
            </div>
          </Link>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-4">
        <div>
          <h2 className="fw-bold mb-1">Quick Actions</h2>
          <p className="text-secondary mb-0">
            Choose what you want to do next.
          </p>
        </div>

        <Link to="/" className="btn btn-outline-secondary">
          <i className="bi bi-house me-2"></i>
          Home
        </Link>
      </div>

      <div className="row g-4">
        {quickActions.map((action) => (
          <div className="col-sm-6 col-lg-3" key={action.title}>
            <div className="card border-0 shadow-sm h-100">
              <div className="card-body p-4 d-flex flex-column">
                <div
                  className={`d-inline-flex align-items-center justify-content-center rounded-3 bg-${action.color} bg-opacity-10 text-${action.color} mb-3`}
                  style={{ width: 55, height: 55 }}
                >
                  <i className={`bi ${action.icon} fs-4`}></i>
                </div>

                <h5 className="fw-bold">{action.title}</h5>

                <p className="text-secondary flex-grow-1">
                  {action.description}
                </p>

                <Link
                  to={action.link}
                  className="btn btn-outline-primary mt-2"
                >
                  Open
                  <i className="bi bi-arrow-right ms-2"></i>
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Help Section */}
      <div className="alert alert-info border-0 rounded-4 mt-5 p-4">
        <div className="d-flex gap-3 align-items-start">
          <i className="bi bi-info-circle-fill fs-3"></i>

          <div>
            <h5 className="fw-bold">Need help?</h5>
            <p className="mb-0">
              Select a service to continue. Some dashboard links will work
              after we create and connect their corresponding pages.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
