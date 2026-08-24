"use client";
import { useEffect, useState } from "react";

export default function AdminUsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("user");
  const [loading, setLoading] = useState(false);

  async function load() {
    const res = await fetch(`/api/admin/users?q=${encodeURIComponent(q)}`);
    const data = await res.json();
    if (res.ok) setUsers(data.users || []);
  }
  useEffect(() => {
    load();
  }, []);

  async function create() {
    if (!email || !password) return alert("邮箱密码必填");
    setLoading(true);
    const res = await fetch("/api/admin/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password, role }) });
    const data = await res.json();
    if (!res.ok) alert(data.error || "创建失败");
    else {
      setEmail("");
      setPassword("");
      load();
    }
    setLoading(false);
  }

  async function toggleStatus(u: any) {
    const next = u.status === "active" ? "disabled" : "active";
    const res = await fetch(`/api/admin/users/${u.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: next }) });
    if (res.ok) load();
  }

  const [editUser, setEditUser] = useState<any>(null);
  const [editRole, setEditRole] = useState("user");
  const [editPassword, setEditPassword] = useState("");

  async function saveEdit() {
    if (!editUser) return;
    const body: any = { role: editRole };
    if (editPassword) body.password = editPassword;
    const res = await fetch(`/api/admin/users/${editUser.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json();
    if (!res.ok) alert(data.error || "更新失败");
    else {
      setEditUser(null);
      setEditPassword("");
      load();
    }
  }

  async function delUser(id: string) {
    if (!confirm("确定删除该用户？")) return;
    const res = await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
    if (res.ok) load();
    else alert("删除失败");
  }

  return (
    <div>
      <h1 className="text-xl font-bold">用户管理</h1>
      <div className="mt-4 flex gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜索邮箱" className="px-3 py-2 rounded-xl bg-[#1a1a1e] border border-white/10 text-sm" />
        <button onClick={load} className="px-4 py-2 rounded-xl bg-white/10 text-sm">搜索</button>
      </div>
      <div className="mt-6 rounded-2xl bg-[#1a1a1e] border border-white/10 p-4">
        <div className="text-sm font-bold">新建用户</div>
        <div className="flex gap-2 mt-3">
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="邮箱" className="flex-1 px-3 py-2 rounded-xl bg-[#0f0f12] border border-white/10 text-sm" />
          <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="密码" className="flex-1 px-3 py-2 rounded-xl bg-[#0f0f12] border border-white/10 text-sm" />
          <select value={role} onChange={(e) => setRole(e.target.value)} className="px-3 py-2 rounded-xl bg-[#0f0f12] border border-white/10 text-sm">
            <option value="user">user</option>
            <option value="admin">admin</option>
          </select>
          <button onClick={create} disabled={loading} className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 text-sm disabled:opacity-50">创建</button>
        </div>
      </div>
      <div className="mt-6 rounded-2xl bg-[#1a1a1e] border border-white/10 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-white/60">
            <tr>
              <th className="p-3 text-left">邮箱</th>
              <th className="p-3">角色</th>
              <th className="p-3">状态</th>
              <th className="p-3">创建时间</th>
              <th className="p-3">操作</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-white/10">
                <td className="p-3">{u.email}</td>
                <td className="p-3 text-center">{u.role}</td>
                <td className="p-3 text-center">
                  <span className={`px-2 py-1 rounded text-xs ${u.status === "active" ? "bg-green-500/20 text-green-300" : "bg-white/10"}`}>{u.status}</span>
                </td>
                <td className="p-3 text-center text-white/50">{new Date(u.createdAt).toLocaleString()}</td>
                <td className="p-3 text-center flex gap-1 justify-center">
                  <button onClick={() => { setEditUser(u); setEditRole(u.role); }} className="px-2 py-1 rounded bg-white/10 text-xs">编辑</button>
                  <button onClick={() => toggleStatus(u)} className="px-2 py-1 rounded bg-white/10 text-xs">{u.status === "active" ? "禁用" : "启用"}</button>
                  <button onClick={() => delUser(u.id)} className="px-2 py-1 rounded bg-red-500/20 text-red-300 text-xs">删除</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editUser && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setEditUser(null)}>
          <div className="w-full max-w-sm rounded-2xl bg-[#1a1a1e] border border-white/10 p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-bold">编辑用户 · {editUser.email}</h3>
            <div className="mt-4 space-y-3">
              <select value={editRole} onChange={(e) => setEditRole(e.target.value)} className="w-full px-3 py-2 rounded-xl bg-[#0f0f12] border border-white/10 text-sm">
                <option value="user">user</option>
                <option value="admin">admin</option>
              </select>
              <input value={editPassword} onChange={(e) => setEditPassword(e.target.value)} placeholder="新密码（留空不改）" className="w-full px-3 py-2 rounded-xl bg-[#0f0f12] border border-white/10 text-sm" />
              <div className="flex gap-2">
                <button onClick={saveEdit} className="flex-1 py-2 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 text-sm">保存</button>
                <button onClick={() => setEditUser(null)} className="px-4 py-2 rounded-xl bg-white/10 text-sm">取消</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
