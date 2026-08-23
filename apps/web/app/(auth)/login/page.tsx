"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const r = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErr("");
    const res = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) setErr(data.error || "登录失败");
    else r.push("/");
    setLoading(false);
  }
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] p-6">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl bg-[#1a1a1e] border border-white/10 p-6">
        <h1 className="text-xl font-bold">登录 Stuido</h1>
        <p className="text-xs text-white/50 mt-1">首个注册账号将自动成为管理员</p>
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="邮箱" className="mt-4 w-full px-3 py-2 rounded-xl bg-[#0f0f12] border border-white/10 text-sm" />
        <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="密码" className="mt-3 w-full px-3 py-2 rounded-xl bg-[#0f0f12] border border-white/10 text-sm" />
        {err && <div className="mt-3 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">{err}</div>}
        <button disabled={loading} className="mt-4 w-full py-2 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 text-sm font-medium disabled:opacity-50">{loading ? "登录中..." : "登录"}</button>
        <div className="mt-3 text-xs text-center text-white/40">没有账号？ <a href="/register" className="text-purple-400 underline">去注册</a> · <a href="/" className="underline">回首页</a></div>
      </form>
    </div>
  );
}
