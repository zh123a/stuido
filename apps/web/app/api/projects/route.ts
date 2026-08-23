import { NextRequest, NextResponse } from "next/server";
import { createPlan } from "@/lib/planner";

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
    return NextResponse.json({ projectId: plan.projectId, plan });
  } catch (e: any) {
    console.error(e);
    const msg = e.message || "创建失败";
    const isConfigError = msg.includes("未配置") || msg.includes("API Key");
    return NextResponse.json({ error: msg, needLlmConfig: isConfigError }, { status: isConfigError ? 400 : 500 });
  }
}
