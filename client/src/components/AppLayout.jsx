
import { Outlet } from "react-router-dom";
import Navbar from "./Navbar";
import Footer from "./Footer";

function AppLayout() {
  return (
    <div className="d-flex flex-column min-vh-100 bg-light">
      {/* One shared, role-aware navbar */}
      <Navbar />

      {/* Current page content */}
      <main className="flex-grow-1">
        <Outlet />
      </main>

      {/* One shared, role-aware footer */}
      <Footer />
    </div>
  );
}

export default AppLayout;
