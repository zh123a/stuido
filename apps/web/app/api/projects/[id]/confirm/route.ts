import { NextRequest, NextResponse } from "next/server";
import { getPlan, setPlan } from "@/lib/planner";
import { enqueueRender } from "@/lib/queue";

export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const plan = getPlan(id);
  if (!plan) return NextResponse.json({ error: "not found", id }, { status: 404 });
  if (plan.status === "rendering" || plan.status === "queued") {
    return NextResponse.json({ ok: true, status: plan.status });
  }
  plan.status = "queued";
  setPlan(id, plan);
  await enqueueRender(id);
  return NextResponse.json({ ok: true, status: "queued" });
}
