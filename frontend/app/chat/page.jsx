"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { queryCode, indexRepo } from "@/lib/api";
import { auth } from "@/lib/auth";
import {
  Send,
  Loader2,
  LogOut,
  User,
  Plus,
  Menu,
  X,
  Code2,
  MessageCircle,
  Settings,
  Database,
  ChevronRight,
  Copy,
} from "lucide-react";

export default function ChatPage() {
  const router = useRouter();
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const [mounted, setMounted] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const [repoPath, setRepoPath] = useState("~/test_repo");
  const [indexPath, setIndexPath] = useState("./index");
  const [indexing, setIndexing] = useState(false);

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [user, setUser] = useState(null);
  const [showIndexPanel, setShowIndexPanel] = useState(false);

  // =============================
  // INIT
  // =============================
  useEffect(() => {
    setMounted(true);

    if (!auth.isAuthenticated()) {
      router.push("/login");
      return;
    }

    const userData = auth.getUser();
    setUser(userData);

    const saved = localStorage.getItem("chatHistory");
    if (saved) setMessages(JSON.parse(saved));
  }, [router]);

  useEffect(() => {
    if (mounted) {
      localStorage.setItem("chatHistory", JSON.stringify(messages));
    }
  }, [messages, mounted]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const isAdmin = user?.role === "admin";

  const handleLogout = () => {
    auth.logout();
  };

  const handleNewChat = () => {
    setMessages([]);
    localStorage.removeItem("chatHistory");
    inputRef.current?.focus();
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMsg = {
      id: Date.now(),
      role: "user",
      content: input,
      timestamp: new Date().toISOString(),
    };

    setMessages((p) => [...p, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await queryCode(input, repoPath);
      const data = res.data.response;

      let text = "";

      if (data.summary) text += `📌 Summary:\n${data.summary}\n\n`;
      if (data.explanation) text += `📝 Explanation:\n${data.explanation}\n\n`;
      if (data.bugs_found?.length)
        text += `🐛 Bugs:\n${data.bugs_found.map((b) => `• ${b}`).join("\n")}\n\n`;
      if (data.suggestions?.length)
        text += `💡 Suggestions:\n${data.suggestions.map((s) => `• ${s}`).join("\n")}\n\n`;
      if (data.sources?.length)
        text += `📂 Sources:\n${data.sources.map((s) => `• ${s}`).join("\n")}`;

      const botMsg = {
        id: Date.now() + 1,
        role: "assistant",
        content: text || "No response",
        timestamp: new Date().toISOString(),
      };

      setMessages((p) => [...p, botMsg]);
    } catch {
      setMessages((p) => [
        ...p,
        {
          id: Date.now(),
          role: "assistant",
          content: "❌ Query failed. Please try again.",
          isError: true,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  if (!mounted || !user) return null;

  return (
    <div className="flex h-screen bg-white">
      {/* SIDEBAR */}
      <div
        className={`${
          sidebarOpen ? "w-64" : "w-0"
        } bg-gradient-to-b from-gray-900 to-gray-800 border-r border-gray-700 flex flex-col transition-all duration-300 overflow-hidden`}
      >
        {/* Logo */}
        <div className="p-4 border-b border-gray-700">
          <div className="flex items-center gap-2 text-white font-bold text-lg">
            <Code2 size={24} className="text-purple-500" />
            <span>PrivCode</span>
          </div>
        </div>

        {/* New Chat Button */}
        <button
          onClick={handleNewChat}
          className="mx-4 mt-4 p-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:shadow-lg transition flex items-center gap-2 font-medium"
        >
          <Plus size={20} />
          New Chat
        </button>

        {/* Chat History */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {messages.length > 0 && (
            <div className="text-xs text-gray-400 mb-3">Today</div>
          )}
          {messages.length > 0 && (
            <button className="w-full p-3 text-left text-gray-300 hover:bg-gray-700 rounded-lg transition text-sm truncate">
              <MessageCircle size={16} className="inline mr-2" />
              {messages[0]?.content?.substring(0, 30)}...
            </button>
          )}
        </div>

        {/* Admin Panel Link */}
        {isAdmin && (
          <div className="border-t border-gray-700 p-4">
            <button
              onClick={() => setShowIndexPanel(!showIndexPanel)}
              className="w-full p-3 bg-gray-700 hover:bg-gray-600 text-gray-100 rounded-lg transition flex items-center gap-2 text-sm font-medium"
            >
              <Database size={18} />
              Repository Index
            </button>
          </div>
        )}

        {/* User Profile */}
        <div className="border-t border-gray-700 p-4 space-y-3">
          <div className="flex items-center gap-2 text-gray-300">
            <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-full flex items-center justify-center text-white text-sm font-bold">
              {user?.username?.charAt(0).toUpperCase()}
            </div>
            <span className="text-sm">{user?.username}</span>
            {isAdmin && <span className="text-xs bg-purple-600 px-2 py-1 rounded">Admin</span>}
          </div>

          <button
            onClick={handleLogout}
            className="w-full p-2 bg-gray-700 hover:bg-gray-600 text-gray-100 rounded-lg transition flex items-center gap-2 text-sm"
          >
            <LogOut size={16} />
            Logout
          </button>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="flex-1 flex flex-col bg-gradient-to-b from-gray-50 to-white">
        {/* TOP BAR */}
        <div className="border-b border-gray-200 bg-white p-4 flex items-center justify-between sticky top-0 z-10">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 hover:bg-gray-200 rounded-lg transition"
          >
            {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
          </button>

          <div className="text-center">
            <h1 className="text-xl font-semibold text-gray-900">PrivCode Assistant</h1>
            <p className="text-xs text-gray-500">Ask me anything about your code</p>
          </div>

          <div className="w-10" />
        </div>

        {/* ADMIN INDEX PANEL */}
        {isAdmin && showIndexPanel && (
          <div className="bg-blue-50 border-b border-blue-200 p-4">
            <div className="max-w-4xl mx-auto">
              <h3 className="font-semibold text-gray-900 mb-3">Repository Indexing</h3>
              <div className="space-y-3">
                <input
                  value={repoPath}
                  onChange={(e) => setRepoPath(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-lg text-sm"
                  placeholder="Repository Path"
                />
                <input
                  value={indexPath}
                  onChange={(e) => setIndexPath(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-lg text-sm"
                  placeholder="Index Path"
                />
                <button
                  onClick={handleIndex}
                  disabled={indexing}
                  className="w-full p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition disabled:opacity-50"
                >
                  {indexing ? "Indexing..." : "Index Repository"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* CHAT AREA */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <Code2 size={64} className="text-gray-300 mb-4" />
              <h2 className="text-3xl font-bold text-gray-900 mb-2">Welcome to PrivCode</h2>
              <p className="text-gray-600 max-w-md mb-8">
                Ask me anything about your codebase. I'll analyze it and provide insights.
              </p>
              <div className="grid grid-cols-2 gap-3 w-full max-w-md">
                <button className="p-4 bg-gray-100 hover:bg-gray-200 rounded-lg text-left transition">
                  <p className="font-medium text-gray-900">🔍 Find Bugs</p>
                  <p className="text-xs text-gray-600">Identify issues in code</p>
                </button>
                <button className="p-4 bg-gray-100 hover:bg-gray-200 rounded-lg text-left transition">
                  <p className="font-medium text-gray-900">📚 Explain</p>
                  <p className="text-xs text-gray-600">Understand code flow</p>
                </button>
                <button className="p-4 bg-gray-100 hover:bg-gray-200 rounded-lg text-left transition">
                  <p className="font-medium text-gray-900">🛡️ Security</p>
                  <p className="text-xs text-gray-600">Check vulnerabilities</p>
                </button>
                <button className="p-4 bg-gray-100 hover:bg-gray-200 rounded-lg text-left transition">
                  <p className="font-medium text-gray-900">⚡ Optimize</p>
                  <p className="text-xs text-gray-600">Performance tips</p>
                </button>
              </div>
            </div>
          ) : (
            <>
              {messages.map((m) => (
                <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-2xl p-4 rounded-lg ${
                      m.role === "user"
                        ? "bg-purple-600 text-white rounded-br-none"
                        : m.isError
                        ? "bg-red-100 text-red-900 rounded-bl-none border border-red-200"
                        : "bg-gray-100 text-gray-900 rounded-bl-none border border-gray-200"
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap break-words">{m.content}</p>
                    <p className={`text-xs mt-2 ${m.role === "user" ? "text-purple-200" : "text-gray-500"}`}>
                      {new Date(m.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))}

              {loading && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 p-4 rounded-lg rounded-bl-none">
                    <Loader2 size={24} className="animate-spin text-gray-600" />
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* INPUT AREA */}
        <div className="border-t border-gray-200 bg-white p-4">
          <form onSubmit={handleSubmit} className="max-w-4xl mx-auto flex gap-3">
            <div className="flex-1 relative">
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about your code..."
                className="w-full p-4 pr-12 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                rows="1"
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-purple-600 hover:bg-purple-100 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send size={20} />
              </button>
            </div>
          </form>
          <p className="text-xs text-gray-500 text-center mt-3">PrivCode can make mistakes. Please verify important information.</p>
        </div>
      </div>
    </div>
  );
}
