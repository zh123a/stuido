import { setPlan, getPlan } from "./planner";
import { synthesizeTTS } from "./tts";
import { searchPexels } from "./pexels";
import { renderMgToPng } from "./mg-render";
import { ensureBgm } from "./bgm";
import path from "path";
import fs from "fs/promises";
import fsSync from "fs";
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
    const p = progressFile(id);
    fsSync.mkdirSync(path.dirname(p), { recursive: true });
    fsSync.writeFileSync(p, JSON.stringify(s));
    for (const alt of [
      path.join("/Users/zh/项目/stuido/renders", id, "progress.json"),
      path.join("/Users/zh/项目/stuido/apps/web/renders", id, "progress.json"),
    ]) {
      try {
        fsSync.mkdirSync(path.dirname(alt), { recursive: true });
        fsSync.writeFileSync(alt, JSON.stringify(s));
      } catch {}
    }
  } catch {}
}

export function getProgress(id: string) {
  const mem = progressMap.get(id);
  if (mem && mem.done) return mem;
  try {
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

  // Step 2: MG 模板准备 + Puppeteer 渲染为透明 PNG
  for (const s of plan.scenes) {
    if (s.mg) {
      const src = s.id === "03" ? "../../packages/hyperframes-templates/mg/scene03.html" : s.id === "09" ? "../../packages/hyperframes-templates/mg/scene09.html" : null;
      let htmlPath = path.join(root, `mg_scene${s.id}.html`);
      if (src) {
        try {
          const srcAbs = path.join(process.cwd(), src);
          await fs.copyFile(srcAbs, htmlPath);
        } catch {
          await fs.writeFile(htmlPath, genericMgHtml(s.narration), "utf8");
        }
      } else {
        await fs.writeFile(htmlPath, genericMgHtml(s.narration), "utf8");
      }
      s.mg.htmlPath = htmlPath;
      // 真实渲染 PNG（若失败则保留 html 供回退）
      try {
        const pngPath = path.join(root, `mg_scene${s.id}.png`);
        const rendered = await renderMgToPng(htmlPath, pngPath);
        if (rendered && fsSync.existsSync(rendered)) {
          s.mg.pngPath = rendered;
          console.log(`[queue] MG PNG rendered ${s.id} -> ${rendered}`);
        }
      } catch (e) {
        console.warn(`[mg] render failed ${s.id}`, e);
      }
    }
  }
  setProgress(projectId, { step: "render", progress: 70, done: false });

  // Step 3: 为每分镜生成视频底（真实素材优先，否则动态渐变占位）+ MG 叠加
  for (const s of plan.scenes) {
    const baseVideo = path.join(root, `scene${s.id}_base.mp4`);
    const sceneVideo = path.join(root, `scene${s.id}.mp4`);
    const durSec = (s.durationMs / 1000).toFixed(3);
    let baseOk = false;
    // 3a-0. AI 视频素材：选择了 Agnes 视频模型时，按分镜文生视频
    if ((plan.videoModel || "").includes("agnes")) {
      try {
        const { agnesTextToVideoUrl } = await import("./agnes");
        const url = await agnesTextToVideoUrl(`${s.search.query}，${s.narration.slice(0, 40)}，电影级运镜`, Math.round(s.durationMs / 1000));
        if (url) {
          const raw = path.join(root, `footage_raw_${s.id}.mp4`);
          const res = await fetch(url);
          if (res.ok) {
            await fs.writeFile(raw, Buffer.from(await res.arrayBuffer()));
            await execFileAsync(ffmpegBin, [
              "-y", "-i", raw, "-t", durSec,
              "-vf", "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30",
              "-an", "-c:v", "libx264", "-pix_fmt", "yuv420p", baseVideo,
            ]);
            baseOk = true;
            s.footage = { ...s.footage, url, provider: "agnes" };
          }
        }
      } catch (e: any) {
        console.warn(`[queue] agnes video failed ${s.id}:`, String(e.message || e).slice(0, 200));
      }
    }
    // 3a. 真实素材：Pexels 等 http 素材下载并裁剪
    if (!baseOk && s.footage?.url && /^https?:\/\//.test(s.footage.url)) {
      try {
        const raw = path.join(root, `footage_raw_${s.id}.mp4`);
        const { downloadIfReal } = await import("./pexels");
        await downloadIfReal({ id: s.footage.id, url: s.footage.url, image: s.footage.image, duration: s.footage.duration, provider: "pexels" }, raw);
        await execFileAsync(ffmpegBin, [
          "-y", "-i", raw, "-t", durSec,
          "-vf", "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30",
          "-an", "-c:v", "libx264", "-pix_fmt", "yuv420p", baseVideo,
        ]);
        baseOk = true;
      } catch (e) {
        console.warn(`[queue] footage download failed ${s.id}`, e);
      }
    }
    // 3b. 占位：动态渐变 + 网格，模拟实拍空镜
    if (!baseOk) {
      await execFileAsync(ffmpegBin, [
        "-y",
        "-f", "lavfi",
        "-i", `gradients=s=1920x1080:d=${durSec}:speed=0.06:c0=0x101c3a:c1=0x1a2744:c2=0x0f3460:c3=0x16213e:nb_colors=4`,
        "-vf", `drawgrid=w=240:h=135:t=1:c=white@0.05,drawbox=x=360:y=480:w=1200:h=140:color=white@0.06:t=fill`,
        "-c:v", "libx264", "-pix_fmt", "yuv420p", "-t", durSec,
        baseVideo,
      ]);
    }
    // 3c. MG PNG 叠加：PNG 单帧需 -loop 1，禁止 shortest（否则输出仅1帧）
    if (s.mg?.pngPath && fsSync.existsSync(s.mg.pngPath)) {
      try {
        await execFileAsync(ffmpegBin, [
          "-y",
          "-i", baseVideo,
          "-loop", "1", "-i", s.mg.pngPath,
          "-filter_complex", "[0:v][1:v]overlay=0:0:format=auto,format=yuv420p",
          "-c:v", "libx264",
          "-t", durSec,
          sceneVideo,
        ]);
      } catch (e) {
        console.warn(`[queue] overlay failed ${s.id}, fallback to base`, e);
        await fs.copyFile(baseVideo, sceneVideo);
      }
    } else {
      await fs.copyFile(baseVideo, sceneVideo);
    }
    s.sceneVideo = sceneVideo;
  }
  setProgress(projectId, { step: "concat", progress: 82, done: false });

  // 生成全片 SRT 字幕（用于烧录）
  const srtPath = path.join(root, "subs.srt");
  let cursorMs = 0;
  const srtLines: string[] = [];
  plan.scenes.forEach((s: any, idx: number) => {
    const start = cursorMs;
    const end = cursorMs + s.durationMs;
    srtLines.push(`${idx + 1}\n${msToSrt(start)} --> ${msToSrt(end)}\n${s.narration.slice(0, 60)}\n`);
    cursorMs = end;
  });
  await fs.writeFile(srtPath, srtLines.join("\n"), "utf8");
  plan.srtPath = srtPath;

  // BGM 生成（按总时长）
  setProgress(projectId, { step: "bgm", progress: 88, done: false });
  const totalSec = plan.scenes.reduce((a: number, s: any) => a + s.durationMs, 0) / 1000;
  const bgmPath = path.join(root, "bgm.m4a");
  try {
    await ensureBgm(plan.scenes[0]?.bgm || "通用平和", bgmPath, totalSec);
    plan.bgmPath = bgmPath;
  } catch (e) {
    console.warn("[bgm] failed", e);
  }

  // Step 4: 合成最终视频
  const listPath = path.join(root, "concat.txt");
  const concatContent = plan.scenes.map((s: any) => `file '${s.sceneVideo}'`).join("\n");
  await fs.writeFile(listPath, concatContent, "utf8");

  const finalVideo = path.join(root, "final.mp4");
  await execFileAsync(ffmpegBin, ["-y", "-f", "concat", "-safe", "0", "-i", listPath, "-c", "copy", finalVideo]);

  // 混音：TTS 全片 + BGM 混音
  const audioList = path.join(root, "audio_concat.txt");
  const audioConcat = plan.scenes.map((s: any) => `file '${s.ttsPath}'`).join("\n");
  await fs.writeFile(audioList, audioConcat, "utf8");
  const fullAudio = path.join(root, "full.m4a");
  await execFileAsync(ffmpegBin, ["-y", "-f", "concat", "-safe", "0", "-i", audioList, "-c", "copy", fullAudio]);

  // 若有 BGM，则混音（TTS 音量 1.0，BGM 0.14）
  let mixedAudio = fullAudio;
  if (plan.bgmPath && fsSync.existsSync(plan.bgmPath)) {
    const mixedPath = path.join(root, "mixed.m4a");
    try {
      await execFileAsync(ffmpegBin, [
        "-y",
        "-i",
        fullAudio,
        "-i",
        plan.bgmPath,
        "-filter_complex",
        "[0:a]volume=1.0[a0];[1:a]volume=0.14[a1];[a0][a1]amix=inputs=2:duration=shortest:dropout_transition=2,volume=1.0",
        "-c:a",
        "aac",
        "-b:a",
        "128k",
        mixedPath,
      ]);
      mixedAudio = mixedPath;
    } catch (e) {
      console.warn("[bgm] mix failed, fallback to tts only", e);
    }
  }

  const finalWithAudio = path.join(root, "final_with_audio.mp4");
  await execFileAsync(ffmpegBin, [
    "-y",
    "-i",
    finalVideo,
    "-i",
    mixedAudio,
    "-c:v",
    "copy",
    "-c:a",
    "aac",
    "-shortest",
    finalWithAudio,
  ]);

  // 尝试烧录字幕（若失败则保留无字幕版）
  const finalBurned = path.join(root, "final_burned.mp4");
  try {
    await execFileAsync(ffmpegBin, [
      "-y",
      "-i",
      finalWithAudio,
      "-vf",
      `subtitles=${srtPath}:force_style='FontName=PingFang SC,FontSize=22,PrimaryColour=&H00FFFFFF,OutlineColour=&H80000000,BackColour=&H80000000,BorderStyle=3,Outline=1,Shadow=0,MarginV=36'`,
      "-c:a",
      "copy",
      finalBurned,
    ]);
    // 若成功，用烧录版替换
    if (fsSync.existsSync(finalBurned) && fsSync.statSync(finalBurned).size > 1000) {
      await fs.copyFile(finalBurned, finalWithAudio);
      console.log("[queue] subtitles burned");
    }
  } catch (e) {
    console.warn("[sub] burn failed, keep without subtitles", (e as any)?.message?.slice(0, 200));
  }

  // 更新 plan 状态
  plan.status = "rendered";
  plan.finalVideo = finalWithAudio;
  plan.renderedAt = new Date().toISOString();
  setPlan(projectId, plan);
  await fs.writeFile(path.join(root, "plan.json"), JSON.stringify(plan, null, 2));
  setProgress(projectId, { step: "done", progress: 100, done: true });
  console.log(`[queue] done ${projectId} -> ${finalWithAudio}`);
}

function msToSrt(ms: number): string {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const msRem = ms % 1000;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")},${String(msRem).padStart(3, "0")}`;
}

function escapeDrawText(s: string) {
  return s.replace(/:/g, "\\:").replace(/'/g, "\\'").slice(0, 20);
}

function genericMgHtml(narration: string) {
  const safe = narration.slice(0, 32).replace(/</g, "&lt;");
  return `<!doctype html><html><head><style>body{width:1920px;height:1080px;margin:0;background:transparent;display:flex;align-items:center;justify-content:center} .card{background:rgba(8,16,32,0.78);border:1px solid rgba(0,229,255,0.35);color:#e6f7ff;padding:22px 36px;border-radius:20px;font-size:44px;backdrop-filter:blur(12px)}</style><script src="https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js"></script></head><body><div class="card">${safe}</div><script>const tl=gsap.timeline();tl.from(".card",{y:24,opacity:0,duration:0.5});window.__hyperframes_seek=(f,fps)=>tl.seek(f/fps);tl.play();</script></body></html>`;
}
