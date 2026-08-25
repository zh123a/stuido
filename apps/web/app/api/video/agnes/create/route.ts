import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { agnesCreateVideo } from "@/lib/agnes";

export async function POST(req: NextRequest) {
  try {
    await requireAuth(req);
    const body = await req.json();
    const { prompt, seconds, aspect_ratio, mode, first_frame, last_frame, images, audios, seed } = body;
    if (!prompt) return NextResponse.json({ error: "prompt 必填" }, { status: 400 });
    const data = await agnesCreateVideo({ prompt, seconds: seconds || "5", size: "720P", aspect_ratio: aspect_ratio || "16:9", mode: mode || "text", first_frame, last_frame, images, audios, seed });
    // 记录可选：audit
    return NextResponse.json({ ok: true, ...data });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || String(e) }, { status: 500 });
  }
}
