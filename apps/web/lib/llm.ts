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
- 理解主题、结构、情感、数据点，按语义而非标点切分
- 切分 6-12 个分镜，每分镜 35-70字（对应5-8秒），口播逐字对应且覆盖原文
- 严禁单句短词独占一分镜：如 "Temperature" "中文一般叫温度" 必须与上下文合并，单分镜至少20字
- 每个分镜输出：narration(本分镜逐字稿，含标点，20-70字)、searchQuery(2-4个中文检索词，精准匹配实拍画面)、mgType(chart|flow|contrast|callout|physics|null)、mgPrompt(若需MG则描述叠加层的画面，如“参数旋钮+温度计动画”)、durationMs(按字数估算 4.5字/秒，5000-8000)
- 触发MG：出现数据对比、百分比、倍数、概率、流程、原理、温度/参数等需可视化时给 mg
- 素材偏好：现代中国、工程精密感、冷色调、避免人物正脸
- BGM：通用平和
- 只输出JSON，格式：{"title": "标题<=24字", "scenes": [...]}，不要markdown`;
}

function buildPrompt(script: string) {
  return `口播稿：\n${script}\n\n请按上述规则输出JSON。`;
}
