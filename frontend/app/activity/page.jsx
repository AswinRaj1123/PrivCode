"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  getDevActivity,
  logoutSession,
  getUsers,
  addUser,
  deleteUser,
  updateUserRole,
  getRoles,
  triggerCrawler,
  getCrawlerStatus,
  getRedisStats,
  flushRedis,
  reindexRedis,
  getSecurityPolicies,
  updateSecurityPolicies,
  getAuditLogs,
  getSystemPerformance,
} from "@/lib/api";
import { auth } from "@/lib/auth";
import {
  LogOut,
  Menu,
  X,
  MessageCircle,
  Users,
  Activity,
  Clock,
  Search,
  RefreshCw,
  ArrowLeft,
  UserPlus,
  Trash2,
  Shield,
  GitBranch,
  Database,
  FileText,
  Cpu,
  HardDrive,
  MemoryStick,
  AlertTriangle,
  Check,
  ChevronRight,
  Play,
  Settings,
  BarChart3,
} from "lucide-react";

// ── Sidebar nav items ──
const NAV_ITEMS = [
  { key: "activity", label: "Developer Activity", icon: Activity },
  { key: "users", label: "User Management", icon: Users },
  { key: "roles", label: "RBAC Control", icon: Shield },
  { key: "crawler", label: "Git Crawler", icon: GitBranch },
  { key: "redis", label: "Redis Knowledge Base", icon: Database },
  { key: "security", label: "Security Policies", icon: Settings },
  { key: "audit", label: "Audit Logs", icon: FileText },
  { key: "performance", label: "System Performance", icon: BarChart3 },
];

