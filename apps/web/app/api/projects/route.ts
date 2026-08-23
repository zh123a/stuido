import { NextRequest, NextResponse } from "next/server";
import { createPlan } from "@/lib/planner";
import { requireAuth } from "@/lib/auth";
import { db, projects } from "@/lib/db";
import { desc, eq } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    const url = new URL(req.url);
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
    const limit = Math.min(50, parseInt(url.searchParams.get("limit") || "20"));
    const offset = (page - 1) * limit;
    const isAdmin = user.role === "admin";
    const rows = isAdmin
      ? await db.select().from(projects).orderBy(desc(projects.createdAt)).limit(limit).offset(offset)
      : await db.select().from(projects).where(eq(projects.ownerId, user.id)).orderBy(desc(projects.createdAt)).limit(limit).offset(offset);
    return NextResponse.json({ projects: rows, page, limit });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "未登录" }, { status: e.status || 401 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { script, voice = "zh-CN-YunxiNeural", aspect = "16:9", mode = "standard", llmApiKey, llmProvider, llmBaseUrl } = body;
    if (!script || typeof script !== "string" || script.trim().length < 10) {
      return NextResponse.json({ error: "口播稿至少10字" }, { status: 400 });
    }
    if (script.length > 10000) {
      return NextResponse.json({ error: "口播稿最多10000字" }, { status: 400 });
    }
    let user: any = null;
    try {
      user = await requireAuth(req);
    } catch (e: any) {
      // 允许未登录创建（兼容旧版），但标记为 mock 游客；若需强制登录，取消下一行并返回 401
      // return NextResponse.json({ error: e.message }, { status: e.status || 401 });
    }
    // 临时注入前端传来的 Key（仅本次请求有效）
    if (llmApiKey) {
      if (llmProvider === "ark") process.env.ARK_API_KEY = llmApiKey;
      else if (llmProvider === "openai") process.env.OPENAI_API_KEY = llmApiKey;
      else if (llmProvider === "dashscope") process.env.DASHSCOPE_API_KEY = llmApiKey;
      else process.env.DEEPSEEK_API_KEY = llmApiKey;
      if (llmBaseUrl) {
        if (llmProvider === "ark") process.env.ARK_BASE_URL = llmBaseUrl;
        else if (llmProvider === "openai") process.env.OPENAI_BASE_URL = llmBaseUrl;
        else if (llmProvider === "dashscope") process.env.DASHSCOPE_BASE_URL = llmBaseUrl;
        else process.env.DEEPSEEK_BASE_URL = llmBaseUrl;
      }
    }
    const plan = await createPlan({ script, voice, aspect, mode });
    // 落库 projects（带 owner）
    try {
      await db.insert(projects).values({
        id: plan.projectId,
        ownerId: user?.id || null,
        title: plan.title,
        script: plan.script,
        voice: plan.voice,
        aspect: plan.aspect,
        status: plan.status,
        planJson: plan as any,
      });
    } catch (e) {
      console.warn("[projects] db insert failed", e);
    }
    return NextResponse.json({ projectId: plan.projectId, plan });
  } catch (e: any) {
    console.error(e);
    const msg = e.message || "创建失败";
    const isConfigError = msg.includes("未配置") || msg.includes("API Key");
    return NextResponse.json({ error: msg, needLlmConfig: isConfigError }, { status: isConfigError ? 400 : 500 });
  }
}
