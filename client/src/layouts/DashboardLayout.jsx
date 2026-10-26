
import { useState } from "react";
import { Outlet } from "react-router-dom";

import DashboardSidebar from "../components/DashboardSidebar";
import DashboardNavbar from "../components/DashboardNavbar";
import "../styles/dashboard.css";

function DashboardLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);

  const closeMobileMenu = () => setMobileOpen(false);

  return (
    <div className="dashboard-layout">
      <DashboardSidebar
        mobileOpen={mobileOpen}
        onClose={closeMobileMenu}
      />

      <div className="dashboard-main">
        <DashboardNavbar
          onMenuClick={() => setMobileOpen((previous) => !previous)}
        />

        <main className="dashboard-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default DashboardLayout;
