import { NextRequest, NextResponse } from "next/server";
import { getPlan } from "@/lib/planner";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const plan = getPlan(id);
  if (!plan) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(plan);
}
