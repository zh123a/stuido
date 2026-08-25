"use client";
import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function RegisterForm() {
  const r = useRouter();
  const sp = useSearchParams();
  const next = sp.get("next") || "/";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErr("");
    const res = await fetch("/api/auth/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) setErr(data.error || "注册失败");
    else {
      try {
        const me = await fetch("/api/auth/me").then((x) => x.json());
        if (me?.user?.role === "admin") (r.push as any)("/admin");
        else (r.push as any)(next);
      } catch {
        (r.push as any)(next);
      }
    }
    setLoading(false);
  }
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] p-6">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl bg-[#1a1a1e] border border-white/10 p-6">
        <h1 className="text-xl font-bold">注册账号</h1>
        <p className="text-xs text-white/50 mt-1">首个账号为管理员，后续为普通用户</p>
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="邮箱" className="mt-4 w-full px-3 py-2 rounded-xl bg-[#0f0f12] border border-white/10 text-sm" />
        <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="至少6位密码" className="mt-3 w-full px-3 py-2 rounded-xl bg-[#0f0f12] border border-white/10 text-sm" />
        {err && <div className="mt-3 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">{err}</div>}
        <button disabled={loading} className="mt-4 w-full py-2 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 text-sm font-medium disabled:opacity-50">{loading ? "注册中..." : "注册并登录"}</button>
        <div className="mt-3 text-xs text-center text-white/40">已有账号？ <a href="/login" className="text-purple-400 underline">去登录</a></div>
      </form>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] text-white/50">加载中...</div>}>
      <RegisterForm />
    </Suspense>
  );
}
