"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Shield,
  FileText,
  AlertTriangle,
  Eye,
  BarChart3,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Clock,
  CheckCircle,
  XCircle,
  User,
} from "lucide-react";
import { auth } from "@/lib/auth";
import {
  getAuditorAuditLogs,
  getAccessAttempts,
  getPolicyViolations,
  getSecurityReport,
} from "@/lib/api";

// ── Tabs ──
const TABS = [
  { id: "audit-logs", label: "Audit Logs", icon: FileText },
  { id: "access-attempts", label: "Access Attempts", icon: Eye },
  { id: "policy-violations", label: "Policy Violations", icon: AlertTriangle },
  { id: "security-report", label: "Security Report", icon: BarChart3 },
];

export default function AuditorDashboard() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [tab, setTab] = useState("audit-logs");
  const [loading, setLoading] = useState(false);

  // Data states
  const [auditLogs, setAuditLogs] = useState([]);
  const [accessAttempts, setAccessAttempts] = useState(null);
  const [violations, setViolations] = useState(null);
  const [securityReport, setSecurityReport] = useState(null);

  // UI
  const [expandedLog, setExpandedLog] = useState(null);
  const [logFilter, setLogFilter] = useState("all");
  const [attemptFilter, setAttemptFilter] = useState("all");
  const [violationFilter, setViolationFilter] = useState("all");

  useEffect(() => {
    const u = auth.getUser();
    if (!u || (u.role !== "auditor" && u.role !== "admin")) {
      router.push("/chat");
      return;
    }
    setUser(u);
  }, [router]);

  // ── Fetch helpers ──
  const fetchAuditLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getAuditorAuditLogs();
      setAuditLogs(res.data.logs || []);
    } catch { setAuditLogs([]); }
    finally { setLoading(false); }
  }, []);

  const fetchAccessAttempts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getAccessAttempts(200);
      setAccessAttempts(res.data);
    } catch { setAccessAttempts(null); }
    finally { setLoading(false); }
  }, []);

  const fetchViolations = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getPolicyViolations(200);
      setViolations(res.data);
    } catch { setViolations(null); }
    finally { setLoading(false); }
  }, []);

  const fetchSecurityReport = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getSecurityReport();
      setSecurityReport(res.data);
    } catch { setSecurityReport(null); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (!user) return;
    if (tab === "audit-logs") fetchAuditLogs();
    else if (tab === "access-attempts") fetchAccessAttempts();
    else if (tab === "policy-violations") fetchViolations();
    else if (tab === "security-report") fetchSecurityReport();
  }, [tab, user, fetchAuditLogs, fetchAccessAttempts, fetchViolations, fetchSecurityReport]);

  const handleRefresh = () => {
    if (tab === "audit-logs") fetchAuditLogs();
    else if (tab === "access-attempts") fetchAccessAttempts();
    else if (tab === "policy-violations") fetchViolations();
    else if (tab === "security-report") fetchSecurityReport();
  };

  if (!user) return null;

  // ── Helper: format timestamp ──
  const fmtTime = (ts) => {
    if (!ts) return "—";
    try {
      const d = new Date(ts);
      return d.toLocaleString();
    } catch { return ts; }
  };

  // ── Helper: status badge ──
  const StatusBadge = ({ success }) => (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${
      success
        ? "bg-green-500/15 text-green-400 border border-green-500/20"
        : "bg-red-500/15 text-red-400 border border-red-500/20"
    }`}>
      {success ? <CheckCircle size={10} /> : <XCircle size={10} />}
      {success ? "Success" : "Failed"}
    </span>
  );

  const SeverityBadge = ({ severity }) => {
    const colors = {
      high: "bg-red-500/15 text-red-400 border-red-500/20",
      medium: "bg-yellow-500/15 text-yellow-400 border-yellow-500/20",
      low: "bg-blue-500/15 text-blue-400 border-blue-500/20",
    };
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${colors[severity] || colors.medium}`}>
        {severity}
      </span>
    );
  };

  // ══════════════════════════════════════════════
  // TAB : Audit Logs
  // ══════════════════════════════════════════════
  const renderAuditLogs = () => {
    const filtered = logFilter === "all"
      ? auditLogs
      : auditLogs.filter(l => (l.status || "").toUpperCase() === logFilter.toUpperCase());

    return (
      <div className="space-y-4">
        {/* Filter bar */}
        <div className="flex items-center gap-3">
          <span className="text-xs text-pc-muted">Filter:</span>
          {["all", "SUCCESS", "FAILED", "ERROR"].map(f => (
            <button key={f} onClick={() => setLogFilter(f)}
              className={`px-3 py-1 rounded text-xs font-mono transition ${
                logFilter === f
                  ? "bg-pc-accent text-[#0d1117]"
                  : "bg-pc-elevated text-pc-secondary hover:text-pc-text border border-pc-border"
              }`}>
              {f}
            </button>
          ))}
          <span className="text-xs text-pc-muted ml-auto">{filtered.length} entries</span>
        </div>

        {/* Log table */}
        <div className="bg-pc-surface border border-pc-border rounded-lg overflow-hidden">
          <div className="grid grid-cols-[140px_100px_80px_70px_1fr] gap-2 px-4 py-2 bg-pc-elevated text-[10px] text-pc-muted uppercase tracking-wider font-medium border-b border-pc-border">
            <span>Timestamp</span><span>User</span><span>Action</span><span>Status</span><span>Details</span>
          </div>
          <div className="max-h-[60vh] overflow-y-auto divide-y divide-pc-border">
            {filtered.length === 0 ? (
              <div className="px-4 py-10 text-center text-pc-muted text-xs">No audit logs found</div>
            ) : filtered.map((log, i) => (
              <div key={i} className="group">
                <div
                  className="grid grid-cols-[140px_100px_80px_70px_1fr] gap-2 px-4 py-2 text-xs hover:bg-pc-elevated/50 cursor-pointer transition"
                  onClick={() => setExpandedLog(expandedLog === i ? null : i)}
                >
                  <span className="text-pc-muted font-mono text-[11px]">{fmtTime(log.timestamp)}</span>
                  <span className="text-pc-text font-mono">{log.user_email || log.user || "—"}</span>
                  <span className="text-pc-accent">{log.action || "—"}</span>
                  <StatusBadge success={(log.status || "").toUpperCase() === "SUCCESS"} />
                  <span className="text-pc-secondary truncate">
                    {log.query ? `Query: ${log.query.slice(0, 60)}` : log.details ? JSON.stringify(log.details).slice(0, 80) : "—"}
                  </span>
                </div>
                {expandedLog === i && (
                  <div className="px-6 py-3 bg-pc-bg border-t border-pc-border">
                    <pre className="text-[11px] text-pc-secondary font-mono whitespace-pre-wrap break-all">
                      {JSON.stringify(log, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // ══════════════════════════════════════════════
  // TAB : Access Attempts
  // ══════════════════════════════════════════════
  const renderAccessAttempts = () => {
    if (!accessAttempts) return <div className="text-pc-muted text-xs py-10 text-center">Loading...</div>;

    const list = accessAttempts.attempts || [];
    const filtered = attemptFilter === "all"
      ? list
      : attemptFilter === "success"
        ? list.filter(a => a.success)
        : list.filter(a => !a.success);

    return (
      <div className="space-y-4">
        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Total Attempts", value: accessAttempts.total || 0, color: "pc-accent" },
            { label: "Successful", value: accessAttempts.success || 0, color: "green-400" },
            { label: "Failed", value: accessAttempts.failed || 0, color: "red-400" },
          ].map(c => (
            <div key={c.label} className="bg-pc-surface border border-pc-border rounded-lg p-4">
              <p className="text-[10px] text-pc-muted uppercase tracking-wider">{c.label}</p>
              <p className={`text-2xl font-bold text-${c.color} mt-1`}>{c.value}</p>
            </div>
          ))}
        </div>

        {/* Filter */}
        <div className="flex items-center gap-3">
          <span className="text-xs text-pc-muted">Filter:</span>
          {["all", "success", "failed"].map(f => (
            <button key={f} onClick={() => setAttemptFilter(f)}
              className={`px-3 py-1 rounded text-xs font-mono transition ${
                attemptFilter === f
                  ? "bg-pc-accent text-[#0d1117]"
                  : "bg-pc-elevated text-pc-secondary hover:text-pc-text border border-pc-border"
              }`}>
              {f}
            </button>
          ))}
          <span className="text-xs text-pc-muted ml-auto">{filtered.length} entries</span>
        </div>

        {/* Table */}
        <div className="bg-pc-surface border border-pc-border rounded-lg overflow-hidden">
          <div className="grid grid-cols-[140px_100px_80px_70px_1fr] gap-2 px-4 py-2 bg-pc-elevated text-[10px] text-pc-muted uppercase tracking-wider font-medium border-b border-pc-border">
            <span>Timestamp</span><span>User</span><span>Action</span><span>Result</span><span>Details</span>
          </div>
          <div className="max-h-[55vh] overflow-y-auto divide-y divide-pc-border">
            {filtered.length === 0 ? (
              <div className="px-4 py-10 text-center text-pc-muted text-xs">No access attempts found</div>
            ) : filtered.map((a, i) => (
              <div key={i} className="grid grid-cols-[140px_100px_80px_70px_1fr] gap-2 px-4 py-2 text-xs hover:bg-pc-elevated/50 transition">
                <span className="text-pc-muted font-mono text-[11px]">{fmtTime(a.timestamp)}</span>
                <span className="text-pc-text font-mono">{a.username}</span>
                <span className="text-pc-accent">{a.action}</span>
                <StatusBadge success={a.success} />
                <span className="text-pc-secondary truncate">{a.details || "—"}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // ══════════════════════════════════════════════
  // TAB : Policy Violations
  // ══════════════════════════════════════════════
  const renderPolicyViolations = () => {
    if (!violations) return <div className="text-pc-muted text-xs py-10 text-center">Loading...</div>;

    const list = violations.violations || [];
    const filtered = violationFilter === "all"
      ? list
      : list.filter(v => v.severity === violationFilter);

    return (
      <div className="space-y-4">
        {/* Summary */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Total Violations", value: violations.total || 0, color: "pc-accent" },
            { label: "High Severity", value: list.filter(v => v.severity === "high").length, color: "red-400" },
            { label: "Medium Severity", value: list.filter(v => v.severity === "medium").length, color: "yellow-400" },
          ].map(c => (
            <div key={c.label} className="bg-pc-surface border border-pc-border rounded-lg p-4">
              <p className="text-[10px] text-pc-muted uppercase tracking-wider">{c.label}</p>
              <p className={`text-2xl font-bold text-${c.color} mt-1`}>{c.value}</p>
            </div>
          ))}
        </div>

        {/* Filter */}
        <div className="flex items-center gap-3">
          <span className="text-xs text-pc-muted">Filter:</span>
          {["all", "high", "medium"].map(f => (
            <button key={f} onClick={() => setViolationFilter(f)}
              className={`px-3 py-1 rounded text-xs font-mono transition ${
                violationFilter === f
                  ? "bg-pc-accent text-[#0d1117]"
                  : "bg-pc-elevated text-pc-secondary hover:text-pc-text border border-pc-border"
              }`}>
              {f}
            </button>
          ))}
          <span className="text-xs text-pc-muted ml-auto">{filtered.length} entries</span>
        </div>

        {/* Table */}
        <div className="bg-pc-surface border border-pc-border rounded-lg overflow-hidden">
          <div className="grid grid-cols-[140px_100px_120px_80px_1fr] gap-2 px-4 py-2 bg-pc-elevated text-[10px] text-pc-muted uppercase tracking-wider font-medium border-b border-pc-border">
            <span>Timestamp</span><span>User</span><span>Type</span><span>Severity</span><span>Details</span>
          </div>
          <div className="max-h-[55vh] overflow-y-auto divide-y divide-pc-border">
            {filtered.length === 0 ? (
              <div className="px-4 py-10 text-center text-pc-muted text-xs">
                <Shield size={24} className="mx-auto mb-2 opacity-30" />
                No policy violations recorded
              </div>
            ) : filtered.map((v, i) => (
              <div key={i} className="grid grid-cols-[140px_100px_120px_80px_1fr] gap-2 px-4 py-2 text-xs hover:bg-pc-elevated/50 transition">
                <span className="text-pc-muted font-mono text-[11px]">{fmtTime(v.timestamp)}</span>
                <span className="text-pc-text font-mono">{v.username}</span>
                <span className="text-pc-accent">{v.violation_type}</span>
                <SeverityBadge severity={v.severity} />
                <span className="text-pc-secondary truncate">{v.details || v.endpoint || "—"}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // ══════════════════════════════════════════════
  // TAB : Security Report
  // ══════════════════════════════════════════════
  const renderSecurityReport = () => {
    if (!securityReport) return <div className="text-pc-muted text-xs py-10 text-center">Loading...</div>;

    const access = securityReport.access_summary || {};
    const viol = securityReport.violations_summary || {};
    const sess = securityReport.session_summary || {};
    const offenders = securityReport.top_offenders || [];
    const hourly = securityReport.hourly_access_pattern || {};

    return (
      <div className="space-y-6">
        {/* Generated at */}
        <div className="flex items-center gap-2 text-xs text-pc-muted">
          <Clock size={12} />
          Report generated: {fmtTime(securityReport.generated_at)}
        </div>

        {/* Access Summary */}
        <div>
          <h3 className="text-sm font-semibold text-pc-text mb-3 flex items-center gap-2">
            <Eye size={14} className="text-pc-accent" /> Access Summary
          </h3>
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: "Total Attempts", value: access.total_attempts || 0 },
              { label: "Successful", value: access.successful || 0 },
              { label: "Failed", value: access.failed || 0 },
              { label: "Failure Rate", value: `${access.failure_rate || 0}%` },
            ].map(c => (
              <div key={c.label} className="bg-pc-surface border border-pc-border rounded-lg p-4 text-center">
                <p className="text-[10px] text-pc-muted uppercase tracking-wider">{c.label}</p>
                <p className="text-xl font-bold text-pc-text mt-1">{c.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Violations Summary */}
        <div>
          <h3 className="text-sm font-semibold text-pc-text mb-3 flex items-center gap-2">
            <AlertTriangle size={14} className="text-yellow-400" /> Violations Summary
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-pc-surface border border-pc-border rounded-lg p-4">
              <p className="text-[10px] text-pc-muted uppercase tracking-wider mb-2">Total Violations</p>
              <p className="text-2xl font-bold text-pc-text">{viol.total || 0}</p>
            </div>
            <div className="bg-pc-surface border border-pc-border rounded-lg p-4">
              <p className="text-[10px] text-pc-muted uppercase tracking-wider mb-2">By Severity</p>
              <div className="space-y-1">
                {Object.entries(viol.by_severity || {}).map(([sev, count]) => (
                  <div key={sev} className="flex items-center justify-between text-xs">
                    <SeverityBadge severity={sev} />
                    <span className="text-pc-text font-mono">{count}</span>
                  </div>
                ))}
                {Object.keys(viol.by_severity || {}).length === 0 && (
                  <span className="text-xs text-pc-muted">None recorded</span>
                )}
              </div>
            </div>
          </div>
          {/* Violation types */}
          {Object.keys(viol.by_type || {}).length > 0 && (
            <div className="mt-3 bg-pc-surface border border-pc-border rounded-lg p-4">
              <p className="text-[10px] text-pc-muted uppercase tracking-wider mb-2">Violations by Type</p>
              <div className="space-y-2">
                {Object.entries(viol.by_type).map(([type, count]) => {
                  const maxCount = Math.max(...Object.values(viol.by_type));
                  const pct = maxCount > 0 ? (count / maxCount) * 100 : 0;
                  return (
                    <div key={type}>
                      <div className="flex justify-between text-xs mb-0.5">
                        <span className="text-pc-secondary">{type}</span>
                        <span className="text-pc-text font-mono">{count}</span>
                      </div>
                      <div className="h-1.5 bg-pc-elevated rounded-full overflow-hidden">
                        <div className="h-full bg-yellow-500/60 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Session Summary */}
        <div>
          <h3 className="text-sm font-semibold text-pc-text mb-3 flex items-center gap-2">
            <User size={14} className="text-pc-accent" /> Session Summary
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-pc-surface border border-pc-border rounded-lg p-4 text-center">
              <p className="text-[10px] text-pc-muted uppercase tracking-wider">Online Users</p>
              <p className="text-2xl font-bold text-green-400 mt-1">{sess.online_users || 0}</p>
            </div>
            <div className="bg-pc-surface border border-pc-border rounded-lg p-4 text-center">
              <p className="text-[10px] text-pc-muted uppercase tracking-wider">Total Tracked</p>
              <p className="text-2xl font-bold text-pc-text mt-1">{sess.total_tracked_users || 0}</p>
            </div>
          </div>
        </div>

        {/* Top Offenders */}
        {offenders.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-pc-text mb-3 flex items-center gap-2">
              <AlertTriangle size={14} className="text-red-400" /> Top Offenders (Failed Logins)
            </h3>
            <div className="bg-pc-surface border border-pc-border rounded-lg overflow-hidden">
              <div className="grid grid-cols-[1fr_120px] gap-2 px-4 py-2 bg-pc-elevated text-[10px] text-pc-muted uppercase tracking-wider font-medium border-b border-pc-border">
                <span>Username</span><span>Failed Attempts</span>
              </div>
              <div className="divide-y divide-pc-border">
                {offenders.map((o, i) => (
                  <div key={i} className="grid grid-cols-[1fr_120px] gap-2 px-4 py-2 text-xs">
                    <span className="text-pc-text font-mono">{o.username}</span>
                    <span className="text-red-400 font-mono font-semibold">{o.failed_attempts}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Hourly Access Pattern */}
        {Object.keys(hourly).length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-pc-text mb-3 flex items-center gap-2">
              <BarChart3 size={14} className="text-pc-accent" /> Hourly Access Pattern
            </h3>
            <div className="bg-pc-surface border border-pc-border rounded-lg p-4">
              <div className="flex items-end gap-1 h-32">
                {Array.from({ length: 24 }, (_, h) => {
                  const key = h.toString().padStart(2, "0");
                  const count = hourly[key] || 0;
                  const maxVal = Math.max(...Object.values(hourly), 1);
                  const pct = (count / maxVal) * 100;
                  return (
                    <div key={key} className="flex-1 flex flex-col items-center gap-1 group relative">
                      <div className="absolute -top-5 bg-pc-elevated text-[9px] text-pc-text font-mono px-1 rounded opacity-0 group-hover:opacity-100 transition pointer-events-none">
                        {count}
                      </div>
                      <div className="w-full bg-pc-accent/40 rounded-t" style={{ height: `${Math.max(pct, 2)}%` }} />
                      <span className="text-[8px] text-pc-muted">{key}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ══════════════════════════════════════════════
  // MAIN LAYOUT
  // ══════════════════════════════════════════════
  return (
    <div className="flex h-screen bg-pc-bg">
      {/* ── Sidebar ── */}
      <div className="w-56 bg-pc-surface border-r border-pc-border flex flex-col flex-shrink-0">
        {/* Header */}
        <div className="h-14 px-4 flex items-center gap-2 border-b border-pc-border">
          <Shield size={16} className="text-pc-accent" />
          <span className="text-sm font-semibold text-pc-text tracking-tight">Security Audit</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-1">
          {TABS.map(t => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded text-xs transition ${
                  tab === t.id
                    ? "bg-pc-elevated text-pc-accent border border-pc-border"
                    : "text-pc-secondary hover:text-pc-text hover:bg-pc-elevated border border-transparent"
                }`}
              >
                <Icon size={14} />
                {t.label}
              </button>
            );
          })}
        </nav>

        {/* Back */}
        <div className="border-t border-pc-border p-3">
          <button
            onClick={() => router.push("/chat")}
            className="w-full flex items-center gap-2 px-3 py-2 bg-pc-elevated border border-pc-border rounded text-xs text-pc-secondary hover:text-pc-text hover:bg-pc-hover transition"
          >
            <ArrowLeft size={13} />
            Back to Chat
          </button>
        </div>

        {/* User info */}
        <div className="border-t border-pc-border p-3">
          <div className="flex items-center gap-2 px-1">
            <div className="w-7 h-7 rounded bg-pc-elevated border border-pc-border flex items-center justify-center text-pc-accent text-xs font-mono font-semibold">
              {user?.username?.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-pc-text truncate">{user?.username}</p>
              <p className="text-[10px] text-pc-muted">{user?.role}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Main Content ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <div className="h-14 bg-pc-surface border-b border-pc-border flex items-center justify-between px-6 flex-shrink-0">
          <div className="flex items-center gap-3">
            <h1 className="text-sm font-semibold text-pc-text">
              {TABS.find(t => t.id === tab)?.label}
            </h1>
            {loading && (
              <RefreshCw size={12} className="text-pc-accent animate-spin" />
            )}
          </div>
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="px-3 py-1.5 bg-pc-elevated border border-pc-border rounded text-xs text-pc-secondary hover:text-pc-text hover:bg-pc-hover transition disabled:opacity-50 flex items-center gap-1.5"
          >
            <RefreshCw size={11} />
            Refresh
          </button>
        </div>

        {/* Content area */}
        <div className="flex-1 overflow-y-auto p-6">
          {tab === "audit-logs" && renderAuditLogs()}
          {tab === "access-attempts" && renderAccessAttempts()}
          {tab === "policy-violations" && renderPolicyViolations()}
          {tab === "security-report" && renderSecurityReport()}
        </div>
      </div>
    </div>
  );
}
