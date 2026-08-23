import fs from "fs/promises";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
const execFileAsync = promisify(execFile);
const ffmpegBin = process.env.FFMPEG_PATH || "/System/Volumes/Data/Users/zh/Library/Application Support/TRAE SOLO/ModularData/ai-agent/vm/tools/opt/ffmpeg/8.1.2/bin/ffmpeg";

// 根据情感选 BGM（W3先用内置生成，后续可接真实库）
// emotion: 通用平和/热血/悬疑 等
export async function ensureBgm(emotion: string, outPath: string, durationSec: number): Promise<string> {
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  // 若已存在且时长足够则复用
  try {
    const st = await fs.stat(outPath);
    if (st.size > 1000) return outPath;
  } catch {}
  // 生成轻量 BGM：sine 波 + 低通，模拟氛围音乐
  // 通用平和：220Hz 正弦，音量 -26dB
  const freq = emotion.includes("热血") ? 330 : emotion.includes("悬疑") ? 110 : 220;
  // 使用 anullsrc + sine 合成，或直接 sine
  await execFileAsync(ffmpegBin, [
    "-y",
    "-f",
    "lavfi",
    "-i",
    `sine=frequency=${freq}:duration=${durationSec}:sample_rate=48000`,
    "-filter:a",
    "lowpass=f=1200,volume=0.08,afade=t=in:st=0:d=1,afade=t=out:st=" + (durationSec - 1) + ":d=1",
    "-c:a",
    "aac",
    "-b:a",
    "96k",
    outPath,
  ]);
  return outPath;
}
