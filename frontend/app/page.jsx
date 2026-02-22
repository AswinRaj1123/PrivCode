"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const token = localStorage.getItem("token");
    if (token) {
      router.push("/chat");
    } else {
      router.push("/login");
    }
  }, [router]);

  if (!mounted) return null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-pc-bg">
      <div className="text-center">
        <div className="flex items-center justify-center gap-3 mb-4">
          <div className="w-8 h-8 border-2 border-pc-accent rounded flex items-center justify-center">
            <span className="font-mono text-pc-accent text-sm font-semibold">&gt;_</span>
          </div>
          <h1 className="text-2xl font-semibold text-pc-text tracking-tight">PrivCode</h1>
        </div>
        <div className="flex items-center justify-center gap-2 text-pc-muted text-sm">
          <div className="w-1.5 h-1.5 rounded-full bg-pc-accent animate-pulse" />
          Loading...
        </div>
      </div>
    </div>
  );
}
