
import { NavLink, Link } from "react-router-dom";

const menuItems = [
  {
    label: "Overview",
    path: "/dashboard",
    icon: "bi-grid-1x2",
    end: true,
  },
  {
    label: "Browse Services",
    path: "/services",
    icon: "bi-grid",
  },
  {
    label: "My Orders",
    path: "/my-orders",
    icon: "bi-clipboard-check",
  },
  {
    label: "My Profile",
    path: "/profile",
    icon: "bi-person-circle",
  },
];

function DashboardSidebar({ mobileOpen = false, onClose }) {
  return (
    <>
      {mobileOpen && (
        <button
          type="button"
          className="sidebar-overlay"
          aria-label="Close navigation menu"
          onClick={onClose}
        />
      )}

      <aside
        className={`dashboard-sidebar ${mobileOpen ? "sidebar-open" : ""}`}
      >
        <Link to="/" className="sidebar-brand" onClick={onClose}>
          <span className="sidebar-brand-icon">
            <i className="bi bi-pc-display-horizontal"></i>
          </span>

          <span>
            Cyber<span>Desk</span>
          </span>
        </Link>

        <div className="sidebar-section-label">WORKSPACE</div>

        <nav className="sidebar-navigation" aria-label="Dashboard navigation">
          {menuItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.end}
              onClick={onClose}
              className={({ isActive }) =>
                `sidebar-link ${isActive ? "sidebar-link-active" : ""}`
              }
            >
              <i className={`bi ${item.icon}`}></i>
              <span>{item.label}</span>

              {item.label === "Overview" && (
                <span className="sidebar-active-dot"></span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-help-card">
          <div className="sidebar-help-icon">
            <i className="bi bi-headset"></i>
          </div>

          <h4>Need help?</h4>
          <p>Have a question about our services?</p>

          <Link to="/#contact" onClick={onClose}>
            Contact Us <i className="bi bi-arrow-up-right"></i>
          </Link>
        </div>

        <div className="sidebar-bottom">
          <div className="sidebar-bottom-icon">
            <i className="bi bi-shield-check"></i>
          </div>

          <div>
            <strong>CyberDesk</strong>
            <span>Digital service portal</span>
          </div>
        </div>
      </aside>
    </>
  );
}

export default DashboardSidebar;
