import { NextRequest, NextResponse } from "next/server";
import { createPlan } from "@/lib/planner";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { script, voice = "zh-CN-YunxiNeural", aspect = "16:9", mode = "standard" } = body;
    if (!script || typeof script !== "string" || script.trim().length < 10) {
      return NextResponse.json({ error: "口播稿至少10字" }, { status: 400 });
    }
    if (script.length > 10000) {
      return NextResponse.json({ error: "口播稿最多10000字" }, { status: 400 });
    }
    const plan = await createPlan({ script, voice, aspect, mode });
    return NextResponse.json({ projectId: plan.projectId, plan });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e.message || "创建失败" }, { status: 500 });
  }
}
