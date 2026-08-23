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

  // 规则版 fallback
  const wordCount = input.script.length;
  const sentences = input.script
    .split(/[。！？\n]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 12);

  const count = Math.max(6, Math.min(12, sentences.length || Math.ceil(wordCount / 120)));
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
  return "数据卡片+强调动效，冷色调工程感";
}