export default function AdminPage() {
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState("activity");

  // ── Developer Activity state ──
  const [devActivity, setDevActivity] = useState([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [searchFilter, setSearchFilter] = useState("");

  // ── User Management state ──
  const [usersList, setUsersList] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState("developer");
  const [addingUser, setAddingUser] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  // ── Roles state ──
  const [rolesList, setRolesList] = useState([]);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [editRoleValue, setEditRoleValue] = useState("");

  // ── Git Crawler state ──
  const [crawlerStatus, setCrawlerStatus] = useState(null);
  const [crawlerLoading, setCrawlerLoading] = useState(false);
  const [crawlRepoPath, setCrawlRepoPath] = useState("");
  const [crawling, setCrawling] = useState(false);
  const [crawlResult, setCrawlResult] = useState(null);

  // ── Redis state ──
  const [redisStats, setRedisStats] = useState(null);
  const [redisLoading, setRedisLoading] = useState(false);
  const [flushing, setFlushing] = useState(false);
  const [reindexing, setReindexing] = useState(false);
  const [flushConfirm, setFlushConfirm] = useState(false);

  // ── Security Policies state ──
  const [policies, setPolicies] = useState(null);
  const [policiesLoading, setPoliciesLoading] = useState(false);
  const [savingPolicies, setSavingPolicies] = useState(false);
  const [policyDraft, setPolicyDraft] = useState(null);

  // ── Audit Logs state ──
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditFilter, setAuditFilter] = useState("");
  const [auditActionFilter, setAuditActionFilter] = useState("all");

  // ── Performance state ──
  const [perfData, setPerfData] = useState(null);
  const [perfLoading, setPerfLoading] = useState(false);

  // ── Init ──
  useEffect(() => {
    setMounted(true);
    if (!auth.isAuthenticated()) {
      router.push("/login");
      return;
    }
    const u = auth.getUser();
    if (u?.role !== "admin") {
      router.push("/chat");
      return;
    }
    setUser(u);
  }, [router]);

  const isAdmin = user?.role === "admin";

  // ── Data fetchers ──
  const fetchActivity = useCallback(async () => {
    if (!isAdmin) return;
    setActivityLoading(true);
    try {
      const res = await getDevActivity();
      setDevActivity(res.data?.developers || []);
    } catch { setDevActivity([]); }
    finally { setActivityLoading(false); }
  }, [isAdmin]);

  const fetchUsers = useCallback(async () => {
    setUsersLoading(true);
    try {
      const res = await getUsers();
      setUsersList(res.data?.users || []);
    } catch { setUsersList([]); }
    finally { setUsersLoading(false); }
  }, []);

  const fetchRoles = useCallback(async () => {
    setRolesLoading(true);
    try {
      const res = await getRoles();
      setRolesList(res.data?.roles || []);
      const ures = await getUsers();
      setUsersList(ures.data?.users || []);
    } catch { setRolesList([]); }
    finally { setRolesLoading(false); }
  }, []);

  const fetchCrawler = useCallback(async () => {
    setCrawlerLoading(true);
    try {
      const res = await getCrawlerStatus();
      setCrawlerStatus(res.data);
    } catch { setCrawlerStatus(null); }
    finally { setCrawlerLoading(false); }
  }, []);

  const fetchRedis = useCallback(async () => {
    setRedisLoading(true);
    try {
      const res = await getRedisStats();
      setRedisStats(res.data);
    } catch { setRedisStats(null); }
    finally { setRedisLoading(false); }
  }, []);

  const fetchPolicies = useCallback(async () => {
    setPoliciesLoading(true);
    try {
      const res = await getSecurityPolicies();
      setPolicies(res.data?.policies || {});
      setPolicyDraft(res.data?.policies || {});
    } catch { setPolicies(null); }
    finally { setPoliciesLoading(false); }
  }, []);

  const fetchAuditLogs = useCallback(async () => {
    setAuditLoading(true);
    try {
      const res = await getAuditLogs();
      setAuditLogs(res.data?.logs || []);
    } catch { setAuditLogs([]); }
    finally { setAuditLoading(false); }
  }, []);

  const fetchPerformance = useCallback(async () => {
    setPerfLoading(true);
    try {
      const res = await getSystemPerformance();
      setPerfData(res.data);
    } catch { setPerfData(null); }
    finally { setPerfLoading(false); }
  }, []);

  // ── Load data when tab changes ──
  useEffect(() => {
    if (!isAdmin) return;
    const fetchers = {
      activity: fetchActivity,
      users: fetchUsers,
      roles: fetchRoles,
      crawler: fetchCrawler,
      redis: fetchRedis,
      security: fetchPolicies,
      audit: fetchAuditLogs,
      performance: fetchPerformance,
    };
    fetchers[activeTab]?.();
  }, [activeTab, isAdmin, fetchActivity, fetchUsers, fetchRoles, fetchCrawler, fetchRedis, fetchPolicies, fetchAuditLogs, fetchPerformance]);

  // Auto-refresh for activity and performance
  useEffect(() => {
    if (!isAdmin) return;
    if (activeTab === "activity") {
      const iv = setInterval(fetchActivity, 15000);
      return () => clearInterval(iv);
    }
    if (activeTab === "performance") {
      const iv = setInterval(fetchPerformance, 5000);
      return () => clearInterval(iv);
    }
  }, [activeTab, isAdmin, fetchActivity, fetchPerformance]);

  // ── Action handlers ──
  const handleLogout = async () => {
    try { await logoutSession(); } catch {}
    auth.logout();
  };

  const handleAddUser = async () => {
    if (!newUsername.trim() || !newPassword.trim()) return;
    setAddingUser(true);
    try {
      await addUser(newUsername.trim(), newPassword, newRole);
      setNewUsername("");
      setNewPassword("");
      setNewRole("developer");
      fetchUsers();
    } catch (err) {
      alert(err?.response?.data?.detail || "Failed to add user");
    } finally { setAddingUser(false); }
  };

  const handleDeleteUser = async (username) => {
    try {
      await deleteUser(username);
      setDeleteConfirm(null);
      fetchUsers();
    } catch (err) {
      alert(err?.response?.data?.detail || "Failed to delete user");
    }
  };

  const handleUpdateRole = async (username) => {
    try {
      await updateUserRole(username, editRoleValue);
      setEditingRole(null);
      setEditRoleValue("");
      fetchRoles();
    } catch (err) {
      alert(err?.response?.data?.detail || "Failed to update role");
    }
  };

  const handleTriggerCrawler = async () => {
    if (!crawlRepoPath.trim()) return;
    setCrawling(true);
    setCrawlResult(null);
    try {
      const res = await triggerCrawler(crawlRepoPath.trim());
      setCrawlResult({ status: "success", message: res.data?.message || "Crawler completed" });
      fetchCrawler();
    } catch (err) {
      setCrawlResult({ status: "error", message: err?.response?.data?.detail || "Crawler failed" });
    } finally { setCrawling(false); }
  };

  const handleFlushRedis = async () => {
    setFlushing(true);
    try {
      await flushRedis();
      setFlushConfirm(false);
      fetchRedis();
    } catch (err) {
      alert(err?.response?.data?.detail || "Flush failed");
    } finally { setFlushing(false); }
  };

  const handleReindexRedis = async () => {
    setReindexing(true);
    try {
      await reindexRedis();
      fetchRedis();
    } catch (err) {
      alert(err?.response?.data?.detail || "Re-index failed");
    } finally { setReindexing(false); }
  };

  const handleSavePolicies = async () => {
    if (!policyDraft) return;
    setSavingPolicies(true);
    try {
      const res = await updateSecurityPolicies(policyDraft);
      setPolicies(res.data?.policies || policyDraft);
    } catch (err) {
      alert(err?.response?.data?.detail || "Failed to save policies");
    } finally { setSavingPolicies(false); }
  };

  // ── Derived data ──
  const filteredDevs = devActivity.filter((d) =>
    d.username.toLowerCase().includes(searchFilter.toLowerCase())
  );
  const totalQueries = devActivity.reduce((s, d) => s + (d.total_queries || 0), 0);
  const onlineCount = devActivity.filter((d) => d.status === "online").length;

  const filteredLogs = auditLogs.filter((log) => {
    const matchesText = auditFilter === "" ||
      (log.user || "").toLowerCase().includes(auditFilter.toLowerCase()) ||
      (log.action || "").toLowerCase().includes(auditFilter.toLowerCase()) ||
      (log.query || "").toLowerCase().includes(auditFilter.toLowerCase());
    const matchesAction = auditActionFilter === "all" || log.action === auditActionFilter;
    return matchesText && matchesAction;
  });

  const uniqueActions = [...new Set(auditLogs.map((l) => l.action).filter(Boolean))];

  const formatUptime = (seconds) => {
    if (!seconds) return "—";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}h ${m}m`;
  };

  if (!mounted || !user) return null;

  // ── Refresh helpers ──
  const refreshMap = {
    activity: fetchActivity, users: fetchUsers, roles: fetchRoles, crawler: fetchCrawler,
    redis: fetchRedis, security: fetchPolicies, audit: fetchAuditLogs, performance: fetchPerformance,
  };
  const currentLoading = {
    activity: activityLoading, users: usersLoading, roles: rolesLoading, crawler: crawlerLoading,
    redis: redisLoading, security: policiesLoading, audit: auditLoading, performance: perfLoading,
  };

  return (
    <div className="flex h-screen bg-pc-bg">
      {/* ── SIDEBAR ── */}
      <div className={`${sidebarOpen ? "w-56" : "w-0"} bg-pc-surface border-r border-pc-border flex flex-col transition-all duration-200 overflow-hidden flex-shrink-0`}>
        {/* Logo */}
        <div className="h-14 px-4 flex items-center gap-2 border-b border-pc-border flex-shrink-0">
          <div className="w-6 h-6 border border-pc-accent rounded flex items-center justify-center">
            <span className="font-mono text-pc-accent text-[10px] font-semibold">&gt;_</span>
          </div>
          <span className="text-sm font-semibold text-pc-text tracking-tight">PrivCode</span>
        </div>

        {/* Back to Chat */}
        <div className="p-3 flex-shrink-0">
          <button
            onClick={() => router.push("/chat")}
            className="w-full px-3 py-2 bg-pc-elevated border border-pc-border rounded text-xs text-pc-secondary hover:text-pc-text hover:bg-pc-hover transition flex items-center gap-2"
          >
            <MessageCircle size={13} />
            Back to Chat
            <ArrowLeft size={12} className="ml-auto" />
          </button>
        </div>

        {/* Nav */}
        <div className="flex-1 overflow-y-auto px-3">
          <p className="text-[10px] text-pc-muted uppercase tracking-wider px-2 py-2 font-medium">Admin Panel</p>
          <div className="space-y-0.5">
            {NAV_ITEMS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`w-full px-2 py-1.5 rounded text-xs flex items-center gap-1.5 transition ${
                  activeTab === key
                    ? "bg-pc-accent/10 border border-pc-accent/30 text-pc-accent"
                    : "text-pc-secondary hover:text-pc-text hover:bg-pc-elevated border border-transparent"
                }`}
              >
                <Icon size={12} />
                <span className="truncate">{label}</span>
                {activeTab === key && <ChevronRight size={10} className="ml-auto" />}
              </button>
            ))}
          </div>
        </div>

        {/* User */}
        <div className="border-t border-pc-border p-3 space-y-2 flex-shrink-0">
          <div className="flex items-center gap-2 px-1">
            <div className="w-7 h-7 rounded bg-pc-elevated border border-pc-border flex items-center justify-center text-pc-accent text-xs font-mono font-semibold">
              {user?.username?.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-pc-text truncate">{user?.username}</p>
              <p className="text-[10px] text-pc-muted">admin</p>
            </div>
          </div>
          <button onClick={handleLogout} className="w-full px-3 py-1.5 text-pc-muted hover:text-pc-danger hover:bg-[rgba(248,81,73,0.08)] rounded transition flex items-center gap-2 text-xs">
            <LogOut size={13} />
            Sign out
          </button>
        </div>
      </div>

      {/* ── MAIN ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <div className="h-14 border-b border-pc-border bg-pc-surface px-4 flex items-center gap-3 flex-shrink-0">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-1.5 hover:bg-pc-elevated rounded transition text-pc-secondary hover:text-pc-text">
            {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
          <div className="h-5 w-px bg-pc-border" />
          <div className="flex items-center gap-2">
            {(() => { const item = NAV_ITEMS.find((n) => n.key === activeTab); const Icon = item?.icon || Activity; return <Icon size={14} className="text-pc-accent" />; })()}
            <span className="text-sm text-pc-text font-medium">{NAV_ITEMS.find((n) => n.key === activeTab)?.label}</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => refreshMap[activeTab]?.()}
              disabled={currentLoading[activeTab]}
              className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] text-pc-muted hover:text-pc-accent bg-pc-elevated border border-pc-border rounded transition"
            >
              <RefreshCw size={11} className={currentLoading[activeTab] ? "animate-spin" : ""} />
              Refresh
            </button>
            <div className="flex items-center gap-1.5 px-2 py-1 bg-pc-elevated rounded border border-pc-border text-xs text-pc-muted">
              <Shield size={12} />
              <span className="font-mono">Admin Dashboard</span>
            </div>
          </div>
        </div>

        {/* ── Content ── */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-5xl mx-auto px-6 py-6">

            {/* ═══════════════════════════════════════════════════════ */}
            {/* TAB: Developer Activity                                */}
            {/* ═══════════════════════════════════════════════════════ */}
            {activeTab === "activity" && (
              <>
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="bg-pc-surface border border-pc-border rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Users size={14} className="text-pc-accent" />
                      <p className="text-[10px] text-pc-muted uppercase tracking-wider font-medium">Total Developers</p>
                    </div>
                    <p className="text-2xl font-mono font-semibold text-pc-text">{devActivity.length}</p>
                  </div>
                  <div className="bg-pc-surface border border-pc-border rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Activity size={14} className="text-pc-success" />
                      <p className="text-[10px] text-pc-muted uppercase tracking-wider font-medium">Online Now</p>
                    </div>
                    <p className="text-2xl font-mono font-semibold text-pc-success">{onlineCount}</p>
                  </div>
                  <div className="bg-pc-surface border border-pc-border rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Search size={14} className="text-pc-warning" />
                      <p className="text-[10px] text-pc-muted uppercase tracking-wider font-medium">Total Queries</p>
                    </div>
                    <p className="text-2xl font-mono font-semibold text-pc-text">{totalQueries}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Users size={16} className="text-pc-accent" />
                    <h3 className="text-sm font-semibold text-pc-text">All Developers</h3>
                    <span className="text-[10px] text-pc-muted bg-pc-elevated px-1.5 py-0.5 rounded">{filteredDevs.length}</span>
                  </div>
                  <div className="relative">
                    <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-pc-muted" />
                    <input value={searchFilter} onChange={(e) => setSearchFilter(e.target.value)} placeholder="Filter developers..." className="pl-7 pr-3 py-1.5 bg-pc-bg border border-pc-border rounded text-xs font-mono text-pc-text focus:outline-none focus:border-pc-accent transition placeholder:text-pc-muted/50 w-48" />
                  </div>
                </div>

                {filteredDevs.length === 0 ? (
                  <div className="text-center py-16">
                    <Users size={32} className="text-pc-muted mx-auto mb-3 opacity-40" />
                    <p className="text-sm text-pc-muted">{searchFilter ? "No developers match your filter" : "No developer activity yet"}</p>
                    <p className="text-[11px] text-pc-muted mt-1">{searchFilter ? "Try a different search term" : "Activity will appear once developers log in"}</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredDevs.map((dev) => (
                      <div key={dev.username} className="bg-pc-surface border border-pc-border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded bg-pc-elevated border border-pc-border flex items-center justify-center text-pc-accent text-sm font-mono font-semibold">{dev.username.charAt(0).toUpperCase()}</div>
                            <div>
                              <p className="text-sm font-medium text-pc-text">{dev.username}</p>
                              <p className="text-[10px] text-pc-muted">{dev.role}</p>
                            </div>
                            <span className={`ml-2 inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-medium ${dev.status === "online" ? "bg-pc-success/10 text-pc-success border border-pc-success/20" : "bg-pc-muted/10 text-pc-muted border border-pc-border"}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${dev.status === "online" ? "bg-pc-success" : "bg-pc-muted"}`} />
                              {dev.status}
                            </span>
                          </div>
                        </div>
                        <div className="grid grid-cols-4 gap-2 mb-3">
                          {[
                            { label: "Queries", value: dev.total_queries },
                            { label: "Indexed", value: dev.total_indexing },
                            { label: "Current Repo", value: dev.current_repo ? dev.current_repo.replace(/\.git$/, "").split("/").filter(Boolean).pop() : "—", accent: true },
                            { label: "Last Active", value: dev.last_active ? new Date(dev.last_active + "Z").toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—" },
                          ].map((s, i) => (
                            <div key={i} className="bg-pc-bg rounded p-2.5 border border-pc-border/50">
                              <p className="text-[10px] text-pc-muted uppercase tracking-wider mb-0.5">{s.label}</p>
                              <p className={`text-sm font-mono font-semibold truncate ${s.accent ? "text-pc-accent text-xs" : "text-pc-text"}`}>{s.value}</p>
                            </div>
                          ))}
                        </div>
                        <div className="flex items-center gap-4 text-[10px] text-pc-muted mb-3">
                          <span className="flex items-center gap-1"><Clock size={10} />Login: {dev.last_login ? new Date(dev.last_login + "Z").toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}</span>
                          <span className="flex items-center gap-1"><LogOut size={10} />Logout: {dev.last_logout ? new Date(dev.last_logout + "Z").toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}</span>
                        </div>
                        {dev.recent_queries?.length > 0 && (
                          <div>
                            <p className="text-[10px] text-pc-muted uppercase tracking-wider mb-1.5 flex items-center gap-1"><Search size={10} />Recent Queries</p>
                            <div className="space-y-1 max-h-32 overflow-y-auto">
                              {dev.recent_queries.slice().reverse().slice(0, 5).map((q, i) => (
                                <div key={i} className="flex items-center gap-2 text-[11px] bg-pc-bg rounded px-2.5 py-1.5 border border-pc-border/30">
                                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${q.status === "SUCCESS" ? "bg-pc-success" : "bg-pc-danger"}`} />
                                  <span className="text-pc-text truncate flex-1" title={q.query}>{q.query}</span>
                                  <span className="text-pc-muted flex-shrink-0 uppercase text-[9px]">{q.mode}</span>
                                  <span className="text-pc-muted flex-shrink-0">{new Date(q.timestamp + "Z").toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* ═══════════════════════════════════════════════════════ */}
            {/* TAB: User Management                                   */}
            {/* ═══════════════════════════════════════════════════════ */}
            {activeTab === "users" && (
              <>
                {/* Add User Form */}
                <div className="bg-pc-surface border border-pc-border rounded-lg p-4 mb-6">
                  <h3 className="text-sm font-semibold text-pc-text mb-3 flex items-center gap-2">
                    <UserPlus size={14} className="text-pc-accent" />Add New User
                  </h3>
                  <div className="flex items-end gap-3">
                    <div className="flex-1">
                      <label className="block text-[10px] text-pc-muted uppercase tracking-wider mb-1 font-medium">Username</label>
                      <input value={newUsername} onChange={(e) => setNewUsername(e.target.value)} placeholder="john_doe" className="w-full px-3 py-1.5 bg-pc-bg border border-pc-border rounded text-xs font-mono text-pc-text focus:outline-none focus:border-pc-accent transition placeholder:text-pc-muted/50" />
                    </div>
                    <div className="flex-1">
                      <label className="block text-[10px] text-pc-muted uppercase tracking-wider mb-1 font-medium">Password</label>
                      <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="••••••••" className="w-full px-3 py-1.5 bg-pc-bg border border-pc-border rounded text-xs font-mono text-pc-text focus:outline-none focus:border-pc-accent transition placeholder:text-pc-muted/50" />
                    </div>
                    <div className="w-36">
                      <label className="block text-[10px] text-pc-muted uppercase tracking-wider mb-1 font-medium">Role</label>
                      <select value={newRole} onChange={(e) => setNewRole(e.target.value)} className="w-full px-3 py-1.5 bg-pc-bg border border-pc-border rounded text-xs font-mono text-pc-text focus:outline-none focus:border-pc-accent transition">
                        <option value="developer">developer</option>
                        <option value="manager">manager</option>
                        <option value="auditor">auditor</option>
                        <option value="admin">admin</option>
                      </select>
                    </div>
                    <button onClick={handleAddUser} disabled={addingUser || !newUsername.trim() || !newPassword.trim()} className="px-4 py-1.5 bg-pc-accent text-[#0d1117] text-xs font-medium rounded hover:bg-pc-accent-hover transition disabled:opacity-50 whitespace-nowrap">
                      {addingUser ? "Adding..." : "Add User"}
                    </button>
                  </div>
                </div>

                {/* Users List */}
                <div className="bg-pc-surface border border-pc-border rounded-lg overflow-hidden">
                  <div className="px-4 py-3 border-b border-pc-border flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-pc-text flex items-center gap-2"><Users size={14} className="text-pc-accent" />All Users</h3>
                    <span className="text-[10px] text-pc-muted bg-pc-elevated px-1.5 py-0.5 rounded">{usersList.length} user{usersList.length !== 1 ? "s" : ""}</span>
                  </div>
                  {usersList.length === 0 ? (
                    <div className="text-center py-10 text-pc-muted text-sm">No users found</div>
                  ) : (
                    <div className="divide-y divide-pc-border">
                      {usersList.map((u) => (
                        <div key={u.username} className="px-4 py-3 flex items-center gap-3 hover:bg-pc-elevated/50 transition">
                          <div className="w-8 h-8 rounded bg-pc-elevated border border-pc-border flex items-center justify-center text-pc-accent text-sm font-mono font-semibold">{u.username.charAt(0).toUpperCase()}</div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-pc-text font-medium">{u.username}</p>
                          </div>
                          <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${u.role === "admin" ? "bg-pc-accent/10 text-pc-accent border border-pc-accent/20" : "bg-pc-elevated text-pc-secondary border border-pc-border"}`}>{u.role}</span>
                          {u.username !== user?.username && (
                            <>
                              {deleteConfirm === u.username ? (
                                <div className="flex items-center gap-1">
                                  <button onClick={() => handleDeleteUser(u.username)} className="p-1.5 bg-pc-danger/20 text-pc-danger rounded hover:bg-pc-danger/30 transition" title="Confirm delete"><Check size={12} /></button>
                                  <button onClick={() => setDeleteConfirm(null)} className="p-1.5 bg-pc-elevated text-pc-muted rounded hover:text-pc-text transition" title="Cancel"><X size={12} /></button>
                                </div>
                              ) : (
                                <button onClick={() => setDeleteConfirm(u.username)} className="p-1.5 text-pc-muted hover:text-pc-danger hover:bg-pc-danger/10 rounded transition" title="Delete user"><Trash2 size={13} /></button>
                              )}
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* ═══════════════════════════════════════════════════════ */}
            {/* TAB: RBAC Control                                      */}
            {/* ═══════════════════════════════════════════════════════ */}
            {activeTab === "roles" && (
              <>
                {/* Available Roles */}
                <div className="bg-pc-surface border border-pc-border rounded-lg p-4 mb-6">
                  <h3 className="text-sm font-semibold text-pc-text mb-3 flex items-center gap-2"><Shield size={14} className="text-pc-accent" />Available Roles</h3>
                  {rolesList.length === 0 ? (
                    <p className="text-sm text-pc-muted">Loading roles...</p>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      {rolesList.map((r) => (
                        <div key={r.name} className="bg-pc-bg border border-pc-border rounded-lg p-3">
                          <div className="flex items-center gap-2 mb-1">
                            <Shield size={12} className={r.name === "admin" ? "text-pc-accent" : "text-pc-secondary"} />
                            <p className="text-sm font-mono font-semibold text-pc-text">{r.name}</p>
                          </div>
                          <p className="text-[10px] text-pc-muted uppercase tracking-wider">Access Level: <span className="text-pc-secondary">{r.access}</span></p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Assign Roles */}
                <div className="bg-pc-surface border border-pc-border rounded-lg overflow-hidden">
                  <div className="px-4 py-3 border-b border-pc-border">
                    <h3 className="text-sm font-semibold text-pc-text flex items-center gap-2"><Users size={14} className="text-pc-accent" />Assign Roles to Users</h3>
                  </div>
                  <div className="divide-y divide-pc-border">
                    {usersList.map((u) => (
                      <div key={u.username} className="px-4 py-3 flex items-center gap-3 hover:bg-pc-elevated/50 transition">
                        <div className="w-8 h-8 rounded bg-pc-elevated border border-pc-border flex items-center justify-center text-pc-accent text-sm font-mono font-semibold">{u.username.charAt(0).toUpperCase()}</div>
                        <p className="text-sm text-pc-text font-medium flex-1">{u.username}</p>
                        {editingRole === u.username ? (
                          <div className="flex items-center gap-2">
                            <select value={editRoleValue} onChange={(e) => setEditRoleValue(e.target.value)} className="px-2 py-1 bg-pc-bg border border-pc-border rounded text-xs font-mono text-pc-text focus:outline-none focus:border-pc-accent transition">
                              <option value="developer">developer</option>
                              <option value="manager">manager</option>
                              <option value="auditor">auditor</option>
                              <option value="admin">admin</option>
                            </select>
                            <button onClick={() => handleUpdateRole(u.username)} className="p-1.5 bg-pc-accent/20 text-pc-accent rounded hover:bg-pc-accent/30 transition" title="Save"><Check size={12} /></button>
                            <button onClick={() => setEditingRole(null)} className="p-1.5 bg-pc-elevated text-pc-muted rounded hover:text-pc-text transition" title="Cancel"><X size={12} /></button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${u.role === "admin" ? "bg-pc-accent/10 text-pc-accent border border-pc-accent/20" : "bg-pc-elevated text-pc-secondary border border-pc-border"}`}>{u.role}</span>
                            {u.username !== user?.username && (
                              <button onClick={() => { setEditingRole(u.username); setEditRoleValue(u.role); }} className="p-1.5 text-pc-muted hover:text-pc-accent hover:bg-pc-accent/10 rounded transition" title="Change role"><Settings size={12} /></button>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* ═══════════════════════════════════════════════════════ */}
            {/* TAB: Git Crawler                                       */}
            {/* ═══════════════════════════════════════════════════════ */}
            {activeTab === "crawler" && (
              <>
                {/* Repo Status */}
                <div className="bg-pc-surface border border-pc-border rounded-lg p-4 mb-6">
                  <h3 className="text-sm font-semibold text-pc-text mb-3 flex items-center gap-2"><GitBranch size={14} className="text-pc-accent" />Repository Status</h3>
                  {crawlerStatus ? (
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { label: "Status", value: crawlerStatus.status, color: crawlerStatus.status === "connected" ? "text-pc-success" : "text-pc-danger" },
                        { label: "Branch", value: crawlerStatus.branch || "—" },
                        { label: "HEAD", value: crawlerStatus.head_sha || "—" },
                        { label: "Last Author", value: crawlerStatus.last_commit_author || "—" },
                        { label: "Last Commit", value: crawlerStatus.last_commit_message || "—" },
                        { label: "Date", value: crawlerStatus.last_commit_date ? new Date(crawlerStatus.last_commit_date).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—" },
                      ].map((s, i) => (
                        <div key={i} className="bg-pc-bg rounded p-2.5 border border-pc-border/50">
                          <p className="text-[10px] text-pc-muted uppercase tracking-wider mb-0.5">{s.label}</p>
                          <p className={`text-xs font-mono truncate ${s.color || "text-pc-text"}`} title={String(s.value)}>{s.value}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-pc-muted">Loading repository status...</p>
                  )}
                </div>

                {/* Trigger Crawler */}
                <div className="bg-pc-surface border border-pc-border rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-pc-text mb-3 flex items-center gap-2"><Play size={14} className="text-pc-accent" />Trigger Crawler</h3>
                  <p className="text-[11px] text-pc-muted mb-3">Paste a local path or remote Git URL to clone/pull and re-index.</p>
                  <div className="flex items-end gap-3 mb-3">
                    <div className="flex-1">
                      <label className="block text-[10px] text-pc-muted uppercase tracking-wider mb-1 font-medium">Repository Path or Git URL</label>
                      <input value={crawlRepoPath} onChange={(e) => setCrawlRepoPath(e.target.value)} placeholder="~/my-project  or  https://github.com/user/repo.git" className="w-full px-3 py-1.5 bg-pc-bg border border-pc-border rounded text-xs font-mono text-pc-text focus:outline-none focus:border-pc-accent transition placeholder:text-pc-muted/50" />
                    </div>
                    <button onClick={handleTriggerCrawler} disabled={crawling || !crawlRepoPath.trim()} className="px-4 py-1.5 bg-pc-accent text-[#0d1117] text-xs font-medium rounded hover:bg-pc-accent-hover transition disabled:opacity-50 whitespace-nowrap flex items-center gap-1.5">
                      {crawling ? <><RefreshCw size={12} className="animate-spin" />Crawling...</> : <><Play size={12} />Start Crawler</>}
                    </button>
                  </div>
                  {crawlResult && (
                    <div className={`px-3 py-2 rounded text-xs font-mono ${crawlResult.status === "success" ? "bg-pc-success/10 text-pc-success border border-pc-success/20" : "bg-pc-danger/10 text-pc-danger border border-pc-danger/20"}`}>
                      {crawlResult.message}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* ═══════════════════════════════════════════════════════ */}
            {/* TAB: Redis Knowledge Base                               */}
            {/* ═══════════════════════════════════════════════════════ */}
            {activeTab === "redis" && (
              <>
                {/* Stats */}
                <div className="bg-pc-surface border border-pc-border rounded-lg p-4 mb-6">
                  <h3 className="text-sm font-semibold text-pc-text mb-3 flex items-center gap-2"><Database size={14} className="text-pc-accent" />Knowledge Base Statistics</h3>
                  {redisStats ? (
                    <div className="grid grid-cols-4 gap-3">
                      {[
                        { label: "Status", value: redisStats.status, color: redisStats.status === "connected" ? "text-pc-success" : "text-pc-danger" },
                        { label: "Indexed Docs", value: redisStats.indexed_documents },
                        { label: "Total Keys", value: redisStats.total_keys },
                        { label: "Memory Used", value: redisStats.used_memory_human },
                        { label: "Redis Version", value: redisStats.redis_version },
                        { label: "Connected Clients", value: redisStats.connected_clients },
                        { label: "Uptime", value: formatUptime(redisStats.uptime_seconds) },
                        { label: "Memory (bytes)", value: (redisStats.used_memory_bytes || 0).toLocaleString() },
                      ].map((s, i) => (
                        <div key={i} className="bg-pc-bg rounded p-2.5 border border-pc-border/50">
                          <p className="text-[10px] text-pc-muted uppercase tracking-wider mb-0.5">{s.label}</p>
                          <p className={`text-sm font-mono font-semibold truncate ${s.color || "text-pc-text"}`}>{s.value}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-pc-muted">Loading Redis stats...</p>
                  )}
                </div>

                {/* Actions */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-pc-surface border border-pc-border rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-pc-text mb-2 flex items-center gap-2"><RefreshCw size={14} className="text-pc-accent" />Re-index</h3>
                    <p className="text-[11px] text-pc-muted mb-3">Rebuild the entire knowledge base from the current repository.</p>
                    <button onClick={handleReindexRedis} disabled={reindexing} className="px-4 py-1.5 bg-pc-accent text-[#0d1117] text-xs font-medium rounded hover:bg-pc-accent-hover transition disabled:opacity-50 flex items-center gap-1.5">
                      {reindexing ? <><RefreshCw size={12} className="animate-spin" />Re-indexing...</> : "Force Re-index"}
                    </button>
                  </div>
                  <div className="bg-pc-surface border border-pc-danger/30 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-pc-text mb-2 flex items-center gap-2"><AlertTriangle size={14} className="text-pc-danger" />Flush Database</h3>
                    <p className="text-[11px] text-pc-muted mb-3">Clear all data from the knowledge base. This action is irreversible.</p>
                    {flushConfirm ? (
                      <div className="flex items-center gap-2">
                        <button onClick={handleFlushRedis} disabled={flushing} className="px-4 py-1.5 bg-pc-danger text-white text-xs font-medium rounded hover:bg-pc-danger/80 transition disabled:opacity-50">
                          {flushing ? "Flushing..." : "Confirm Flush"}
                        </button>
                        <button onClick={() => setFlushConfirm(false)} className="px-4 py-1.5 bg-pc-elevated text-pc-secondary text-xs rounded hover:text-pc-text transition border border-pc-border">Cancel</button>
                      </div>
                    ) : (
                      <button onClick={() => setFlushConfirm(true)} className="px-4 py-1.5 bg-pc-danger/20 text-pc-danger text-xs font-medium rounded hover:bg-pc-danger/30 transition">Flush All Data</button>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* ═══════════════════════════════════════════════════════ */}
            {/* TAB: Security Policies                                 */}
            {/* ═══════════════════════════════════════════════════════ */}
            {activeTab === "security" && (
              <>
                {policyDraft ? (
                  <div className="bg-pc-surface border border-pc-border rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-pc-text mb-4 flex items-center gap-2"><Shield size={14} className="text-pc-accent" />Security Configuration</h3>
                    <div className="space-y-4">
                      {/* Numeric policies */}
                      {[
                        { key: "max_session_hours", label: "Max Session Duration (hours)", desc: "Automatically log out users after this duration" },
                        { key: "min_password_length", label: "Minimum Password Length", desc: "Minimum characters required for new passwords" },
                        { key: "max_failed_logins", label: "Max Failed Login Attempts", desc: "Lock account after this many consecutive failures" },
                        { key: "audit_log_retention_days", label: "Audit Log Retention (days)", desc: "Number of days to retain audit log entries" },
                      ].map(({ key, label, desc }) => (
                        <div key={key} className="flex items-center justify-between py-2 border-b border-pc-border/50">
                          <div>
                            <p className="text-xs text-pc-text font-medium">{label}</p>
                            <p className="text-[10px] text-pc-muted">{desc}</p>
                          </div>
                          <input
                            type="number"
                            value={policyDraft[key] ?? ""}
                            onChange={(e) => setPolicyDraft({ ...policyDraft, [key]: parseInt(e.target.value) || 0 })}
                            className="w-24 px-2 py-1 bg-pc-bg border border-pc-border rounded text-xs font-mono text-pc-text text-right focus:outline-none focus:border-pc-accent transition"
                          />
                        </div>
                      ))}

                      {/* Boolean toggles */}
                      {[
                        { key: "enforce_mfa", label: "Enforce Multi-Factor Authentication", desc: "Require MFA for all user logins" },
                        { key: "ip_whitelist_enabled", label: "IP Whitelist Enabled", desc: "Restrict access to whitelisted IP addresses only" },
                        { key: "allow_public_repos", label: "Allow Public Repositories", desc: "Permit indexing of public remote Git repositories" },
                      ].map(({ key, label, desc }) => (
                        <div key={key} className="flex items-center justify-between py-2 border-b border-pc-border/50">
                          <div>
                            <p className="text-xs text-pc-text font-medium">{label}</p>
                            <p className="text-[10px] text-pc-muted">{desc}</p>
                          </div>
                          <button
                            onClick={() => setPolicyDraft({ ...policyDraft, [key]: !policyDraft[key] })}
                            className={`w-10 h-5 rounded-full transition relative ${policyDraft[key] ? "bg-pc-accent" : "bg-pc-elevated border border-pc-border"}`}
                          >
                            <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${policyDraft[key] ? "left-5" : "left-0.5"}`} />
                          </button>
                        </div>
                      ))}

                      {/* IP Whitelist input - only show when enabled */}
                      {policyDraft.ip_whitelist_enabled && (
                        <div className="py-2">
                          <p className="text-xs text-pc-text font-medium mb-1">IP Whitelist (comma-separated)</p>
                          <input
                            value={(policyDraft.ip_whitelist || []).join(", ")}
                            onChange={(e) => setPolicyDraft({ ...policyDraft, ip_whitelist: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
                            placeholder="192.168.1.0, 10.0.0.1"
                            className="w-full px-3 py-1.5 bg-pc-bg border border-pc-border rounded text-xs font-mono text-pc-text focus:outline-none focus:border-pc-accent transition placeholder:text-pc-muted/50"
                          />
                        </div>
                      )}
                    </div>

                    <div className="mt-6 flex items-center gap-3">
                      <button onClick={handleSavePolicies} disabled={savingPolicies} className="px-4 py-1.5 bg-pc-accent text-[#0d1117] text-xs font-medium rounded hover:bg-pc-accent-hover transition disabled:opacity-50">
                        {savingPolicies ? "Saving..." : "Save Policies"}
                      </button>
                      <button onClick={() => setPolicyDraft(policies)} className="px-4 py-1.5 bg-pc-elevated text-pc-secondary text-xs rounded hover:text-pc-text transition border border-pc-border">Reset</button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-16 text-pc-muted text-sm">Loading security policies...</div>
                )}
              </>
            )}

            {/* ═══════════════════════════════════════════════════════ */}
            {/* TAB: Audit Logs                                        */}
            {/* ═══════════════════════════════════════════════════════ */}
            {activeTab === "audit" && (
              <>
                {/* Filters */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="relative flex-1 max-w-xs">
                    <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-pc-muted" />
                    <input value={auditFilter} onChange={(e) => setAuditFilter(e.target.value)} placeholder="Search by user, action, query..." className="w-full pl-7 pr-3 py-1.5 bg-pc-bg border border-pc-border rounded text-xs font-mono text-pc-text focus:outline-none focus:border-pc-accent transition placeholder:text-pc-muted/50" />
                  </div>
                  <select value={auditActionFilter} onChange={(e) => setAuditActionFilter(e.target.value)} className="px-3 py-1.5 bg-pc-bg border border-pc-border rounded text-xs font-mono text-pc-text focus:outline-none focus:border-pc-accent transition">
                    <option value="all">All Actions</option>
                    {uniqueActions.map((a) => <option key={a} value={a}>{a}</option>)}
                  </select>
                  <span className="text-[10px] text-pc-muted bg-pc-elevated px-1.5 py-0.5 rounded">{filteredLogs.length} entries</span>
                </div>

                {/* Log Entries */}
                <div className="bg-pc-surface border border-pc-border rounded-lg overflow-hidden">
                  {filteredLogs.length === 0 ? (
                    <div className="text-center py-16 text-pc-muted text-sm">
                      <FileText size={32} className="mx-auto mb-3 opacity-40" />
                      <p>{auditFilter || auditActionFilter !== "all" ? "No logs match your filter" : "No audit logs recorded yet"}</p>
                    </div>
                  ) : (
                    <div className="max-h-[600px] overflow-y-auto divide-y divide-pc-border">
                      {filteredLogs.slice(0, 100).map((log, i) => (
                        <div key={i} className="px-4 py-2.5 hover:bg-pc-elevated/50 transition">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${log.status === "SUCCESS" ? "bg-pc-success" : log.status === "ERROR" ? "bg-pc-danger" : "bg-pc-warning"}`} />
                            <span className="text-xs font-medium text-pc-text">{log.action}</span>
                            <span className="text-[10px] text-pc-muted">by</span>
                            <span className="text-xs font-mono text-pc-accent">{log.user}</span>
                            <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ml-1 ${log.status === "SUCCESS" ? "bg-pc-success/10 text-pc-success" : log.status === "FAILED" ? "bg-pc-warning/10 text-pc-warning" : "bg-pc-danger/10 text-pc-danger"}`}>{log.status}</span>
                            <span className="text-[10px] text-pc-muted ml-auto">{log.timestamp ? new Date(log.timestamp + "Z").toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" }) : ""}</span>
                          </div>
                          {log.query && <p className="text-[11px] text-pc-secondary ml-3.5 truncate" title={log.query}>Query: {log.query}</p>}
                          {log.details && Object.keys(log.details).length > 0 && (
                            <p className="text-[10px] text-pc-muted ml-3.5 truncate font-mono" title={JSON.stringify(log.details)}>{JSON.stringify(log.details)}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* ═══════════════════════════════════════════════════════ */}
            {/* TAB: System Performance                                */}
            {/* ═══════════════════════════════════════════════════════ */}
            {activeTab === "performance" && (
              <>
                {perfData ? (
                  <>
                    {/* Main metrics */}
                    <div className="grid grid-cols-4 gap-4 mb-6">
                      <div className="bg-pc-surface border border-pc-border rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Cpu size={14} className="text-pc-accent" />
                          <p className="text-[10px] text-pc-muted uppercase tracking-wider font-medium">CPU Usage</p>
                        </div>
                        <p className="text-2xl font-mono font-semibold text-pc-text">{perfData.cpu_percent}%</p>
                        <div className="mt-2 w-full h-1.5 bg-pc-elevated rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${perfData.cpu_percent > 80 ? "bg-pc-danger" : perfData.cpu_percent > 50 ? "bg-pc-warning" : "bg-pc-success"}`} style={{ width: `${perfData.cpu_percent}%` }} />
                        </div>
                      </div>
                      <div className="bg-pc-surface border border-pc-border rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <MemoryStick size={14} className="text-pc-accent" />
                          <p className="text-[10px] text-pc-muted uppercase tracking-wider font-medium">Memory</p>
                        </div>
                        <p className="text-2xl font-mono font-semibold text-pc-text">{perfData.memory.percent}%</p>
                        <p className="text-[10px] text-pc-muted mt-1">{perfData.memory.used_gb} / {perfData.memory.total_gb} GB</p>
                        <div className="mt-1 w-full h-1.5 bg-pc-elevated rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${perfData.memory.percent > 85 ? "bg-pc-danger" : perfData.memory.percent > 60 ? "bg-pc-warning" : "bg-pc-success"}`} style={{ width: `${perfData.memory.percent}%` }} />
                        </div>
                      </div>
                      <div className="bg-pc-surface border border-pc-border rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <HardDrive size={14} className="text-pc-accent" />
                          <p className="text-[10px] text-pc-muted uppercase tracking-wider font-medium">Disk</p>
                        </div>
                        <p className="text-2xl font-mono font-semibold text-pc-text">{perfData.disk.percent}%</p>
                        <p className="text-[10px] text-pc-muted mt-1">{perfData.disk.used_gb} / {perfData.disk.total_gb} GB</p>
                        <div className="mt-1 w-full h-1.5 bg-pc-elevated rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${perfData.disk.percent > 90 ? "bg-pc-danger" : perfData.disk.percent > 70 ? "bg-pc-warning" : "bg-pc-success"}`} style={{ width: `${perfData.disk.percent}%` }} />
                        </div>
                      </div>
                      <div className="bg-pc-surface border border-pc-border rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Clock size={14} className="text-pc-accent" />
                          <p className="text-[10px] text-pc-muted uppercase tracking-wider font-medium">Server Uptime</p>
                        </div>
                        <p className="text-2xl font-mono font-semibold text-pc-text">{formatUptime(perfData.server_uptime_seconds)}</p>
                      </div>
                    </div>

                    {/* Secondary stats */}
                    <div className="grid grid-cols-3 gap-4">
                      <div className="bg-pc-surface border border-pc-border rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Users size={14} className="text-pc-success" />
                          <p className="text-[10px] text-pc-muted uppercase tracking-wider font-medium">Online Users</p>
                        </div>
                        <p className="text-2xl font-mono font-semibold text-pc-success">{perfData.online_users}</p>
                        <p className="text-[10px] text-pc-muted mt-1">{perfData.total_users} total registered</p>
                      </div>
                      <div className="bg-pc-surface border border-pc-border rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Search size={14} className="text-pc-warning" />
                          <p className="text-[10px] text-pc-muted uppercase tracking-wider font-medium">Total Queries</p>
                        </div>
                        <p className="text-2xl font-mono font-semibold text-pc-text">{perfData.total_queries}</p>
                      </div>
                      <div className="bg-pc-surface border border-pc-border rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Activity size={14} className="text-pc-accent" />
                          <p className="text-[10px] text-pc-muted uppercase tracking-wider font-medium">System Status</p>
                        </div>
                        <p className="text-sm font-mono font-semibold text-pc-success flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-pc-success" />System Healthy
                        </p>
                        <p className="text-[10px] text-pc-muted mt-1">Auto-refreshing every 5s</p>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-16 text-pc-muted text-sm">Loading performance data...</div>
                )}
              </>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
