import { NextRequest, NextResponse } from "next/server";
import { db, users } from "@/lib/db";
import { verifyPassword, signToken } from "@/lib/auth";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
  const { email, password } = await req.json();
  if (!email || !password) return NextResponse.json({ error: "请输入邮箱密码" }, { status: 400 });
  const [row] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!row || row.status === "disabled") return NextResponse.json({ error: "账号不存在或已禁用" }, { status: 401 });
  const ok = await verifyPassword(password, row.passwordHash);
  if (!ok) return NextResponse.json({ error: "密码错误" }, { status: 401 });
  await db.update(users).set({ lastLogin: new Date() as any }).where(eq(users.id, row.id));
  const token = await signToken({ id: row.id, email: row.email, role: row.role });
  const res = NextResponse.json({ ok: true, user: { id: row.id, email: row.email, role: row.role } });
  res.cookies.set("token", token, { httpOnly: true, path: "/", maxAge: 60 * 60 * 24 * 7, sameSite: "lax" });
  return res;
}
