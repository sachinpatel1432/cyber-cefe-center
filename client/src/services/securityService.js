
import api from "./api";

// Change password for the logged-in user
export const changePassword = async (data) => {
  const response = await api.post("/auth/change-password", data);
  return response.data;
};

// Request a password reset email
export const forgotPassword = async (email) => {
  const response = await api.post("/auth/forgot-password", { email });
  return response.data;
};

// Reset password using the email token
export const resetPassword = async (data) => {
  const response = await api.post("/auth/reset-password", data);
  return response.data;
};

// Request email change verification
export const changeEmail = async (data) => {
  const response = await api.post("/auth/change-email", data);
  return response.data;
};

// Verify the new email address
export const verifyEmailChange = async (token) => {
  const response = await api.post("/auth/verify-email-change", {
    token,
  });
  return response.data;
};
