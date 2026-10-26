
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { getAdminDashboard } from "../../services/adminService";
import {
  getAdminServiceRequests,
} from "../../services/adminServiceRequestService";
import "../../styles/admin-dashboard.css";

const statCards = [
  {
    key: "totalUsers",
    label: "Total Users",
    icon: "bi-people",
    color: "primary",
  },
  {
    key: "activeUsers",
    label: "Active Accounts",
    icon: "bi-person-check",
    color: "success",
  },
  {
    key: "pendingUsers",
    label: "Pending Accounts",
    icon: "bi-hourglass-split",
    color: "warning",
  },
  {
    key: "suspendedUsers",
    label: "Suspended Accounts",
    icon: "bi-person-x",
    color: "danger",
  },
];

const requestStatCards = [
  {
    key: "total",
    label: "Total Requests",
    icon: "bi-clipboard-data",
    color: "primary",
    status: "all",
  },
  {
    key: "pending",
    label: "Pending Requests",
    icon: "bi-hourglass-split",
    color: "warning",
    status: "pending",
  },
  {
    key: "approved",
    label: "Approved Requests",
    icon: "bi-person-check",
    color: "info",
    status: "approved",
  },
  {
    key: "inProgress",
    label: "In Progress",
    icon: "bi-arrow-repeat",
    color: "primary",
    status: "in_progress",
  },
  {
    key: "completed",
    label: "Completed Requests",
    icon: "bi-check-circle",
    color: "success",
    status: "completed",
  },
];

const initialRequestStats = {
  total: null,
  pending: null,
  approved: null,
  inProgress: null,
  completed: null,
};

const AdminDonutChart = ({ items, centerValue, centerLabel }) => {
  const radius = 43;
  const circumference = 2 * Math.PI * radius;
  const total = items.reduce((sum, item) => sum + Math.max(0, Number(item.value) || 0), 0);
  let offset = 0;

  return (
    <div className="admin-donut-layout">
      <div className="admin-donut-wrap" role="img" aria-label={`${centerLabel}: ${centerValue}`}>
        <svg viewBox="0 0 120 120" className="admin-donut-svg" aria-hidden="true">
          <circle cx="60" cy="60" r={radius} fill="none" stroke="#edf1f7" strokeWidth="13" />
          {items.filter((item) => Number(item.value) > 0 && total > 0).map((item) => {
            const segment = (Number(item.value) / total) * circumference;
            const node = (
              <circle
                key={item.label}
                cx="60"
                cy="60"
                r={radius}
                fill="none"
                stroke={item.color}
                strokeWidth="13"
                strokeLinecap="butt"
                strokeDasharray={`${segment} ${circumference - segment}`}
                strokeDashoffset={-offset}
                transform="rotate(-90 60 60)"
              />
            );
            offset += segment;
            return node;
          })}
        </svg>
        <div className="admin-donut-center">
          <strong>{centerValue}</strong>
          <span>{centerLabel}</span>
        </div>
      </div>
      <div className="admin-donut-legend">
        {items.map((item) => (
          <div className="admin-legend-row" key={item.label}>
            <span className="admin-legend-label"><i style={{ backgroundColor: item.color }} />{item.label}</span>
            <strong>{Number(item.value) || 0}</strong>
          </div>
        ))}
        {total === 0 && <p className="small text-secondary mb-0">No data available yet.</p>}
      </div>
    </div>
  );
};

