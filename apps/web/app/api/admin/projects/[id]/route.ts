import { NextRequest, NextResponse } from "next/server";
import { db, projects, auditLogs } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { eq } from "drizzle-orm";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin(req);
    const { id } = await params;
    await db.delete(projects).where(eq(projects.id, id));
    await db.insert(auditLogs).values({ actorId: admin.id, action: "project.delete", targetType: "project", targetId: id } as any);
    // 同时尝试删除文件（best effort）
    try {
      const fs = await import("fs/promises");
      const path = await import("path");
      const candidates = [path.join(process.cwd(), "renders", id), path.join(process.cwd(), "..", "renders", id), path.join("/Users/zh/项目/stuido/apps/web/renders", id)];
      for (const p of candidates) {
        try {
          await fs.rm(p, { recursive: true, force: true });
        } catch {}
      }
    } catch {}
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status || 500 });
  }
}
