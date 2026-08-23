import { NextRequest, NextResponse } from "next/server";
import { db, projects, users } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { desc, like, or } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const url = new URL(req.url);
    const q = url.searchParams.get("q") || "";
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
    const limit = Math.min(50, parseInt(url.searchParams.get("limit") || "20"));
    const offset = (page - 1) * limit;
    let rows = await db.select().from(projects).orderBy(desc(projects.createdAt)).limit(limit).offset(offset);
    if (q) {
      rows = await db.select().from(projects).where(like(projects.title, `%${q}%`)).orderBy(desc(projects.createdAt)).limit(limit).offset(offset);
    }
    // 关联 owner email（简易 N+1）
    const withOwner = await Promise.all(
      rows.map(async (r) => {
        let ownerEmail: string | null = null;
        if (r.ownerId) {
          const [u] = await db.select().from(users).where((await import("drizzle-orm")).eq(users.id, r.ownerId)).limit(1);
          ownerEmail = u?.email || null;
        }
        return { ...r, ownerEmail, planJson: undefined };
      })
    );
    return NextResponse.json({ projects: withOwner, page, limit });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status || 500 });
  }
}
