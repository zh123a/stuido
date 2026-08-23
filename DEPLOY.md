# 部署指南

## 方式一：本地开发 (推荐)

```bash
git clone https://github.com/zh123a/stuido.git && cd stuido
cp .env.example .env  # 可选填 PEXELS_API_KEY / DEEPSEEK_API_KEY
bun install  # 已换 npmmirror，~36s
bun --cwd apps/web run dev  # http://127.0.0.1:3000
```

## 方式二：生产构建

```bash
bun --cwd apps/web run build
bun --cwd apps/web run start -p 3000 --hostname 0.0.0.0
# 或 node scripts/build-prod.mjs
```

## 方式三：Docker (可选)

```bash
docker compose up -d  # redis + postgres
bun install && bun --cwd apps/web run dev
```

## 环境要求

*   Node >=22, Bun 1.3, Chrome 151 (/Applications/Google Chrome.app)
*   FFmpeg 8.1 + FFprobe (TRAE 内置路径已在 .env 预设，或 brew install ffmpeg)
*   可选：PEXELS_API_KEY, DEEPSEEK_API_KEY, REDIS_URL, DATABASE_URL

## 健康检查

```bash
node scripts/doctor.mjs
curl http://127.0.0.1:3000/api/projects -X POST -H "Content-Type: application/json" -d '{"script":"test"}'
```

## 常见问题

*   `module is not defined`：已修复，勿在 apps/web/package.json 加 "type":"module"
*   `Cannot find module tailwindcss`：已补依赖，重新 `bun install`
*   `puppeteer-core not available`：`bun add puppeteer-core` 已在 package.json
*   `subtitles burn failed`：当前 ffmpeg 无 libass，自动回退保留无字幕版，SRT 仍生成于 `renders/*/subs.srt`
