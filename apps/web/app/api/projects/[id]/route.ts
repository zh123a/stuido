import { NextRequest, NextResponse } from "next/server";
import { getPlan } from "@/lib/planner";
import { db, projects } from "@/lib/db";
import { eq } from "drizzle-orm";
import { getTokenFromHeader, verifyToken } from "@/lib/auth";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const plan = getPlan(id);
  if (!plan) return NextResponse.json({ error: "not found" }, { status: 404 });
  // 校验归属：若 DB 有 owner 且当前用户非 owner/非 admin 则 403（兼容旧文件无 owner 的情况放行）
  try {
    const [row] = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
    if (row?.ownerId) {
      const token = getTokenFromHeader(req);
      if (token) {
        try {
          const payload = await verifyToken(token);
          if ((payload as any).role !== "admin" && (payload as any).id !== row.ownerId) {
            return NextResponse.json({ error: "无权访问该项目" }, { status: 403 });
          }
        } catch {}
      }
    }
  } catch {}
  return NextResponse.json(plan);
}
