
import api from "./api";

// Get user profile
export const getProfile = async () => {
  const response = await api.get("/profile");
  return response.data;
};

// Update profile details
export const updateProfile = async (data) => {
  const response = await api.patch("/profile", data);
  return response.data;
};

// Upload profile photo
export const uploadProfilePhoto = async (file) => {
  const formData = new FormData();
  formData.append("photo", file);

  const response = await api.post("/profile/photo", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });

  return response.data;
};

// Remove profile photo
export const removeProfilePhoto = async () => {
  const response = await api.delete("/profile/photo");
  return response.data;
};
