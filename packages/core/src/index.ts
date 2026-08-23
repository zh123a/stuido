import { z } from "zod";

export const LayerSchema = z.object({
  type: z.enum(["video", "mg", "subtitle", "bgm", "tts"]),
  z: z.number().min(0),
  src: z.string().optional(),
  alpha: z.boolean().optional(),
  style: z.record(z.any()).optional(),
});

export const SceneSchema = z.object({
  id: z.string(),
  idx: z.number(),
  narration: z.string(),
  durationMs: z.number(),
  search: z.object({
    query: z.string(),
    filters: z.object({
      country: z.string().optional(),
      year: z.string().optional(),
      mood: z.string().optional(),
      tone: z.string().optional(),
      avoid: z.string().optional(),
    }).optional(),
  }),
  mg: z.object({
    enabled: z.boolean(),
    type: z.enum(["chart", "flow", "contrast", "callout", "physics"]),
    prompt: z.string(),
    htmlPath: z.string(),
  }).nullable(),
  bgm: z.string().optional(),
  layers: z.array(LayerSchema),
});

export const PlanSchema = z.object({
  projectId: z.string().uuid(),
  title: z.string(),
  aspect: z.enum(["16:9", "9:16", "1:1"]),
  voice: z.string(),
  script: z.string(),
  totalDurationMs: z.number(),
  scenes: z.array(SceneSchema),
  metrics: z.object({ videoClips: z.number(), mgScenes: z.number(), cost: z.number() }),
  status: z.string(),
  createdAt: z.string(),
});

export type Plan = z.infer<typeof PlanSchema>;
export type Scene = z.infer<typeof SceneSchema>;
