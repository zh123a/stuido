"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function HomePage() {
  const router = useRouter();
  const [script, setScript] = useState("");
  const [loading, setLoading] = useState(false);
  const [voice, setVoice] = useState("zh-CN-YunxiNeural");
  const [aspect, setAspect] = useState("16:9");
  const [llmProvider, setLlmProvider] = useState("deepseek");
  const [llmApiKey, setLlmApiKey] = useState("");
  const [showLlmConfig, setShowLlmConfig] = useState(false);
  const [user, setUser] = useState<any>(null);
  const examples = [
    "热点 | 医保有药，医院没货？",
    "财经 | 长鑫上市，谁是最大赢家",
    "科普 | 韦伯拍到了\"不该存在\"的星系",
    "科普 | 高铁为什么能硬币不倒",
  ];

  useEffect(() => {
    setLlmApiKey(localStorage.getItem("stuido_llm_key") || "");
    setLlmProvider(localStorage.getItem("stuido_llm_provider") || "deepseek");
    fetch("/api/auth/me").then(async (r) => {
      if (r.ok) {
        const d = await r.json();
        if (d.user) setUser(d.user);
      }
    });
  }, []);

  function saveLlmConfig() {
    localStorage.setItem("stuido_llm_key", llmApiKey);
    localStorage.setItem("stuido_llm_provider", llmProvider);
    setShowLlmConfig(false);
  }

  async function handleCreate() {
    if (!script.trim()) return alert("请先输入口播稿");
    setLoading(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          script,
          voice,
          aspect,
          mode: "standard",
          preference: "B-素材混合MG",
          llmApiKey: llmApiKey || undefined,
          llmProvider,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.needLlmConfig) setShowLlmConfig(true);
        throw new Error(data.error || "创建失败");
      }
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
        <div className="flex gap-3 items-center">
          <span className="px-3 py-1 rounded-full bg-white/10 text-sm">标准版 · Hyperframes</span>
          {user ? (
            <>
              <span className="px-3 py-1 rounded-full bg-white/10 text-sm">{user.email} · {user.role}</span>
              {user.role === "admin" && <a href="/admin" className="px-3 py-1 rounded-full bg-gradient-to-r from-purple-500 to-blue-500 text-sm">管理后台</a>}
              <button
                onClick={async () => {
                  await fetch("/api/auth/logout", { method: "POST" });
                  setUser(null);
                  localStorage.removeItem("stuido_llm_key");
                }}
                className="px-3 py-1 rounded-full bg-white/10 text-sm"
              >
                退出
              </button>
            </>
          ) : (
            <>
              <a href="/login" className="px-3 py-1 rounded-full bg-white/10 text-sm">登录</a>
              <a href="/register" className="px-3 py-1 rounded-full bg-gradient-to-r from-purple-500 to-blue-500 text-sm">注册</a>
            </>
          )}
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

        <div className="mt-4 w-full max-w-4xl flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-white/50">
            <span>AI 分镜：</span>
            <span className={`px-2 py-1 rounded-full text-xs ${llmApiKey ? "bg-green-500/20 text-green-300" : "bg-amber-500/20 text-amber-300"}`}>
              {llmApiKey ? `已配置 ${llmProvider}` : "未配置（需 LLM）"}
            </span>
            <span className="text-white/30 hidden sm:inline">通读全文后由 AI 重写分镜，非本地分词</span>
          </div>
          <button onClick={() => setShowLlmConfig(true)} className="px-3 py-1 rounded-full bg-white/10 hover:bg-white/20 text-white/70">
            配置 LLM
          </button>
        </div>

        {showLlmConfig && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowLlmConfig(false)}>
            <div className="w-full max-w-md rounded-2xl bg-[#1a1a1e] border border-white/10 p-6" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-sm font-bold">配置 AI 分镜 LLM</h3>
              <p className="mt-2 text-xs text-white/60">分镜脚本必须由 AI 通读全文后撰写，不再使用本地分词。请配置任意 OpenAI 兼容的 LLM。</p>
              <div className="mt-4 space-y-3">
                <select value={llmProvider} onChange={(e) => setLlmProvider(e.target.value)} className="w-full bg-[#0f0f12] border border-white/10 rounded-xl px-3 py-2 text-sm text-white">
                  <option value="deepseek">DeepSeek (deepseek-chat)</option>
                  <option value="ark">火山方舟 Ark (doubao-seed-1-6)</option>
                  <option value="openai">OpenAI (gpt-4o-mini)</option>
                  <option value="dashscope">阿里百炼 DashScope (qwen-plus)</option>
                </select>
                <input value={llmApiKey} onChange={(e) => setLlmApiKey(e.target.value)} placeholder="粘贴 API Key (sk-...)" className="w-full bg-[#0f0f12] border border-white/10 rounded-xl px-3 py-2 text-sm placeholder:text-white/30" />
                <p className="text-[11px] text-white/40">Key 仅存于浏览器 localStorage，也可在服务端 .env 配置 DEEPSEEK_API_KEY / ARK_API_KEY 等后重启。</p>
                <div className="flex gap-2">
                  <button onClick={saveLlmConfig} className="flex-1 py-2 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 text-sm font-medium">保存</button>
                  <button onClick={() => setShowLlmConfig(false)} className="px-4 py-2 rounded-xl bg-white/10 text-sm">取消</button>
                </div>
              </div>
            </div>
          </div>
        )}

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
