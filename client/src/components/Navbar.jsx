import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  Link,
  NavLink,
  useLocation,
  useNavigate,
} from "react-router-dom";

import { useAuth } from "../context/AuthContext";
import "./Navbar.css";

const COMMON_LINKS = [
  {
    label: "Home",
    path: "/",
    icon: "bi-house-door",
    end: true,
  },
  {
    label: "Services",
    path: "/services",
    icon: "bi-grid",
    end: true,
  },
];

const ROLE_LINKS = {
  admin: [
    {
      label: "Dashboard",
      path: "/admin",
      icon: "bi-speedometer2",
      end: true,
    },
    {
      label: "Requests",
      path: "/admin/requests",
      icon: "bi-clipboard-check",
    },
    {
      label: "Manage Services",
      path: "/admin/services",
      icon: "bi-collection",
    },
    {
      label: "Users",
      path: "/admin/users",
      icon: "bi-people",
    },
    {
      label: "Create Staff",
      path: "/admin/staff/new",
      icon: "bi-person-plus",
    },
  ],

  staff: [
    {
      label: "Dashboard",
      path: "/staff/dashboard",
      icon: "bi-speedometer2",
      end: true,
    },
  ],

  customer: [
    {
      label: "Dashboard",
      path: "/customer/dashboard",
      icon: "bi-speedometer2",
      end: true,
    },
    {
      label: "My Requests",
      path: "/my-requests",
      icon: "bi-clipboard-check",
    },
  ],
};

const DASHBOARD_PATHS = {
  admin: "/admin",
  staff: "/staff/dashboard",
  customer: "/customer/dashboard",
};

function getInitials(name) {
  const parts = String(name || "User")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  return (
    parts
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("") || "U"
  );
}

function formatRole(role) {
  if (!role) return "Member";

  return role
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase()
    );
}

// Robust helper to resolve profile image from any backend schema format
function getProfileImageUrl(user) {
  if (!user) return "";

  const image =
    user.profileImage ||
    user.profileImageUrl ||
    user.avatar ||
    user.avatarUrl ||
    user.photo ||
    user.photoURL ||
    user.imageUrl ||
    user.imageURL ||
    user.src ||
    user.path;

  if (!image) return "";

  if (typeof image === "object") {
    const nestedUrl =
      image.url ||
      image.secure_url ||
      image.imageUrl ||
      image.imageURL ||
      image.src ||
      image.path;

    return typeof nestedUrl === "string" ? nestedUrl.trim() : "";
  }

  if (typeof image === "string") {
    return image.trim();
  }

  return "";
}

function ProfileAvatar({ user, large = false }) {
  const imageUrl = getProfileImageUrl(user);
  const [imageFailed, setImageFailed] = useState(false);

  const displayName =
    user?.fullName ||
    user?.name ||
    user?.email ||
    "User";

  const initials = getInitials(displayName);

  useEffect(() => {
    setImageFailed(false);
  }, [imageUrl]);

  return (
    <span
      className={`cyber-avatar ${
        large ? "cyber-avatar-large" : ""
      }`}
      aria-label={`${displayName} profile picture`}
    >
      {imageUrl && !imageFailed ? (
        <img
          src={imageUrl}
          alt={`${displayName} profile`}
          className="cyber-avatar-image"
          onError={() => setImageFailed(true)}
          referrerPolicy="no-referrer"
        />
      ) : (
        <span className="cyber-avatar-initials">
          {initials}
        </span>
      )}
    </span>
  );
}

