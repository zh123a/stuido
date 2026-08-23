"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

export default function PlanPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [plan, setPlan] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // W1 简化：从 renders/plan.json 取，实际走 API
    // 这里先尝试从 creation 返回的内存中取，若刷新则提示
    fetch(`/api/projects/${id}`).then(async (r) => {
      if (r.ok) setPlan(await r.json());
      setLoading(false);
    });
  }, [id]);

  if (loading) return <div className="p-10 text-white/60">加载创作规划书中...</div>;
  if (!plan) return <div className="p-10 text-white/60">未找到规划书，请返回首页重新创建。<button onClick={() => router.push("/")} className="ml-2 underline">返回</button></div>;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <header className="px-6 py-4 border-b border-white/10 flex justify-between">
        <span className="font-bold">Stuido</span>
        <span className="text-sm text-white/60">创作规划书 · {plan.title}</span>
      </header>

      <div className="flex">
        <div className="flex-1 p-6">
          <h2 className="text-xl font-bold mb-4">创作规划书</h2>
          <div className="rounded-xl border border-white/10 overflow-hidden">
            <div className="grid grid-cols-[140px_1fr_1.2fr] bg-white/5 text-xs font-medium">
              <div className="p-3 border-r border-white/10">画面类型</div>
              <div className="p-3 border-r border-white/10">口播脚本</div>
              <div className="p-3">画面描述</div>
            </div>
            {plan.scenes.map((s: any) => (
              <div key={s.id} className="grid grid-cols-[140px_1fr_1.2fr] border-t border-white/10 text-xs">
                <div className="p-3 border-r border-white/10">
                  <span className={`px-2 py-1 rounded text-[11px] ${s.mg ? "bg-purple-500/20 text-purple-300" : "bg-white/10"}`}>
                    {s.mg ? "视频素材 + MG动画" : "视频素材"}
                  </span>
                  <div className="mt-1 text-white/40">分镜{s.id} · {s.durationMs / 1000}s</div>
                </div>
                <div className="p-3 border-r border-white/10 text-white/80">{s.narration}</div>
                <div className="p-3 text-white/60">
                  <div className="font-medium text-white/80">素材检索</div>
                  <div>查询：{s.search.query} / 国家:{s.search.filters.country} 年代:{s.search.filters.year}</div>
                  {s.mg && (
                    <>
                      <div className="mt-2 font-medium text-white/80">MG动画</div>
                      <div>{s.mg.prompt}</div>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="w-[320px] border-l border-white/10 p-6 bg-[#141416]">
          <div className="text-sm font-bold">画面构建</div>
          <div className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-white/60">视频素材匹配 * {plan.metrics.videoClips}</span><span>0</span></div>
            <div className="flex justify-between"><span className="text-white/60">MG动画场景 * {plan.metrics.mgScenes}</span><span>{plan.metrics.mgScenes * 93}</span></div>
            <div className="flex justify-between"><span className="text-white/60">旁白配音</span><span>0</span></div>
            <div className="flex justify-between font-bold pt-2 border-t border-white/10"><span>总预估消耗</span><span className="text-purple-400">{plan.metrics.cost}</span></div>
          </div>
          <button
            onClick={async () => {
              const r = await fetch(`/api/projects/${id}/confirm`, { method: "POST" });
              if (r.ok) router.push(`/project/${id}/edit`);
              else alert("确认失败");
            }}
            className="mt-6 w-full py-3 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 font-bold"
          >
            {plan.metrics.cost} 确认并继续
          </button>
          <p className="mt-2 text-xs text-white/40">W2：确认后触发并行生成（TTS+素材+MG），编辑器可实时查看进度</p>
          <div className="mt-6 p-3 rounded-xl bg-white/5 text-xs text-white/60">
            分镜方案已生成，请确认是否满足创作需求，确认后即可开始制作视频成片。
          </div>
        </div>
      </div>
    </div>
  );
}
