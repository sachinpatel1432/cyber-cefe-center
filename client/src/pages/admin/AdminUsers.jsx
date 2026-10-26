
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  getAdminUsers,
  updateAdminUserStatus,
  deleteAdminUser,
} from "../../services/adminService";
import "../../styles/admin-users.css";

function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    totalUsers: 0,
    totalPages: 0,
  });

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [updatingUserId, setUpdatingUserId] = useState(null);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await getAdminUsers({
        page: pagination.page,
        limit: pagination.limit,
        search,
      });

      setUsers(response.users || []);

      setPagination((previous) => ({
        ...previous,
        ...(response.pagination || {}),
      }));
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to load users. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, search]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleSearch = (event) => {
    event.preventDefault();
    setSuccess("");

    setPagination((previous) => ({
      ...previous,
      page: 1,
    }));

    setSearch(searchInput.trim());
  };

  const handleClearSearch = () => {
    setSearchInput("");
    setSearch("");
    setSuccess("");

    setPagination((previous) => ({
      ...previous,
      page: 1,
    }));
  };

  const changePage = (page) => {
    if (page < 1 || page > pagination.totalPages) return;

    setPagination((previous) => ({
      ...previous,
      page,
    }));
  };

  // Activate / Suspend user
  const handleStatusChange = async (user) => {
    const nextStatus =
      user.accountStatus === "suspended" ? "active" : "suspended";

    const action = nextStatus === "active" ? "activate" : "suspend";

    const confirmed = window.confirm(
      `Are you sure you want to ${action} the account of ${
        user.fullName || user.email
      }?`
    );

    if (!confirmed) return;

    setUpdatingUserId(user._id);
    setError("");
    setSuccess("");

    try {
      const response = await updateAdminUserStatus(
        user._id,
        nextStatus
      );

      setSuccess(
        response.message || `Account ${nextStatus} successfully.`
      );

      await loadUsers();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to update account status."
      );
    } finally {
      setUpdatingUserId(null);
    }
  };

  // Permanently delete user
  const handleDeleteUser = async (user) => {
    if (user.role === "admin") {
      setError("Admin accounts cannot be deleted here.");
      return;
    }

    const confirmed = window.confirm(
      `PERMANENT DELETE\n\nAre you sure you want to permanently delete ${
        user.fullName || user.email
      }?\n\nThis action cannot be undone.`
    );

    if (!confirmed) return;

    setUpdatingUserId(user._id);
    setError("");
    setSuccess("");

    try {
      const response = await deleteAdminUser(user._id);

      setSuccess(
        response.message || "User deleted successfully."
      );

      // Remove the deleted user immediately from the UI.
      setUsers((previous) =>
        previous.filter((item) => item._id !== user._id)
      );

      // If the last user on a later page was deleted,
      // go to the previous page. The effect will reload it.
      if (users.length === 1 && pagination.page > 1) {
        setPagination((previous) => ({
          ...previous,
          page: previous.page - 1,
          totalUsers: Math.max(0, previous.totalUsers - 1),
        }));
      } else {
        await loadUsers();
      }
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to delete user."
      );
    } finally {
      setUpdatingUserId(null);
    }
  };

  const formatDate = (date) => {
    if (!date) return "—";

    const parsedDate = new Date(date);

    if (Number.isNaN(parsedDate.getTime())) return "—";

    return parsedDate.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const statusClass = {
    active: "text-bg-success",
    pending: "text-bg-warning",
    suspended: "text-bg-danger",
  };

  const roleClass = {
    admin: "text-bg-primary",
    staff: "text-bg-info",
    customer: "text-bg-secondary",
  };

  // These charts deliberately describe only the currently loaded page.
  // The existing API provides paginated user results, not global role/status aggregates.
  const roleMetrics = [
    { label: "Customers", value: users.filter((user) => user.role === "customer").length, color: "#6478f5" },
    { label: "Staff", value: users.filter((user) => user.role === "staff").length, color: "#23a6a1" },
    { label: "Admins", value: users.filter((user) => user.role === "admin").length, color: "#8b72e8" },
  ];
  const accountMetrics = [
    { label: "Active", value: users.filter((user) => user.accountStatus === "active").length, color: "#22a06b" },
    { label: "Pending", value: users.filter((user) => user.accountStatus === "pending").length, color: "#e6a23c" },
    { label: "Suspended", value: users.filter((user) => user.accountStatus === "suspended").length, color: "#dd5b65" },
  ];
  const roleMax = Math.max(1, ...roleMetrics.map((item) => item.value));
  const accountMax = Math.max(1, ...accountMetrics.map((item) => item.value));

  return (
    <div className="cyber-admin-users container-fluid px-3 px-lg-4 py-4 py-lg-5">
      {/* Header */}
      <header className="admin-users-hero d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
        <div className="admin-users-hero-copy">
          <div className="admin-users-breadcrumb small mb-2">
            <Link to="/admin" className="text-decoration-none">
              Admin Dashboard
            </Link>
            <span className="mx-2">/</span>
            Users
          </div>

          <span className="admin-users-eyebrow"><i className="bi bi-shield-lock me-2" aria-hidden="true" />CYBERDESK ADMINISTRATION</span>
          <h1 className="fw-bold mb-2">User Management</h1>
          <p className="mb-0">
            Review account health, find users quickly and manage access from one place.
          </p>
        </div>

        <div className="d-flex flex-wrap gap-2">
          <Link to="/admin/staff/new" className="btn btn-primary">
            <i className="bi bi-person-plus me-2" aria-hidden="true" />
            Create Staff
          </Link>

          <Link to="/admin" className="btn btn-outline-secondary">
            <i className="bi bi-arrow-left me-2" aria-hidden="true" />
            Back to Admin
          </Link>
        </div>
      </header>

      {/* Error message */}
      {error && (
        <div className="alert alert-danger" role="alert">
          <i className="bi bi-exclamation-circle me-2" />
          {error}
          <button
            type="button"
            className="btn-close float-end"
            aria-label="Dismiss error"
            onClick={() => setError("")}
          />
        </div>
      )}

      {/* Success message */}
      {success && (
        <div className="alert alert-success" role="status">
          <i className="bi bi-check-circle me-2" />
          {success}
          <button
            type="button"
            className="btn-close float-end"
            aria-label="Dismiss success"
            onClick={() => setSuccess("")}
          />
        </div>
      )}

      {/* Summary cards */}
      <div className="row g-3 mb-4">
        <div className="col-12 col-md-4">
          <div className="admin-users-stat-card card border-0 h-100 rounded-4">
            <div className="card-body p-4">
              <p className="text-secondary mb-2">Matching users</p>
              <h3 className="fw-bold mb-0">
                {pagination.totalUsers.toLocaleString("en-IN")}
              </h3>
            </div>
          </div>
        </div>

        <div className="col-12 col-md-4">
          <div className="admin-users-stat-card card border-0 h-100 rounded-4">
            <div className="card-body p-4">
              <p className="text-secondary mb-2">Current page</p>
              <h3 className="fw-bold mb-0">
                {pagination.totalPages ? pagination.page : 0}
                <span className="text-secondary fs-6">
                  {" "}of {pagination.totalPages}
                </span>
              </h3>
            </div>
          </div>
        </div>

        <div className="col-12 col-md-4">
          <div className="admin-users-stat-card card border-0 h-100 rounded-4">
            <div className="card-body p-4">
              <p className="text-secondary mb-2">Users on this page</p>
              <h3 className="fw-bold mb-0">{users.length}</h3>
            </div>
          </div>
        </div>
      </div>

      {/* Current page analytics — intentionally not presented as whole-platform totals. */}
      <section className="admin-users-analytics mb-4" aria-label="Current page account analytics">
        <div className="admin-users-section-heading d-flex flex-wrap justify-content-between align-items-end gap-2 mb-3">
          <div>
            <span className="admin-users-section-kicker">ACCOUNT INSIGHTS</span>
            <h2 className="h4 fw-bold mb-1">Account distribution</h2>
            <p className="text-secondary mb-0">A snapshot of the users on this page, based on the current search results.</p>
          </div>
          <span className="admin-users-data-note"><i className="bi bi-info-circle me-2" aria-hidden="true" />Page-level data · {users.length} users</span>
        </div>

        <div className="row g-3">
          <div className="col-12 col-lg-6">
            <article className="admin-users-chart-card h-100">
              <div className="admin-users-chart-heading">
                <div>
                  <h3>Users by role</h3>
                  <p>How the current result set is composed</p>
                </div>
                <span className="admin-users-chart-icon"><i className="bi bi-people" aria-hidden="true" /></span>
              </div>
              <div className="admin-users-metric-bars">
                {roleMetrics.map((item) => (
                  <div className="admin-users-metric-row" key={item.label}>
                    <div className="admin-users-metric-meta">
                      <span><i style={{ backgroundColor: item.color }} aria-hidden="true" />{item.label}</span>
                      <strong>{item.value}</strong>
                    </div>
                    <div className="admin-users-metric-track" aria-label={`${item.label}: ${item.value}`}>
                      <span style={{ width: `${(item.value / roleMax) * 100}%`, backgroundColor: item.color }} />
                    </div>
                  </div>
                ))}
              </div>
            </article>
          </div>
          <div className="col-12 col-lg-6">
            <article className="admin-users-chart-card h-100">
              <div className="admin-users-chart-heading">
                <div>
                  <h3>Account status</h3>
                  <p>Active, pending and suspended users on this page</p>
                </div>
                <span className="admin-users-chart-icon admin-users-chart-icon-green"><i className="bi bi-shield-check" aria-hidden="true" /></span>
              </div>
              <div className="admin-users-metric-bars">
                {accountMetrics.map((item) => (
                  <div className="admin-users-metric-row" key={item.label}>
                    <div className="admin-users-metric-meta">
                      <span><i style={{ backgroundColor: item.color }} aria-hidden="true" />{item.label}</span>
                      <strong>{item.value}</strong>
                    </div>
                    <div className="admin-users-metric-track" aria-label={`${item.label}: ${item.value}`}>
                      <span style={{ width: `${(item.value / accountMax) * 100}%`, backgroundColor: item.color }} />
                    </div>
                  </div>
                ))}
              </div>
            </article>
          </div>
        </div>
      </section>

      {/* Search */}
      <div className="admin-users-search-card card border-0 rounded-4 mb-4">
        <div className="card-body p-3 p-md-4">
          <form
            className="row g-2 align-items-end"
            onSubmit={handleSearch}
          >
            <div className="col-12 col-md">
              <label
                htmlFor="userSearch"
                className="form-label fw-semibold"
              >
                Search users
              </label>

              <div className="input-group">
                <span className="input-group-text bg-white">
                  <i className="bi bi-search" />
                </span>

                <input
                  id="userSearch"
                  type="search"
                  className="form-control"
                  placeholder="Search by name or email..."
                  value={searchInput}
                  onChange={(event) =>
                    setSearchInput(event.target.value)
                  }
                  maxLength={100}
                />
              </div>
            </div>

            <div className="col-12 col-md-auto d-flex gap-2">
              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading || Boolean(updatingUserId)}
              >
                <i className="bi bi-search me-1" />
                Search
              </button>

              <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={handleClearSearch}
                disabled={Boolean(updatingUserId)}
              >
                Clear
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Users table */}
      <div className="admin-users-table-card card border-0 rounded-4 overflow-hidden">
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 p-3 p-md-4 border-bottom">
          <div>
            <span className="admin-users-section-kicker">DIRECTORY</span>
            <h2 className="h5 fw-bold mb-1">Registered Users</h2>
            <p className="text-secondary small mb-0">
              Account details, verification state and secure account actions.
            </p>
          </div>

          <button
            type="button"
            className="btn btn-outline-primary btn-sm"
            onClick={loadUsers}
            disabled={loading || Boolean(updatingUserId)}
          >
            <i className="bi bi-arrow-clockwise me-2" />
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="text-center py-5">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading users...</span>
            </div>
            <p className="text-secondary mt-3 mb-0">
              Loading users...
            </p>
          </div>
        ) : error && users.length === 0 ? (
          <div className="text-center text-secondary py-5">
            <i className="bi bi-exclamation-circle fs-2" />
            <p className="mt-3">
              Could not load users. Please retry.
            </p>
            <button
              type="button"
              className="btn btn-outline-primary btn-sm"
              onClick={loadUsers}
            >
              Retry
            </button>
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-5">
            <i className="bi bi-people fs-1 text-secondary" />
            <h5 className="mt-3">No users found</h5>
            <p className="text-secondary mb-0">
              Try a different name or email search.
            </p>
          </div>
        ) : (
          <>
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0 admin-users-table">
                <thead className="table-light">
                  <tr>
                    <th className="px-3 px-md-4 py-3">User</th>
                    <th className="py-3">Role</th>
                    <th className="py-3">Account Status</th>
                    <th className="py-3">Email Verification</th>
                    <th className="py-3">Joined</th>
                    <th className="text-end px-3 py-3">Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {users.map((user) => {
                    const isUpdating = updatingUserId === user._id;
                    const isAdmin = user.role === "admin";
                    const isPending =
                      user.accountStatus === "pending";
                    const isSuspended =
                      user.accountStatus === "suspended";

                    return (
                      <tr key={user._id}>
                        <td className="px-3 px-md-4 py-3">
                          <div className="fw-semibold">
                            {user.fullName || "Unnamed user"}
                          </div>
                          <div className="text-secondary small">
                            {user.email}
                          </div>
                        </td>

                        <td>
                          <span
                            className={`badge ${
                              roleClass[user.role] ||
                              "text-bg-secondary"
                            } text-capitalize`}
                          >
                            {user.role || "unknown"}
                          </span>
                        </td>

                        <td>
                          <span
                            className={`badge ${
                              statusClass[user.accountStatus] ||
                              "text-bg-secondary"
                            } text-capitalize`}
                          >
                            {user.accountStatus || "unknown"}
                          </span>
                        </td>

                        <td>
                          {user.emailVerified ? (
                            <span className="text-success small fw-semibold">
                              <i className="bi bi-check-circle-fill me-1" />
                              Verified
                            </span>
                          ) : (
                            <span className="text-warning-emphasis small fw-semibold">
                              <i className="bi bi-clock me-1" />
                              Not verified
                            </span>
                          )}
                        </td>

                        <td className="text-secondary small">
                          {formatDate(user.createdAt)}
                        </td>

                        {/* Actions */}
                        <td className="text-end px-3">
                          <div className="d-flex justify-content-end align-items-center gap-2 flex-wrap">
                            {/* View Details */}
                            <Link
                              to={`/admin/users/${user._id}`}
                              className="btn btn-sm btn-outline-primary"
                              title="View user details"
                            >
                              <i className="bi bi-eye me-1" />
                              View
                            </Link>

                            {isAdmin ? (
                              <span className="badge text-bg-secondary">
                                <i className="bi bi-shield-lock me-1" />
                                Protected
                              </span>
                            ) : (
                              <>
                                {/* Activate / Suspend */}
                                {isPending ? (
                                  <span className="badge text-bg-warning">
                                    <i className="bi bi-clock me-1" />
                                    Pending
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    className={`btn btn-sm ${
                                      isSuspended
                                        ? "btn-outline-success"
                                        : "btn-outline-danger"
                                    }`}
                                    disabled={Boolean(updatingUserId)}
                                    onClick={() =>
                                      handleStatusChange(user)
                                    }
                                  >
                                    {isUpdating ? (
                                      <>
                                        <span
                                          className="spinner-border spinner-border-sm me-1"
                                          aria-hidden="true"
                                        />
                                        Updating...
                                      </>
                                    ) : isSuspended ? (
                                      <>
                                        <i className="bi bi-person-check me-1" />
                                        Activate
                                      </>
                                    ) : (
                                      <>
                                        <i className="bi bi-person-slash me-1" />
                                        Suspend
                                      </>
                                    )}
                                  </button>
                                )}

                                {/* Delete User */}
                                <button
                                  type="button"
                                  className="btn btn-sm btn-danger"
                                  disabled={Boolean(updatingUserId)}
                                  onClick={() => handleDeleteUser(user)}
                                  title="Permanently delete user"
                                >
                                  {isUpdating ? (
                                    <>
                                      <span
                                        className="spinner-border spinner-border-sm me-1"
                                        aria-hidden="true"
                                      />
                                      Processing...
                                    </>
                                  ) : (
                                    <>
                                      <i className="bi bi-trash me-1" />
                                      Delete
                                    </>
                                  )}
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 p-3 p-md-4 border-top">
              <p className="text-secondary small mb-0">
                Showing {users.length} of {pagination.totalUsers} matching users
              </p>

              <div className="d-flex align-items-center gap-2">
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm"
                  disabled={
                    pagination.page <= 1 ||
                    loading ||
                    Boolean(updatingUserId)
                  }
                  onClick={() =>
                    changePage(pagination.page - 1)
                  }
                >
                  <i className="bi bi-chevron-left me-1" />
                  Previous
                </button>

                <span className="small text-secondary px-1">
                  {pagination.totalPages ? pagination.page : 0} /{" "}
                  {pagination.totalPages}
                </span>

                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm"
                  disabled={
                    pagination.page >= pagination.totalPages ||
                    loading ||
                    Boolean(updatingUserId)
                  } 
                  onClick={() =>
                    changePage(pagination.page + 1)
                  }
                >
                  Next
                  <i className="bi bi-chevron-right ms-1" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default AdminUsers;
