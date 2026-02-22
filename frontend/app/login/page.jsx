"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { loginUser } from "@/lib/api";
import { auth } from "@/lib/auth";
import { Lock, User, Eye, EyeOff, Loader2, ArrowRight, Terminal, ShieldCheck, Wifi, WifiOff } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await loginUser(username, password);
      auth.login(response.token, response.username, response.role);
      router.push("/chat");
    } catch (err) {
      setError(err?.response?.data?.detail || "Invalid username or password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-pc-bg flex">
      {/* LEFT PANEL — Branding */}
      <div className="hidden lg:flex lg:w-[480px] xl:w-[520px] bg-pc-surface border-r border-pc-border flex-col justify-between p-10">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 border-2 border-pc-accent rounded flex items-center justify-center">
            <span className="font-mono text-pc-accent text-sm font-semibold">&gt;_</span>
          </div>
          <span className="text-lg font-semibold text-pc-text tracking-tight">PrivCode</span>
        </div>

        {/* Center content */}
        <div className="space-y-10">
          <div>
            <h2 className="text-3xl font-semibold text-pc-text leading-tight mb-3">
              Private code intelligence.
            </h2>
            <p className="text-pc-secondary text-base leading-relaxed">
              Analyze your codebase with AI — fully offline, end-to-end encrypted, zero cloud dependencies.
            </p>
          </div>

          <div className="space-y-5">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded bg-pc-elevated border border-pc-border flex items-center justify-center flex-shrink-0 mt-0.5">
                <WifiOff size={16} className="text-pc-accent" />
              </div>
              <div>
                <p className="text-sm font-medium text-pc-text mb-0.5">Air-gapped operation</p>
                <p className="text-sm text-pc-muted">No internet required. Your code stays on your machine.</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded bg-pc-elevated border border-pc-border flex items-center justify-center flex-shrink-0 mt-0.5">
                <ShieldCheck size={16} className="text-pc-success" />
              </div>
              <div>
                <p className="text-sm font-medium text-pc-text mb-0.5">Encrypted at rest</p>
                <p className="text-sm text-pc-muted">Redis, indexes, and audit logs all Fernet-encrypted.</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded bg-pc-elevated border border-pc-border flex items-center justify-center flex-shrink-0 mt-0.5">
                <Terminal size={16} className="text-pc-warning" />
              </div>
              <div>
                <p className="text-sm font-medium text-pc-text mb-0.5">Local LLM + RAG</p>
                <p className="text-sm text-pc-muted">Llama 3 running locally with hybrid vector retrieval.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 text-pc-muted text-xs">
          <div className="w-1.5 h-1.5 rounded-full bg-pc-success" />
          System online &middot; v1.0
        </div>
      </div>

      {/* RIGHT PANEL — Login Form */}
      <div className="flex-1 flex flex-col justify-center px-6 sm:px-12 lg:px-16">
        <div className="max-w-sm mx-auto w-full">
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center gap-2 mb-10">
            <div className="w-8 h-8 border-2 border-pc-accent rounded flex items-center justify-center">
              <span className="font-mono text-pc-accent text-xs font-semibold">&gt;_</span>
            </div>
            <span className="text-lg font-semibold text-pc-text">PrivCode</span>
          </div>

          {/* Header */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-pc-text mb-1">Sign in</h2>
            <p className="text-sm text-pc-secondary">Authenticate to access the code intelligence dashboard.</p>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-5 px-3 py-2.5 bg-[rgba(248,81,73,0.1)] border border-pc-danger/30 rounded text-sm text-pc-danger">
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4 mb-6">
            <div>
              <label htmlFor="username" className="block text-xs font-medium text-pc-secondary mb-1.5 uppercase tracking-wider">
                Username
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-pc-muted" />
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter username"
                  required
                  autoComplete="username"
                  className="w-full pl-10 pr-4 py-2.5 bg-pc-surface border border-pc-border rounded text-sm text-pc-text placeholder-pc-muted focus:outline-none focus:border-pc-accent focus:ring-1 focus:ring-pc-accent/50 transition"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-medium text-pc-secondary mb-1.5 uppercase tracking-wider">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-pc-muted" />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  required
                  autoComplete="current-password"
                  className="w-full pl-10 pr-10 py-2.5 bg-pc-surface border border-pc-border rounded text-sm text-pc-text placeholder-pc-muted focus:outline-none focus:border-pc-accent focus:ring-1 focus:ring-pc-accent/50 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-pc-muted hover:text-pc-secondary transition"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-2.5 bg-pc-accent hover:bg-pc-accent-hover text-[#0d1117] font-medium text-sm rounded transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Authenticating...
                </>
              ) : (
                <>
                  Sign in
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          {/* Separator */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-pc-border" />
            </div>
            <div className="relative flex justify-center">
              <span className="px-3 bg-pc-bg text-pc-muted text-xs uppercase tracking-wider">Credentials</span>
            </div>
          </div>

          {/* Credential Cards */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => { setUsername("admin"); setPassword("admin123"); }}
              className="p-3 bg-pc-surface border border-pc-border rounded hover:border-pc-accent/50 transition text-left group"
            >
              <div className="flex items-center gap-1.5 mb-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-pc-success" />
                <span className="text-[10px] text-pc-muted font-medium uppercase tracking-wider">Admin</span>
              </div>
              <p className="font-mono text-xs text-pc-text">admin</p>
              <p className="font-mono text-[10px] text-pc-muted mt-0.5">admin123</p>
            </button>

            <button
              type="button"
              onClick={() => { setUsername("developer"); setPassword("dev123"); }}
              className="p-3 bg-pc-surface border border-pc-border rounded hover:border-pc-accent/50 transition text-left group"
            >
              <div className="flex items-center gap-1.5 mb-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-pc-secondary" />
                <span className="text-[10px] text-pc-muted font-medium uppercase tracking-wider">Developer</span>
              </div>
              <p className="font-mono text-xs text-pc-text">developer</p>
              <p className="font-mono text-[10px] text-pc-muted mt-0.5">dev123</p>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

