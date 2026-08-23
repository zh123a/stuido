import { NextRequest, NextResponse } from "next/server";
import { getPlan, setPlan } from "@/lib/planner";

function classifyIntent(cmd: string) {
  const c = cmd.trim();
  if (/合并/.test(c)) return { op: "merge", target: "first3" };
  if (/把.*换成.*中国人/.test(c) || /换成中国人/.test(c)) return { op: "replace_foreign", target: "all" };
  if (/换成.*柱状图|柱状图/.test(c)) return { op: "replace_mg", target: "latest", payload: { mgType: "chart", prompt: "柱状图对比" } };
  if (/重配|换素材/.test(c)) return { op: "reSearch", target: "all" };
  return { op: "generic", target: "all", raw: c };
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const plan = getPlan(id);
  if (!plan) return NextResponse.json({ error: "not found", id }, { status: 404 });
  // 归属校验
  try {
    const { db, projects } = await import("@/lib/db");
    const { eq } = await import("drizzle-orm");
    const [row] = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
    if (row?.ownerId) {
      const { getTokenFromHeader, verifyToken } = await import("@/lib/auth");
      const token = getTokenFromHeader(req);
      if (token) {
        try {
          const p = await verifyToken(token);
          if ((p as any).role !== "admin" && (p as any).id !== row.ownerId) return NextResponse.json({ error: "无权操作" }, { status: 403 });
        } catch {}
      }
    }
  } catch {}
  const { cmd } = await req.json();
  if (!cmd || typeof cmd !== "string") return NextResponse.json({ error: "cmd required" }, { status: 400 });

  const intent = classifyIntent(cmd);
  // W2 简化：直接在 plan 上打标记，真实渲染在 W3 做增量
  if (intent.op === "merge") {
    if (plan.scenes.length >= 3) {
      const first3 = plan.scenes.slice(0, 3);
      const mergedNarration = first3.map((s: any) => s.narration).join(" ");
      const merged = {
        id: "01",
        idx: 1,
        narration: mergedNarration,
        durationMs: first3.reduce((a: number, s: any) => a + s.durationMs, 0),
        search: first3[0].search,
        mg: first3.find((s: any) => s.mg)?.mg || null,
        bgm: "通用平和",
        layers: first3[0].layers,
      };
      plan.scenes = [merged, ...plan.scenes.slice(3).map((s: any, i: number) => ({ ...s, id: String(i + 2).padStart(2, "0"), idx: i + 2 }))];
    }
  } else if (intent.op === "replace_foreign") {
    for (const s of plan.scenes) {
      if (s.search?.filters) s.search.filters.country = "CN";
      s.search.query = s.search.query.replace(/外国|海外|欧美/g, "中国");
    }
  } else if (intent.op === "replace_mg") {
    const target = plan.scenes.find((s: any) => s.id === "09") || plan.scenes[1];
    if (target) target.mg = { enabled: true, type: "chart", prompt: "柱状图对比 MG", htmlPath: `mg/scene${target.id}.html` };
  }

  plan.totalDurationMs = plan.scenes.reduce((a: number, s: any) => a + s.durationMs, 0);
  plan.metrics = { videoClips: plan.scenes.length, mgScenes: plan.scenes.filter((s: any) => s.mg).length, cost: plan.scenes.filter((s: any) => s.mg).length * 93 + plan.scenes.length * 2 };
  plan.lastEdit = { cmd, intent, at: new Date().toISOString() };
  setPlan(id, plan);

  // 持久化
  try {
    const fs = await import("fs/promises");
    const path = await import("path");
    const dir = path.join(process.cwd(), "..", "..", "renders", id);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, "plan.json"), JSON.stringify(plan, null, 2));
  } catch {}

  return NextResponse.json({ ok: true, intent, plan });
}
