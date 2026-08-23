export type LlmPlanInput = { script: string; voice: string; aspect: string };

export async function callDeepSeekForPlan(input: LlmPlanInput): Promise<any | null> {
  // 优先走 DB 通道（管理后台配置），再兜底 env
  let resolved: any = null;
  try {
    const { resolveLlmChannel } = await import("./llm-channel");
    resolved = await resolveLlmChannel();
  } catch {}
  if (!resolved) {
    const providers = [
      { key: process.env.DEEPSEEK_API_KEY, baseUrl: process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com", model: process.env.DEEPSEEK_MODEL || "deepseek-chat", type: "deepseek" },
      { key: process.env.ARK_API_KEY, baseUrl: process.env.ARK_BASE_URL || "https://ark.cn-beijing.volces.com/api/v3", model: process.env.ARK_MODEL || "doubao-seed-1-6-251015", type: "ark" },
      { key: process.env.OPENAI_API_KEY, baseUrl: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1", model: process.env.OPENAI_MODEL || "gpt-4o-mini", type: "openai" },
      { key: process.env.DASHSCOPE_API_KEY, baseUrl: process.env.DASHSCOPE_BASE_URL || "https://dashscope.aliyuncs.com/compatible-mode/v1", model: process.env.DASHSCOPE_MODEL || "qwen-plus", type: "dashscope" },
    ];
    const chosen: any = providers.find((p) => !!p.key);
    if (!chosen) {
      return { error: "未配置任何 LLM 通道。请在 管理后台→接口通道 新增 DeepSeek/Ark/OpenAI 通道，或在 .env 设置对应 API Key 后重试。" };
    }
    resolved = chosen;
  }
  const key: string = (resolved as any).key;
  const base: string = (resolved as any).baseUrl || (resolved as any).base;
  const model: string = (resolved as any).model;
  const type: string = (resolved as any).type;
  if (!key) return { error: "通道 Key 为空" };
  if (!key) return null;
  try {
    const prompt = buildPrompt(input.script);
    const body: any = {
      model,
      temperature: 0.7,
      messages: [
        { role: "system", content: systemPrompt() },
        { role: "user", content: prompt },
      ],
    };
    // DeepSeek / OpenAI / DashScope 支持 json_object，Ark 需用普通文本
    if (type !== "ark") body.response_format = { type: "json_object" };
    const res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const txt = await res.text();
      console.warn(`[llm] ${type} error`, res.status, txt.slice(0, 600));
      return { error: `${type} 调用失败 ${res.status}: ${txt.slice(0, 200)}` };
    }
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) return { error: "LLM 未返回内容" };
    // Ark 可能返回非 JSON，需提取
    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch {
      const m = content.match(/\{[\s\S]*\}/);
      if (m) parsed = JSON.parse(m[0]);
      else return { error: "LLM 返回非 JSON: " + content.slice(0, 200) };
    }
    return parsed;
  } catch (e: any) {
    console.warn("[llm] exception", e);
    return { error: String(e?.message || e) };
  }
}

function systemPrompt() {
  return `你是花生AI的“制片人”分镜规划Agent。输入是一段中文口播稿（200-5000字），你必须通读全文、理解核心观点与叙事逻辑后，重新撰写适合视频口播的分镜脚本，而非简单按标点切分原文。

要求：
- 通读全文后，提炼主题与情绪，将原稿改写为 6-12 段口播分镜脚本，每段为一句完整、口语化、适合直接配音的 narration（20-65字），保留原意但更符合视频节奏与画面感；严禁将 "Temperature" "中文一般叫温度" 等短句单独成段
- 每段必须可独立配音 5-8秒，按 4.5字/秒估算 durationMs(5000-8000)，覆盖原文全部信息且不遗漏关键数据
- 为每段生成：searchQuery(2-4个中文检索词，精准匹配实拍画面，用于 Pexels 搜素材)、mgType(chart|flow|contrast|callout|physics|null)、mgPrompt(需可视化时描述 MG 叠加画面，如“参数旋钮+温度计动画，横向对比”)、durationMs
- 触发MG：数据对比、百分比、概率、温度/参数、流程原理等抽象概念必须给 mg
- 素材偏好：现代中国、工程精密感、冷色调、避免人物正脸
- BGM：通用平和
- 只输出JSON，格式：{"title": "标题<=24字", "scenes": [{"narration": "...", "searchQuery": "...", "mgType": "...", "mgPrompt": "...", "durationMs": 6000}, ...]}，不要markdown`;
}

function buildPrompt(script: string) {
  return `口播稿：\n${script}\n\n请按上述规则输出JSON。`;
}
