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
    return NextResponse.json({ grouped });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
