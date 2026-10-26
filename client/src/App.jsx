
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";

import AppLayout from "./components/AppLayout";
import ProtectedRoute from "./components/ProtectedRoute";
import AdminRoute from "./components/AdminRoute";
import StaffRoute from "./components/StaffRoute";

// Public pages
import Home from "./pages/Home";
import Services from "./pages/Services";
import Login from "./pages/Login";
import Register from "./pages/Register";
import VerifyEmail from "./pages/VerifyEmail";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import VerifyEmailChange from "./pages/VerifyEmailChange";
import StaffInvitationSetup from "./pages/StaffInvitationSetup";
import NotFound from "./pages/NotFound";
import RequestWorkspace from "./pages/RequestWorkspace";

// Customer pages
import CustomerDashboard from "./pages/customer/CustomerDashboard";
import MyServiceRequests from "./pages/customer/MyServiceRequests";

// Shared authenticated account pages
import Profile from "./pages/Profile";
import ChangePassword from "./pages/ChangePassword";
import ChangeEmail from "./pages/ChangeEmail";

// Admin pages
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminUserDetails from "./pages/admin/AdminUserDetails";
import AdminCreateStaff from "./pages/admin/AdminCreateStaff";
import AdminServices from "./pages/admin/AdminServices";
import AdminServiceDetails from "./pages/admin/AdminServiceDetails";
import AdminRequests from "./pages/admin/AdminRequests";

// Staff pages
import StaffDashboard from "./pages/staff/StaffDashboard";

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Shared navbar and footer */}
          <Route element={<AppLayout />}>
            {/* Public pages */}
            <Route path="/" element={<Home />} />
            <Route path="/services" element={<Services />} />

            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            <Route
              path="/verify-email"
              element={<VerifyEmail />}
            />

            <Route
              path="/forgot-password"
              element={<ForgotPassword />}
            />

            <Route
              path="/reset-password"
              element={<ResetPassword />}
            />

            <Route
              path="/verify-email-change"
              element={<VerifyEmailChange />}
            />

            <Route
              path="/staff/setup"
              element={<StaffInvitationSetup />}
            />

            {/* Customer-only pages */}
            <Route
              element={
                <ProtectedRoute allowedRoles={["customer"]} />
              }
            >
              <Route
                path="/customer/dashboard"
                element={<CustomerDashboard />}
              />

              <Route
                path="/my-requests"
                element={<MyServiceRequests />}
              />
            </Route>

            {/* Shared authenticated account pages */}
            <Route
              element={
                <ProtectedRoute
                  allowedRoles={["customer", "staff", "admin"]}
                />
              }
            >
              <Route
                path="/profile"
                element={<Profile />}
              />

              <Route
                path="/change-password"
                element={<ChangePassword />}
              />

              <Route
                path="/change-email"
                element={<ChangeEmail />}
              />

              {/* Shared request conversation and activity */}
              <Route
                path="/requests/:requestId/workspace"
                element={<RequestWorkspace />}
              />
            </Route>

            {/* Admin-only pages */}
            <Route element={<AdminRoute />}>
              <Route
                path="/admin"
                element={<AdminDashboard />}
              />

              <Route
                path="/admin/users"
                element={<AdminUsers />}
              />

              <Route
                path="/admin/users/:id"
                element={<AdminUserDetails />}
              />

              <Route
                path="/admin/staff/new"
                element={<AdminCreateStaff />}
              />

              <Route
                path="/admin/services"
                element={<AdminServices />}
              />

              <Route
                path="/admin/services/:id"
                element={<AdminServiceDetails />}
              />

              <Route
                path="/admin/requests"
                element={<AdminRequests />}
              />
            </Route>

            {/* Staff-only pages */}
            <Route element={<StaffRoute />}>
              <Route
                path="/staff/dashboard"
                element={<StaffDashboard />}
              />
            </Route>

            {/* Unknown URLs */}
            <Route
              path="*"
              element={<NotFound />}
            />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
