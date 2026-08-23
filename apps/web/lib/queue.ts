import { setPlan, getPlan } from "./planner";
import { synthesizeTTS } from "./tts";
import { searchPexels } from "./pexels";
import path from "path";
import fs from "fs/promises";
import { execFile } from "child_process";
import { promisify } from "util";
const execFileAsync = promisify(execFile);

const ffmpegBin = process.env.FFMPEG_PATH || "/System/Volumes/Data/Users/zh/Library/Application Support/TRAE SOLO/ModularData/ai-agent/vm/tools/opt/ffmpeg/8.1.2/bin/ffmpeg";
const ffprobeBin = process.env.FFPROBE_PATH || "/System/Volumes/Data/Users/zh/Library/Application Support/TRAE SOLO/ModularData/ai-agent/vm/tools/opt/ffmpeg/8.1.2/bin/ffprobe";

// 简单内存队列，W2先不强依赖 Redis/BullMQ，后续可替换为 BullMQ
type JobStatus = { step: string; progress: number; done: boolean; error?: string };
const progressMap = new Map<string, JobStatus>();

function progressFile(id: string) {
  const candidates = [
    path.join(process.cwd(), "..", "..", "renders", id, "progress.json"),
    path.join(process.cwd(), "renders", id, "progress.json"),
    path.join("/Users/zh/项目/stuido/renders", id, "progress.json"),
    path.join("/Users/zh/项目/stuido/apps/web/renders", id, "progress.json"),
  ];
  return candidates[0];
}
function writeProgressFile(id: string, s: JobStatus) {
  try {
    const fsSync = require("fs");
    const p = progressFile(id);
    fsSync.mkdirSync(require("path").dirname(p), { recursive: true });
    fsSync.writeFileSync(p, JSON.stringify(s));
    // also write to alt
    for (const alt of [
      path.join("/Users/zh/项目/stuido/renders", id, "progress.json"),
      path.join("/Users/zh/项目/stuido/apps/web/renders", id, "progress.json"),
    ]) {
      try {
        require("fs").mkdirSync(require("path").dirname(alt), { recursive: true });
        require("fs").writeFileSync(alt, JSON.stringify(s));
      } catch {}
    }
  } catch {}
}

export function getProgress(id: string) {
  const mem = progressMap.get(id);
  if (mem && mem.done) return mem;
  // 尝试从磁盘读取（跨实例共享）
  try {
    const fsSync = require("fs");
    for (const p of [
      path.join(process.cwd(), "..", "..", "renders", id, "progress.json"),
      path.join(process.cwd(), "renders", id, "progress.json"),
      path.join("/Users/zh/项目/stuido/renders", id, "progress.json"),
      path.join("/Users/zh/项目/stuido/apps/web/renders", id, "progress.json"),
    ]) {
      if (fsSync.existsSync(p)) {
        const j = JSON.parse(fsSync.readFileSync(p, "utf8"));
        if (j && typeof j.progress === "number") {
          progressMap.set(id, j);
          return j;
        }
      }
    }
  } catch {}
  return mem || { step: "idle", progress: 0, done: false };
}
export function setProgress(id: string, s: JobStatus) {
  progressMap.set(id, s);
  writeProgressFile(id, s);
}

function resolveRendersRoot(projectId: string) {
  const cwd = process.cwd();
  const candidates = [
    path.join(cwd, "..", "..", "renders", projectId),
    path.join(cwd, "renders", projectId),
    path.join(cwd, "..", "renders", projectId),
  ];
  for (const c of candidates) {
    try {
      if (c.includes("apps/web")) return c;
    } catch {}
  }
  // 优先用绝对路径 /项目/stuido/renders
  if (cwd.endsWith("web")) return path.join(cwd, "..", "..", "renders", projectId);
  if (cwd.includes("apps")) return path.join(cwd, "..", "..", "renders", projectId);
  return path.join(cwd, "renders", projectId);
}

export async function enqueueRender(projectId: string) {
  const plan = getPlan(projectId);
  if (!plan) throw new Error("plan not found");
  setProgress(projectId, { step: "queued", progress: 5, done: false });
  // 异步执行，不阻塞
  runPipeline(projectId).catch((e) => {
    console.error("[queue] pipeline error", e);
    setProgress(projectId, { step: "error: " + (e.message || e), progress: 100, done: true, error: String(e) });
  });
  return { queued: true };
}

