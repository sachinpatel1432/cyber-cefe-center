
import api from "./api";

// Register new user
export const registerUser = async (data) => {
  const response = await api.post("/auth/register", data);
  return response.data;
};

// Login user
export const loginUser = async (data) => {
  const response = await api.post("/auth/login", data);
  return response.data;
};

// Get currently logged-in user
export const getCurrentUser = async () => {
  const response = await api.get("/auth/me");
  return response.data;
};

// Logout user
export const logoutUser = async () => {
  const response = await api.post("/auth/logout");
  return response.data;
};

// Verify email
export const verifyEmail = async (token) => {
  const response = await api.post("/auth/verify-email", {
    token,
  });
  return response.data;
};

// Forgot password
export const forgotPassword = async (email) => {
  const response = await api.post("/auth/forgot-password", {
    email,
  });
  return response.data;
};

// Reset password
export const resetPassword = async (data) => {
  const response = await api.post("/auth/reset-password", data);
  return response.data;
};

// Change password
export const changePassword = async (data) => {
  const response = await api.post("/auth/change-password", data);
  return response.data;
};

// Change email
export const changeEmail = async (data) => {
  const response = await api.post("/auth/change-email", data);
  return response.data;
};

// Verify email change
export const verifyEmailChange = async (token) => {
  const response = await api.post("/auth/verify-email-change", {
    token,
  });
  return response.data;
};
