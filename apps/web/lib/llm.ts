export type LlmPlanInput = { script: string; voice: string; aspect: string };

export async function callDeepSeekForPlan(input: LlmPlanInput): Promise<any | null> {
  const key = process.env.DEEPSEEK_API_KEY;
  const base = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com";
  if (!key) return null;
  try {
    const prompt = buildPrompt(input.script);
    const res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: process.env.DEEPSEEK_MODEL || "deepseek-chat",
        temperature: 0.6,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt() },
          { role: "user", content: prompt },
        ],
      }),
    });
    if (!res.ok) {
      const txt = await res.text();
      console.warn("[llm] deepseek error", res.status, txt.slice(0, 400));
      return null;
    }
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;
    const parsed = JSON.parse(content);
    // 期望 { scenes: [{ narration, searchQuery, mgType, mgPrompt, durationMs }] }
    return parsed;
  } catch (e) {
    console.warn("[llm] exception", e);
    return null;
  }
}

function systemPrompt() {
  return `你是花生AI的“制片人”分镜规划Agent。输入是一段中文口播稿（200-5000字）。
你必须：
- 理解主题、结构、情感、数据点
- 按语义切分 6-12 个分镜，每分镜 5-7秒，口播逐字对应
- 每个分镜输出：narration(本分镜逐字稿，含标点)、searchQuery(2-4个中文检索词，精准匹配实拍画面)、mgType(chart|flow|contrast|callout|physics|null)、mgPrompt(若需MG则描述叠加层的画面，如“灰色矩形轨道板+激光线交汇+2毫米数据卡”)、durationMs(5000-7000)
- 触发MG的规则：出现数据对比、百分比、倍数、流程、原理、毫米级精度、卫星/激光等工程概念时必须给 mg
- 素材偏好：现代中国、工程精密感、冷色调、避免人物正脸
- BGM：通用平和
- 只输出JSON，格式：{"title": "标题<=24字", "scenes": [...]}，不要markdown`;
}

function buildPrompt(script: string) {
  return `口播稿：\n${script}\n\n请按上述规则输出JSON。`;
}