const AdminBarChart = ({ items }) => {
  const maxValue = Math.max(...items.map((item) => Number(item.value) || 0), 1);
  return (
    <div className="admin-bars">
      {items.map((item) => {
        const value = Number(item.value) || 0;
        return (
          <div className="admin-bar-row" key={item.label}>
            <div className="admin-bar-meta"><span>{item.label}</span><strong>{value.toLocaleString("en-IN")}</strong></div>
            <div className="admin-bar-track" aria-label={`${item.label}: ${value}`}>
              <span className="admin-bar-fill" style={{ width: `${(value / maxValue) * 100}%`, backgroundColor: item.color }} />
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default function AdminDashboard() {
  const [dashboard, setDashboard] = useState(null);
  const [requestStats, setRequestStats] = useState(initialRequestStats);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [requestStatsError, setRequestStatsError] = useState("");

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError("");
    setRequestStatsError("");

    const requestQueries = [
      ["total", "all"],
      ["pending", "pending"],
      ["approved", "approved"],
      ["inProgress", "in_progress"],
      ["completed", "completed"],
    ];

    try {
      const [dashboardResult, ...requestResults] =
        await Promise.allSettled([
          getAdminDashboard(),
          ...requestQueries.map(([, status]) =>
            getAdminServiceRequests({
              page: 1,
              limit: 1,
              status,
            })
          ),
        ]);

      if (dashboardResult.status === "fulfilled") {
        setDashboard(dashboardResult.value.dashboard);
      } else {
        throw dashboardResult.reason;
      }

      const updatedStats = { ...initialRequestStats };
      let failedRequestCount = 0;

      requestResults.forEach((result, index) => {
        const [key] = requestQueries[index];

        if (result.status === "fulfilled") {
          updatedStats[key] = result.value.pagination?.total ?? 0;
        } else {
          failedRequestCount += 1;
        }
      });

      setRequestStats(updatedStats);

      if (failedRequestCount > 0) {
        setRequestStatsError(
          "Some request counts could not be loaded. Check the admin request API."
        );
      }
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to load admin dashboard."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  if (loading) {
    return (
      <div className="container py-5 text-center">
        <div
          className="spinner-border text-primary"
          role="status"
          aria-label="Loading"
        />
        <p className="text-secondary mt-3">
          Loading admin dashboard...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container py-5">
        <div className="alert alert-danger" role="alert">
          {error}
          <button
            type="button"
            className="btn btn-sm btn-outline-danger ms-3"
            onClick={loadDashboard}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const statistics = dashboard?.statistics || {};
  const userStatusItems = [
    { label: "Active accounts", value: statistics.activeUsers ?? 0, color: "#20a779" },
    { label: "Pending accounts", value: statistics.pendingUsers ?? 0, color: "#e5a33e" },
    { label: "Suspended accounts", value: statistics.suspendedUsers ?? 0, color: "#e15b64" },
  ];
  const userStatusTotal = userStatusItems.reduce((sum, item) => sum + (Number(item.value) || 0), 0);
  const knownRequestCount = ["pending", "approved", "inProgress", "completed"]
    .reduce((sum, key) => sum + (Number(requestStats[key]) || 0), 0);
  const extraRequestCount = Math.max(0, (Number(requestStats.total) || 0) - knownRequestCount);
  const requestStatusItems = [
    { label: "Pending", value: requestStats.pending ?? 0, color: "#e5a33e" },
    { label: "Approved", value: requestStats.approved ?? 0, color: "#4c8bf5" },
    { label: "In progress", value: requestStats.inProgress ?? 0, color: "#8b72dc" },
    { label: "Completed", value: requestStats.completed ?? 0, color: "#20a779" },
    { label: "Other statuses", value: extraRequestCount, color: "#98a2b3" },
  ];
  const roleItems = [
    { label: "Customers", value: statistics.totalCustomers ?? 0, color: "#4c8bf5" },
    { label: "Staff", value: statistics.totalStaff ?? 0, color: "#20a779" },
    { label: "Administrators", value: statistics.totalAdmins ?? 0, color: "#8b72dc" },
  ];
  const requestPipelineItems = [
    { label: "Pending requests", value: requestStats.pending ?? 0, color: "#e5a33e" },
    { label: "Approved requests", value: requestStats.approved ?? 0, color: "#4c8bf5" },
    { label: "In progress", value: requestStats.inProgress ?? 0, color: "#8b72dc" },
    { label: "Completed requests", value: requestStats.completed ?? 0, color: "#20a779" },
  ];

  return (
    <main className="cyber-admin-dashboard container-fluid px-3 px-lg-4 py-4 py-lg-5">
      {/* Page heading and actions */}
      <div className="admin-page-header d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
        <div>
          <span className="badge text-bg-primary mb-2">
            CYBERDESK ADMIN
          </span>
          <h1 className="h2 fw-bold mb-1">Admin Dashboard</h1>
          <p className="text-secondary mb-0">
            Manage users, services and customer bookings from one place.
          </p>
        </div>

        <div className="d-flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-outline-secondary"
            onClick={loadDashboard}
            disabled={loading}
          >
            <i className="bi bi-arrow-clockwise me-2" />
            Refresh
          </button>

          <Link to="/admin/requests" className="btn btn-success">
            <i className="bi bi-clipboard-check me-2" />
            Manage Requests
          </Link>

          <Link to="/admin/services" className="btn btn-primary">
            <i className="bi bi-grid me-2" />
            Manage Services
          </Link>

          <Link
            to="/admin/users"
            className="btn btn-outline-primary"
          >
            <i className="bi bi-people me-2" />
            Manage Users
          </Link>
        </div>
      </div>

      {/* User statistics */}
      <section className="mb-5">
        <h2 className="admin-section-title h5 fw-bold mb-3">User Overview</h2>

        <div className="row g-3">
          {statCards.map((card) => (
            <div
              className="col-12 col-sm-6 col-xl-3"
              key={card.key}
            >
              <div className="card border-0 shadow-sm rounded-4 h-100">
                <div className="card-body p-4">
                  <div className="d-flex justify-content-between align-items-center mb-3">
                    <span className="text-secondary small fw-semibold">
                      {card.label}
                    </span>

                    <span
                      className={`text-${card.color} bg-${card.color}-subtle rounded-3 p-2`}
                    >
                      <i className={`bi ${card.icon} fs-5`} />
                    </span>
                  </div>

                  <h3 className="fw-bold mb-0">
                    {statistics[card.key] ?? 0}
                  </h3>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Role statistics */}
      <section className="mb-5">
        <h2 className="admin-section-title h5 fw-bold mb-3">Accounts by Role</h2>

        <div className="row g-3">
          {[
            {
              label: "Customers",
              value: statistics.totalCustomers,
              icon: "bi-person",
              color: "primary",
            },
            {
              label: "Staff",
              value: statistics.totalStaff,
              icon: "bi-person-workspace",
              color: "success",
            },
            {
              label: "Administrators",
              value: statistics.totalAdmins,
              icon: "bi-shield-lock",
              color: "dark",
            },
          ].map((item) => (
            <div className="col-12 col-md-4" key={item.label}>
              <div className="card border-0 shadow-sm rounded-4 h-100">
                <div className="card-body p-4 d-flex align-items-center gap-3">
                  <div
                    className={`text-${item.color} bg-${item.color}-subtle rounded-3 p-3`}
                  >
                    <i className={`bi ${item.icon} fs-4`} />
                  </div>

                  <div>
                    <p className="text-secondary mb-1">
                      {item.label}
                    </p>
                    <h3 className="fw-bold mb-0">
                      {item.value ?? 0}
                    </h3>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Service request statistics */}
      <section className="mb-5">
        <div className="d-flex flex-wrap justify-content-between align-items-end gap-2 mb-3">
          <div>
            <h2 className="admin-section-title h5 fw-bold mb-1">
              Service Request Overview
            </h2>
            <p className="text-secondary small mb-0">
              Customer booking totals and current workflow statuses.
            </p>
          </div>

          <Link
            to="/admin/requests"
            className="btn btn-outline-primary btn-sm"
          >
            View All Requests
            <i className="bi bi-arrow-right ms-2" />
          </Link>
        </div>

        {requestStatsError && (
          <div className="alert alert-warning" role="status">
            {requestStatsError}
          </div>
        )}

        <div className="row g-3">
          {requestStatCards.map((card) => (
            <div
              className="col-6 col-md-4 col-xl"
              key={card.key}
            >
              <div className="card border-0 shadow-sm rounded-4 h-100">
                <div className="card-body p-3 p-lg-4">
                  <div
                    className={`text-${card.color} bg-${card.color}-subtle rounded-3 d-inline-flex p-2 mb-3`}
                  >
                    <i className={`bi ${card.icon} fs-5`} />
                  </div>

                  <p className="text-secondary small mb-1">
                    {card.label}
                  </p>
                  <h3 className="fw-bold mb-0">
                    {requestStats[card.key] ?? "—"}
                  </h3>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="d-flex justify-content-end mt-3">
          <Link
            to="/admin/requests"
            className="btn btn-primary"
          >
            <i className="bi bi-clipboard-check me-2" />
            Open Request Management
          </Link>
        </div>
      </section>

      {/* Live analytics: derived from counts returned by the existing APIs, not invented trend data. */}
      <section className="admin-analytics-section mb-5" aria-label="Dashboard analytics">
        <div className="admin-analytics-heading d-flex flex-wrap justify-content-between align-items-end gap-2 mb-3">
          <div>
            <span className="admin-section-kicker">BUSINESS INTELLIGENCE</span>
            <h2 className="admin-section-title h4 fw-bold mb-1">Platform analytics</h2>
            <p className="text-secondary mb-0">A current snapshot of account health, user roles and request workflow.</p>
          </div>
          <span className="admin-data-note"><i className="bi bi-arrow-repeat me-1" /> Based on the latest refresh</span>
        </div>

        <div className="row g-3 mb-3">
          <div className="col-12 col-xl-6">
            <article className="admin-analytics-card h-100">
              <div className="admin-chart-heading">
                <div><h3>Account health</h3><p>Active, pending and suspended accounts</p></div>
                <span className="admin-chart-icon"><i className="bi bi-pie-chart" /></span>
              </div>
              <AdminDonutChart items={userStatusItems} centerValue={statistics.totalUsers ?? userStatusTotal} centerLabel="Total users" />
              {userStatusTotal === 0 && <p className="admin-chart-empty">Account status information will appear here when available.</p>}
            </article>
          </div>
          <div className="col-12 col-xl-6">
            <article className="admin-analytics-card h-100">
              <div className="admin-chart-heading">
                <div><h3>Team & customer mix</h3><p>Registered accounts grouped by role</p></div>
                <span className="admin-chart-icon admin-chart-icon-teal"><i className="bi bi-people" /></span>
              </div>
              <AdminBarChart items={roleItems} />
              <div className="admin-chart-footnote"><i className="bi bi-info-circle me-2" />Role counts are based on the admin dashboard statistics.</div>
            </article>
          </div>
        </div>

        <div className="row g-3">
          <div className="col-12 col-xl-6">
            <article className="admin-analytics-card h-100">
              <div className="admin-chart-heading">
                <div><h3>Request status distribution</h3><p>Requests classified by current workflow status</p></div>
                <span className="admin-chart-icon admin-chart-icon-purple"><i className="bi bi-pie-chart-fill" /></span>
              </div>
              <AdminDonutChart items={requestStatusItems} centerValue={requestStats.total ?? "—"} centerLabel="Total requests" />
              {requestStatsError && <p className="admin-chart-empty">Some status counts may be incomplete because one or more requests APIs did not respond.</p>}
            </article>
          </div>
          <div className="col-12 col-xl-6">
            <article className="admin-analytics-card h-100">
              <div className="admin-chart-heading">
                <div><h3>Request pipeline</h3><p>Current volume across the main work stages</p></div>
                <span className="admin-chart-icon admin-chart-icon-amber"><i className="bi bi-bar-chart-line" /></span>
              </div>
              <AdminBarChart items={requestPipelineItems} />
              <div className="admin-chart-footnote"><i className="bi bi-info-circle me-2" />These are current counts, not a historical performance trend.</div>
            </article>
          </div>
        </div>
      </section>

      {/* Management shortcuts */}
      <section className="mb-5">
        <h2 className="admin-section-title h5 fw-bold mb-3">Quick Management</h2>

        <div className="row g-3">
          {/* Services */}
          <div className="col-12 col-lg-4">
            <div className="card border-0 shadow-sm rounded-4 h-100">
              <div className="card-body p-4">
                <div className="d-flex align-items-start gap-3">
                  <div className="bg-primary-subtle text-primary rounded-3 p-3">
                    <i className="bi bi-grid-1x2 fs-3" />
                  </div>

                  <div className="flex-grow-1">
                    <h3 className="h5 fw-bold mb-2">
                      Service Management
                    </h3>
                    <p className="text-secondary mb-3">
                      Create services, update prices, manage
                      availability and close services temporarily.
                    </p>

                    <Link
                      to="/admin/services"
                      className="btn btn-outline-primary"
                    >
                      Manage Services
                      <i className="bi bi-arrow-right ms-2" />
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Users */}
          <div className="col-12 col-lg-4">
            <div className="card border-0 shadow-sm rounded-4 h-100">
              <div className="card-body p-4">
                <div className="d-flex align-items-start gap-3">
                  <div className="bg-success-subtle text-success rounded-3 p-3">
                    <i className="bi bi-people fs-3" />
                  </div>

                  <div className="flex-grow-1">
                    <h3 className="h5 fw-bold mb-2">
                      User Management
                    </h3>
                    <p className="text-secondary mb-3">
                      Review registered users, manage account
                      status and create staff accounts.
                    </p>

                    <Link
                      to="/admin/users"
                      className="btn btn-outline-success"
                    >
                      Manage Users
                      <i className="bi bi-arrow-right ms-2" />
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Requests */}
          <div className="col-12 col-lg-4">
            <div className="card border-0 shadow-sm rounded-4 h-100">
              <div className="card-body p-4">
                <div className="d-flex align-items-start gap-3">
                  <div className="bg-warning-subtle text-warning rounded-3 p-3">
                    <i className="bi bi-clipboard-check fs-3" />
                  </div>

                  <div className="flex-grow-1">
                    <h3 className="h5 fw-bold mb-2">
                      Request Management
                    </h3>
                    <p className="text-secondary mb-3">
                      Review customer bookings, assign staff and
                      manage valid request status transitions.
                    </p>

                    <Link
                      to="/admin/requests"
                      className="btn btn-outline-primary"
                    >
                      Manage Requests
                      <i className="bi bi-arrow-right ms-2" />
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Recent registrations */}
      <section className="admin-registration-panel card border-0 shadow-sm rounded-4">
        <div className="card-body p-0">
          <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 p-4">
            <div>
              <h2 className="admin-section-title h5 fw-bold mb-1">
                Recent Registrations
              </h2>
              <p className="text-secondary small mb-0">
                Latest five registered accounts.
              </p>
            </div>

            <Link
              to="/admin/users"
              className="btn btn-outline-primary btn-sm"
            >
              View All Users
            </Link>
          </div>

          <div className="table-responsive">
            <table className="table align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th className="px-4">Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Verified</th>
                </tr>
              </thead>

              <tbody>
                {(dashboard?.recentUsers || []).map((item) => (
                  <tr key={item._id}>
                    <td className="px-4 fw-semibold">
                      {item.fullName}
                    </td>

                    <td>{item.email}</td>

                    <td className="text-capitalize">
                      {item.role}
                    </td>

                    <td>
                      <span
                        className={`badge ${
                          item.accountStatus === "active"
                            ? "text-bg-success"
                            : item.accountStatus === "suspended"
                              ? "text-bg-danger"
                              : "text-bg-warning"
                        }`}
                      >
                        {item.accountStatus}
                      </span>
                    </td>

                    <td>
                      {item.emailVerified ? (
                        <span className="text-success">
                          <i className="bi bi-check-circle-fill me-1" />
                          Verified
                        </span>
                      ) : (
                        <span className="text-secondary">
                          <i className="bi bi-clock me-1" />
                          Pending
                        </span>
                      )}
                    </td>
                  </tr>
                ))}

                {!dashboard?.recentUsers?.length && (
                  <tr>
                    <td
                      colSpan="5"
                      className="text-center py-4 text-secondary"
                    >
                      No registered users found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </main>
  );
}
