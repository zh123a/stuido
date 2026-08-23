import fs from "fs/promises";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
const execFileAsync = promisify(execFile);

const ffmpegBin = process.env.FFMPEG_PATH || "/System/Volumes/Data/Users/zh/Library/Application Support/TRAE SOLO/ModularData/ai-agent/vm/tools/opt/ffmpeg/8.1.2/bin/ffmpeg";

export type TtsResult = { audioPath: string; durationMs: number; provider: string };

// W2 简化版：若无 EdgeTTS Key 则用 ffmpeg 生成静音占位（时长按字数估算 4字/秒）
// 后续可替换为 edge-tts npm 或 Azure
export async function synthesizeTTS(text: string, voice: string, outPath: string): Promise<TtsResult> {
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  const key = process.env.AZURE_SPEECH_KEY;
  const edgeVoice = voice || "zh-CN-YunxiNeural";

  // 尝试 EdgeTTS via Node (若安裝了 edge-tts 包)
  if (key) {
    try {
      // 占位：真实 Azure 调用可在此实现
      console.log("[tts] azure key present, but W2 uses ffmpeg placeholder, voice", edgeVoice);
    } catch {}
  }

  // 按中文阅读速度估算时长：约 4.5字/秒 + 200ms停顿
  const durationMs = Math.max(1500, Math.round((text.length / 4.5) * 1000));
  // 生成静音 wav (anullsrc) 转 mp3/aac，保持与视频时长对齐
  const durationSec = (durationMs / 1000).toFixed(3);
  await execFileAsync(ffmpegBin, [
    "-y",
    "-f",
    "lavfi",
    "-i",
    `anullsrc=r=24000:cl=mono`,
    "-t",
    durationSec,
    "-c:a",
    "aac",
    "-b:a",
    "96k",
    outPath,
  ]);
  // 同时生成 vtt 占位（W3 用 whisper 替换）
  const vttPath = outPath.replace(/\.(mp3|aac|wav|m4a)$/, ".vtt");
  const vtt = `WEBVTT\n\n00:00:00.000 --> ${secToVtt(durationSec)}\n${text.slice(0, 60)}\n`;
  await fs.writeFile(vttPath, vtt, "utf8");
  return { audioPath: outPath, durationMs, provider: "ffmpeg-silence" };
}

function secToVtt(s: string) {
  const sec = parseFloat(s);
  const m = Math.floor(sec / 60);
  const sc = (sec % 60).toFixed(3).padStart(6, "0");
  return `00:${String(m).padStart(2, "0")}:${sc}`;
}
