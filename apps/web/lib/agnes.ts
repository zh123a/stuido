import { config } from "./config";
import { getActiveChannel, getChannelKey } from "./llm-channel";

type AgnesCreateParams = {
  prompt: string;
  seconds?: string; // "4"-"12" default "5"
  size?: string; // fixed "720P" for flash
  aspect_ratio?: string; // 16:9 default
  mode?: "text" | "keyframe" | "reference";
  first_frame?: string;
  last_frame?: string;
  images?: string[];
  audios?: string[];
  seed?: number;
};

type AgnesCreateResult = {
  video_id?: string;
  id?: string;
  task_id?: string;
  status?: string;
  raw: any;
};

async function resolveAgnes(): Promise<{ key: string; base: string; model: string }> {
  // DB channel first
  try {
    const ch = await getActiveChannel("agnes");
    if (ch) {
      const { key, baseUrl, model } = await getChannelKey(ch);
      return { key, base: baseUrl || config.AGNES_BASE_URL, model: model || config.AGNES_MODEL };
    }
  } catch {}
  if (!config.AGNES_API_KEY) throw new Error("未配置 Agnes 通道，请在 管理后台→接口通道 新增 agnes 并填入 API Key，或在 .env 设置 AGNES_API_KEY");
  return { key: config.AGNES_API_KEY, base: config.AGNES_BASE_URL, model: config.AGNES_MODEL };
}

export async function agnesCreateVideo(params: AgnesCreateParams): Promise<AgnesCreateResult> {
  const { key, base, model } = await resolveAgnes();
  const url = `${base.replace(/\/$/, "")}/videos`;
  const body: any = {
    model: model || "agnes-video-2.5-flash",
    prompt: params.prompt,
    seconds: params.seconds || "5",
    mode: params.mode || "text",
    size: "720P", // flash fixed
    aspect_ratio: params.aspect_ratio || "16:9",
  };
  if (params.seed !== undefined) body.seed = params.seed;
  if (params.mode === "keyframe") {
    if (params.first_frame) body.first_frame = params.first_frame;
    if (params.last_frame) body.last_frame = params.last_frame;
  }
  if (params.mode === "reference") {
    if (params.images?.length) {
      if (params.images.length > 5) throw new Error("Flash: images 最多 5 张");
      body.images = params.images;
    }
    if (params.audios?.length) body.audios = params.audios;
  }

  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(async () => ({ raw: await res.text() }));
  if (!res.ok) {
    const detail = (data as any)?.detail || (data as any)?.error || JSON.stringify(data).slice(0, 800);
    throw new Error(`Agnes 创建失败 ${res.status}: ${detail}`);
  }
  const video_id = (data as any).video_id || (data as any).id || (data as any).task_id;
  return { video_id, id: (data as any).id, task_id: (data as any).task_id, status: (data as any).status, raw: data };
}

export async function agnesQueryVideo(videoId: string, modelName = "agnes-video-2.5-flash"): Promise<any> {
  const { key } = await resolveAgnes();
  // 推荐 video_id + model_name
  const url = `https://apihub.agnes-ai.com/agnesapi?video_id=${encodeURIComponent(videoId)}&model_name=${encodeURIComponent(modelName)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${key}` } });
  const data = await res.json().catch(async () => ({ raw: await res.text() }));
  if (!res.ok) throw new Error(`Agnes 查询失败 ${res.status}: ${JSON.stringify(data).slice(0, 800)}`);
  return data;
}

export async function agnesTextToVideoUrl(prompt: string, seconds: number): Promise<string | null> {
  const created = await agnesCreateVideo({ prompt, seconds: String(Math.min(12, Math.max(4, seconds))), mode: "text", aspect_ratio: "16:9" });
  const vid = created.video_id || created.id || created.task_id;
  if (!vid) throw new Error("Agnes 未返回 video_id");
  const done: any = await agnesPollUntilDone(vid, { timeoutMs: 150000 });
  return done.video_url || done.url || done.result?.video_url || done.output?.video_url || done.data?.video_url || null;
}

export async function agnesPollUntilDone(videoId: string, opts?: { intervalMs?: number; timeoutMs?: number; modelName?: string }) {
  const interval = opts?.intervalMs ?? 1500;
  const timeout = opts?.timeoutMs ?? 180000;
  const modelName = opts?.modelName || "agnes-video-2.5-flash";
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const data: any = await agnesQueryVideo(videoId, modelName);
    const status = data.status || data.state || data.task_status;
    if (status === "completed" || status === "succeeded" || data.video_url || data.url) return data;
    if (status === "failed" || status === "error") throw new Error(`Agnes 任务失败: ${JSON.stringify(data).slice(0, 800)}`);
    await new Promise((r) => setTimeout(r, interval));
  }
  throw new Error("Agnes 轮询超时");
}
