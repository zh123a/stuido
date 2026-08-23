import { NextRequest, NextResponse } from "next/server";
import { db, users, auditLogs } from "@/lib/db";
import { requireAdmin, hashPassword } from "@/lib/auth";
import { eq } from "drizzle-orm";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin(req);
    const { id } = await params;
    const body = await req.json();
    const update: any = {};
    if (body.role) update.role = body.role;
    if (body.status) update.status = body.status;
    if (body.password) update.passwordHash = await hashPassword(body.password);
    if (!Object.keys(update).length) return NextResponse.json({ error: "无更新字段" }, { status: 400 });
    const [row] = await db.update(users).set(update).where(eq(users.id, id)).returning();
    if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });
    await db.insert(auditLogs).values({ actorId: admin.id, action: "user.update", targetType: "user", targetId: id, meta: body as any });
    return NextResponse.json({ ok: true, user: { id: row.id, email: row.email, role: row.role, status: row.status } });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status || 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin(req);
    const { id } = await params;
    await db.delete(users).where(eq(users.id, id));
    await db.insert(auditLogs).values({ actorId: admin.id, action: "user.delete", targetType: "user", targetId: id } as any);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
