# Stuido · 口播稿 → MG动画+视频素材短视频平台

> 复刻 B站花生AI `huasheng.cn` 的 **素材混合MG动画 (B模式)**，3分钟成片 · 标准版4层全量

[![Next.js 15](https://img.shields.io/badge/Next.js-15.4.5-black)](https://nextjs.org) [![Hyperframes](https://img.shields.io/badge/Hyperframes-0.7.60-blue)](https://github.com/heygen-com/hyperframes) [![FFmpeg](https://img.shields.io/badge/FFmpeg-8.1.2-green)](https://ffmpeg.org) [![License MIT](https://img.shields.io/badge/License-MIT-yellow)](LICENSE)

## 演示

*   **在线预览:** `http://127.0.0.1:3000`（本地 `bun dev` 后）
*   **示例成片:** `apps/web/renders/*/final_with_audio.mp4`（W3 已生成 6 个示例，见下方）
*   **仓库:** `https://github.com/zh123a/stuido.git` `main` 分支

| 输入页 (图2) | 创作规划书 (图3) | 时间线编辑器 (图4) |
|---|---|---|
| `让文字穿越到影像的世界` 输入文稿/上传口播 0/10000 | 表格 `画面类型|口播脚本|画面描述` 需确认Gate | 三栏：字幕列表 | 预览+控制 | 素材6选1+MG状态+自然语言输入 |

## 核心能力 (W1-W3 已完成)

*   **B模式混剪:** 视频素材(底) + MG透明层(中) + 字幕(顶)，如 `轨道板实拍 + 激光线/卫星图标/2毫米数据卡`
*   **创作规划书Gate:** `画面类型|口播脚本|画面描述` 表格，`总预估消耗 186` 需确认后才渲染
*   **时间线编辑器:** 12分镜轨道，每段5-6s，`分镜总数/总时长`，`重配画面/展开更多`
*   **自然语言编辑:** `合并前3个分镜` `把所有外国人素材换成中国人` `把分镜09的MG换成柱状图` → 定点重渲染
*   **真实MG渲染:** `puppeteer-core 25.8.0` + Chrome 截图 MG HTML 为透明 PNG，再 `ffmpeg overlay`（W3）
*   **BGM情感匹配:** `sine+lowpass+fade` 按 `通用平和/热血/悬疑` 生成并 `amix` 混音 `TTS 1.0 + BGM 0.14`
*   **字幕:** 全片 `subs.srt` 生成，`subtitles` 尝试烧录（无 `libass` 时回退保留）

## 架构 (标准版4层)

```
Next.js前端(输入/规划书/编辑器) → BFF(API Routes) → 内存队列+文件持久化(progress.json/plan.json) → 并行Worker(TTS/素材/MG/BGM) → Puppeteer(Chrome)+Hyperframes+FFmpeg合成 → 本地renders/
```
后续可替换为 `BullMQ+Redis` + `Postgres+Drizzle` + `R2/S3`，`Lib` 已预留接口。

## 技术栈

| 层 | 技术 | 说明 |
|---|---|---|
| 前端 | Next.js 15.4.5, React 19.1, Tailwind 3.4, Zustand | 图2/3/4还原 |
| 队列 | 内存Map + 文件持久化（兼容 BullMQ）| `apps/web/lib/queue.ts:17` |
| LLM | DeepSeek-V3 (OpenAI兼容) + 规则回退 | `apps/web/lib/llm.ts:1` |
| TTS | EdgeTTS占位 → ffmpeg静音估算 4.5字/秒 | `apps/web/lib/tts.ts:1` |
| 素材 | Pexels/Pixabay API + mock fallback | `apps/web/lib/pexels.ts:1` |
| MG渲染 | Puppeteer 25.8.0 + Hyperframes 0.7.60 + GSAP 3.12 | `apps/web/lib/mg-render.ts:1` |
| BGM | sine+lowpass | `apps/web/lib/bgm.ts:1` |
| 合成 | FFmpeg 8.1.2 + ffprobe | overlay / amix / subtitles |
| 部署 | Bun 1.3.14, Node 24, Chrome 151, Docker可选 | `bun.lock` |

## 快速开始

```bash
git clone https://github.com/zh123a/stuido.git
cd stuido

# 1. 环境
cp .env.example .env  # 填 PEXELS_API_KEY / DEEPSEEK_API_KEY (可选，无则走mock/规则)
# ffmpeg 使用 TRAE 内置路径已在 .env.example 预设，或 brew install ffmpeg
# Chrome 使用 /Applications/Google Chrome.app

# 2. 安装 (已换 npmmirror，36s)
bun install

# 3. 启动
bun --cwd apps/web run dev  # http://127.0.0.1:3000
# 或 pnpm --filter web dev

# 4. 自检
node scripts/doctor.mjs
node scripts/render-demo.mjs  # 生成 renders/demo/final_demo.mp4

# 5. 一键验证全链路 (不经过浏览器)
bun run scripts/test-w2.mjs
# 经过浏览器：
curl -X POST http://127.0.0.1:3000/api/projects -H "Content-Type: application/json" \
  -d '{"script":"高铁硬币科普测试，需要MG演示毫米级精度。","voice":"zh-CN-YunxiNeural","aspect":"16:9"}'
# → {projectId} → POST /api/projects/:id/confirm → 轮询 GET /status → GET /preview
```

## 目录

```
docs/spec.md                          # 完整开发文档 (含Mermaid)
apps/web                              # Next.js 三页 + API
  app/page.tsx                        # 输入页
  app/project/[id]/plan/page.tsx      # 规划书
  app/project/[id]/edit/page.tsx      # 编辑器 (SSE进度+自然语言)
  app/api/projects/*                  # 创建/确认/状态(SSE)/预览/编辑
  lib/planner.ts llm.ts pexels.ts tts.ts queue.ts mg-render.ts bgm.ts
apps/worker                           # 预留 BullMQ worker
packages/core                         # plan.json Schema (Zod)
packages/hyperframes-templates/mg     # scene03/09.html 真实MG模板
scripts/doctor.mjs render-demo.mjs test-w2.mjs
renders/  apps/web/renders/           # 产物 (gitignored, 示例见下方)
```

## 示例成片 (W3 本地已生成)

```bash
ls apps/web/renders/*/final_with_audio.mp4
# 0f6558e7... 194K 12分镜7MG (高铁硬币完整稿)
# 91b03d74... 195K 10分镜7MG + BGM 438K + mg PNG 249K
# adb4b4bd... 75K 6分镜3MG + BGM混音 18K
# 7fc1d980... 116K 8分镜4MG
ffprobe -v error -select_streams v:0 -show_entries stream=width,height,duration -of default=nw=1 \
  apps/web/renders/91b03d74-c75a-4792-8dff-de16dbbe5aea/final_with_audio.mp4
# width=1920 height=1080 duration=72.200000
```

预览：`open apps/web/renders/91b03d74-c75a-4792-8dff-de16dbbe5aea/final_with_audio.mp4`

## API

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | /api/projects | 创建 `{script, voice, aspect}` → `{projectId, plan}` |
| GET | /api/projects/:id | 规划书 |
| POST | /api/projects/:id/confirm | 确认Gate → 并行生成 |
| GET | /api/projects/:id/status | 轮询或SSE `text/event-stream` `{progress, plan}` |
| GET | /api/projects/:id/preview | 视频流 `video/mp4` |
| POST | /api/projects/:id/edit | 自然语言 `{cmd}` → `{intent, plan}` |

## 修复记录

*   **2026-08-23 ESM修复:** 移除 `apps/web/package.json` `type:module`，`planner.ts`/`queue.ts` 改 `import fsSync` 替代 `require`，补 `tailwindcss/postcss/autoprefixer`，`bun.lock` 更新 108→158包。详见 `0436d2f`。

## 开源参考

*   `harry0703/MoneyPrinterTurbo` 113k MIT - MVP底座
*   `calesthio/OpenMontage` 49k AGPL - 最全管线
*   `heygen-com/hyperframes` 42k Apache2 - MG引擎

## 路线图

*   [x] W1 脚手架 + 规划书 + 单分镜叠加
*   [x] W2 并行化 + 时间线编辑器 + 自然语言编辑
*   [x] W3 真实MG渲染(Puppeteer) + BGM混音 + 字幕
*   [ ] W4 多模板/字幕样式/一键发布B站/必剪

## License

MIT
