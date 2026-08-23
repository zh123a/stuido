import { NextRequest, NextResponse } from "next/server";
import { db, apiKeyChannels, auditLogs } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { encrypt, decrypt, maskKey } from "@/lib/crypto";
import { desc } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const rows = await db.select().from(apiKeyChannels).orderBy(desc(apiKeyChannels.createdAt));
    const masked = rows.map((r) => {
      let plain = "";
      try {
        plain = decrypt(r.apiKeyEncrypted);
      } catch {
        plain = r.apiKeyEncrypted;
      }
      return { ...r, apiKeyEncrypted: undefined as any, apiKeyMasked: maskKey(plain), apiKey: undefined };
    });
    return NextResponse.json({ channels: masked });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status || 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAdmin(req);
    const body = await req.json();
    const { provider, name, apiKey, baseUrl, model, weight = 1, rateLimit = 60 } = body;
    if (!provider || !name || !apiKey) return NextResponse.json({ error: "provider/name/apiKey 必填" }, { status: 400 });
    const encrypted = encrypt(apiKey);
    const [row] = await db
      .insert(apiKeyChannels)
      .values({ provider, name, apiKeyEncrypted: encrypted, baseUrl, model, weight: Number(weight), rateLimit: Number(rateLimit), isActive: true, createdBy: user.id } as any)
      .returning();
    await db.insert(auditLogs).values({ actorId: user.id, action: "channel.create", targetType: "api_key_channel", targetId: row.id, meta: { provider, name } as any });
    return NextResponse.json({ ok: true, channel: row });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status || 500 });
  }
}
