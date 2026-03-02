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
export const queryCode = async (question, repoPath, mode = "auto") => {
  return api.post("/query", {
    question,
    repo_path: repoPath,
    mode,
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
// 🚪 LOGOUT API
// =====================================================
export const logoutSession = async () => {
  try {
    await api.post("/logout");
  } catch {
    // swallow — server may already be down
  }
};

// =====================================================
// 📊 ADMIN: Developer Activity
// =====================================================
export const getDevActivity = async () => {
  return api.get("/admin/activity");
};

// =====================================================
// 👥 ADMIN: User Management
// =====================================================
export const getUsers = async () => {
  return api.get("/admin/users");
};

export const addUser = async (username, password, role) => {
  return api.post("/admin/users", { username, password, role });
};

export const deleteUser = async (username) => {
  return api.delete(`/admin/users/${username}`);
};

export const updateUserRole = async (username, role) => {
  return api.put(`/admin/users/${username}/role`, { role });
};

export const getRoles = async () => {
  return api.get("/admin/roles");
};

// =====================================================
// 🕷️ ADMIN: Git Crawler
// =====================================================
export const triggerCrawler = async (repoPath) => {
  return api.post("/admin/crawler/trigger", { repo_path: repoPath });
};

export const getCrawlerStatus = async () => {
  return api.get("/admin/crawler/status");
};

// =====================================================
// 📚 ADMIN: Redis Knowledge Base
// =====================================================
export const getRedisStats = async () => {
  return api.get("/admin/redis/stats");
};

export const flushRedis = async () => {
  return api.post("/admin/redis/flush");
};

export const reindexRedis = async () => {
  return api.post("/admin/redis/reindex");
};

// =====================================================
// 🛡️ ADMIN: Security Policies
// =====================================================
export const getSecurityPolicies = async () => {
  return api.get("/admin/security/policies");
};

export const updateSecurityPolicies = async (policies) => {
  return api.put("/admin/security/policies", policies);
};

// =====================================================
// 📋 ADMIN: Audit Logs
// =====================================================
export const getAuditLogs = async () => {
  return api.get("/admin/audit-logs");
};

// =====================================================
// 📈 ADMIN: System Performance
// =====================================================
export const getSystemPerformance = async () => {
  return api.get("/admin/system/performance");
};

// =====================================================
// 👔 MANAGER: Team Dashboard
// =====================================================
export const getTeamMembers = async () => {
  return api.get("/manager/team/members");
};

export const getQueryHistory = async (username = null, limit = 50) => {
  const params = { limit };
  if (username) params.username = username;
  return api.get("/manager/team/query-history", { params });
};

export const getUsageAnalytics = async () => {
  return api.get("/manager/team/analytics");
};

export const getActivityReport = async () => {
  return api.get("/manager/team/activity-report");
};

export const getProjectDocs = async () => {
  return api.get("/manager/docs/project");
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