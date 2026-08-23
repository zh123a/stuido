import { NextRequest } from "next/server";
import { getPlan } from "@/lib/planner";
import { getProgress } from "@/lib/queue";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const plan = getPlan(id);
  if (!plan) return new Response("not found: " + id, { status: 404 });

  const progress = getProgress(id);

  // 若客户端请求 EventSource，则返回 SSE
  const accept = _.headers.get("accept") || "";
  if (accept.includes("text/event-stream")) {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        let closed = false;
        const send = () => {
          if (closed) return;
          const p = getProgress(id);
          const curPlan = getPlan(id);
          const payload = JSON.stringify({ progress: p, plan: curPlan });
          controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
          if (p.done) {
            controller.enqueue(encoder.encode(`event: done\ndata: ${payload}\n\n`));
            controller.close();
            closed = true;
          }
        };
        send();
        const iv = setInterval(send, 800);
        _.signal.addEventListener("abort", () => {
          clearInterval(iv);
          try { controller.close(); } catch {}
          closed = true;
        });
      },
    });
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  }

  // 普通 JSON 轮询
  return Response.json({ progress, plan });
}
