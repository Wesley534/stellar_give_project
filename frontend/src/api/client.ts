import axios from "axios";

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "http://localhost:5000/api",
  headers: {
    "Content-Type": "application/json",
    // Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
  },
});

// Add interceptor to inject token dynamically
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
    config.headers["Accept"] = "application/json";
  }
  return config;
});

export default apiClient;
