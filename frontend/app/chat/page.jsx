"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { auth } from "@/lib/auth";
import { 
  Send, 
  Loader2, 
  LogOut, 
  User, 
  Moon, 
  Sun,
  Download,
  Trash2,
  Shield,
  Eye
} from "lucide-react";

export default function ChatPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState({ username: "", role: "" });
  const [darkMode, setDarkMode] = useState(true);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    setMounted(true);
    
    // Check authentication
    if (!auth.isAuthenticated()) {
      router.push("/login");
      return;
    }

    // Load user info
    const userData = auth.getUser();
    setUser(userData);

    // Load chat history from localStorage
    const savedMessages = localStorage.getItem("chatHistory");
    if (savedMessages) {
      try {
        setMessages(JSON.parse(savedMessages));
      } catch (e) {
        console.error("Failed to load chat history:", e);
      }
    }
  }, [router]);

  useEffect(() => {
    // Save messages to localStorage whenever they change
    if (mounted && messages.length > 0) {
      localStorage.setItem("chatHistory", JSON.stringify(messages));
    }
  }, [messages, mounted]);

  useEffect(() => {
    // Scroll to bottom when new messages arrive
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleLogout = () => {
    auth.logout();
  };

  const handleClearChat = () => {
    if (confirm("Clear all chat history?")) {
      setMessages([]);
      localStorage.removeItem("chatHistory");
    }
  };

  const handleExportChat = () => {
    const exportData = {
      exported_at: new Date().toISOString(),
      user: user.username,
      messages: messages,
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `privcode-chat-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage = {
      id: Date.now(),
      role: "user",
      content: input.trim(),
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const response = await api.query(userMessage.content, "test_repo");
      
      const assistantMessage = {
        id: Date.now() + 1,
        role: "assistant",
        content: response.data.response,
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage = {
        id: Date.now() + 1,
        role: "assistant",
        content: "Error: " + (error.response?.data?.detail || "Failed to get response from backend"),
        timestamp: new Date().toISOString(),
        isError: true,
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  if (!mounted) {
    return null;
  }

  return (
    <div className={`min-h-screen ${darkMode ? "bg-slate-900" : "bg-slate-100"}`}>
      {/* Header */}
      <header className={`border-b ${darkMode ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200"} sticky top-0 z-10`}>
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg flex items-center justify-center">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className={`text-xl font-bold ${darkMode ? "text-white" : "text-slate-900"}`}>
                PrivCode
              </h1>
              <p className={`text-xs ${darkMode ? "text-slate-400" : "text-slate-600"}`}>
                Private Code Intelligence
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {/* User Info */}
            <div className={`flex items-center space-x-2 px-3 py-2 rounded-lg ${darkMode ? "bg-slate-700" : "bg-slate-200"}`}>
              <User className={`w-4 h-4 ${darkMode ? "text-slate-300" : "text-slate-600"}`} />
              <span className={`text-sm font-medium ${darkMode ? "text-white" : "text-slate-900"}`}>
                {user.username}
              </span>
              {user.role === "admin" ? (
                <Shield className="w-4 h-4 text-purple-400" />
              ) : (
                <Eye className="w-4 h-4 text-blue-400" />
              )}
            </div>

            {/* Dark Mode Toggle */}
            <button
              onClick={() => setDarkMode(!darkMode)}
              className={`p-2 rounded-lg ${darkMode ? "bg-slate-700 hover:bg-slate-600" : "bg-slate-200 hover:bg-slate-300"} transition`}
            >
              {darkMode ? (
                <Sun className="w-5 h-5 text-yellow-400" />
              ) : (
                <Moon className="w-5 h-5 text-slate-600" />
              )}
            </button>

            {/* Export */}
            <button
              onClick={handleExportChat}
              disabled={messages.length === 0}
              className={`p-2 rounded-lg ${darkMode ? "bg-slate-700 hover:bg-slate-600" : "bg-slate-200 hover:bg-slate-300"} transition disabled:opacity-50`}
              title="Export Chat"
            >
              <Download className={`w-5 h-5 ${darkMode ? "text-slate-300" : "text-slate-600"}`} />
            </button>

            {/* Clear */}
            <button
              onClick={handleClearChat}
              disabled={messages.length === 0}
              className={`p-2 rounded-lg ${darkMode ? "bg-slate-700 hover:bg-slate-600" : "bg-slate-200 hover:bg-slate-300"} transition disabled:opacity-50`}
              title="Clear Chat"
            >
              <Trash2 className={`w-5 h-5 ${darkMode ? "text-slate-300" : "text-slate-600"}`} />
            </button>

            {/* Logout */}
            <button
              onClick={handleLogout}
              className="p-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 transition"
              title="Logout"
            >
              <LogOut className="w-5 h-5 text-red-400" />
            </button>
          </div>
        </div>
      </header>

      {/* Chat Area */}
      <main className="max-w-5xl mx-auto px-4 py-6">
        <div className="space-y-4 mb-24">
          {messages.length === 0 ? (
            <div className="text-center py-20">
              <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Shield className="w-10 h-10 text-white" />
              </div>
              <h2 className={`text-2xl font-bold mb-2 ${darkMode ? "text-white" : "text-slate-900"}`}>
                Welcome to PrivCode
              </h2>
              <p className={`${darkMode ? "text-slate-400" : "text-slate-600"} mb-6`}>
                Ask me anything about your codebase
              </p>
              <div className={`max-w-md mx-auto space-y-2 text-left ${darkMode ? "text-slate-400" : "text-slate-600"} text-sm`}>
                <p>• "Find security vulnerabilities in auth.py"</p>
                <p>• "Explain the payment flow"</p>
                <p>• "Show me error handling patterns"</p>
              </div>
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-3xl rounded-2xl px-6 py-4 ${
                    message.role === "user"
                      ? "bg-gradient-to-r from-purple-500 to-indigo-600 text-white"
                      : message.isError
                      ? darkMode ? "bg-red-900/30 border border-red-500/30 text-red-300" : "bg-red-100 border border-red-300 text-red-800"
                      : darkMode ? "bg-slate-800 text-slate-100" : "bg-white border border-slate-200 text-slate-900"
                  }`}
                >
                  <div className="prose prose-sm max-w-none">
                    <pre className="whitespace-pre-wrap font-sans">{message.content}</pre>
                  </div>
                  <div className={`text-xs mt-2 ${message.role === "user" ? "text-purple-200" : darkMode ? "text-slate-500" : "text-slate-400"}`}>
                    {new Date(message.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))
          )}
          {loading && (
            <div className="flex justify-start">
              <div className={`rounded-2xl px-6 py-4 ${darkMode ? "bg-slate-800" : "bg-white border border-slate-200"}`}>
                <Loader2 className={`w-6 h-6 animate-spin ${darkMode ? "text-slate-400" : "text-slate-600"}`} />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Input Area */}
      <div className={`fixed bottom-0 left-0 right-0 border-t ${darkMode ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200"}`}>
        <div className="max-w-5xl mx-auto px-4 py-4">
          <form onSubmit={handleSubmit} className="flex space-x-3">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about your codebase..."
              disabled={loading}
              className={`flex-1 px-4 py-3 rounded-xl ${
                darkMode 
                  ? "bg-slate-700 text-white placeholder-slate-400 border border-slate-600" 
                  : "bg-slate-100 text-slate-900 placeholder-slate-500 border border-slate-300"
              } focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50`}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="px-6 py-3 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-xl hover:from-purple-600 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center space-x-2"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
              <span className="hidden sm:inline">Send</span>
            </button>
          </form>
          <p className={`text-xs text-center mt-2 ${darkMode ? "text-slate-500" : "text-slate-400"}`}>
            🔒 100% Offline • Zero Cloud • Enterprise Privacy
          </p>
        </div>
      </div>
    </div>
  );
}
