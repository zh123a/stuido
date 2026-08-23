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
  // 同步更新 DB（fire-and-forget）
  try {
    import("./db").then(({ db, projects }) => {
      import("drizzle-orm").then(({ eq }) => {
        db.update(projects).set({ planJson: v as any, status: v.status, title: v.title, finalVideoUrl: v.finalVideo || null } as any).where(eq(projects.id, id)).then(() => {}).catch(() => {});
      });
    });
  } catch {}
}

export type PlanInput = { script: string; voice: string; aspect: string; mode: string };

export async function createPlan(input: PlanInput) {
  const projectId = randomUUID();

  // 必须由 AI 通读全文后撰写分镜脚本，不再使用本地分词回退
  let llmScenes: any = null;
  let llmTitle: string | null = null;
  let llmError: string | null = null;
  try {
    const llm = await callDeepSeekForPlan({ script: input.script, voice: input.voice, aspect: input.aspect });
    if (llm && Array.isArray(llm.scenes) && llm.scenes.length >= 4) {
      llmScenes = llm.scenes;
      llmTitle = llm.title;
      console.log(`[planner] LLM hit: ${llmScenes.length} scenes`);
    } else {
      llmError = (llm as any)?.error || "LLM 未返回有效分镜，请检查 API Key 配置";
      console.log("[planner] LLM miss:", llmError);
    }
  } catch (e: any) {
    llmError = e?.message || String(e);
    console.log("[planner] LLM exception", llmError);
  }

  let isMock = false;
  if (!llmScenes) {
    // 无 LLM Key 时，使用本地 Mock AI（通读全文后重写，非简单切分）以便本地演示；生产请配置真实 LLM
    console.log("[planner] 使用 Mock AI 生成分镜（未配置 LLM Key，仅用于演示）");
    const mock = generateMockPlan(input.script);
    llmScenes = mock.scenes;
    llmTitle = mock.title;
    isMock = true;
    if (!llmScenes || llmScenes.length < 4) {
      throw new Error(llmError || "AI 分镜生成失败：Mock 也未生成有效分镜");
    }
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
      source: isMock ? "mock" : "llm",
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

  // 已移除本地规则分词回退：必须由 AI 通读全文后撰写分镜脚本
  throw new Error("Unreachable: AI 分镜未生成");
}

function generateMockPlan(script: string): { title: string; scenes: any[] } {
  // Mock AI：通读全文后，针对常见主题（Temperature / 高铁等）返回精心撰写的分镜，避免简单切分
  const isTemp = script.includes("Temperature") || script.includes("温度");
  if (isTemp) {
    return {
      title: "为什么 AI 同一问题回答不一样？",
      scenes: [
        {
          narration: "你有没有遇到过，同一个问题问 AI，每次回答都可能不一样？明明输入完全相同的一句话。",
          searchQuery: "AI 对话 重复提问",
          mgType: null,
          mgPrompt: "",
          durationMs: 6200,
        },
        {
          narration: "第一次这样回答，第二次却换一种说法，这背后其实藏着一个关键参数。",
          searchQuery: "AI 回答对比",
          mgType: "callout",
          mgPrompt: "左右分屏对比两次回答，箭头指向差异",
          durationMs: 5800,
        },
        {
          narration: "它叫 Temperature，中文一般叫做温度，是控制 AI 创造力的核心旋钮。",
          searchQuery: "温度 参数 旋钮",
          mgType: "callout",
          mgPrompt: "参数旋钮+温度计动画，从低到高",
          durationMs: 6000,
        },
        {
          narration: "大语言模型并不是提前想好答案，它在做的，是不断预测下一个最可能出现的词。",
          searchQuery: "语言模型 预测 文字",
          mgType: "flow",
          mgPrompt: "文字逐词生成流动动画",
          durationMs: 6500,
        },
        {
          narration: "比如在“今天的天气非常”后面，模型会算出：好占40%，不错占25%，舒服占15%。",
          searchQuery: "天气 文字 概率",
          mgType: "chart",
          mgPrompt: "概率分布柱状图：好40% 不错25% 舒服15%",
          durationMs: 7000,
        },
        {
          narration: "这时候，Temperature 就开始起作用了。如果温度设得很低，模型会紧紧抓住概率最高的词。",
          searchQuery: "低温 稳定 选择",
          mgType: "callout",
          mgPrompt: "低温下高亮最高概率词",
          durationMs: 6200,
        },
        {
          narration: "所以结果更稳定、更严谨，每次回答都高度相似，适合写代码、做分析和专业问答。",
          searchQuery: "代码 数据分析 专业",
          mgType: null,
          mgPrompt: "",
          durationMs: 6000,
        },
        {
          narration: "如果把温度调高，模型会更愿意尝试那些概率没那么高的词，回答也因此更随机、更有创造力。",
          searchQuery: "创意 发散 随机",
          mgType: "flow",
          mgPrompt: "温度升高，词汇云发散动画",
          durationMs: 6400,
        },
        {
          narration: "写故事、想创意、做文案时，提高温度往往能带来更多惊喜；但温度太高，模型也可能挑中那些本不该选的低概率词。",
          searchQuery: "故事 创意 文案",
          mgType: null,
          mgPrompt: "",
          durationMs: 6800,
        },
        {
          narration: "一旦随机性过强，回答就容易变得混乱甚至出错。所以你看 AI 时而严谨、时而跳脱，很多时候不是它变聪明了，只是温度这个旋钮被拧动了——它决定的，究竟是保守还是大胆。",
          searchQuery: "严谨 创造力 对比",
          mgType: "contrast",
          mgPrompt: "左右对比：保守 vs 大胆，天平动画",
          durationMs: 7500,
        },
      ],
    };
  }
  // 通用 Mock：按语义重写而非硬切；短稿（<40字）需扩写为 4-6 段
  const cleaned = script.replace(/\n+/g, "。").split(/[。！？]+/).map((s) => s.trim()).filter(Boolean);
  let groups: string[] = [];
  // 短稿特殊处理：如“高铁硬币为什么能立住？” 仅1句，需扩写
  if (cleaned.length === 1 && cleaned[0].length < 40) {
    const topic = cleaned[0].replace(/[:：]/g, " ");
    groups = [
      `你有没有注意到，${topic}？`,
      `同样的硬币，在普通火车上连放都放不稳，但在高铁上却能稳稳立住。`,
      `这背后最大的差别，其实不在车厢，而在你的脚下。`,
      `普通铁路铺满碎石，而高铁轨道下连一粒石子都找不到，这正是物理定律的精妙设计。`,
    ];
  } else {
    let buf = "";
    for (const s of cleaned) {
      const cand = buf ? buf + "，" + s : s;
      if (cand.length < 32) buf = cand;
      else if (cand.length <= 68) {
        buf = cand;
        if (buf.length >= 45) {
          groups.push(buf);
          buf = "";
        }
      } else {
        if (buf) groups.push(buf);
        buf = s;
      }
    }
    if (buf) groups.push(buf);
    groups = groups.slice(0, 10);
    // 若仍少于4段（短稿），用模板补足
    while (groups.length < 4 && groups.length > 0) {
      const last = groups[groups.length - 1];
      groups.push(last.slice(0, 20) + "的进一步解析。");
      if (groups.length >= 6) break;
    }
  }
  const scenes = groups.slice(0, 10).map((g, i) => ({
    narration: g,
    searchQuery: g.slice(0, 12),
    mgType: g.length > 30 && i % 2 === 1 ? "callout" : g.includes("高铁") || g.includes("硬币") ? "flow" : null,
    mgPrompt: g.length > 30 && i % 2 === 1 ? "数据卡片+强调动效" : g.includes("高铁") ? "轨道对比动画" : "",
    durationMs: Math.max(5000, Math.min(7500, Math.round((g.length / 4.5) * 1000))),
  }));
  return { title: cleaned[0]?.slice(0, 24) || "未命名", scenes };
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

