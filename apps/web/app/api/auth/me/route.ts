import { NextRequest, NextResponse } from "next/server";
import { verifyToken, getTokenFromHeader } from "@/lib/auth";
import { db, users } from "@/lib/db";
import { eq } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const token = getTokenFromHeader(req);
  if (!token) return NextResponse.json({ user: null }, { status: 401 });
  try {
    const payload = await verifyToken(token);
    const [row] = await db.select().from(users).where(eq(users.id, payload.id)).limit(1);
    if (!row) return NextResponse.json({ user: null }, { status: 401 });
    return NextResponse.json({ user: { id: row.id, email: row.email, role: row.role, status: row.status } });
  } catch {
    return NextResponse.json({ user: null }, { status: 401 });
  }
}
