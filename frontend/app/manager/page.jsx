"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  getTeamMembers,
  getQueryHistory,
  getUsageAnalytics,
  getActivityReport,
  getProjectDocs,
  logoutSession,
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
  Shield,
  FileText,
  ChevronRight,
  BarChart3,
  Eye,
  BookOpen,
  TrendingUp,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

// ── Sidebar nav items ──
const NAV_ITEMS = [
  { key: "members", label: "Team Members", icon: Users },
  { key: "queries", label: "Query History", icon: Search },
  { key: "analytics", label: "Usage Analytics", icon: BarChart3 },
  { key: "docs", label: "Project Documentation", icon: BookOpen },
  { key: "reports", label: "Activity Reports", icon: FileText },
];

export default function ManagerPage() {
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState("members");

  // ── Team Members state ──
  const [members, setMembers] = useState([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [memberFilter, setMemberFilter] = useState("");

  // ── Query History state ──
  const [queryHistory, setQueryHistory] = useState([]);
  const [queryLoading, setQueryLoading] = useState(false);
  const [queryUserFilter, setQueryUserFilter] = useState("");
  const [queryStatusFilter, setQueryStatusFilter] = useState("all");
  const [expandedQuery, setExpandedQuery] = useState(null);

  // ── Analytics state ──
  const [analytics, setAnalytics] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  // ── Docs state ──
  const [docs, setDocs] = useState([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [expandedDoc, setExpandedDoc] = useState(null);

  // ── Reports state ──
  const [report, setReport] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);

  // ── Init ──
  useEffect(() => {
    setMounted(true);
    if (!auth.isAuthenticated()) {
      router.push("/login");
      return;
    }
    const u = auth.getUser();
    if (u?.role !== "manager" && u?.role !== "admin") {
      router.push("/chat");
      return;
    }
    setUser(u);
  }, [router]);

  const isAllowed = user?.role === "manager" || user?.role === "admin";

  // ── Fetchers ──
  const fetchMembers = useCallback(async () => {
    if (!isAllowed) return;
    setMembersLoading(true);
    try {
      const res = await getTeamMembers();
      setMembers(res.data?.members || []);
    } catch { setMembers([]); }
    finally { setMembersLoading(false); }
  }, [isAllowed]);

  const fetchQueries = useCallback(async () => {
    if (!isAllowed) return;
    setQueryLoading(true);
    try {
      const res = await getQueryHistory(null, 100);
      setQueryHistory(res.data?.history || []);
    } catch { setQueryHistory([]); }
    finally { setQueryLoading(false); }
  }, [isAllowed]);

  const fetchAnalytics = useCallback(async () => {
    if (!isAllowed) return;
    setAnalyticsLoading(true);
    try {
      const res = await getUsageAnalytics();
      setAnalytics(res.data);
    } catch { setAnalytics(null); }
    finally { setAnalyticsLoading(false); }
  }, [isAllowed]);

  const fetchDocs = useCallback(async () => {
    if (!isAllowed) return;
    setDocsLoading(true);
    try {
      const res = await getProjectDocs();
      setDocs(res.data?.docs || []);
    } catch { setDocs([]); }
    finally { setDocsLoading(false); }
  }, [isAllowed]);

  const fetchReport = useCallback(async () => {
    if (!isAllowed) return;
    setReportLoading(true);
    try {
      const res = await getActivityReport();
      setReport(res.data);
    } catch { setReport(null); }
    finally { setReportLoading(false); }
  }, [isAllowed]);

  // ── Load data when tab changes ──
  useEffect(() => {
    if (!isAllowed) return;
    const fetchers = {
      members: fetchMembers,
      queries: fetchQueries,
      analytics: fetchAnalytics,
      docs: fetchDocs,
      reports: fetchReport,
    };
    fetchers[activeTab]?.();
  }, [activeTab, isAllowed, fetchMembers, fetchQueries, fetchAnalytics, fetchDocs, fetchReport]);

  // Auto-refresh members every 15s
  useEffect(() => {
    if (!isAllowed || activeTab !== "members") return;
    const iv = setInterval(fetchMembers, 15000);
    return () => clearInterval(iv);
  }, [activeTab, isAllowed, fetchMembers]);

  // ── Actions ──
  const handleLogout = async () => {
    try { await logoutSession(); } catch {}
    auth.logout();
  };

  // ── Derived data ──
  const filteredMembers = members.filter((m) =>
    m.username.toLowerCase().includes(memberFilter.toLowerCase())
  );

  const filteredQueries = queryHistory.filter((q) => {
    const matchUser = queryUserFilter === "" ||
      q.username.toLowerCase().includes(queryUserFilter.toLowerCase());
    const matchStatus = queryStatusFilter === "all" || q.status === queryStatusFilter;
    return matchUser && matchStatus;
  });

  const uniqueQueryUsers = [...new Set(queryHistory.map((q) => q.username))];

  const refreshMap = {
    members: fetchMembers, queries: fetchQueries, analytics: fetchAnalytics,
    docs: fetchDocs, reports: fetchReport,
  };
  const currentLoading = {
    members: membersLoading, queries: queryLoading, analytics: analyticsLoading,
    docs: docsLoading, reports: reportLoading,
  };

  if (!mounted || !user) return null;

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
          <p className="text-[10px] text-pc-muted uppercase tracking-wider px-2 py-2 font-medium">Team Manager</p>
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
              <p className="text-[10px] text-pc-muted">manager</p>
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
              <span className="font-mono">Team Dashboard</span>
            </div>
          </div>
        </div>

        {/* ── Content ── */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-5xl mx-auto px-6 py-6">

            {/* ═══════════════════════════════════════════════ */}
            {/* TAB: Team Members                               */}
            {/* ═══════════════════════════════════════════════ */}
            {activeTab === "members" && (
              <>
                {/* Summary cards */}
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="bg-pc-surface border border-pc-border rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Users size={14} className="text-pc-accent" />
                      <p className="text-[10px] text-pc-muted uppercase tracking-wider font-medium">Team Size</p>
                    </div>
                    <p className="text-2xl font-mono font-semibold text-pc-text">{members.length}</p>
                  </div>
                  <div className="bg-pc-surface border border-pc-border rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Activity size={14} className="text-pc-success" />
                      <p className="text-[10px] text-pc-muted uppercase tracking-wider font-medium">Online Now</p>
                    </div>
                    <p className="text-2xl font-mono font-semibold text-pc-success">{members.filter((m) => m.status === "online").length}</p>
                  </div>
                  <div className="bg-pc-surface border border-pc-border rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Search size={14} className="text-pc-warning" />
                      <p className="text-[10px] text-pc-muted uppercase tracking-wider font-medium">Total Queries</p>
                    </div>
                    <p className="text-2xl font-mono font-semibold text-pc-text">{members.reduce((s, m) => s + (m.total_queries || 0), 0)}</p>
                  </div>
                </div>

                {/* Filter */}
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-pc-text flex items-center gap-2">
                    <Users size={14} className="text-pc-accent" />Team Developers
                    <span className="text-[10px] text-pc-muted bg-pc-elevated px-1.5 py-0.5 rounded">{filteredMembers.length}</span>
                  </h3>
                  <div className="relative">
                    <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-pc-muted" />
                    <input value={memberFilter} onChange={(e) => setMemberFilter(e.target.value)} placeholder="Filter members..." className="pl-7 pr-3 py-1.5 bg-pc-bg border border-pc-border rounded text-xs font-mono text-pc-text focus:outline-none focus:border-pc-accent transition placeholder:text-pc-muted/50 w-48" />
                  </div>
                </div>

                {filteredMembers.length === 0 ? (
                  <div className="text-center py-16">
                    <Users size={32} className="text-pc-muted mx-auto mb-3 opacity-40" />
                    <p className="text-sm text-pc-muted">{memberFilter ? "No members match your filter" : "No developer activity recorded yet"}</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredMembers.map((dev) => (
                      <div key={dev.username} className="bg-pc-surface border border-pc-border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded bg-pc-elevated border border-pc-border flex items-center justify-center text-pc-accent text-sm font-mono font-semibold">{dev.username.charAt(0).toUpperCase()}</div>
                            <div>
                              <p className="text-sm font-medium text-pc-text">{dev.username}</p>
                              <p className="text-[10px] text-pc-muted">developer</p>
                            </div>
                            <span className={`ml-2 inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-medium ${dev.status === "online" ? "bg-pc-success/10 text-pc-success border border-pc-success/20" : "bg-pc-muted/10 text-pc-muted border border-pc-border"}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${dev.status === "online" ? "bg-pc-success" : "bg-pc-muted"}`} />
                              {dev.status}
                            </span>
                          </div>
                          <div className="text-[10px] text-pc-muted flex items-center gap-1">
                            <Clock size={10} />
                            {dev.last_active ? new Date(dev.last_active + "Z").toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}
                          </div>
                        </div>
                        <div className="grid grid-cols-4 gap-2 mb-3">
                          {[
                            { label: "Queries", value: dev.total_queries || 0 },
                            { label: "Indexed", value: dev.total_indexing || 0 },
                            { label: "Current Repo", value: dev.current_repo ? dev.current_repo.replace(/\.git$/, "").split("/").filter(Boolean).pop() : "—", accent: true },
                            { label: "Last Login", value: dev.last_login ? new Date(dev.last_login + "Z").toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—" },
                          ].map((s, i) => (
                            <div key={i} className="bg-pc-bg rounded p-2.5 border border-pc-border/50">
                              <p className="text-[10px] text-pc-muted uppercase tracking-wider mb-0.5">{s.label}</p>
                              <p className={`text-sm font-mono font-semibold truncate ${s.accent ? "text-pc-accent text-xs" : "text-pc-text"}`}>{s.value}</p>
                            </div>
                          ))}
                        </div>
                        {/* Recent queries preview */}
                        {dev.recent_queries?.length > 0 && (
                          <div>
                            <p className="text-[10px] text-pc-muted uppercase tracking-wider mb-1.5 flex items-center gap-1"><Search size={10} />Recent Queries</p>
                            <div className="space-y-1 max-h-28 overflow-y-auto">
                              {dev.recent_queries.slice().reverse().slice(0, 3).map((q, i) => (
                                <div key={i} className="flex items-center gap-2 text-[11px] bg-pc-bg rounded px-2.5 py-1.5 border border-pc-border/30">
                                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${q.status === "SUCCESS" ? "bg-pc-success" : "bg-pc-danger"}`} />
                                  <span className="text-pc-text truncate flex-1" title={q.query}>{q.query}</span>
                                  <span className="text-pc-muted flex-shrink-0 uppercase text-[9px]">{q.mode}</span>
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

            {/* ═══════════════════════════════════════════════ */}
            {/* TAB: Query History + Responses                  */}
            {/* ═══════════════════════════════════════════════ */}
            {activeTab === "queries" && (
              <>
                {/* Filters */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="relative flex-1 max-w-xs">
                    <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-pc-muted" />
                    <input value={queryUserFilter} onChange={(e) => setQueryUserFilter(e.target.value)} placeholder="Filter by developer..." className="w-full pl-7 pr-3 py-1.5 bg-pc-bg border border-pc-border rounded text-xs font-mono text-pc-text focus:outline-none focus:border-pc-accent transition placeholder:text-pc-muted/50" />
                  </div>
                  <select value={queryStatusFilter} onChange={(e) => setQueryStatusFilter(e.target.value)} className="px-3 py-1.5 bg-pc-bg border border-pc-border rounded text-xs font-mono text-pc-text focus:outline-none focus:border-pc-accent transition">
                    <option value="all">All Statuses</option>
                    <option value="SUCCESS">Success</option>
                    <option value="ERROR">Error</option>
                  </select>
                  <span className="text-[10px] text-pc-muted bg-pc-elevated px-1.5 py-0.5 rounded">{filteredQueries.length} queries</span>
                </div>

                {filteredQueries.length === 0 ? (
                  <div className="text-center py-16">
                    <Search size={32} className="text-pc-muted mx-auto mb-3 opacity-40" />
                    <p className="text-sm text-pc-muted">No query history available</p>
                    <p className="text-[11px] text-pc-muted mt-1">Query history appears once developers start making queries</p>
                  </div>
                ) : (
                  <div className="bg-pc-surface border border-pc-border rounded-lg overflow-hidden">
                    <div className="max-h-[650px] overflow-y-auto divide-y divide-pc-border">
                      {filteredQueries.map((q, i) => (
                        <div key={i} className="hover:bg-pc-elevated/50 transition">
                          <button
                            onClick={() => setExpandedQuery(expandedQuery === i ? null : i)}
                            className="w-full px-4 py-3 flex items-center gap-2 text-left"
                          >
                            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${q.status === "SUCCESS" ? "bg-pc-success" : "bg-pc-danger"}`} />
                            <span className="text-xs font-mono text-pc-accent flex-shrink-0">{q.username}</span>
                            <span className="text-xs text-pc-text truncate flex-1" title={q.query}>{q.query}</span>
                            <span className="text-[9px] text-pc-muted uppercase flex-shrink-0 px-1.5 py-0.5 bg-pc-elevated rounded">{q.mode}</span>
                            <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${q.status === "SUCCESS" ? "bg-pc-success/10 text-pc-success" : "bg-pc-danger/10 text-pc-danger"}`}>{q.status}</span>
                            <span className="text-[10px] text-pc-muted flex-shrink-0">{q.timestamp ? new Date(q.timestamp + "Z").toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : ""}</span>
                            {q.response && (expandedQuery === i ? <ChevronUp size={12} className="text-pc-muted flex-shrink-0" /> : <ChevronDown size={12} className="text-pc-muted flex-shrink-0" />)}
                          </button>
                          {expandedQuery === i && q.response && (
                            <div className="px-4 pb-3">
                              <div className="bg-pc-bg border border-pc-border/50 rounded p-3">
                                <p className="text-[10px] text-pc-muted uppercase tracking-wider mb-1.5 flex items-center gap-1"><Eye size={10} />Generated Response</p>
                                <pre className="text-[11px] text-pc-secondary font-mono whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">{q.response}</pre>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* ═══════════════════════════════════════════════ */}
            {/* TAB: Usage Analytics                             */}
            {/* ═══════════════════════════════════════════════ */}
            {activeTab === "analytics" && (
              <>
                {analytics ? (
                  <>
                    {/* Overview cards */}
                    <div className="grid grid-cols-4 gap-4 mb-6">
                      <div className="bg-pc-surface border border-pc-border rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Users size={14} className="text-pc-accent" />
                          <p className="text-[10px] text-pc-muted uppercase tracking-wider font-medium">Developers</p>
                        </div>
                        <p className="text-2xl font-mono font-semibold text-pc-text">{analytics.total_developers}</p>
                        <p className="text-[10px] text-pc-success mt-1">{analytics.online_developers} online</p>
                      </div>
                      <div className="bg-pc-surface border border-pc-border rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Search size={14} className="text-pc-warning" />
                          <p className="text-[10px] text-pc-muted uppercase tracking-wider font-medium">Total Queries</p>
                        </div>
                        <p className="text-2xl font-mono font-semibold text-pc-text">{analytics.total_queries}</p>
                      </div>
                      <div className="bg-pc-surface border border-pc-border rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <TrendingUp size={14} className="text-pc-success" />
                          <p className="text-[10px] text-pc-muted uppercase tracking-wider font-medium">Success Rate</p>
                        </div>
                        <p className="text-2xl font-mono font-semibold text-pc-success">
                          {analytics.status_distribution?.SUCCESS && analytics.total_queries
                            ? Math.round((analytics.status_distribution.SUCCESS / (analytics.status_distribution.SUCCESS + (analytics.status_distribution.ERROR || 0))) * 100)
                            : 0}%
                        </p>
                      </div>
                      <div className="bg-pc-surface border border-pc-border rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Activity size={14} className="text-pc-accent" />
                          <p className="text-[10px] text-pc-muted uppercase tracking-wider font-medium">Total Indexing</p>
                        </div>
                        <p className="text-2xl font-mono font-semibold text-pc-text">{analytics.total_indexing}</p>
                      </div>
                    </div>

                    {/* Mode Distribution */}
                    <div className="grid grid-cols-2 gap-4 mb-6">
                      <div className="bg-pc-surface border border-pc-border rounded-lg p-4">
                        <h3 className="text-sm font-semibold text-pc-text mb-3 flex items-center gap-2">
                          <BarChart3 size={14} className="text-pc-accent" />Query Mode Distribution
                        </h3>
                        {Object.keys(analytics.mode_distribution || {}).length > 0 ? (
                          <div className="space-y-2">
                            {Object.entries(analytics.mode_distribution).map(([mode, count]) => {
                              const total = Object.values(analytics.mode_distribution).reduce((a, b) => a + b, 0);
                              const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                              return (
                                <div key={mode}>
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs text-pc-text font-mono uppercase">{mode}</span>
                                    <span className="text-[10px] text-pc-muted">{count} ({pct}%)</span>
                                  </div>
                                  <div className="w-full h-2 bg-pc-elevated rounded-full overflow-hidden">
                                    <div className="h-full bg-pc-accent rounded-full transition-all" style={{ width: `${pct}%` }} />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-sm text-pc-muted">No data yet</p>
                        )}
                      </div>

                      <div className="bg-pc-surface border border-pc-border rounded-lg p-4">
                        <h3 className="text-sm font-semibold text-pc-text mb-3 flex items-center gap-2">
                          <CheckCircle2 size={14} className="text-pc-success" />Status Distribution
                        </h3>
                        {Object.keys(analytics.status_distribution || {}).length > 0 ? (
                          <div className="space-y-2">
                            {Object.entries(analytics.status_distribution).map(([st, count]) => {
                              const total = Object.values(analytics.status_distribution).reduce((a, b) => a + b, 0);
                              const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                              const isSuccess = st === "SUCCESS";
                              return (
                                <div key={st}>
                                  <div className="flex items-center justify-between mb-1">
                                    <span className={`text-xs font-mono ${isSuccess ? "text-pc-success" : "text-pc-danger"}`}>{st}</span>
                                    <span className="text-[10px] text-pc-muted">{count} ({pct}%)</span>
                                  </div>
                                  <div className="w-full h-2 bg-pc-elevated rounded-full overflow-hidden">
                                    <div className={`h-full rounded-full transition-all ${isSuccess ? "bg-pc-success" : "bg-pc-danger"}`} style={{ width: `${pct}%` }} />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-sm text-pc-muted">No data yet</p>
                        )}
                      </div>
                    </div>

                    {/* Top Users */}
                    <div className="bg-pc-surface border border-pc-border rounded-lg p-4 mb-6">
                      <h3 className="text-sm font-semibold text-pc-text mb-3 flex items-center gap-2">
                        <TrendingUp size={14} className="text-pc-accent" />Top Users by Queries
                      </h3>
                      {analytics.top_users?.length > 0 ? (
                        <div className="space-y-2">
                          {analytics.top_users.map((u, i) => {
                            const maxQ = analytics.top_users[0]?.total_queries || 1;
                            const pct = Math.round((u.total_queries / maxQ) * 100);
                            return (
                              <div key={u.username} className="flex items-center gap-3">
                                <span className="text-[10px] text-pc-muted w-4 text-right font-mono">#{i + 1}</span>
                                <span className="text-xs text-pc-text font-medium w-28 truncate">{u.username}</span>
                                <div className="flex-1 h-2 bg-pc-elevated rounded-full overflow-hidden">
                                  <div className="h-full bg-pc-accent rounded-full transition-all" style={{ width: `${pct}%` }} />
                                </div>
                                <span className="text-[10px] font-mono text-pc-muted w-12 text-right">{u.total_queries}</span>
                                <span className={`w-1.5 h-1.5 rounded-full ${u.status === "online" ? "bg-pc-success" : "bg-pc-muted"}`} />
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-sm text-pc-muted">No developer activity yet</p>
                      )}
                    </div>

                    {/* Hourly Distribution */}
                    {Object.keys(analytics.hourly_distribution || {}).length > 0 && (
                      <div className="bg-pc-surface border border-pc-border rounded-lg p-4">
                        <h3 className="text-sm font-semibold text-pc-text mb-3 flex items-center gap-2">
                          <Clock size={14} className="text-pc-accent" />Hourly Query Distribution
                        </h3>
                        <div className="flex items-end gap-1 h-24">
                          {Array.from({ length: 24 }, (_, h) => {
                            const key = h.toString().padStart(2, "0");
                            const count = analytics.hourly_distribution[key] || 0;
                            const maxVal = Math.max(...Object.values(analytics.hourly_distribution), 1);
                            const pct = (count / maxVal) * 100;
                            return (
                              <div key={key} className="flex-1 flex flex-col items-center gap-0.5" title={`${key}:00 — ${count} queries`}>
                                <div className="w-full bg-pc-elevated rounded-t overflow-hidden flex items-end" style={{ height: "80px" }}>
                                  <div className="w-full bg-pc-accent/60 rounded-t transition-all" style={{ height: `${pct}%` }} />
                                </div>
                                <span className="text-[8px] text-pc-muted font-mono">{h % 6 === 0 ? key : ""}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-16 text-pc-muted text-sm">Loading analytics...</div>
                )}
              </>
            )}

            {/* ═══════════════════════════════════════════════ */}
            {/* TAB: Project Documentation                      */}
            {/* ═══════════════════════════════════════════════ */}
            {activeTab === "docs" && (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-pc-text flex items-center gap-2">
                    <BookOpen size={14} className="text-pc-accent" />Documentation Files
                    <span className="text-[10px] text-pc-muted bg-pc-elevated px-1.5 py-0.5 rounded">{docs.length} found</span>
                  </h3>
                </div>

                {docsLoading ? (
                  <div className="text-center py-16 text-pc-muted text-sm">Scanning repository for docs...</div>
                ) : docs.length === 0 ? (
                  <div className="text-center py-16">
                    <BookOpen size={32} className="text-pc-muted mx-auto mb-3 opacity-40" />
                    <p className="text-sm text-pc-muted">No documentation files found</p>
                    <p className="text-[11px] text-pc-muted mt-1">Looking for .md, .rst, .txt, README, etc.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {docs.map((doc, i) => (
                      <div key={i} className="bg-pc-surface border border-pc-border rounded-lg overflow-hidden">
                        <button
                          onClick={() => setExpandedDoc(expandedDoc === i ? null : i)}
                          className="w-full px-4 py-3 flex items-center gap-3 hover:bg-pc-elevated/50 transition text-left"
                        >
                          <FileText size={14} className="text-pc-accent flex-shrink-0" />
                          <span className="text-xs font-mono text-pc-text flex-1">{doc.path}</span>
                          <span className="text-[10px] text-pc-muted">{(doc.size / 1024).toFixed(1)} KB</span>
                          {expandedDoc === i ? <ChevronUp size={12} className="text-pc-muted" /> : <ChevronDown size={12} className="text-pc-muted" />}
                        </button>
                        {expandedDoc === i && (
                          <div className="border-t border-pc-border px-4 py-3 bg-pc-bg">
                            <pre className="text-[11px] text-pc-secondary font-mono whitespace-pre-wrap leading-relaxed max-h-96 overflow-y-auto">{doc.content}</pre>
                            {doc.content?.length >= 5000 && (
                              <p className="text-[10px] text-pc-warning mt-2">Content truncated at 5 KB</p>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* ═══════════════════════════════════════════════ */}
            {/* TAB: Activity Reports                           */}
            {/* ═══════════════════════════════════════════════ */}
            {activeTab === "reports" && (
              <>
                {report ? (
                  <>
                    {/* Report header */}
                    <div className="bg-pc-surface border border-pc-border rounded-lg p-4 mb-6">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-semibold text-pc-text flex items-center gap-2">
                          <FileText size={14} className="text-pc-accent" />Activity Report
                        </h3>
                        <span className="text-[10px] text-pc-muted">Generated: {report.generated_at ? new Date(report.generated_at + "Z").toLocaleString() : "—"}</span>
                      </div>
                      <div className="grid grid-cols-5 gap-3">
                        {[
                          { label: "Total Devs", value: report.summary?.total_developers, color: "text-pc-text" },
                          { label: "Online", value: report.summary?.online, color: "text-pc-success" },
                          { label: "Offline", value: report.summary?.offline, color: "text-pc-muted" },
                          { label: "Queries", value: report.summary?.total_queries, color: "text-pc-text" },
                          { label: "Indexing Ops", value: report.summary?.total_indexing, color: "text-pc-text" },
                        ].map((s, i) => (
                          <div key={i} className="bg-pc-bg rounded p-3 border border-pc-border/50 text-center">
                            <p className="text-[10px] text-pc-muted uppercase tracking-wider mb-1">{s.label}</p>
                            <p className={`text-xl font-mono font-semibold ${s.color}`}>{s.value}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Per-developer report */}
                    <h3 className="text-sm font-semibold text-pc-text mb-3 flex items-center gap-2">
                      <Users size={14} className="text-pc-accent" />Individual Reports
                    </h3>
                    {report.developers?.length === 0 ? (
                      <div className="text-center py-10 text-pc-muted text-sm">No developer data available</div>
                    ) : (
                      <div className="space-y-3">
                        {report.developers?.map((dev) => (
                          <div key={dev.username} className="bg-pc-surface border border-pc-border rounded-lg p-4">
                            <div className="flex items-center gap-3 mb-3">
                              <div className="w-8 h-8 rounded bg-pc-elevated border border-pc-border flex items-center justify-center text-pc-accent text-sm font-mono font-semibold">{dev.username.charAt(0).toUpperCase()}</div>
                              <div className="flex-1">
                                <p className="text-sm font-medium text-pc-text">{dev.username}</p>
                                <p className="text-[10px] text-pc-muted">{dev.current_repo || "No repo"}</p>
                              </div>
                              <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-medium ${dev.status === "online" ? "bg-pc-success/10 text-pc-success border border-pc-success/20" : "bg-pc-muted/10 text-pc-muted border border-pc-border"}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${dev.status === "online" ? "bg-pc-success" : "bg-pc-muted"}`} />
                                {dev.status}
                              </span>
                            </div>
                            <div className="grid grid-cols-5 gap-2">
                              <div className="bg-pc-bg rounded p-2 border border-pc-border/50">
                                <p className="text-[9px] text-pc-muted uppercase tracking-wider mb-0.5">Queries</p>
                                <p className="text-sm font-mono font-semibold text-pc-text">{dev.total_queries}</p>
                              </div>
                              <div className="bg-pc-bg rounded p-2 border border-pc-border/50">
                                <p className="text-[9px] text-pc-muted uppercase tracking-wider mb-0.5">Success</p>
                                <p className="text-sm font-mono font-semibold text-pc-success">{dev.success_rate}%</p>
                              </div>
                              <div className="bg-pc-bg rounded p-2 border border-pc-border/50">
                                <p className="text-[9px] text-pc-muted uppercase tracking-wider mb-0.5">Errors</p>
                                <p className="text-sm font-mono font-semibold text-pc-danger">{dev.error_count}</p>
                              </div>
                              <div className="bg-pc-bg rounded p-2 border border-pc-border/50">
                                <p className="text-[9px] text-pc-muted uppercase tracking-wider mb-0.5">Indexed</p>
                                <p className="text-sm font-mono font-semibold text-pc-text">{dev.total_indexing}</p>
                              </div>
                              <div className="bg-pc-bg rounded p-2 border border-pc-border/50">
                                <p className="text-[9px] text-pc-muted uppercase tracking-wider mb-0.5">Modes</p>
                                <p className="text-xs font-mono text-pc-accent truncate" title={dev.modes_used?.join(", ")}>{dev.modes_used?.join(", ") || "—"}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-4 mt-2 text-[10px] text-pc-muted">
                              <span className="flex items-center gap-1"><Clock size={10} />Last active: {dev.last_active ? new Date(dev.last_active + "Z").toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}</span>
                              <span className="flex items-center gap-1"><Clock size={10} />Last login: {dev.last_login ? new Date(dev.last_login + "Z").toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-16 text-pc-muted text-sm">Loading activity report...</div>
                )}
              </>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
