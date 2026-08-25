import { db, apiKeyChannels } from "./db";
import { eq, and } from "drizzle-orm";
import { decrypt } from "./crypto";

export type Channel = typeof apiKeyChannels.$inferSelect;

export async function getActiveChannel(provider?: string, preferredModel?: string): Promise<Channel | null> {
  const all = await db.select().from(apiKeyChannels).where(eq(apiKeyChannels.isActive, true as any));
  let filtered = all;
  if (preferredModel) {
    // 优先按模型精确匹配
    const byModel = all.filter((c) => c.model === preferredModel);
    if (byModel.length) filtered = byModel;
    else if (provider) filtered = all.filter((c) => c.provider === provider);
  } else if (provider) {
    filtered = all.filter((c) => c.provider === provider);
  }
  // 仅保留 LLM 类型通道
  filtered = filtered.filter((c) => ["deepseek", "ark", "openai", "dashscope"].includes(c.provider));
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

// 供 queue/llm 使用：按 provider/model 返回可用的 key，若无则尝试 env 兜底
export async function resolveLlmChannel(provider?: string, preferredModel?: string) {
  // 若指定了模型，先尝试按模型精确匹配
  if (preferredModel) {
    const ch = await getActiveChannel(undefined, preferredModel);
    if (ch) {
      const { key, baseUrl, model } = await getChannelKey(ch);
      return { key, baseUrl: baseUrl || undefined, model: model || preferredModel, channel: ch, type: ch.provider };
    }
    // 根据模型名推断 provider 再试一次
    const inferred = inferProviderFromModel(preferredModel);
    if (inferred) {
      const ch2 = await getActiveChannel(inferred);
      if (ch2) {
        const { key, baseUrl } = await getChannelKey(ch2);
        return { key, baseUrl: baseUrl || undefined, model: preferredModel, channel: ch2, type: inferred };
      }
    }
  }
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

function inferProviderFromModel(model: string): string | undefined {
  const m = model.toLowerCase();
  if (m.includes("deepseek")) return "deepseek";
  if (m.includes("doubao") || m.includes("seed")) return "ark";
  if (m.includes("gpt") || m.includes("openai")) return "openai";
  if (m.includes("qwen") || m.includes("dashscope")) return "dashscope";
  return undefined;
}
