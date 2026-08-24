import { NextRequest, NextResponse } from "next/server";
import { db, apiKeyChannels, auditLogs } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { encrypt } from "@/lib/crypto";
import { eq } from "drizzle-orm";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAdmin(req);
    const { id } = await params;
    const body = await req.json();
    const update: any = {};
    if (body.name !== undefined) update.name = body.name;
    if (body.provider !== undefined) update.provider = body.provider;
    if (body.baseUrl !== undefined) update.baseUrl = body.baseUrl;
    if (body.model !== undefined) update.model = body.model;
    if (body.weight !== undefined) update.weight = Number(body.weight);
    if (body.rateLimit !== undefined) update.rateLimit = Number(body.rateLimit);
    if (body.isActive !== undefined) update.isActive = !!body.isActive;
    if (body.apiKey) update.apiKeyEncrypted = encrypt(body.apiKey);
    update.updatedAt = new Date() as any;
    const [row] = await db.update(apiKeyChannels).set(update).where(eq(apiKeyChannels.id, id)).returning();
    if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });
    await db.insert(auditLogs).values({ actorId: user.id, action: "channel.update", targetType: "api_key_channel", targetId: id, meta: body as any });
    return NextResponse.json({ ok: true, channel: row });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status || 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAdmin(req);
    const { id } = await params;
    await db.delete(apiKeyChannels).where(eq(apiKeyChannels.id, id));
    await db.insert(auditLogs).values({ actorId: user.id, action: "channel.delete", targetType: "api_key_channel", targetId: id } as any);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status || 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // 测试连通性：按 provider 选择探活方式
  try {
    await requireAdmin(req);
    const { id } = await params;
    const [ch] = await db.select().from(apiKeyChannels).where(eq(apiKeyChannels.id, id)).limit(1);
    if (!ch) return NextResponse.json({ error: "not found" }, { status: 404 });
    const { decrypt } = await import("@/lib/crypto");
    const key = decrypt(ch.apiKeyEncrypted);
    if (["pexels", "pixabay"].includes(ch.provider)) {
      const url = ch.provider === "pexels" ? "https://api.pexels.com/v1/search?query=nature&per_page=1" : `https://pixabay.com/api/?key=${key}&q=nature&per_page=3`;
      const headers: any = ch.provider === "pexels" ? { Authorization: key } : {};
      const res = await fetch(url, { headers });
      const txt = await res.text();
      return NextResponse.json({ ok: res.ok, status: res.status, body: txt.slice(0, 600) });
    }
    const base = ch.baseUrl || (ch.provider === "deepseek" ? "https://api.deepseek.com" : ch.provider === "ark" ? "https://ark.cn-beijing.volces.com/api/v3" : ch.provider === "dashscope" ? "https://dashscope.aliyuncs.com/compatible-mode/v1" : "https://api.openai.com/v1");
    const model = ch.model || (ch.provider === "deepseek" ? "deepseek-chat" : ch.provider === "ark" ? "doubao-seed-1-6-251015" : ch.provider === "dashscope" ? "qwen-plus" : "gpt-4o-mini");
    const res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model, messages: [{ role: "user", content: "hello" }], max_tokens: 8 }),
    });
    const txt = await res.text();
    return NextResponse.json({ ok: res.ok, status: res.status, body: txt.slice(0, 600) });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
