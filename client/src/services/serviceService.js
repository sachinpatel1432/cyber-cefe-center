
import api from "./api";

export const getActiveServices = async () => {
  const response = await api.get("/services");
  return response.data;
};

export const getManageableServices = async (params = {}) => {
  const response = await api.get("/services/manage", { params });
  return response.data;
};

export const getServiceDetails = async (id) => {
  const response = await api.get(`/services/manage/${id}`);
  return response.data;
};

export const createService = async (data) => {
  const response = await api.post("/services", data);
  return response.data;
};

export const updateService = async (id, data) => {
  const response = await api.patch(`/services/manage/${id}`, data);
  return response.data;
};

export const closeService = async (id, reason = "") => {
  const response = await api.patch(`/services/manage/${id}/close`, {
    reason,
  });
  return response.data;
};

export const reopenService = async (id) => {
  const response = await api.patch(`/services/manage/${id}/reopen`);
  return response.data;
};

export const activateService = async (id) => {
  const response = await api.patch(`/services/manage/${id}/activate`);
  return response.data;
};

export const deactivateService = async (id) => {
  const response = await api.patch(`/services/manage/${id}/deactivate`);
  return response.data;
};

export const deleteService = async (id) => {
  const response = await api.delete(`/services/manage/${id}`);
  return response.data;
};
