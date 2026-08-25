"use client";
import { useEffect, useState } from "react";

const providers = [
  { v: "deepseek", l: "DeepSeek" },
  { v: "ark", l: "火山方舟 Ark" },
  { v: "openai", l: "OpenAI" },
  { v: "dashscope", l: "阿里百炼 DashScope" },
  { v: "agnes", l: "Agnes 视频 (agnes-video-2.5-flash)" },
  { v: "pexels", l: "Pexels" },
  { v: "pixabay", l: "Pixabay" },
];

export default function AdminChannelsPage() {
  const [list, setList] = useState<any[]>([]);
  const [form, setForm] = useState({ provider: "deepseek", name: "", apiKey: "", baseUrl: "", model: "", weight: 1, rateLimit: 60 });
  const [loading, setLoading] = useState(false);

  async function load() {
    const res = await fetch("/api/admin/channels");
    const data = await res.json();
    if (res.ok) setList(data.channels || []);
  }
  useEffect(() => {
    load();
  }, []);

  async function create() {
    if (!form.name || !form.apiKey) return alert("名称和 Key 必填");
    setLoading(true);
    const res = await fetch("/api/admin/channels", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const data = await res.json();
    if (!res.ok) alert(data.error || "创建失败");
    else {
      setForm({ provider: "deepseek", name: "", apiKey: "", baseUrl: "", model: "", weight: 1, rateLimit: 60 });
      load();
    }
    setLoading(false);
  }

  const [edit, setEdit] = useState<any>(null);
  const [editForm, setEditForm] = useState({ name: "", baseUrl: "", model: "", weight: 1, rateLimit: 60, apiKey: "" });

  async function toggle(c: any) {
    await fetch(`/api/admin/channels/${c.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive: !c.isActive }) });
    load();
  }
  async function del(id: string) {
    if (!confirm("确定删除该通道？")) return;
    await fetch(`/api/admin/channels/${id}`, { method: "DELETE" });
    load();
  }
  async function test(id: string) {
    const res = await fetch(`/api/admin/channels/${id}`, { method: "POST" });
    const data = await res.json();
    alert(res.ok ? `连通性: ${data.status}\n${data.body?.slice(0, 300)}` : `失败: ${data.error || data.body}`);
  }
  function startEdit(c: any) {
    setEdit(c);
    setEditForm({ name: c.name, baseUrl: c.baseUrl || "", model: c.model || "", weight: c.weight, rateLimit: c.rateLimit, apiKey: "" });
  }
  async function saveEdit() {
    if (!edit) return;
    const body: any = { name: editForm.name, baseUrl: editForm.baseUrl, model: editForm.model, weight: editForm.weight, rateLimit: editForm.rateLimit };
    if (editForm.apiKey) body.apiKey = editForm.apiKey;
    const res = await fetch(`/api/admin/channels/${edit.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json();
    if (!res.ok) alert(data.error || "更新失败");
    else {
      setEdit(null);
      load();
    }
  }

  return (
    <div>
      <h1 className="text-xl font-bold">接口通道 Key 管理</h1>
      <p className="text-xs text-white/50 mt-1">按提供商分组，支持加权随机与故障转移；Key 加密存储，列表仅显示脱敏值。</p>

      <div className="mt-6 rounded-2xl bg-[#1a1a1e] border border-white/10 p-4">
        <div className="text-sm font-bold">新增通道</div>
        <div className="grid grid-cols-2 gap-2 mt-3">
          <select value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })} className="px-3 py-2 rounded-xl bg-[#0f0f12] border border-white/10 text-sm">
            {providers.map((p) => (
              <option key={p.v} value={p.v}>{p.l}</option>
            ))}
          </select>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="通道名称 (如 deepseek-主)" className="px-3 py-2 rounded-xl bg-[#0f0f12] border border-white/10 text-sm" />
          <input value={form.apiKey} onChange={(e) => setForm({ ...form, apiKey: e.target.value })} placeholder="API Key (sk-...)" className="px-3 py-2 rounded-xl bg-[#0f0f12] border border-white/10 text-sm" />
          <input value={form.baseUrl} onChange={(e) => setForm({ ...form, baseUrl: e.target.value })} placeholder="Base URL (可选)" className="px-3 py-2 rounded-xl bg-[#0f0f12] border border-white/10 text-sm" />
          <input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} placeholder="Model (如 deepseek-chat)" className="px-3 py-2 rounded-xl bg-[#0f0f12] border border-white/10 text-sm" />
          <div className="flex gap-2">
            <input type="number" value={form.weight} onChange={(e) => setForm({ ...form, weight: parseInt(e.target.value) || 1 })} placeholder="权重" className="flex-1 px-3 py-2 rounded-xl bg-[#0f0f12] border border-white/10 text-sm" />
            <input type="number" value={form.rateLimit} onChange={(e) => setForm({ ...form, rateLimit: parseInt(e.target.value) || 60 })} placeholder="限流/分" className="flex-1 px-3 py-2 rounded-xl bg-[#0f0f12] border border-white/10 text-sm" />
          </div>
        </div>
        <button onClick={create} disabled={loading} className="mt-3 px-4 py-2 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 text-sm disabled:opacity-50">创建通道</button>
      </div>

      <div className="mt-6 rounded-2xl bg-[#1a1a1e] border border-white/10 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-white/60">
            <tr>
              <th className="p-3 text-left">提供商/名称</th>
              <th className="p-3">模型</th>
              <th className="p-3">Key(脱敏)</th>
              <th className="p-3">权重</th>
              <th className="p-3">状态</th>
              <th className="p-3">操作</th>
            </tr>
          </thead>
          <tbody>
            {list.map((c) => (
              <tr key={c.id} className="border-t border-white/10">
                <td className="p-3">
                  <div className="font-medium">{c.provider}</div>
                  <div className="text-white/60 text-xs">{c.name}</div>
                </td>
                <td className="p-3 text-center text-xs">{c.model || "-"}</td>
                <td className="p-3 text-center font-mono text-xs">{c.apiKeyMasked}</td>
                <td className="p-3 text-center">{c.weight}</td>
                <td className="p-3 text-center">
                  <span className={`px-2 py-1 rounded text-xs ${c.isActive ? "bg-green-500/20 text-green-300" : "bg-white/10"}`}>{c.isActive ? "启用" : "停用"}</span>
                </td>
                <td className="p-3 text-center flex gap-1 justify-center">
                  <button onClick={() => startEdit(c)} className="px-2 py-1 rounded bg-white/10 text-xs">编辑</button>
                  <button onClick={() => toggle(c)} className="px-2 py-1 rounded bg-white/10 text-xs">{c.isActive ? "停用" : "启用"}</button>
                  <button onClick={() => test(c.id)} className="px-2 py-1 rounded bg-white/10 text-xs">测试</button>
                  <button onClick={() => del(c.id)} className="px-2 py-1 rounded bg-red-500/20 text-red-300 text-xs">删除</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {edit && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setEdit(null)}>
          <div className="w-full max-w-md rounded-2xl bg-[#1a1a1e] border border-white/10 p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-bold">编辑通道 · {edit.provider} / {edit.name}</h3>
            <div className="mt-4 space-y-3">
              <input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} placeholder="通道名称" className="w-full px-3 py-2 rounded-xl bg-[#0f0f12] border border-white/10 text-sm" />
              <input value={editForm.baseUrl} onChange={(e) => setEditForm({ ...editForm, baseUrl: e.target.value })} placeholder="Base URL" className="w-full px-3 py-2 rounded-xl bg-[#0f0f12] border border-white/10 text-sm" />
              <input value={editForm.model} onChange={(e) => setEditForm({ ...editForm, model: e.target.value })} placeholder="Model" className="w-full px-3 py-2 rounded-xl bg-[#0f0f12] border border-white/10 text-sm" />
              <input value={editForm.apiKey} onChange={(e) => setEditForm({ ...editForm, apiKey: e.target.value })} placeholder="新 API Key（留空不改）" className="w-full px-3 py-2 rounded-xl bg-[#0f0f12] border border-white/10 text-sm" />
              <div className="flex gap-2">
                <input type="number" value={editForm.weight} onChange={(e) => setEditForm({ ...editForm, weight: parseInt(e.target.value) || 1 })} className="flex-1 px-3 py-2 rounded-xl bg-[#0f0f12] border border-white/10 text-sm" placeholder="权重" />
                <input type="number" value={editForm.rateLimit} onChange={(e) => setEditForm({ ...editForm, rateLimit: parseInt(e.target.value) || 60 })} className="flex-1 px-3 py-2 rounded-xl bg-[#0f0f12] border border-white/10 text-sm" placeholder="限流" />
              </div>
              <div className="flex gap-2">
                <button onClick={saveEdit} className="flex-1 py-2 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 text-sm">保存</button>
                <button onClick={() => setEdit(null)} className="px-4 py-2 rounded-xl bg-white/10 text-sm">取消</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
