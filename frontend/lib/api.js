import axios from "axios";
import { jwtDecode } from "jwt-decode";

// =====================================================
// 🔧 AXIOS INSTANCE
// =====================================================
const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const api = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// =====================================================
// 🔐 REQUEST INTERCEPTOR
// Auto-attach JWT token
// =====================================================
api.interceptors.request.use(
  (config) => {
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("token"); // matches your backend

      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// =====================================================
// 🚨 RESPONSE INTERCEPTOR
// Auto logout on 401
// =====================================================
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      if (typeof window !== "undefined") {
        localStorage.removeItem("token");
        localStorage.removeItem("user");

        window.location.href = "/login";
      }
    }

    return Promise.reject(error);
  }
);

// =====================================================
// 👤 HELPER — GET CURRENT USER FROM TOKEN
// =====================================================
export const getCurrentUserFromToken = () => {
  if (typeof window === "undefined") return null;

  const token = localStorage.getItem("token");
  if (!token) return null;

  try {
    const decoded = jwtDecode(token);
    return decoded; // { username, role, exp, ... }
  } catch (err) {
    console.error("Invalid token", err);
    return null;
  }
};

// =====================================================
// 🔐 AUTH APIs
// =====================================================
export const loginUser = async (username, password) => {
  const res = await api.post("/login", {
    username,
    password,
  });

  const { token, username: user, role } = res.data;

  // Store auth data
  localStorage.setItem("token", token);
  localStorage.setItem(
    "user",
    JSON.stringify({ username: user, role })
  );

  return res.data;
};

export const logoutUser = () => {
  localStorage.removeItem("token");
  localStorage.removeItem("user");

  if (typeof window !== "undefined") {
    window.location.href = "/login";
  }
};

export const getCurrentUser = async () => {
  return api.get("/me");
};

// =====================================================
// 🔎 QUERY API
// =====================================================
export const queryCode = async (question, repoPath) => {
  return api.post("/query", {
    question,
    repo_path: repoPath,
  });
};

// =====================================================
// 📦 INDEX API
// =====================================================
export const indexRepo = async (repoPath, indexPath) => {
  return api.post("/index", {
    repo_path: repoPath,
    index_path: indexPath,
  });
};

// =====================================================
// ❤️ HEALTH CHECK
// =====================================================
export const healthCheck = async () => {
  return api.get("/health");
};

// =====================================================
// DEFAULT EXPORT
// =====================================================
export default api;