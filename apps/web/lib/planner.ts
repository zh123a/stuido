import { randomUUID } from "crypto";
import { callDeepSeekForPlan } from "./llm";
import fsSync from "fs";
import pathSync from "path";

// 内存存储，W1简化版，后续替换为 Postgres + BullMQ
const store = new Map<string, any>();
export function getPlan(id: string) {
  // 优先从磁盘读取（保证跨路由共享，单进程多实例也能同步）
  try {
    const candidates = [
      pathSync.join(process.cwd(), "..", "..", "renders", id, "plan.json"),
      pathSync.join(process.cwd(), "renders", id, "plan.json"),
      pathSync.join(process.cwd(), "..", "renders", id, "plan.json"),
      pathSync.join("/Users/zh/项目/stuido/renders", id, "plan.json"),
      pathSync.join("/Users/zh/项目/stuido/apps/web/renders", id, "plan.json"),
    ];
    for (const p of candidates) {
      if (fsSync.existsSync(p)) {
        try {
          const j = JSON.parse(fsSync.readFileSync(p, "utf8"));
          const mem = store.get(id);
          if (!mem || (j as any).finalVideo || (j as any).renderedAt || JSON.stringify(j) !== JSON.stringify(mem)) {
            store.set(id, j);
          }
          return j;
        } catch {}
      }
    }
  } catch {}
  return store.get(id);
}
export function setPlan(id: string, v: any) {
  store.set(id, v);
  // 同步写盘，保证跨实例可见
  try {
    const candidates = [
      pathSync.join(process.cwd(), "..", "..", "renders", id, "plan.json"),
      pathSync.join(process.cwd(), "renders", id, "plan.json"),
    ];
    for (const p of candidates) {
      try {
        const d = pathSync.dirname(p);
        fsSync.mkdirSync(d, { recursive: true });
        fsSync.writeFileSync(p, JSON.stringify(v, null, 2));
      } catch {}
    }
    for (const abs of [pathSync.join("/Users/zh/项目/stuido/renders", id, "plan.json"), pathSync.join("/Users/zh/项目/stuido/apps/web/renders", id, "plan.json")]) {
      try {
        fsSync.mkdirSync(pathSync.dirname(abs), { recursive: true });
        fsSync.writeFileSync(abs, JSON.stringify(v, null, 2));
      } catch {}
    }
  } catch {}
}

export type PlanInput = { script: string; voice: string; aspect: string; mode: string };

