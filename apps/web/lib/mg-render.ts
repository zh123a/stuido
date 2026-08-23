import fs from "fs/promises";
import path from "path";

const chromePath = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

// 渲染 MG HTML 为透明 PNG（用于叠加）
// 若 Puppeteer 失败则返回 null，调用方回退到纯 ffmpeg 方案
export async function renderMgToPng(htmlPath: string, outPng: string): Promise<string | null> {
  try {
    // 动态导入 puppeteer-core，仅在需要时加载
    const puppeteer = await import("puppeteer-core").catch(() => null) as any;
    if (!puppeteer) {
      console.warn("[mg] puppeteer-core not available");
      return null;
    }
    const mod = puppeteer.default || puppeteer;
    const browser = await mod.launch({
      executablePath: chromePath,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu", "--disable-dev-shm-usage"],
      headless: "new",
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
    let html = await fs.readFile(htmlPath, "utf8");
    // 注入透明背景（若原模板有不透明背景，强制改透明以便叠加）
    // 保留 mg-layer，其余背景设透明
    html = html.replace(/background:\s*#0a0f1a/g, "background: transparent").replace(/background:\s*#070b1a/g, "background: transparent");
    await page.setContent(html, { waitUntil: "domcontentloaded", timeout: 8000 });
    // 等待 GSAP 动画初帧
    await new Promise((r) => setTimeout(r, 1200));
    await fs.mkdir(path.dirname(outPng), { recursive: true });
    await page.screenshot({ path: outPng, omitBackground: true, fullPage: false });
    await browser.close();
    return outPng;
  } catch (e) {
    console.warn("[mg] render failed", (e as any)?.message || e);
    return null;
  }
}

// 生成通用 MG HTML（当无模板时）
export function genericMgHtmlPath(narration: string, outPath: string): string {
  const safe = narration.slice(0, 36).replace(/</g, "&lt;");
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>*{margin:0;padding:0;box-sizing:border-box}body{width:1920px;height:1080px;margin:0;background:transparent;display:flex;align-items:center;justify-content:center;font-family:sans-serif} .card{background:rgba(8,16,32,0.82);border:1px solid rgba(0,229,255,0.38);color:#e6f7ff;padding:24px 38px;border-radius:20px;font-size:46px;backdrop-filter:blur(10px);box-shadow:0 12px 32px rgba(0,0,0,0.35)}</style><script src="https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js"></script></head><body><div class="card">${safe}</div><script>const tl=gsap.timeline();tl.from(".card",{y:24,opacity:0,duration:0.6});window.__hyperframes_seek=(f,fps)=>tl.seek(f/fps);tl.play();</script></body></html>`;
  // 同步写文件（调用方会 await，但此处用 sync 简化）
  try {
    const fsSync = require("fs");
    const pathSync = require("path");
    fsSync.mkdirSync(pathSync.dirname(outPath), { recursive: true });
    fsSync.writeFileSync(outPath, html, "utf8");
  } catch {}
  return outPath;
}
