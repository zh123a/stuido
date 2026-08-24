"use client";
import { useEffect, useState } from "react";

export default function AdminProjectsPage() {
  const [list, setList] = useState<any[]>([]);
  const [q, setQ] = useState("");

  async function load() {
    const res = await fetch(`/api/admin/projects?q=${encodeURIComponent(q)}`);
    const data = await res.json();
    if (res.ok) setList(data.projects || []);
  }
  useEffect(() => {
    load();
  }, []);

  async function del(id: string) {
    if (!confirm("确定删除该项目？将同时删除本地渲染文件")) return;
    const res = await fetch(`/api/admin/projects/${id}`, { method: "DELETE" });
    if (res.ok) load();
    else alert("删除失败");
  }

  return (
    <div>
      <h1 className="text-xl font-bold">项目管理</h1>
      <div className="mt-4 flex gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜索标题" className="px-3 py-2 rounded-xl bg-[#1a1a1e] border border-white/10 text-sm flex-1" />
        <button onClick={load} className="px-4 py-2 rounded-xl bg-white/10 text-sm">搜索</button>
      </div>
      <div className="mt-6 rounded-2xl bg-[#1a1a1e] border border-white/10 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-white/60">
            <tr>
              <th className="p-3 text-left">标题</th>
              <th className="p-3">归属</th>
              <th className="p-3">状态</th>
              <th className="p-3">创建时间</th>
              <th className="p-3">操作</th>
            </tr>
          </thead>
          <tbody>
            {list.map((p) => (
              <tr key={p.id} className="border-t border-white/10">
                <td className="p-3">{p.title || p.id.slice(0, 8)}</td>
                <td className="p-3 text-center text-xs">{p.ownerEmail || p.ownerId?.slice(0, 8) || "游客"}</td>
                <td className="p-3 text-center">
                  <span className="px-2 py-1 rounded bg-white/10 text-xs">{p.status}</span>
                </td>
                <td className="p-3 text-center text-white/50 text-xs">{new Date(p.createdAt).toLocaleString()}</td>
                <td className="p-3 text-center flex gap-1 justify-center">
                  <a href={`/project/${p.id}/plan`} className="px-2 py-1 rounded bg-white/10 text-xs">查看</a>
                  <a href={`/api/projects/${p.id}/preview`} target="_blank" className="px-2 py-1 rounded bg-purple-500/20 text-purple-300 text-xs">预览</a>
                  <button onClick={() => del(p.id)} className="px-2 py-1 rounded bg-red-500/20 text-red-300 text-xs">删除</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
