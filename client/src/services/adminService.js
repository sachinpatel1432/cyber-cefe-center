
import api from "./api";

export const getAdminDashboard = async () => {
  const response = await api.get("/admin/dashboard");
  return response.data;
};

export const getAdminUsers = async ({
  page = 1,
  limit = 10,
  search = "",
} = {}) => {
  const response = await api.get("/admin/users", {
    params: { page, limit, search },
  });

  return response.data;
};


export const updateAdminUserStatus = async (userId, accountStatus) => {
  const response = await api.patch(
    `/admin/users/${userId}/status`,
    { accountStatus }
  );

  return response.data;
};

export const getAdminUserDetails = async (userId) => {
  const response = await api.get(`/admin/users/${userId}`);
  return response.data;
};


export const deleteAdminUser = async (userId) => {
  const response = await api.delete(`/admin/users/${userId}`);
  return response.data;
};


export const createAdminStaff = async (staffData) => {
  const response = await api.post("/admin/staff", staffData);
  return response.data;
};