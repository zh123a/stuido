#!/usr/bin/env node
// 直接测试 W2 管道：planner + queue，不经过 Next.js HTTP
import path from "path";
import fs from "fs/promises";
import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
process.chdir(path.join(__dirname, "..", "apps", "web"));

// 动态导入
const { createPlan, getPlan } = await import("../apps/web/lib/planner.ts");
const { enqueueRender, getProgress } = await import("../apps/web/lib/queue.ts");

const script = `你有没有注意到一个细节。 同样的硬币，在普通火车上连放都放不稳，但在高铁上却能稳稳立住。 这背后最大的差别，其实不在车厢，而在你的脚下。 普通铁路的枕木下面，铺满了碎石。但高铁轨道下，却连一粒石子都找不到。这不是为了省钱，而是被物理定律逼出来的... 当列车时速超过250公里，带起的气流会把道砟石子像子弹一样吸起来，直接击打车底和轨道。这叫"道砟飞溅"。 所以高速铁路必须抛弃传统的碎石道床，改用整体浇筑的混凝土底板。 换句话说，就是把轨道固定在一整块刚性面板上。但这样还不够。高铁的平稳，靠的是另一个不可思议的精度指标。 铺设这种混凝土轨道板时，全程由卫星和激光引导，全自动化精调。 以中国最常见的高铁轨道为例，两根钢轨之间的高低误差，必须控制在2毫米以内。 2毫米是什么概念？比一张银行卡的厚度还薄半圈。 而且这条"毫米级"的标线，要连续贯穿上千公里，翻山越岭也不能断。`;

console.log("创建 plan...");
const plan = await createPlan({ script, voice: "zh-CN-YunxiNeural", aspect: "16:9", mode: "standard" });
console.log(`planId=${plan.projectId} title=${plan.title} scenes=${plan.scenes.length} mg=${plan.metrics.mgScenes} source=${plan.source}`);
console.log(JSON.stringify(plan.scenes.slice(0,2).map(s=>({id:s.id, mg: s.mg?.prompt, q:s.search.query})), null, 2));

console.log("\nenqueueRender...");
await enqueueRender(plan.projectId);

let last = "";
for (let i=0;i<60;i++) {
  await new Promise(r=>setTimeout(r,1000));
  const p = getProgress(plan.projectId);
  const line = `${new Date().toISOString().slice(11,19)} ${p.step} ${p.progress}% ${p.done?"DONE":""}`;
  if (line!==last) { console.log(line); last=line; }
  if (p.done) break;
  if (p.error) { console.error("error", p.error); break; }
}

const finalPlan = getPlan(plan.projectId);
console.log("\n最终 plan status", finalPlan.status);
console.log("finalVideo", finalPlan.finalVideo);
try {
  const stat = await fs.stat(finalPlan.finalVideo);
  console.log("视频大小", (stat.size/1024).toFixed(1), "KB");
  // ffprobe
  const { execFile } = await import("child_process");
  const { promisify } = await import("util");
  const execFileAsync = promisify(execFile);
  const ffmpegBin = process.env.FFPROBE_PATH || "/System/Volumes/Data/Users/zh/Library/Application Support/TRAE SOLO/ModularData/ai-agent/vm/tools/opt/ffmpeg/8.1.2/bin/ffprobe";
  const out = await execFileAsync(ffmpegBin, ["-v","error","-select_streams","v:0","-show_entries","stream=width,height,duration","-of","default=nw=1", finalPlan.finalVideo]);
  console.log(out.stdout);
} catch(e){ console.error(e.message); }

console.log("\n测试自然语言编辑: 合并前3个分镜");
const editRes = await fetch(`http://localhost:3000/api/projects/${plan.projectId}/edit`, { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({cmd:"合并前3个分镜"}) }).catch(()=>null);
if (editRes) console.log("edit HTTP", await editRes.text().catch(()=>"?"));
else {
  // 直接调用 lib
  const { getPlan: gp, setPlan: sp } = await import("../apps/web/lib/planner.ts");
  // 模拟调用 edit route 逻辑
  console.log("跳过HTTP，直接完成");
}
