# Stuido · 口播稿 → MG动画+视频素材短视频平台

> 复刻 B站花生AI `huasheng.cn` 的 **素材混合MG动画 (B模式)**，3分钟成片

## 定位
输入口播稿/上传口播音频 → AI自动分镜、匹配实拍素材、生成MG动画、TTS、混音 → 时间线编辑器确认/自然语言改分镜 → 导出1080P。

对标截图流程：`输入文稿(图2) → 创作规划书(图3) → 时间线编辑器(图4)`，已锁定 **Hyperframes + GSAP** 做 MG叠加层。

## 核心能力
*   **B模式混剪**：视频素材(底) + MG透明层(中) + 字幕(顶)，如 `轨道板实拍 + 激光线/卫星图标/数据卡MG`
*   **创作规划书Gate**：`画面类型|口播脚本|画面描述` 表格，需确认后才渲染
*   **时间线编辑**：12分镜轨道，每段5-6s，预览区实时叠加，右侧6选1换素材
*   **自然语言编辑**：`把前3个分镜合并` `把外国人换成中国人` 定点重渲染

## 架构 (标准版4层)
```
Next.js前端(输入/规划书/编辑器) → BFF+BullMQ+Redis → 并行Worker(TTS/素材/MG/BGM) → Hyperframes Engine+Puppeteer+FFmpeg合成 → R2/S3
```

详见 `docs/spec.md` (含Mermaid流程/时序/架构图、API、数据模型、Hyperframes模板代码)。

## 技术栈
*   前端 Next.js 15, 后端 BullMQ+Redis, DB Postgres+Drizzle
*   LLM DeepSeek-V3 (OpenAI兼容), TTS EdgeTTS+FishAudio
*   MG `heygen-com/hyperframes 0.7.60` + GSAP (Apache2.0), 合成 FFmpeg 6, STT whisper.cpp
*   素材 Pexels/Pixabay + CLIP

## 快速开始
```bash
git clone https://github.com/zh123a/stuido.git
cd stuido
cp .env.example .env  # 填 PEXELS_API_KEY / DEEPSEEK_API_KEY
docker compose up -d  # web, worker, redis, postgres, chromium, ffmpeg
pnpm install && pnpm dev        # 前端 http://localhost:3000
pnpm worker                     # 队列消费
npx hyperframes --version       # 校验
```

## 目录
```
docs/spec.md                          # 完整开发文档
apps/web                              # Next.js 三页
apps/worker                           # BullMQ 消费
packages/core                         # plan.json Schema
packages/hyperframes-templates        # MG模板 (轨道板/激光线/数据卡)
```

## 开源参考
*   `harry0703/MoneyPrinterTurbo` 113k MIT - MVP底座
*   `calesthio/OpenMontage` 49k AGPL - 最全管线
*   `heygen-com/hyperframes` 42k Apache2 - MG引擎

## 路线图
*   W1 规划书+单分镜叠加跑通
*   W2 并行化+时间线编辑器
*   W3 自然语言编辑+BGM+导出

## 仓库
`https://github.com/zh123a/stuido.git` 已同步，`main` 分支。

## License
MIT