async function runPipeline(projectId: string) {
  const plan = getPlan(projectId);
  if (!plan) throw new Error("plan not found");
  const root = resolveRendersRoot(projectId);
  await fs.mkdir(root, { recursive: true });

  // Step 1: 并行生成 TTS + 素材检索
  setProgress(projectId, { step: "tts+search", progress: 15, done: false });
  const ttsTasks = plan.scenes.map(async (s: any, i: number) => {
    const out = path.join(root, `tts_scene${s.id}.m4a`);
    const r = await synthesizeTTS(s.narration, plan.voice, out);
    // 用真实时长校正分镜时长（若tts比预设长则拉长）
    s.ttsPath = out;
    s.ttsDurationMs = r.durationMs;
    s.durationMs = Math.max(s.durationMs, r.durationMs);
  });
  const searchTasks = plan.scenes.map(async (s: any) => {
    const videos = await searchPexels(s.search.query, 1);
    s.footage = videos[0];
  });
  await Promise.all([...ttsTasks, ...searchTasks]);
  setProgress(projectId, { step: "mg", progress: 45, done: false });

  // Step 2: MG 模板拷贝（W2 先用内置的2个模板，其余复用）
  for (const s of plan.scenes) {
    if (s.mg) {
      const src = s.id === "03" ? "../../packages/hyperframes-templates/mg/scene03.html" : s.id === "09" ? "../../packages/hyperframes-templates/mg/scene09.html" : null;
      if (src) {
        const dest = path.join(root, `mg_scene${s.id}.html`);
        try {
          const srcAbs = path.join(process.cwd(), src);
          await fs.copyFile(srcAbs, dest);
          s.mg.htmlPath = dest;
        } catch {}
      } else {
        // 通用卡片模板
        const dest = path.join(root, `mg_scene${s.id}.html`);
        await fs.writeFile(dest, genericMgHtml(s.narration), "utf8");
        s.mg.htmlPath = dest;
      }
    }
  }
  setProgress(projectId, { step: "render", progress: 70, done: false });

  // Step 3: 为每分镜生成占位视频底 + 静音时长对齐
  for (const s of plan.scenes) {
    const sceneVideo = path.join(root, `scene${s.id}.mp4`);
    const durSec = (s.durationMs / 1000).toFixed(3);
    // 底视频：纯色+纹理（避免 drawtext 中文无字体问题，W3再加字幕烧录）
    await execFileAsync(ffmpegBin, [
      "-y",
      "-f",
      "lavfi",
      "-i",
      `color=c=0x1a2744:s=1920x1080:r=30:d=${durSec}`,
      "-vf",
      `drawbox=x=360:y=480:w=1200:h=140:color=white@0.08:t=fill`,
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      "-t",
      durSec,
      sceneVideo,
    ]);
    s.sceneVideo = sceneVideo;
  }
  setProgress(projectId, { step: "concat", progress: 90, done: false });

  // Step 4: 合成最终视频 + 混音
  const listPath = path.join(root, "concat.txt");
  const concatContent = plan.scenes.map((s: any) => `file '${s.sceneVideo}'`).join("\n");
  await fs.writeFile(listPath, concatContent, "utf8");

  const finalVideo = path.join(root, "final.mp4");
  await execFileAsync(ffmpegBin, ["-y", "-f", "concat", "-safe", "0", "-i", listPath, "-c", "copy", finalVideo]);

  // 混音：把每段 tts 按顺序 concat 成全片音频，再与视频合并
  const audioList = path.join(root, "audio_concat.txt");
  const audioConcat = plan.scenes.map((s: any) => `file '${s.ttsPath}'`).join("\n");
  await fs.writeFile(audioList, audioConcat, "utf8");
  const fullAudio = path.join(root, "full.m4a");
  await execFileAsync(ffmpegBin, ["-y", "-f", "concat", "-safe", "0", "-i", audioList, "-c", "copy", fullAudio]);

  const finalWithAudio = path.join(root, "final_with_audio.mp4");
  await execFileAsync(ffmpegBin, [
    "-y",
    "-i",
    finalVideo,
    "-i",
    fullAudio,
    "-c:v",
    "copy",
    "-c:a",
    "aac",
    "-shortest",
    finalWithAudio,
  ]);

  // 更新 plan 状态
  plan.status = "rendered";
  plan.finalVideo = finalWithAudio;
  plan.renderedAt = new Date().toISOString();
  setPlan(projectId, plan);
  await fs.writeFile(path.join(root, "plan.json"), JSON.stringify(plan, null, 2));
  setProgress(projectId, { step: "done", progress: 100, done: true });
  console.log(`[queue] done ${projectId} -> ${finalWithAudio}`);
}

function escapeDrawText(s: string) {
  return s.replace(/:/g, "\\:").replace(/'/g, "\\'").slice(0, 20);
}

function genericMgHtml(narration: string) {
  const safe = narration.slice(0, 32).replace(/</g, "&lt;");
  return `<!doctype html><html><head><style>body{width:1920px;height:1080px;margin:0;background:transparent;display:flex;align-items:center;justify-content:center} .card{background:rgba(8,16,32,0.78);border:1px solid rgba(0,229,255,0.35);color:#e6f7ff;padding:22px 36px;border-radius:20px;font-size:44px;backdrop-filter:blur(12px)}</style><script src="https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js"></script></head><body><div class="card">${safe}</div><script>const tl=gsap.timeline();tl.from(".card",{y:24,opacity:0,duration:0.5});window.__hyperframes_seek=(f,fps)=>tl.seek(f/fps);tl.play();</script></body></html>`;
}
