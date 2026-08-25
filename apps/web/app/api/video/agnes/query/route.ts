import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { agnesQueryVideo } from "@/lib/agnes";

export async function GET(req: NextRequest) {
  try {
    await requireAuth(req);
    const url = new URL(req.url);
    const video_id = url.searchParams.get("video_id");
    const model_name = url.searchParams.get("model_name") || "agnes-video-2.5-flash";
    if (!video_id) return NextResponse.json({ error: "video_id 必填" }, { status: 400 });
    const data = await agnesQueryVideo(video_id, model_name);
    return NextResponse.json({ ok: true, data });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || String(e) }, { status: 500 });
  }
}
