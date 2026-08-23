import { db, apiKeyChannels } from "./db";
import { eq, and } from "drizzle-orm";
import { decrypt } from "./crypto";

export type Channel = typeof apiKeyChannels.$inferSelect;

export async function getActiveChannel(provider?: string): Promise<Channel | null> {
  const all = await db
    .select()
    .from(apiKeyChannels)
    .where(and(eq(apiKeyChannels.isActive, true as any), provider ? eq(apiKeyChannels.provider, provider as any) : undefined as any));
  // 过滤 provider 若传入
  const filtered = provider ? all.filter((c) => c.provider === provider) : all;
  if (!filtered.length) return null;
  // 加权随机
  const pool: Channel[] = [];
  for (const c of filtered) for (let i = 0; i < (c.weight || 1); i++) pool.push(c);
  return pool[Math.floor(Math.random() * pool.length)] || filtered[0];
}

export async function getChannelKey(channel: Channel): Promise<{ key: string; baseUrl?: string | null; model?: string | null }> {
  const key = decrypt(channel.apiKeyEncrypted);
  return { key, baseUrl: channel.baseUrl, model: channel.model };
}

// 供 queue/llm 使用：按 provider 返回可用的 key，若无则尝试 env 兜底
export async function resolveLlmChannel(provider?: string) {
  const ch = await getActiveChannel(provider);
  if (ch) {
    const { key, baseUrl, model } = await getChannelKey(ch);
    return { key, baseUrl: baseUrl || undefined, model: model || undefined, channel: ch, type: ch.provider };
  }
  // 兜底 env（兼容旧版）
  const envMap: Record<string, { key: string | undefined; base: string | undefined; model: string | undefined }> = {
    deepseek: { key: process.env.DEEPSEEK_API_KEY, base: process.env.DEEPSEEK_BASE_URL, model: process.env.DEEPSEEK_MODEL },
    ark: { key: process.env.ARK_API_KEY, base: process.env.ARK_BASE_URL, model: process.env.ARK_MODEL },
    openai: { key: process.env.OPENAI_API_KEY, base: process.env.OPENAI_BASE_URL, model: process.env.OPENAI_MODEL },
    dashscope: { key: process.env.DASHSCOPE_API_KEY, base: process.env.DASHSCOPE_BASE_URL, model: process.env.DASHSCOPE_MODEL },
  };
  const p = provider || "deepseek";
  const e = envMap[p] || envMap.deepseek;
  if (e?.key) return { key: e.key, baseUrl: e.base, model: e.model, channel: null, type: p };
  // 全局遍历 env 找任意可用
  for (const k of Object.keys(envMap)) if (envMap[k].key) return { key: envMap[k].key!, baseUrl: envMap[k].base, model: envMap[k].model, channel: null, type: k };
  return null;
}
