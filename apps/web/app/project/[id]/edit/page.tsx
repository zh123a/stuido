"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

export default function EditPage() {
  const { id } = useParams<{ id: string }>();
  const [plan, setPlan] = useState<any>(null);
  const [progress, setProgress] = useState<any>(null);
  const [cmd, setCmd] = useState("");
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/projects/${id}`).then(async (r) => {
      if (r.ok) setPlan(await r.json());
    });
  }, [id]);

  useEffect(() => {
    // SSE 轮询进度
    let es: EventSource | null = null;
    let timer: any = null;
    const useSSE = () => {
      try {
        es = new EventSource(`/api/projects/${id}/status`);
        es.onmessage = (e) => {
          try {
            const data = JSON.parse(e.data);
            setProgress(data.progress);
            if (data.plan) setPlan(data.plan);
            if (data.plan?.finalVideo) setVideoUrl(`/api/projects/${id}/preview`);
            if (data.progress?.done) es?.close();
          } catch {}
        };
        es.onerror = () => {
          es?.close();
          // 降级轮询
          timer = setInterval(async () => {
            const r = await fetch(`/api/projects/${id}/status`);
            if (r.ok) {
              const data = await r.json();
              setProgress(data.progress);
              if (data.plan) setPlan(data.plan);
              if (data.plan?.finalVideo) setVideoUrl(`/api/projects/${id}/preview`);
              if (data.progress?.done) clearInterval(timer);
            }
          }, 1200);
        };
      } catch {
        timer = setInterval(async () => {
          const r = await fetch(`/api/projects/${id}/status`);
          if (r.ok) {
            const data = await r.json();
            setProgress(data.progress);
            if (data.plan) setPlan(data.plan);
            if (data.plan?.finalVideo) setVideoUrl(`/api/projects/${id}/preview`);
          }
        }, 1200);
      }
    };
    useSSE();
    return () => {
      es?.close();
      if (timer) clearInterval(timer);
    };
  }, [id]);

  async function handleEdit() {
    if (!cmd.trim()) return;
    const r = await fetch(`/api/projects/${id}/edit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cmd }),
    });
    const data = await r.json();
    if (r.ok) {
      setPlan(data.plan);
      setCmd("");
    } else alert(data.error || "编辑失败");
  }

  if (!plan) return <div className="p-10 text-white/60">加载编辑器...</div>;

  return (
    <div className="h-screen flex flex-col bg-[#0a0a0a] text-white">
      <header className="h-14 px-4 flex items-center justify-between border-b border-white/10 shrink-0">
        <span className="font-bold">Stuido · {plan.title}</span>
        <span className="text-xs text-white/60">分镜总数 {plan.scenes.length} | 总时长 00:{String(Math.floor(plan.totalDurationMs / 1000)).padStart(2, "0")}</span>
        <div className="flex items-center gap-2">
          {progress && !progress.done && <span className="text-xs px-3 py-1 rounded-full bg-purple-500/20 text-purple-300">{progress.step} {progress.progress}%</span>}
          {progress?.done && <span className="text-xs px-3 py-1 rounded-full bg-green-500/20 text-green-300">渲染完成</span>}
          {videoUrl ? (
            <a href={videoUrl} download className="px-4 py-1 rounded-full bg-gradient-to-r from-purple-500 to-blue-500 text-sm">导出MP4</a>
          ) : (
            <button className="px-4 py-1 rounded-full bg-white/10 text-sm opacity-50" disabled>导出</button>
          )}
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        {/* left subtitles */}
        <div className="w-[280px] border-r border-white/10 p-4 overflow-auto">
          <div className="text-xs font-bold">文稿字幕</div>
          {plan.scenes.map((s: any) => (
            <div key={s.id} className="mt-3 p-3 rounded-xl bg-white/5 border border-white/10">
              <div className="text-xs text-purple-300">分镜{s.id} · {s.mg ? "MG动画" : "视频素材"}</div>
              <div className="mt-1 text-xs text-white/80">{s.narration}</div>
              <div className="mt-1 text-[11px] text-white/40">{s.search.query}</div>
            </div>
          ))}
        </div>

        {/* center preview */}
        <div className="flex-1 flex flex-col p-4">
          <div className="flex justify-center gap-2 text-xs text-white/60">
            <span className="px-3 py-1 rounded-full bg-white/10">编辑裁切</span>
            <span className="px-3 py-1 rounded-full bg-white/10">16:9</span>
          </div>
          <div className="mt-3 flex-1 bg-[#141416] rounded-xl border border-white/10 flex items-center justify-center relative overflow-hidden">
            {videoUrl ? (
              <video src={videoUrl} controls className="w-[720px] h-[405px] rounded-xl bg-black" />
            ) : (
              <div className="w-[720px] h-[405px] bg-gradient-to-br from-blue-900/40 to-cyan-900/40 rounded-xl border border-white/10 relative flex items-center justify-center">
                <div className="absolute inset-0 opacity-30" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
                <div className="px-4 py-2 rounded-xl bg-black/70 border border-white/20 text-sm">智能知识库</div>
                <div className="absolute bottom-6 left-6 right-6 text-center text-sm bg-black/60 px-3 py-1 rounded">所以现在很多AI知识库，智能搜索，推荐系统</div>
                {progress && <div className="absolute bottom-2 text-xs text-white/50">{progress.step} {progress.progress}%</div>}
              </div>
            )}
          </div>
          <div className="mt-3 flex items-center justify-center gap-4 text-white/60 text-xs">
            {progress?.step === "done" ? "✓ 9个MG动画已叠加 · BGM已自动配好" : progress ? `生成中: ${progress.step} ${progress.progress}%` : "等待确认后开始生成"}
          </div>
        </div>

        {/* right inspector */}
        <div className="w-[320px] border-l border-white/10 p-4 overflow-auto bg-[#141416]">
          <div className="text-xs font-bold">分镜09 · 视频素材+MG动画</div>
          <div className="mt-2 text-xs text-white/60">蓝色调半透科技卡片显示AI知识库界面，中国，现代</div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className={`h-20 rounded-lg bg-white/5 border ${i === 1 ? "border-purple-500" : "border-white/10"} flex items-center justify-center text-[11px] text-white/40`}>
                {i === 1 ? "✓ 使用中" : `素材${i}`}
              </div>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <button className="flex-1 py-2 rounded-lg bg-white/10 text-xs">重配画面</button>
            <button className="flex-1 py-2 rounded-lg bg-white/10 text-xs">展开更多 →</button>
          </div>
          <div className="mt-4 p-3 rounded-xl bg-white/5 border border-white/10 text-xs text-white/60">
            <div>✓ 9个MG动画，全部成功叠加</div>
            <div>BGM已自动配好：通用平和风格</div>
          </div>
          <div className="mt-4">
            <div className="flex gap-2">
              <input
                value={cmd}
                onChange={(e) => setCmd(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleEdit()}
                placeholder="输入你的任何想法，如：合并前3个分镜"
                className="flex-1 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs placeholder:text-white/30"
              />
              <button onClick={handleEdit} className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 text-xs">发送</button>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {["合并前3个分镜", "把所有外国人素材换成中国人", "把分镜09的MG换成柱状图"].map((t) => (
                <button key={t} onClick={() => setCmd(t)} className="px-3 py-1 rounded-full bg-white/10 text-xs hover:bg-white/20">
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* bottom timeline */}
      <div className="h-[140px] border-t border-white/10 p-3 bg-[#0f0f12] shrink-0 overflow-x-auto">
        <div className="flex gap-3 h-full">
          {plan.scenes.map((s: any) => (
            <div key={s.id} className="w-[160px] shrink-0 rounded-xl bg-white/5 border border-white/10 p-2 flex flex-col">
              <div className="text-[11px] text-white/60 flex justify-between">
                <span>分镜{s.id}</span>
                <span>00:{String(Math.floor(s.durationMs / 1000)).padStart(2, "0")}</span>
              </div>
              <div className="mt-1 flex-1 rounded-lg bg-gradient-to-br from-purple-500/20 to-blue-500/20 flex items-center justify-center text-[11px] text-white/50">
                {s.mg ? "MG动画" : "视频素材"}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
