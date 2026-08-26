import { NextRequest, NextResponse } from "next/server";
import { getPlan, setPlan } from "@/lib/planner";
import { enqueueRender } from "@/lib/queue";
import { db, projects } from "@/lib/db";
import { eq } from "drizzle-orm";
import { getTokenFromHeader, verifyToken } from "@/lib/auth";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const plan = getPlan(id);
  if (!plan) return NextResponse.json({ error: "not found", id }, { status: 404 });
  // 归属校验
  try {
    const [row] = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
    if (row?.ownerId) {
      const token = getTokenFromHeader(req);
      if (token) {
        try {
          const p = await verifyToken(token);
          if ((p as any).role !== "admin" && (p as any).id !== row.ownerId) return NextResponse.json({ error: "无权操作" }, { status: 403 });
        } catch {}
      }
    }
  } catch {}
  if (plan.status === "rendering" || plan.status === "queued") {
    return NextResponse.json({ ok: true, status: plan.status });
  }
  // 视频模型选择（前台规划书页选择，默认占位素材）
  try {
    const body = await req.json().catch(() => ({}));
    if (body?.videoModel) plan.videoModel = String(body.videoModel);
  } catch {}
  plan.status = "queued";
  setPlan(id, plan);
  try {
    await db.update(projects).set({ status: "queued" }).where(eq(projects.id, id));
  } catch {}
  await enqueueRender(id);
  return NextResponse.json({ ok: true, status: "queued" });
}
