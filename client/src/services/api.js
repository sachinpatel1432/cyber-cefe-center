import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5001/api",
  withCredentials: true,
});

// Handle multipart uploads correctly.
// Axios/browser must set the multipart boundary for FormData requests.
api.interceptors.request.use(
  (config) => {
    if (
      typeof FormData !== "undefined" &&
      config.data instanceof FormData
    ) {
      if (config.headers?.delete) {
        config.headers.delete("Content-Type");
      } else if (config.headers) {
        delete config.headers["Content-Type"];
        delete config.headers["content-type"];
      }
    }

    return config;
  },
  (error) => Promise.reject(error)
);

export const getErrorMessage = (error) => {
  return (
    error?.response?.data?.message ||
    (error?.code === "ERR_NETWORK"
      ? "Backend se connection nahi ho pa raha. Server check karo."
      : "Something went wrong. Please try again.")
  );
};

export default api;