function Navbar() {
  const { user, logout } = useAuth();

  const navigate = useNavigate();
  const location = useLocation();

  const accountRef = useRef(null);

  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");

  const role = user?.role;
  const dashboardPath = DASHBOARD_PATHS[role];

  const displayName =
    user?.fullName ||
    user?.name ||
    user?.email?.split("@")[0] ||
    "My Account";

  const links = useMemo(
    () => [
      ...COMMON_LINKS,
      ...(ROLE_LINKS[role] || []),
    ],
    [role]
  );

  const closeMenus = () => {
    setMenuOpen(false);
    setAccountOpen(false);
  };

  useEffect(() => {
    setMenuOpen(false);
    setAccountOpen(false);
    setLogoutError("");
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (!accountOpen) return undefined;

    const handlePointerDown = (event) => {
      if (
        accountRef.current &&
        !accountRef.current.contains(event.target)
      ) {
        setAccountOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setAccountOpen(false);
      }
    };

    document.addEventListener(
      "pointerdown",
      handlePointerDown
    );

    document.addEventListener(
      "keydown",
      handleKeyDown
    );

    return () => {
      document.removeEventListener(
        "pointerdown",
        handlePointerDown
      );

      document.removeEventListener(
        "keydown",
        handleKeyDown
      );
    };
  }, [accountOpen]);

  const handleLogout = async () => {
    if (loggingOut) return;

    setLoggingOut(true);
    setLogoutError("");
    setMenuOpen(false);

    try {
      await logout();

      setAccountOpen(false);

      navigate("/login", {
        replace: true,
      });
    } catch (error) {
      console.error("Logout failed:", error);

      setLogoutError(
        "Logout nahi ho saka. Please dobara try karein."
      );

      setAccountOpen(true);
    } finally {
      setLoggingOut(false);
    }
  };

  const renderNavigationLinks = () =>
    links.map((item) => (
      <li
        className="cyber-nav-item"
        key={`${item.path}-${item.label}`}
      >
        <NavLink
          to={item.path}
          end={Boolean(item.end)}
          className={({ isActive }) =>
            `cyber-nav-link ${
              isActive ? "active" : ""
            }`
          }
          onClick={closeMenus}
        >
          <i
            className={`bi ${item.icon}`}
            aria-hidden="true"
          />

          <span>{item.label}</span>
        </NavLink>
      </li>
    ));

  return (
    <nav
      className="cyber-navbar"
      aria-label="Main navigation"
    >
      <div className="cyber-navbar-inner">
        <Link
          to="/"
          className="cyber-brand"
          aria-label="CyberDesk home"
          onClick={closeMenus}
        >
          <span
            className="cyber-brand-mark"
            aria-hidden="true"
          >
            <i className="bi bi-pc-display-horizontal" />
          </span>

          <span className="cyber-brand-copy">
            <span className="cyber-brand-name">
              Cyber<span>Desk</span>
            </span>

            <span className="cyber-brand-caption">
              YOUR DIGITAL SERVICE HUB
            </span>
          </span>
        </Link>

        <button
          type="button"
          className={`cyber-menu-toggle ${
            menuOpen ? "is-open" : ""
          }`}
          aria-label={
            menuOpen
              ? "Close navigation menu"
              : "Open navigation menu"
          }
          aria-controls="cyber-navbar-menu"
          aria-expanded={menuOpen}
          onClick={() => {
            setMenuOpen((previous) => !previous);
            setAccountOpen(false);
          }}
        >
          <i
            className={`bi ${
              menuOpen ? "bi-x-lg" : "bi-list"
            }`}
            aria-hidden="true"
          />
        </button>

        <div
          id="cyber-navbar-menu"
          className={`cyber-navbar-menu ${
            menuOpen ? "is-open" : ""
          }`}
        >
          <ul className="cyber-nav-links">
            {renderNavigationLinks()}
          </ul>

          <div className="cyber-navbar-actions">
            {!user ? (
              <div className="cyber-auth-actions">
                <Link
                  to="/login"
                  className="cyber-login-button"
                  onClick={closeMenus}
                >
                  Sign in
                </Link>

                <Link
                  to="/register"
                  className="cyber-register-button"
                  onClick={closeMenus}
                >
                  <span>Create Account</span>

                  <i
                    className="bi bi-arrow-up-right"
                    aria-hidden="true"
                  />
                </Link>
              </div>
            ) : (
              <div
                className="cyber-account"
                ref={accountRef}
              >
                <button
                  type="button"
                  className={`cyber-account-trigger ${
                    accountOpen ? "is-open" : ""
                  }`}
                  aria-expanded={accountOpen}
                  aria-haspopup="menu"
                  aria-label={`Account menu for ${displayName}`}
                  onClick={() => {
                    setAccountOpen(
                      (previous) => !previous
                    );
                    setLogoutError("");
                  }}
                >
                  <ProfileAvatar user={user} />

                  <span className="cyber-account-copy">
                    <span className="cyber-account-name">
                      {displayName}
                    </span>

                    <span className="cyber-account-role">
                      {formatRole(role)}
                    </span>
                  </span>

                  <i
                    className={`bi bi-chevron-down cyber-account-chevron ${
                      accountOpen ? "rotated" : ""
                    }`}
                    aria-hidden="true"
                  />
                </button>

                {accountOpen && (
                  <div
                    className="cyber-account-dropdown"
                    role="menu"
                  >
                    <div className="cyber-dropdown-profile">
                      <ProfileAvatar
                        user={user}
                        large
                      />

                      <div className="cyber-dropdown-profile-copy">
                        <strong>{displayName}</strong>

                        <span>
                          {user?.email || formatRole(role)}
                        </span>
                      </div>
                    </div>

                    <div className="cyber-dropdown-divider" />

                    {dashboardPath && (
                      <Link
                        to={dashboardPath}
                        className="cyber-dropdown-item"
                        role="menuitem"
                        onClick={closeMenus}
                      >
                        <i
                          className="bi bi-speedometer2"
                          aria-hidden="true"
                        />

                        <span>My Dashboard</span>

                        <i
                          className="bi bi-arrow-up-right cyber-dropdown-trailing"
                          aria-hidden="true"
                        />
                      </Link>
                    )}

                    <Link
                      to="/profile"
                      className="cyber-dropdown-item"
                      role="menuitem"
                      onClick={closeMenus}
                    >
                      <i
                        className="bi bi-person-circle"
                        aria-hidden="true"
                      />

                      <span>My Profile</span>
                    </Link>

                    <Link
                      to="/change-password"
                      className="cyber-dropdown-item"
                      role="menuitem"
                      onClick={closeMenus}
                    >
                      <i
                        className="bi bi-shield-lock"
                        aria-hidden="true"
                      />

                      <span>Change Password</span>
                    </Link>

                    <Link
                      to="/change-email"
                      className="cyber-dropdown-item"
                      role="menuitem"
                      onClick={closeMenus}
                    >
                      <i
                        className="bi bi-envelope"
                        aria-hidden="true"
                      />

                      <span>Change Email</span>
                    </Link>

                    <div className="cyber-dropdown-divider" />

                    {logoutError && (
                      <p
                        className="cyber-logout-error"
                        role="alert"
                      >
                        {logoutError}
                      </p>
                    )}

                    <button
                      type="button"
                      className="cyber-dropdown-item cyber-logout-item"
                      role="menuitem"
                      disabled={loggingOut}
                      onClick={handleLogout}
                    >
                      <i
                        className={`bi ${
                          loggingOut
                            ? "bi-arrow-repeat"
                            : "bi-box-arrow-right"
                        }`}
                        aria-hidden="true"
                      />

                      <span>
                        {loggingOut
                          ? "Signing out..."
                          : "Sign out"}
                      </span>
                    </button>

                    <div className="cyber-dropdown-footer">
                      <i
                        className="bi bi-shield-check"
                        aria-hidden="true"
                      />

                      Secure CyberDesk account
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}

export default Navbar;