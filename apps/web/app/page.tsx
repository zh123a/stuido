"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function HomePage() {
  const router = useRouter();
  const [script, setScript] = useState("");
  const [loading, setLoading] = useState(false);
  const [voice, setVoice] = useState("zh-CN-YunxiNeural");
  const [aspect, setAspect] = useState("16:9");
  const examples = [
    "热点 | 医保有药，医院没货？",
    "财经 | 长鑫上市，谁是最大赢家",
    "科普 | 韦伯拍到了\"不该存在\"的星系",
    "科普 | 高铁为什么能硬币不倒",
  ];

  async function handleCreate() {
    if (!script.trim()) return alert("请先输入口播稿");
    setLoading(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ script, voice, aspect, mode: "standard", preference: "B-素材混合MG" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "创建失败");
      router.push(`/project/${data.projectId}/plan`);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-white/10">
        <div className="flex items-center gap-2 text-xl font-bold">
          <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">花</span>
          Stuido
        </div>
        <div className="flex gap-3">
          <span className="px-3 py-1 rounded-full bg-white/10 text-sm">标准版 · Hyperframes</span>
          <span className="px-3 py-1 rounded-full bg-white/10 text-sm">我的会员</span>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center px-6 pt-16">
        <h1 className="text-5xl font-black tracking-tight text-center">
          让文字<span className="bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">穿越到影像的世界</span>
        </h1>
        <p className="mt-3 text-white/60">即刻成片，让每个观点都被看见 · 复刻花生AI B模式 (素材+MG混合)</p>

        {/* input card */}
        <div className="mt-10 w-full max-w-4xl rounded-2xl bg-[#1a1a1e] border border-white/10 p-6">
          <div className="flex gap-2 text-sm">
            <span className="px-3 py-1 rounded-full bg-white text-black">输入文稿</span>
            <span className="px-3 py-1 rounded-full bg-white/10 text-white/60">上传口播</span>
          </div>
          <textarea
            value={script}
            onChange={(e) => setScript(e.target.value)}
            placeholder="输入/粘贴视频口播稿，即刻为你生成精彩视频。你输入的内容将会被AI配音完整读出~"
            className="mt-4 w-full min-h-[160px] bg-[#0f0f12] border border-white/10 rounded-xl p-4 text-sm placeholder:text-white/30 focus:outline-none focus:border-purple-500"
            maxLength={10000}
          />
          <div className="mt-2 flex items-center justify-between text-xs text-white/40">
            <span>{script.length} / 10000</span>
            <div className="flex gap-2">
              <select value={voice} onChange={(e) => setVoice(e.target.value)} className="bg-white/10 rounded-full px-3 py-1 text-white">
                <option className="text-black" value="zh-CN-YunxiNeural">科普男主1</option>
                <option className="text-black" value="zh-CN-XiaoxiaoNeural">知性女主</option>
                <option className="text-black" value="zh-CN-YunjianNeural">沉稳男声</option>
              </select>
              <select value={aspect} onChange={(e) => setAspect(e.target.value)} className="bg-white/10 rounded-full px-3 py-1 text-white">
                <option className="text-black" value="16:9">16:9</option>
                <option className="text-black" value="9:16">9:16</option>
              </select>
              <span className="px-3 py-1 rounded-full bg-white/10">标准模式</span>
              <span className="px-3 py-1 rounded-full bg-white/10">偏好01</span>
              <button
                onClick={handleCreate}
                disabled={loading}
                className="px-5 py-1 rounded-full bg-gradient-to-r from-purple-500 to-blue-500 text-white font-medium disabled:opacity-50"
              >
                {loading ? "生成中..." : "✨ 创建"}
              </button>
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-2 max-w-4xl">
          {examples.map((t) => (
            <button
              key={t}
              onClick={() => setScript(`请围绕“${t}”写一篇800字科普口播稿，要求有数据对比和原理讲解，适合MG动画演示。`)}
              className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-white/70 hover:bg-white/10"
            >
              {t}
            </button>
          ))}
        </div>

        <div className="mt-8 text-xs text-white/30">
          当前引擎：Hyperframes 0.7.60 + GSAP · 素材 Pexels/Pixabay · TTS EdgeTTS
        </div>
      </main>
    </div>
  );
}
