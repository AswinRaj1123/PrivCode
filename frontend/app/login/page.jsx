"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { loginUser } from "@/lib/api";
import { auth } from "@/lib/auth";
import { Lock, User, Eye, EyeOff, Loader2, Code2, ArrowRight, Shield } from "lucide-react";

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
    <div className="min-h-screen bg-white flex">
      {/* LEFT SIDE - BRANDING & FEATURES */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-slate-900 via-slate-800 to-gray-900 text-white flex-col justify-between p-12">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg flex items-center justify-center">
            <Code2 size={24} />
          </div>
          <h1 className="text-2xl font-bold">PrivCode</h1>
        </div>

        {/* Features */}
        <div className="space-y-8">
          <div>
            <h2 className="text-4xl font-bold leading-tight mb-8">
              Private Code Intelligence at Your Fingertips
            </h2>
            <p className="text-gray-400 text-lg">
              Analyze your codebase securely, offline, and completely private.
            </p>
          </div>

          <div className="space-y-6">
            {/* Feature 1 */}
            <div className="flex gap-4">
              <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center flex-shrink-0 mt-1">
                <Shield size={24} className="text-purple-400" />
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-1">100% Offline</h3>
                <p className="text-gray-400">Your code never leaves your machine. Complete privacy guaranteed.</p>
              </div>
            </div>

            {/* Feature 2 */}
            <div className="flex gap-4">
              <div className="w-12 h-12 bg-indigo-500/20 rounded-lg flex items-center justify-center flex-shrink-0 mt-1">
                <Code2 size={24} className="text-indigo-400" />
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-1">Code Analysis</h3>
                <p className="text-gray-400">Get instant insights about bugs, security issues, and improvements.</p>
              </div>
            </div>

            {/* Feature 3 */}
            <div className="flex gap-4">
              <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center flex-shrink-0 mt-1">
                <Loader2 size={24} className="text-blue-400" />
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-1">Zero Cloud</h3>
                <p className="text-gray-400">No cloud storage, no tracking, no dependencies on external services.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <p className="text-gray-500 text-sm">
          © 2026 PrivCode. Secure code intelligence for everyone.
        </p>
      </div>

      {/* RIGHT SIDE - LOGIN FORM */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center px-6 sm:px-12 py-12 bg-white">
        <div className="max-w-md mx-auto w-full">
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg flex items-center justify-center">
              <Code2 size={20} className="text-white" />
            </div>
            <h1 className="text-xl font-bold text-gray-900">PrivCode</h1>
          </div>

          {/* Header */}
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">Welcome back</h2>
            <p className="text-gray-600">Sign in to access your private code intelligence.</p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-700 text-sm font-medium">{error}</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4 mb-6">
            {/* Username */}
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-900 mb-2">
                Username
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your username"
                  required
                  className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition text-gray-900 placeholder-gray-500"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-900 mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  className="w-full pl-11 pr-12 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition text-gray-900 placeholder-gray-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-medium rounded-lg hover:from-purple-700 hover:to-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 size={20} className="animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  Continue
                  <ArrowRight size={20} />
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">Default Credentials</span>
            </div>
          </div>

          {/* Demo Credentials */}
          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-xs text-blue-600 font-semibold mb-2">ADMIN</p>
              <p className="text-sm text-blue-900 font-mono break-all">admin</p>
              <p className="text-xs text-blue-700 font-mono mt-1">admin123</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-xs text-gray-600 font-semibold mb-2">VIEWER</p>
              <p className="text-sm text-gray-900 font-mono break-all">viewer</p>
              <p className="text-xs text-gray-700 font-mono mt-1">viewer123</p>
            </div>
          </div>

          {/* Footer Text */}
          <p className="text-xs text-gray-500 text-center">
            By signing in, you agree to our Terms of Service and Privacy Policy.
          </p>
        </div>
      </div>
    </div>
  );
}
