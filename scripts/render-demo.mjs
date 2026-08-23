#!/usr/bin/env node
// W1 本地渲染演示：验证 Hyperframes 单分镜叠加是否可出 MP4
// 优先用 ffmpeg 直接合成占位視頻 + MG 截图，若 hyperframes/Chromium 不可用则降級為靜態圖
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const ffmpegBin = process.env.FFMPEG_PATH || "/System/Volumes/Data/Users/zh/Library/Application Support/TRAE SOLO/ModularData/ai-agent/vm/tools/opt/ffmpeg/8.1.2/bin/ffmpeg";
const ffprobeBin = process.env.FFPROBE_PATH || "/System/Volumes/Data/Users/zh/Library/Application Support/TRAE SOLO/ModularData/ai-agent/vm/tools/opt/ffmpeg/8.1.2/bin/ffprobe";

function run(cmd) {
  console.log(`$ ${cmd}`);
  execSync(cmd, { stdio: "inherit", cwd: root });
}

const outDir = path.join(root, "renders", "demo");
fs.mkdirSync(outDir, { recursive: true });

// 1. 生成 6s 占位视频底 (漸變色塊模擬實拍)
const bgVideo = path.join(outDir, "bg.mp4");
run(`"${ffmpegBin}" -y -f lavfi -i color=c=0x0f2747:s=1920x1080:r=30:d=6 -vf "drawbox=x=360:y=430:w=1200:h=220:color=#b8c2d0:t=fill, drawbox=x=360:y=500:w=1180:h=10:color=#5a6a7d:t=fill" -c:v libx264 -pix_fmt yuv420p -t 6 "${bgVideo}"`);

// 2. 尝试 Hyperframes 渲染 MG 層 (若失敗則跳過)
let mgRendered = false;
try {
  console.log("\n--- 嘗試 hyperframes 渲染 scene03.html ---");
  run(`npx --yes hyperframes render packages/hyperframes-templates/mg/scene03.html -o "${path.join(outDir, "mg03.mp4")}" --fps 30 --width 1920 --height 1080 2>&1 | head -n 40`);
  mgRendered = fs.existsSync(path.join(outDir, "mg03.mp4"));
} catch (e) {
  console.log("hyperframes 渲染未成功，降級為靜態 MG 截圖方案");
}

// 3. 用 ffmpeg 疊加：若有 mg03.mp4 則 overlay，否則直接用 bg.mp4 當最終
const finalMp4 = path.join(outDir, "final_demo.mp4");
if (mgRendered) {
  run(`"${ffmpegBin}" -y -i "${bgVideo}" -i "${path.join(outDir, "mg03.mp4")}" -filter_complex "[0:v][1:v]overlay=0:0:shortest=1" -c:a copy "${finalMp4}"`);
} else {
  // 降級：為 bg 加上文字水印模擬 MG 卡片
  run(`"${ffmpegBin}" -y -i "${bgVideo}" -vf "drawbox=x=560:y=620:w=800:h=90:color=black@0.6:t=fill, drawtext=text='2毫米 ≈ 2.6张银行卡厚度':fontcolor=white:fontsize=42:x=(w-text_w)/2:y=650" -c:a aac "${finalMp4}"`);
}

try {
  const info = execSync(`"${ffprobeBin}" -v error -select_streams v:0 -show_entries stream=width,height,r_frame_rate,duration -of default=nw=1 "${finalMp4}"`, { encoding: "utf8" });
  console.log("\n✓ 渲染完成: " + finalMp4);
  console.log(info);
  const stat = fs.statSync(finalMp4);
  console.log(`  大小: ${(stat.size / 1024).toFixed(1)} KB`);
} catch (e) {
  console.error(e.message);
}
console.log("\n預覽：open renders/demo/final_demo.mp4");
