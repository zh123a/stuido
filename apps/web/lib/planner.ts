import { randomUUID } from "crypto";

// 内存存储，W1简化版，后续替换为 Postgres + BullMQ
const store = new Map<string, any>();
export function getPlan(id: string) { return store.get(id); }
export function setPlan(id: string, v: any) { store.set(id, v); }

export type PlanInput = { script: string; voice: string; aspect: string; mode: string };

export async function createPlan(input: PlanInput) {
  const projectId = randomUUID();
  const wordCount = input.script.length;
  // 简单文稿分析：按句号/换行切分，生成分镜，W1先做规则版，后续接LLM
  const sentences = input.script
    .split(/[。！？\n]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 12);

  // 若句子太少，按字数兜底
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
