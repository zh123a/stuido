import { NextRequest, NextResponse } from "next/server";
import { db, users, auditLogs } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { hashPassword } from "@/lib/auth";
import { desc, like, or } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const url = new URL(req.url);
    const q = url.searchParams.get("q") || "";
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
    const limit = Math.min(50, parseInt(url.searchParams.get("limit") || "20"));
    const offset = (page - 1) * limit;
    let rows = await db.select().from(users).orderBy(desc(users.createdAt)).limit(limit).offset(offset);
    if (q) {
      const lower = `%${q}%`;
      rows = await db.select().from(users).where(like(users.email, lower)).orderBy(desc(users.createdAt)).limit(limit).offset(offset);
    }
    const safe = rows.map((r) => ({ id: r.id, email: r.email, role: r.role, status: r.status, createdAt: r.createdAt, lastLogin: r.lastLogin }));
    return NextResponse.json({ users: safe, page, limit });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status || 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin(req);
    const { email, password, role = "user" } = await req.json();
    if (!email || !password) return NextResponse.json({ error: "邮箱密码必填" }, { status: 400 });
    const hash = await hashPassword(password);
    const [row] = await db.insert(users).values({ email, passwordHash: hash, role } as any).returning();
    await db.insert(auditLogs).values({ actorId: admin.id, action: "user.create", targetType: "user", targetId: row.id, meta: { email, role } as any });
    return NextResponse.json({ ok: true, user: { id: row.id, email: row.email, role: row.role } });
  } catch (e: any) {
    if (String(e.message).includes("UNIQUE") || String(e.message).includes("unique")) return NextResponse.json({ error: "邮箱已存在" }, { status: 400 });
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
