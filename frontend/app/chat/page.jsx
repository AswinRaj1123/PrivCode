"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { queryCode, indexRepo, logoutSession } from "@/lib/api";
import { auth } from "@/lib/auth";
import {
  Send,
  Loader2,
  LogOut,
  Plus,
  Menu,
  X,
  MessageCircle,
  Database,
  Copy,
  Check,
  Terminal,
  Bug,
  ShieldAlert,
  Zap,
  BookOpen,
  ChevronDown,
  FolderGit2,
  Trash2,
  GitBranch,
  Globe,
  Sparkles,
  Users,
  Activity,
} from "lucide-react";

// ── Code Block with copy button ──
function CodeBlock({ code, language }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="my-3 rounded-lg overflow-hidden border border-pc-border bg-[#0d1117]">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-pc-elevated border-b border-pc-border">
        <span className="text-[11px] font-mono text-pc-muted uppercase tracking-wide">
          {language || "code"}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-[11px] text-pc-muted hover:text-pc-text transition-colors"
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      {/* Code body */}
      <div className="overflow-x-auto">
        <pre className="p-4 text-[13px] leading-relaxed font-mono text-pc-text">
          <code>{code}</code>
        </pre>
      </div>
    </div>
  );
}

// ── Message renderer: splits text into prose + code blocks ──
function MessageContent({ content }) {
  // Split on triple-backtick fences: ```lang\n...\n```
  const parts = [];
  const regex = /```(\w*)\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(content)) !== null) {
    // Text before this code block
    if (match.index > lastIndex) {
      parts.push({ type: "text", value: content.slice(lastIndex, match.index) });
    }
    parts.push({ type: "code", language: match[1], value: match[2].replace(/\n$/, "") });
    lastIndex = regex.lastIndex;
  }
  // Remaining text
  if (lastIndex < content.length) {
    parts.push({ type: "text", value: content.slice(lastIndex) });
  }

  // If no code blocks found, return as plain text
  if (parts.length === 0) {
    return <span className="whitespace-pre-wrap break-words">{content}</span>;
  }

  return (
    <>
      {parts.map((part, i) =>
        part.type === "code" ? (
          <CodeBlock key={i} code={part.value} language={part.language} />
        ) : (
          <span key={i} className="whitespace-pre-wrap break-words">{part.value}</span>
        )
      )}
    </>
  );
}

// ── Helpers ──
const STORAGE_KEY = "privcode_conversations";
const ACTIVE_KEY = "privcode_active_conversation";
const REPO_PATH_KEY = "privcode_repo_path";

function newConversation() {
  return {
    id: crypto.randomUUID?.() || String(Date.now()),
    title: "New conversation",
    messages: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function loadConversations() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveConversations(convos) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(convos));
}

function deriveTitle(messages) {
  const first = messages.find((m) => m.role === "user");
  if (!first) return "New conversation";
  const t = first.content.substring(0, 40).trim();
  return t.length < first.content.length ? t + "..." : t;
}

export default function ChatPage() {
  const router = useRouter();
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const [mounted, setMounted] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const [repoPath, setRepoPath] = useState("~/test_repo");
  const [indexPath, setIndexPath] = useState("./index");
  const [indexing, setIndexing] = useState(false);

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [user, setUser] = useState(null);
  const [showIndexPanel, setShowIndexPanel] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [queryMode, setQueryMode] = useState("auto"); // "auto", "repo", "general"

  // Active conversation derived from state
  const activeConvo = conversations.find((c) => c.id === activeId);
  const messages = activeConvo?.messages || [];

  // ── Persist helper ──
  const persist = useCallback(
    (nextConvos, nextActiveId) => {
      saveConversations(nextConvos);
      if (nextActiveId !== undefined) {
        localStorage.setItem(ACTIVE_KEY, nextActiveId);
      }
    },
    []
  );

  // ── Init ──
  useEffect(() => {
    setMounted(true);
    if (!auth.isAuthenticated()) {
      router.push("/login");
      return;
    }
    setUser(auth.getUser());

    // Restore saved repo path
    const savedRepo = localStorage.getItem(REPO_PATH_KEY);
    if (savedRepo) setRepoPath(savedRepo);

    // Migrate old single-chat format if present
    const oldHistory = localStorage.getItem("chatHistory");
    let convos = loadConversations();

    if (oldHistory && convos.length === 0) {
      try {
        const oldMessages = JSON.parse(oldHistory);
        if (oldMessages.length > 0) {
          const migrated = newConversation();
          migrated.messages = oldMessages;
          migrated.title = deriveTitle(oldMessages);
          migrated.updatedAt = oldMessages[oldMessages.length - 1]?.timestamp || migrated.updatedAt;
          convos = [migrated];
          saveConversations(convos);
        }
        localStorage.removeItem("chatHistory");
      } catch {
        localStorage.removeItem("chatHistory");
      }
    }

    setConversations(convos);

    // Restore last active or create fresh
    const savedActive = localStorage.getItem(ACTIVE_KEY);
    if (savedActive && convos.some((c) => c.id === savedActive)) {
      setActiveId(savedActive);
    } else if (convos.length > 0) {
      setActiveId(convos[0].id);
    } else {
      const fresh = newConversation();
      setConversations([fresh]);
      setActiveId(fresh.id);
      saveConversations([fresh]);
    }
  }, [router]);

  // Persist on changes
  useEffect(() => {
    if (mounted && conversations.length > 0) {
      persist(conversations, activeId);
    }
  }, [conversations, activeId, mounted, persist]);

  // Persist repo path changes
  useEffect(() => {
    if (mounted) {
      localStorage.setItem(REPO_PATH_KEY, repoPath);
    }
  }, [repoPath, mounted]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const isAdmin = user?.role === "admin";
  const isManager = user?.role === "manager";

  // ── Actions ──
  const handleLogout = async () => {
    try { await logoutSession(); } catch {}
    auth.logout();
  };

  const handleNewChat = () => {
    const fresh = newConversation();
    setConversations((prev) => [fresh, ...prev]);
    setActiveId(fresh.id);
    inputRef.current?.focus();
  };

  const handleSwitchConversation = (id) => {
    setActiveId(id);
    setDeleteConfirmId(null);
  };

  const handleDeleteConversation = (id) => {
    setConversations((prev) => {
      const next = prev.filter((c) => c.id !== id);
      if (id === activeId) {
        if (next.length > 0) {
          setActiveId(next[0].id);
        } else {
          const fresh = newConversation();
          next.push(fresh);
          setActiveId(fresh.id);
        }
      }
      return next;
    });
    setDeleteConfirmId(null);
  };

  const updateActiveMessages = (updater) => {
    setConversations((prev) =>
      prev.map((c) => {
        if (c.id !== activeId) return c;
        const nextMessages = typeof updater === "function" ? updater(c.messages) : updater;
        return {
          ...c,
          messages: nextMessages,
          title: deriveTitle(nextMessages) || c.title,
          updatedAt: new Date().toISOString(),
        };
      })
    );
  };

  const handleCopy = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleIndex = async () => {
    setIndexing(true);
    try {
      await indexRepo(repoPath, indexPath);
      alert("Repository indexed successfully!");
      setShowIndexPanel(false);
    } catch (err) {
      alert(err?.response?.data?.detail || "Indexing failed");
    } finally {
      setIndexing(false);
    }
  };

  const handleQuickAction = (prompt) => {
    setInput(prompt);
    inputRef.current?.focus();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMsg = {
      id: Date.now(),
      role: "user",
      content: input,
      timestamp: new Date().toISOString(),
    };

    updateActiveMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await queryCode(input, repoPath, queryMode);
      const data = res.data.response;

      let text = "";
      if (data.summary) text += `SUMMARY\n${data.summary}\n\n`;
      if (data.explanation) text += `EXPLANATION\n${data.explanation}\n\n`;
      if (data.bugs_found?.length)
        text += `BUGS\n${data.bugs_found.map((b) => `  - ${b}`).join("\n")}\n\n`;
      if (data.suggestions?.length)
        text += `SUGGESTIONS\n${data.suggestions.map((s) => `  - ${s}`).join("\n")}\n\n`;
      if (data.sources?.length)
        text += `SOURCES\n${data.sources.map((s) => `  ${s}`).join("\n")}`;

      updateActiveMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          role: "assistant",
          content: text || "No response generated.",
          timestamp: new Date().toISOString(),
        },
      ]);
    } catch {
      updateActiveMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          role: "assistant",
          content: "Error: Query failed. Check backend connection and try again.",
          isError: true,
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  if (!mounted || !user) return null;

  // ── Sorted conversations: active first, then by updatedAt desc ──
  const sortedConvos = [...conversations].sort((a, b) => {
    if (a.id === activeId) return -1;
    if (b.id === activeId) return 1;
    return new Date(b.updatedAt) - new Date(a.updatedAt);
  });

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

        {/* New Chat */}
        <div className="p-3 flex-shrink-0">
          <button
            onClick={handleNewChat}
            className="w-full px-3 py-2 bg-pc-elevated border border-pc-border rounded text-sm text-pc-text hover:bg-pc-hover hover:border-pc-accent/40 transition flex items-center gap-2"
          >
            <Plus size={14} />
            New conversation
          </button>
        </div>

        {/* Conversation History */}
        <div className="flex-1 overflow-y-auto px-3 space-y-0.5">
          {sortedConvos.length > 0 && (
            <p className="text-[10px] text-pc-muted uppercase tracking-wider px-2 py-2 font-medium">
              Conversations ({sortedConvos.length})
            </p>
          )}
          {sortedConvos.map((convo) => (
            <div key={convo.id} className="group relative">
              <button
                onClick={() => handleSwitchConversation(convo.id)}
                className={`w-full px-2 py-1.5 text-left rounded text-xs truncate transition flex items-center gap-1.5 ${
                  convo.id === activeId
                    ? "bg-pc-elevated text-pc-text border border-pc-border"
                    : "text-pc-secondary hover:text-pc-text hover:bg-pc-elevated border border-transparent"
                }`}
              >
                <MessageCircle size={12} className="flex-shrink-0 opacity-50" />
                <span className="truncate">{convo.title}</span>
              </button>

              {/* Delete button */}
              {deleteConfirmId === convo.id ? (
                <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteConversation(convo.id); }}
                    className="p-1 bg-pc-danger/20 text-pc-danger rounded hover:bg-pc-danger/30 transition"
                    title="Confirm delete"
                  >
                    <Check size={10} />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(null); }}
                    className="p-1 bg-pc-elevated text-pc-muted rounded hover:text-pc-text transition"
                    title="Cancel"
                  >
                    <X size={10} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(convo.id); }}
                  className="absolute right-1 top-1/2 -translate-y-1/2 p-1 opacity-0 group-hover:opacity-100 text-pc-muted hover:text-pc-danger rounded transition"
                  title="Delete conversation"
                >
                  <Trash2 size={11} />
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Repository Panel Toggle */}
        <div className="border-t border-pc-border p-3 flex-shrink-0 space-y-2">
          <button
            onClick={() => setShowIndexPanel(!showIndexPanel)}
            className="w-full px-3 py-2 bg-pc-elevated border border-pc-border rounded text-xs text-pc-secondary hover:text-pc-text hover:bg-pc-hover transition flex items-center gap-2"
          >
            <Database size={13} />
            Change Repository
            <ChevronDown size={12} className={`ml-auto transition ${showIndexPanel ? "rotate-180" : ""}`} />
          </button>
          {isAdmin && (
            <button
              onClick={() => router.push("/activity")}
              className="w-full px-3 py-2 bg-pc-elevated border border-pc-border rounded text-xs text-pc-secondary hover:text-pc-text hover:bg-pc-hover transition flex items-center gap-2"
            >
              <Users size={13} />
              Admin Dashboard
              <Activity size={12} className="ml-auto" />
            </button>
          )}
          {isManager && (
            <button
              onClick={() => router.push("/manager")}
              className="w-full px-3 py-2 bg-pc-elevated border border-pc-border rounded text-xs text-pc-secondary hover:text-pc-text hover:bg-pc-hover transition flex items-center gap-2"
            >
              <Users size={13} />
              Team Dashboard
              <Activity size={12} className="ml-auto" />
            </button>
          )}
        </div>

        {/* User */}
        <div className="border-t border-pc-border p-3 space-y-2 flex-shrink-0">
          <div className="flex items-center gap-2 px-1">
            <div className="w-7 h-7 rounded bg-pc-elevated border border-pc-border flex items-center justify-center text-pc-accent text-xs font-mono font-semibold">
              {user?.username?.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-pc-text truncate">{user?.username}</p>
              <p className="text-[10px] text-pc-muted">{user?.role || "developer"}</p>
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
            <Terminal size={14} className="text-pc-muted" />
            <span className="text-sm text-pc-text font-medium">PrivCode Assistant</span>
          </div>

          <div className="ml-auto flex items-center gap-2 text-xs text-pc-muted">
            <div className="flex items-center gap-1.5 px-2 py-1 bg-pc-elevated rounded border border-pc-border">
              <FolderGit2 size={12} />
              <span className="font-mono">{repoPath.replace(/\.git$/, "").split("/").filter(Boolean).pop() || "no repo"}</span>
            </div>
          </div>
        </div>

        {/* Repository Panel */}
        {showIndexPanel && (
          <div className="border-b border-pc-border bg-pc-surface px-4 py-3">
            <div className="max-w-2xl mx-auto flex items-end gap-3">
              <div className="flex-1">
                <label className="block text-[10px] text-pc-muted uppercase tracking-wider mb-1 font-medium">Repository Path or Git URL</label>
                <input
                  value={repoPath}
                  onChange={(e) => setRepoPath(e.target.value)}
                  placeholder="~/my-project  or  https://github.com/user/repo.git"
                  className="w-full px-3 py-1.5 bg-pc-bg border border-pc-border rounded text-xs font-mono text-pc-text focus:outline-none focus:border-pc-accent transition placeholder:text-pc-muted/50"
                />
              </div>
              <button
                onClick={handleIndex}
                disabled={indexing}
                className="px-4 py-1.5 bg-pc-accent text-[#0d1117] text-xs font-medium rounded hover:bg-pc-accent-hover transition disabled:opacity-50 whitespace-nowrap"
              >
                {indexing ? "Cloning & Indexing..." : "Index & Switch"}
              </button>
            </div>
            <p className="max-w-2xl mx-auto text-[10px] text-pc-muted mt-2">
              Paste a local path or a remote Git URL (GitHub, GitLab, etc.). Remote repos are cloned automatically and indexed for queries.
            </p>
          </div>
        )}



        {/* ── Chat Area ── */}
        <div className="flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            /* Empty State */
            <div className="flex flex-col items-center justify-center h-full px-4">
              <div className="max-w-lg w-full text-center">
                <div className="w-12 h-12 border border-pc-border rounded-lg flex items-center justify-center mx-auto mb-5">
                  <Terminal size={22} className="text-pc-muted" />
                </div>
                <h2 className="text-xl font-semibold text-pc-text mb-1">What do you want to know?</h2>
                <p className="text-sm text-pc-secondary mb-8">
                  Ask about your codebase — bugs, architecture, security, performance.
                </p>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleQuickAction("Find potential bugs in the codebase")}
                    className="p-3 bg-pc-surface border border-pc-border rounded hover:border-pc-accent/40 hover:bg-pc-elevated transition text-left group"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Bug size={14} className="text-pc-danger" />
                      <span className="text-xs font-medium text-pc-text">Find bugs</span>
                    </div>
                    <p className="text-[11px] text-pc-muted leading-relaxed">Detect issues and errors</p>
                  </button>

                  <button
                    onClick={() => handleQuickAction("Explain how the authentication system works")}
                    className="p-3 bg-pc-surface border border-pc-border rounded hover:border-pc-accent/40 hover:bg-pc-elevated transition text-left group"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <BookOpen size={14} className="text-pc-accent" />
                      <span className="text-xs font-medium text-pc-text">Explain code</span>
                    </div>
                    <p className="text-[11px] text-pc-muted leading-relaxed">Understand code flow</p>
                  </button>

                  <button
                    onClick={() => handleQuickAction("Check for security vulnerabilities")}
                    className="p-3 bg-pc-surface border border-pc-border rounded hover:border-pc-accent/40 hover:bg-pc-elevated transition text-left group"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <ShieldAlert size={14} className="text-pc-warning" />
                      <span className="text-xs font-medium text-pc-text">Security audit</span>
                    </div>
                    <p className="text-[11px] text-pc-muted leading-relaxed">Check vulnerabilities</p>
                  </button>

                  <button
                    onClick={() => handleQuickAction("Suggest performance optimizations")}
                    className="p-3 bg-pc-surface border border-pc-border rounded hover:border-pc-accent/40 hover:bg-pc-elevated transition text-left group"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Zap size={14} className="text-pc-success" />
                      <span className="text-xs font-medium text-pc-text">Optimize</span>
                    </div>
                    <p className="text-[11px] text-pc-muted leading-relaxed">Improve performance</p>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* Messages */
            <div className="max-w-3xl mx-auto px-4 py-6 space-y-1">
              {messages.map((m) => (
                <div key={m.id} className={`group ${m.role === "user" ? "flex justify-end" : ""}`}>
                  {m.role === "user" ? (
                    /* User bubble */
                    <div className="max-w-[75%] px-4 py-2.5 bg-pc-accent/10 border border-pc-accent/20 rounded-lg rounded-br-sm">
                      <p className="text-sm text-pc-text whitespace-pre-wrap break-words">{m.content}</p>
                      <p className="text-[10px] text-pc-muted mt-1.5">
                        {new Date(m.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  ) : (
                    /* Assistant response */
                    <div className="py-4 border-b border-pc-border/50">
                      <div className="flex items-start gap-3">
                        <div className="w-6 h-6 rounded bg-pc-elevated border border-pc-border flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Terminal size={12} className="text-pc-accent" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div
                            className={`text-sm leading-relaxed break-words font-mono ${
                              m.isError ? "text-pc-danger" : "text-pc-text"
                            }`}
                          >
                            <MessageContent content={m.content} />
                          </div>
                          <div className="flex items-center gap-3 mt-2">
                            <p className="text-[10px] text-pc-muted">
                              {m.timestamp && new Date(m.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </p>
                            <button
                              onClick={() => handleCopy(m.content, m.id)}
                              className="opacity-0 group-hover:opacity-100 text-pc-muted hover:text-pc-text transition flex items-center gap-1 text-[10px]"
                            >
                              {copiedId === m.id ? <Check size={11} /> : <Copy size={11} />}
                              {copiedId === m.id ? "Copied" : "Copy"}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {loading && (
                <div className="py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded bg-pc-elevated border border-pc-border flex items-center justify-center">
                      <Terminal size={12} className="text-pc-accent" />
                    </div>
                    <div className="flex items-center gap-2 text-pc-muted text-sm">
                      <Loader2 size={14} className="animate-spin" />
                      <span className="font-mono text-xs">Analyzing...</span>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* ── Input ── */}
        <div className="border-t border-pc-border bg-pc-surface px-4 py-3">
          <form onSubmit={handleSubmit} className="max-w-3xl mx-auto">
            {/* Mode Toggle */}
            <div className="flex items-center gap-1 mb-2">
              {[
                { key: "auto", label: "Auto", icon: Sparkles, desc: "RAG first, then general" },
                { key: "repo", label: "Repo", icon: GitBranch, desc: "Codebase only" },
                { key: "general", label: "General", icon: Globe, desc: "Direct LLM" },
              ].map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setQueryMode(key)}
                  className={`px-2.5 py-1 rounded text-[11px] font-medium flex items-center gap-1.5 transition ${
                    queryMode === key
                      ? "bg-pc-accent/15 text-pc-accent border border-pc-accent/30"
                      : "text-pc-muted hover:text-pc-secondary border border-transparent hover:bg-pc-elevated"
                  }`}
                >
                  <Icon size={12} />
                  {label}
                </button>
              ))}
              <span className="text-[10px] text-pc-muted ml-2">
                {queryMode === "auto" && "— tries codebase first, falls back to general"}
                {queryMode === "repo" && "— answers only from indexed repository"}
                {queryMode === "general" && "— general coding assistant, no repo context"}
              </span>
            </div>

            <div className="relative">
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={
                  queryMode === "general"
                    ? "Ask anything about coding..."
                    : queryMode === "repo"
                    ? "Ask about your codebase..."
                    : "Ask about your code or anything else..."
                }
                className="w-full px-4 py-3 pr-12 bg-pc-bg border border-pc-border rounded-lg text-sm text-pc-text placeholder-pc-muted focus:outline-none focus:border-pc-accent focus:ring-1 focus:ring-pc-accent/30 transition"
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-pc-accent hover:bg-pc-accent/10 rounded transition disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <Send size={16} />
              </button>
            </div>
            <p className="text-[10px] text-pc-muted text-center mt-2">
              PrivCode runs locally. Responses are generated by your on-device LLM.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}

