import { NextRequest, NextResponse } from "next/server";
import { db, users } from "@/lib/db";
import { hashPassword, signToken } from "@/lib/auth";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
  const { email, password } = await req.json();
  if (!email || !password || password.length < 6) return NextResponse.json({ error: "邮箱和至少6位密码必填" }, { status: 400 });
  const existed = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existed.length) return NextResponse.json({ error: "邮箱已注册" }, { status: 400 });
  const all = await db.select().from(users).limit(1);
  const role = all.length === 0 ? "admin" : "user"; // 首个注册为 admin
  const hash = await hashPassword(password);
  const [row] = await db.insert(users).values({ email, passwordHash: hash, role }).returning();
  const token = await signToken({ id: row.id, email: row.email, role: row.role });
  const res = NextResponse.json({ ok: true, user: { id: row.id, email: row.email, role: row.role } });
  res.cookies.set("token", token, { httpOnly: true, path: "/", maxAge: 60 * 60 * 24 * 7, sameSite: "lax" });
  return res;
}