export async function createPlan(input: PlanInput) {
  const projectId = randomUUID();

  // 优先尝试 LLM，若失败回退到规则版
  let llmScenes: any = null;
  let llmTitle: string | null = null;
  try {
    const llm = await callDeepSeekForPlan({ script: input.script, voice: input.voice, aspect: input.aspect });
    if (llm && Array.isArray(llm.scenes) && llm.scenes.length >= 4) {
      llmScenes = llm.scenes;
      llmTitle = llm.title;
      console.log(`[planner] LLM hit: ${llmScenes.length} scenes`);
    } else {
      console.log("[planner] LLM miss, fallback to rule");
    }
  } catch (e) {
    console.log("[planner] LLM exception, fallback", e);
  }

  if (llmScenes) {
    const scenes = llmScenes.slice(0, 12).map((s: any, i: number) => ({
      id: String(i + 1).padStart(2, "0"),
      idx: i + 1,
      narration: String(s.narration || "").trim() || `分镜${i + 1}`,
      durationMs: Number(s.durationMs) || 6000,
      search: {
        query: String(s.searchQuery || s.search_query || "").slice(0, 20) || extractSearchQuery(String(s.narration || "")),
        filters: { country: "CN", year: "modern", mood: "precise", tone: "cold", avoid: "人物正脸" },
      },
      mg: s.mgType && s.mgType !== "null"
        ? { enabled: true, type: s.mgType, prompt: String(s.mgPrompt || ""), htmlPath: `mg/scene${String(i + 1).padStart(2, "0")}.html` }
        : s.mgPrompt
        ? { enabled: true, type: s.mgType || "callout", prompt: String(s.mgPrompt), htmlPath: `mg/scene${String(i + 1).padStart(2, "0")}.html` }
        : null,
      bgm: "通用平和",
      layers: [] as any[],
    }));
    // 补 layers
    for (const s of scenes) {
      s.layers = [
        { type: "video", z: 0, src: `footage/scene${s.id}.mp4` },
        ...(s.mg ? [{ type: "mg", z: 1, src: `mg/scene${s.id}.html`, alpha: true }] : []),
        { type: "subtitle", z: 2, src: `subtitles/scene${s.id}.vtt` },
      ];
    }
    const mgScenes = scenes.filter((s: any) => s.mg).length;
    const plan = {
      projectId,
      title: (llmTitle || scenes[0]?.narration?.slice(0, 24) || "未命名项目").slice(0, 24),
      aspect: input.aspect,
      voice: input.voice,
      script: input.script,
      totalDurationMs: scenes.reduce((a: number, s: any) => a + s.durationMs, 0),
      scenes,
      metrics: { videoClips: scenes.length, mgScenes, cost: mgScenes * 93 + scenes.length * 2 },
      status: "pending_confirm",
      createdAt: new Date().toISOString(),
      source: "llm",
    };
    setPlan(projectId, plan);
    try {
      const fs = await import("fs/promises");
      const path = await import("path");
      const dir = path.join(process.cwd(), "..", "..", "renders", projectId);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(path.join(dir, "plan.json"), JSON.stringify(plan, null, 2));
    } catch {}
    return plan;
  }

  // 规则版 fallback — 语义合并，避免单句过短（如 "Temperature" 独占 6s）
  const rawSentences = input.script
    .split(/[。！？\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const grouped = groupSentencesSmart(rawSentences);
  const sentences = grouped.slice(0, 12);
  const count = Math.max(6, Math.min(12, sentences.length || Math.ceil(input.script.length / 90)));
  const perSceneMs = 6000;

  const scenes = Array.from({ length: count }).map((_, i) => {
    const narration = sentences[i] || `分镜${String(i + 1).padStart(2, "0")}：${input.script.slice(i * 80, (i + 1) * 80)}`;
    // 根据关键词决定是否触发MG
    const mgTriggers = ["对比", "数据", "原理", "毫米", "卫星", "激光", "轨道", "精度", "百分比", "%", "倍"];
    const needMG = mgTriggers.some((k) => narration.includes(k)) || i % 3 === 1;
    return {
      id: String(i + 1).padStart(2, "0"),
      idx: i + 1,
      narration,
      durationMs: perSceneMs,
      search: {
        query: extractSearchQuery(narration),
        filters: { country: "CN", year: "modern", mood: "precise", tone: "cold", avoid: "人物正脸" },
      },
      mg: needMG
        ? {
            enabled: true,
            type: pickMgType(narration),
            prompt: `为文案“${narration.slice(0, 24)}”生成叠加MG：${pickMgDesc(narration)}`,
            htmlPath: `mg/scene${String(i + 1).padStart(2, "0")}.html`,
          }
        : null,
      bgm: "通用平和",
      layers: [
        { type: "video", z: 0, src: `footage/scene${String(i + 1).padStart(2, "0")}.mp4` },
        ...(needMG ? [{ type: "mg", z: 1, src: `mg/scene${String(i + 1).padStart(2, "0")}.html`, alpha: true }] : []),
        { type: "subtitle", z: 2, src: `subtitles/scene${String(i + 1).padStart(2, "0")}.vtt` },
      ],
    };
  });

  const mgScenes = scenes.filter((s) => s.mg).length;
  const plan = {
    projectId,
    title: sentences[0]?.slice(0, 24) || "未命名项目",
    aspect: input.aspect,
    voice: input.voice,
    script: input.script,
    totalDurationMs: scenes.length * perSceneMs,
    scenes,
    metrics: { videoClips: scenes.length, mgScenes, cost: mgScenes * 93 + scenes.length * 2 },
    status: "pending_confirm",
    createdAt: new Date().toISOString(),
    source: "rule",
  };
  setPlan(projectId, plan);
  // 模拟一个全局 store 文件，方便调试
  try {
    const fs = await import("fs/promises");
    const path = await import("path");
    const dir = path.join(process.cwd(), "..", "..", "renders", projectId);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, "plan.json"), JSON.stringify(plan, null, 2));
  } catch {}
  return plan;
}

