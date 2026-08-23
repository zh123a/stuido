import { NextRequest } from "next/server";
import { getPlan } from "@/lib/planner";
import fs from "fs";
import path from "path";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const plan = getPlan(id);
  if (!plan) return new Response("not found: " + id, { status: 404 });
  // W2: final视频在 renders/{id}/final_with_audio.mp4，若无则用 final.mp4
  const candidates = [
    path.join(process.cwd(), "..", "..", "renders", id, "final_with_audio.mp4"),
    path.join(process.cwd(), "renders", id, "final_with_audio.mp4"),
    path.join(process.cwd(), "..", "renders", id, "final_with_audio.mp4"),
    (plan as any).finalVideo,
  ].filter(Boolean) as string[];
  let file: string | null = null;
  for (const c of candidates) {
    try {
      if (fs.existsSync(c)) { file = c; break; }
    } catch {}
  }
  if (!file) return new Response("video not ready: " + id, { status: 404 });
  const stat = fs.statSync(file);
  const stream = fs.createReadStream(file);
  return new Response(stream as any, {
    headers: {
      "Content-Type": "video/mp4",
      "Content-Length": stat.size.toString(),
      "Content-Disposition": `attachment; filename="${id}.mp4"`,
      "Cache-Control": "no-cache",
    },
  });
}
