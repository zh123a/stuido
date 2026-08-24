export type PexelsVideo = { id: number; url: string; image: string; duration: number; provider: "pexels" | "mock" };

export async function searchPexels(query: string, perPage = 3): Promise<PexelsVideo[]> {
  // 优先走 DB 通道（管理后台配置），再兜底 env
  let key: string | undefined = process.env.PEXELS_API_KEY;
  try {
    const { getActiveChannel, getChannelKey } = await import("./llm-channel");
    const ch = await getActiveChannel("pexels");
    if (ch) {
      const k = await getChannelKey(ch);
      if (k.key) key = k.key;
    }
  } catch {}
  if (!key) {
    // mock：返回本地占位，后续渲染时用 ffmpeg 生成
    return Array.from({ length: perPage }).map((_, i) => ({
      id: 10000 + i,
      url: `mock://pexels/${encodeURIComponent(query)}/${i}`,
      image: `mock://image/${i}`,
      duration: 8,
      provider: "mock",
    }));
  }
  try {
    const url = `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=${perPage}&orientation=landscape&size=medium`;
    const res = await fetch(url, { headers: { Authorization: key } });
    if (!res.ok) {
      console.warn("[pexels] error", res.status, (await res.text()).slice(0, 300));
      return mockFallback(query, perPage);
    }
    const data = await res.json();
    const videos = (data.videos || []).map((v: any) => {
      // 选 1280x720 左右的 mp4
      const file = v.video_files?.find((f: any) => f.width >= 1280) || v.video_files?.[0];
      return {
        id: v.id,
        url: file?.link || v.url,
        image: v.image,
        duration: v.duration,
        provider: "pexels" as const,
      };
    });
    return videos.length ? videos : mockFallback(query, perPage);
  } catch (e) {
    console.warn("[pexels] exception", e);
    return mockFallback(query, perPage);
  }
}

function mockFallback(query: string, n: number): PexelsVideo[] {
  return Array.from({ length: n }).map((_, i) => ({
    id: 90000 + i,
    url: `mock://pexels/${encodeURIComponent(query)}/${i}`,
    image: `mock://image/${i}`,
    duration: 8,
    provider: "mock",
  }));
}

export async function downloadIfReal(video: PexelsVideo, dest: string): Promise<string> {
  if (video.provider === "mock" || video.url.startsWith("mock://")) {
    // W2 用 ffmpeg 生成占位视频，不下载
    return dest; // 调用方会自行生成
  }
  const res = await fetch(video.url);
  if (!res.ok) throw new Error(`download failed ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const fs = await import("fs/promises");
  await fs.writeFile(dest, buf);
  return dest;
}