function extractSearchQuery(n: string): string {
  // 取前12字做检索词，实际会接入 LLM + CLIP
  const k = n.replace(/[，。！？、]/g, " ").trim().split(/\s+/).slice(0, 4).join(" ");
  return k || n.slice(0, 12);
}
function pickMgType(n: string): string {
  if (n.includes("%") || n.includes("倍") || n.includes("数据")) return "chart";
  if (n.includes("流程") || n.includes("步骤") || n.includes("引导")) return "flow";
  if (n.includes("对比")) return "contrast";
  return "callout";
}
function pickMgDesc(n: string): string {
  if (n.includes("毫米") || n.includes("激光")) return "灰色矩形轨道板+激光线交汇+数据卡 2毫米对比";
  if (n.includes("卫星")) return "卫星图标闪烁+激光引导线";
  if (n.includes("Temperature") || n.includes("温度")) return "参数旋钮+温度计动画，冷色科技感";
  if (n.includes("概率") || n.includes("%") || n.includes("随机")) return "概率分布柱状图+高亮动效";
  return "数据卡片+强调动效，冷色调工程感";
}

function groupSentencesSmart(sents: string[]): string[] {
  if (!sents.length) return [];
  // 清理：去除首尾空，去重多余空格
  const cleaned = sents.map((s) => s.replace(/\s+/g, " ").trim()).filter(Boolean);
  const groups: string[] = [];
  let buf = "";
  const flush = () => {
    if (buf.trim()) groups.push(buf.trim());
    buf = "";
  };
  for (let i = 0; i < cleaned.length; i++) {
    const s = cleaned[i];
    const isShort = s.length < 14; // 如 "Temperature" (11) 必须合并
    const isEnglishOnly = /^[A-Za-z0-9\s\-_.,%]+$/.test(s) && s.length < 20;
    if (!buf) {
      buf = s;
      continue;
    }
    const candidate = buf + "。" + s;
    const bufLen = buf.length;
    const candLen = candidate.length;
    // 强制合并短句
    if (isShort || isEnglishOnly) {
      // 短句必须跟上下文合并，不独占分镜
      if (candLen <= 72) {
        buf = candidate;
      } else {
        flush();
        buf = s;
      }
      continue;
    }
    // 常规合并策略：目标每分镜 35-70 字
    if (candLen <= 38) {
      // 太短，继续攒
      buf = candidate;
    } else if (candLen <= 70 && bufLen < 48) {
      // 当前还不算长，且合并后不超长，继续
      // 但若下一句是短句则先不 flush，等下一轮
      const next = cleaned[i + 1];
      const nextIsShort = next ? next.length < 14 : false;
      if (nextIsShort && candLen < 60) {
        buf = candidate;
      } else if (bufLen < 32) {
        buf = candidate;
      } else {
        // buf 已有一定长度，合并后适中则合并，否则另起
        if (candLen <= 58) buf = candidate;
        else {
          flush();
          buf = s;
        }
      }
    } else {
      // 超长，另起
      flush();
      buf = s;
    }
    if (buf.length >= 68) flush();
  }
  flush();
  // 二次合并：消除仍过短的尾组 (<22字 且 组数>6)
  const merged: string[] = [];
  for (const g of groups) {
    if (merged.length && g.length < 22 && merged.length < 12) {
      merged[merged.length - 1] = merged[merged.length - 1] + "。" + g;
    } else {
      merged.push(g);
    }
  }
  // 限制 6-12 组
  while (merged.length > 12) {
    const last = merged.pop()!;
    merged[merged.length - 1] = merged[merged.length - 1] + "。" + last;
  }
  // 拆分过长组 (>78字，避免 140字 单分镜)
  const final: string[] = [];
  for (const g of merged) {
    if (g.length > 78) {
      const parts = g.split("。").filter(Boolean);
      let tmp = "";
      for (const p of parts) {
        const cand = tmp ? tmp + "。" + p : p;
        if (cand.length > 42 && tmp) {
          final.push(tmp);
          tmp = p;
        } else {
          tmp = cand;
        }
        if (tmp.length >= 62) {
          final.push(tmp);
          tmp = "";
        }
      }
      if (tmp) final.push(tmp);
    } else {
      final.push(g);
    }
  }
  while (final.length > 12) {
    const last = final.pop()!;
    final[final.length - 1] = final[final.length - 1] + "。" + last;
  }
  return final.map((g) => g.replace(/。+/g, "。").replace(/^。|。$/g, "")).filter(Boolean);
}
