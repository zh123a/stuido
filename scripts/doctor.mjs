#!/usr/bin/env node
import { execSync } from "child_process";

function check(cmd, name) {
  try {
    const out = execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim().split("\n")[0];
    console.log(`✓ ${name}: ${out}`);
    return true;
  } catch (e) {
    console.log(`✗ ${name}: NOT FOUND (${cmd})`);
    return false;
  }
}

console.log("Stuido doctor — W1 校验\n");
const ffmpegBin = process.env.FFMPEG_PATH || "/System/Volumes/Data/Users/zh/Library/Application Support/TRAE SOLO/ModularData/ai-agent/vm/tools/opt/ffmpeg/8.1.2/bin/ffmpeg";
const ffprobeBin = process.env.FFPROBE_PATH || "/System/Volumes/Data/Users/zh/Library/Application Support/TRAE SOLO/ModularData/ai-agent/vm/tools/opt/ffmpeg/8.1.2/bin/ffprobe";
check(`"${ffmpegBin}" -version 2>&1 | head -n 1`, "ffmpeg (TRAE path)");
check(`"${ffprobeBin}" -version 2>&1 | head -n 1`, "ffprobe");
check("node -v", "node");
check("pnpm -v", "pnpm");
check("npx --yes hyperframes --version 2>&1 | head -n 1", "hyperframes CLI");
try {
  const v = execSync("cat package.json | grep hyperframes", { encoding: "utf8" });
  console.log(`  package.json hyperframes: ${v.trim()}`);
} catch {}
console.log("\n提示：本机无 brew，按 TRAE 內建 ffmpeg 路徑已設 FFMPEG_PATH");
console.log("啟動：pnpm install && pnpm --filter web dev (http://localhost:3000)");
