import { NextResponse } from "next/server";
import { db, apiKeyChannels } from "@/lib/db";
import { eq } from "drizzle-orm";

const CATEGORY_MAP: Record<string, "text" | "video" | "tts" | "other"> = {
  deepseek: "text",
  ark: "text",
  openai: "text",
  dashscope: "text",
  agnes: "video",
  pexels: "video",
  pixabay: "video",
  azure: "tts",
};

export async function GET() {
  try {
    const rows = await db.select().from(apiKeyChannels).where(eq(apiKeyChannels.isActive, true as any));
    const grouped: Record<string, any[]> = { text: [], video: [], tts: [], other: [] };
    for (const r of rows) {
      const cat = CATEGORY_MAP[r.provider] || "other";
      grouped[cat].push({
        id: r.id,
        provider: r.provider,
        name: r.name,
        model: r.model,
        baseUrl: r.baseUrl,
        weight: r.weight,
      });
    }
    // 兜底：若DB为空，提供默认可用模型提示（前端可直接用，无需通道也能走Mock/Env）
    if (grouped.text.length === 0) {
      grouped.text = [
        { id: "env-deepseek", provider: "deepseek", name: "DeepSeek (env)", model: "deepseek-chat" },
        { id: "env-ark", provider: "ark", name: "豆包 Seed 1.6 (env)", model: "doubao-seed-1-6-251015" },
        { id: "env-openai", provider: "openai", name: "GPT-4o mini (env)", model: "gpt-4o-mini" },
        { id: "env-qwen", provider: "dashscope", name: "Qwen Plus (env)", model: "qwen-plus" },
      ];
    }
    if (grouped.video.length === 0) {
      grouped.video = [
        { id: "env-pexels", provider: "pexels", name: "Pexels 素材（免费）", model: "pexels" },
        { id: "env-agnes", provider: "agnes", name: "Agnes 2.5 Flash（需Key）", model: "agnes-video-2.5-flash" },
      ];
    }
    if (grouped.tts.length === 0) {
      grouped.tts = [
        { id: "env-edge", provider: "azure", name: "EdgeTTS 免费", model: "zh-CN-YunxiNeural" },
      ];
    }
    return NextResponse.json({ grouped });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
