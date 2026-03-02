"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getDevActivity, logoutSession } from "@/lib/api";
import { auth } from "@/lib/auth";
import {
  LogOut,
  Menu,
  X,
  MessageCircle,
  Terminal,
  Users,
  Activity,
  Clock,
  Search,
  RefreshCw,
  ArrowLeft,
  FolderGit2,
} from "lucide-react";

export default function ActivityPage() {
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const [devActivity, setDevActivity] = useState([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [searchFilter, setSearchFilter] = useState("");

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

  // Fetch developer activity
  const fetchActivity = useCallback(async () => {
    if (!isAdmin) return;
    setActivityLoading(true);
    try {
      const res = await getDevActivity();
      setDevActivity(res.data?.developers || []);
    } catch {
      setDevActivity([]);
    } finally {
      setActivityLoading(false);
    }
  }, [isAdmin]);

  // Auto-refresh every 15s
  useEffect(() => {
    if (!isAdmin) return;
    fetchActivity();
    const interval = setInterval(fetchActivity, 15000);
    return () => clearInterval(interval);
  }, [isAdmin, fetchActivity]);

  const handleLogout = async () => {
    try { await logoutSession(); } catch {}
    auth.logout();
  };

  // Filter developers by search
  const filteredDevs = devActivity.filter((dev) =>
    dev.username.toLowerCase().includes(searchFilter.toLowerCase())
  );

  // Stats
  const totalQueries = devActivity.reduce((sum, d) => sum + (d.total_queries || 0), 0);
  const onlineCount = devActivity.filter((d) => d.status === "online").length;

  if (!mounted || !user) return null;

  return (
    <div className="flex h-screen bg-pc-bg">
      {/* ── SIDEBAR ── */}
      <div
        className={`${
          sidebarOpen ? "w-60" : "w-0"
        } bg-pc-surface border-r border-pc-border flex flex-col transition-all duration-200 overflow-hidden flex-shrink-0`}
      >
        {/* Logo */}
        <div className="h-14 px-4 flex items-center gap-2 border-b border-pc-border flex-shrink-0">
          <div className="w-6 h-6 border border-pc-accent rounded flex items-center justify-center">
            <span className="font-mono text-pc-accent text-[10px] font-semibold">&gt;_</span>
          </div>
          <span className="text-sm font-semibold text-pc-text tracking-tight">PrivCode</span>
        </div>

        {/* Navigation */}
        <div className="p-3 flex-shrink-0 space-y-1">
          <button
            onClick={() => router.push("/chat")}
            className="w-full px-3 py-2 bg-pc-elevated border border-pc-border rounded text-xs text-pc-secondary hover:text-pc-text hover:bg-pc-hover transition flex items-center gap-2"
          >
            <MessageCircle size={13} />
            Back to Chat
            <ArrowLeft size={12} className="ml-auto" />
          </button>
        </div>

        {/* Activity nav label */}
        <div className="px-3 flex-1">
          <p className="text-[10px] text-pc-muted uppercase tracking-wider px-2 py-2 font-medium">
            Admin
          </p>
          <div className="w-full px-2 py-1.5 bg-pc-accent/10 border border-pc-accent/30 rounded text-xs text-pc-accent flex items-center gap-1.5">
            <Users size={12} />
            <span>Developer Activity</span>
            <Activity size={12} className="ml-auto" />
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
          <button
            onClick={handleLogout}
            className="w-full px-3 py-1.5 text-pc-muted hover:text-pc-danger hover:bg-[rgba(248,81,73,0.08)] rounded transition flex items-center gap-2 text-xs"
          >
            <LogOut size={13} />
            Sign out
          </button>
        </div>
      </div>

      {/* ── MAIN ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <div className="h-14 border-b border-pc-border bg-pc-surface px-4 flex items-center gap-3 flex-shrink-0">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1.5 hover:bg-pc-elevated rounded transition text-pc-secondary hover:text-pc-text"
          >
            {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
          </button>

          <div className="h-5 w-px bg-pc-border" />

          <div className="flex items-center gap-2">
            <Users size={14} className="text-pc-accent" />
            <span className="text-sm text-pc-text font-medium">Developer Activity</span>
          </div>

          <div className="ml-auto flex items-center gap-2 text-xs text-pc-muted">
            <div className="flex items-center gap-1.5 px-2 py-1 bg-pc-elevated rounded border border-pc-border">
              <Activity size={12} />
              <span className="font-mono">Admin Dashboard</span>
            </div>
          </div>
        </div>

        {/* ── Content ── */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-5xl mx-auto px-6 py-6">

            {/* Summary Cards */}
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

            {/* Header + Controls */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Users size={16} className="text-pc-accent" />
                <h3 className="text-sm font-semibold text-pc-text">All Developers</h3>
                <span className="text-[10px] text-pc-muted bg-pc-elevated px-1.5 py-0.5 rounded">
                  {filteredDevs.length} developer{filteredDevs.length !== 1 ? "s" : ""}
                </span>
              </div>
              <div className="flex items-center gap-3">
                {/* Search */}
                <div className="relative">
                  <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-pc-muted" />
                  <input
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    placeholder="Filter developers..."
                    className="pl-7 pr-3 py-1.5 bg-pc-bg border border-pc-border rounded text-xs font-mono text-pc-text focus:outline-none focus:border-pc-accent transition placeholder:text-pc-muted/50 w-48"
                  />
                </div>
                <button
                  onClick={fetchActivity}
                  disabled={activityLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-pc-muted hover:text-pc-accent bg-pc-elevated border border-pc-border rounded transition"
                >
                  <RefreshCw size={11} className={activityLoading ? "animate-spin" : ""} />
                  Refresh
                </button>
              </div>
            </div>

            {/* Developer Cards */}
            {filteredDevs.length === 0 ? (
              <div className="text-center py-16">
                <Users size={32} className="text-pc-muted mx-auto mb-3 opacity-40" />
                <p className="text-sm text-pc-muted">
                  {searchFilter ? "No developers match your filter" : "No developer activity yet"}
                </p>
                <p className="text-[11px] text-pc-muted mt-1">
                  {searchFilter ? "Try a different search term" : "Activity will appear once developers log in"}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredDevs.map((dev) => (
                  <div key={dev.username} className="bg-pc-surface border border-pc-border rounded-lg p-4">
                    {/* Developer Header */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded bg-pc-elevated border border-pc-border flex items-center justify-center text-pc-accent text-sm font-mono font-semibold">
                          {dev.username.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-pc-text">{dev.username}</p>
                          <p className="text-[10px] text-pc-muted">{dev.role}</p>
                        </div>
                        <span className={`ml-2 inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-medium ${
                          dev.status === "online"
                            ? "bg-pc-success/10 text-pc-success border border-pc-success/20"
                            : "bg-pc-muted/10 text-pc-muted border border-pc-border"
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${dev.status === "online" ? "bg-pc-success" : "bg-pc-muted"}`} />
                          {dev.status}
                        </span>
                      </div>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-4 gap-2 mb-3">
                      <div className="bg-pc-bg rounded p-2.5 border border-pc-border/50">
                        <p className="text-[10px] text-pc-muted uppercase tracking-wider mb-0.5">Queries</p>
                        <p className="text-sm font-mono font-semibold text-pc-text">{dev.total_queries}</p>
                      </div>
                      <div className="bg-pc-bg rounded p-2.5 border border-pc-border/50">
                        <p className="text-[10px] text-pc-muted uppercase tracking-wider mb-0.5">Indexed</p>
                        <p className="text-sm font-mono font-semibold text-pc-text">{dev.total_indexing}</p>
                      </div>
                      <div className="bg-pc-bg rounded p-2.5 border border-pc-border/50">
                        <p className="text-[10px] text-pc-muted uppercase tracking-wider mb-0.5">Current Repo</p>
                        <p className="text-xs font-mono text-pc-accent truncate" title={dev.current_repo}>
                          {dev.current_repo ? dev.current_repo.replace(/\.git$/, "").split("/").filter(Boolean).pop() : "—"}
                        </p>
                      </div>
                      <div className="bg-pc-bg rounded p-2.5 border border-pc-border/50">
                        <p className="text-[10px] text-pc-muted uppercase tracking-wider mb-0.5">Last Active</p>
                        <p className="text-xs font-mono text-pc-secondary">
                          {dev.last_active ? new Date(dev.last_active + "Z").toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}
                        </p>
                      </div>
                    </div>

                    {/* Session Times */}
                    <div className="flex items-center gap-4 text-[10px] text-pc-muted mb-3">
                      <span className="flex items-center gap-1">
                        <Clock size={10} />
                        Login: {dev.last_login ? new Date(dev.last_login + "Z").toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}
                      </span>
                      <span className="flex items-center gap-1">
                        <LogOut size={10} />
                        Logout: {dev.last_logout ? new Date(dev.last_logout + "Z").toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}
                      </span>
                    </div>

                    {/* Recent Queries */}
                    {dev.recent_queries && dev.recent_queries.length > 0 && (
                      <div>
                        <p className="text-[10px] text-pc-muted uppercase tracking-wider mb-1.5 flex items-center gap-1">
                          <Search size={10} />
                          Recent Queries
                        </p>
                        <div className="space-y-1 max-h-40 overflow-y-auto">
                          {dev.recent_queries.slice().reverse().slice(0, 5).map((q, i) => (
                            <div key={i} className="flex items-center gap-2 text-[11px] bg-pc-bg rounded px-2.5 py-1.5 border border-pc-border/30">
                              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${q.status === "SUCCESS" ? "bg-pc-success" : "bg-pc-danger"}`} />
                              <span className="text-pc-text truncate flex-1" title={q.query}>{q.query}</span>
                              <span className="text-pc-muted flex-shrink-0 uppercase text-[9px]">{q.mode}</span>
                              <span className="text-pc-muted flex-shrink-0">
                                {new Date(q.timestamp + "Z").toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
