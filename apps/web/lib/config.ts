import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().default("file:./data/stuido.db"),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  FFMPEG_PATH: z.string().default("/System/Volumes/Data/Users/zh/Library/Application Support/TRAE SOLO/ModularData/ai-agent/vm/tools/opt/ffmpeg/8.1.2/bin/ffmpeg"),
  FFPROBE_PATH: z.string().default("/System/Volumes/Data/Users/zh/Library/Application Support/TRAE SOLO/ModularData/ai-agent/vm/tools/opt/ffmpeg/8.1.2/bin/ffprobe"),
  ENCRYPTION_KEY: z.string().default("dev-32b-encryption-key-1234567890ab"),
  JWT_SECRET: z.string().default("dev-jwt-secret-please-change-32b+"),
  DEEPSEEK_API_KEY: z.string().optional(),
  DEEPSEEK_BASE_URL: z.string().default("https://api.deepseek.com"),
  ARK_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  PEXELS_API_KEY: z.string().optional(),
  AGNES_API_KEY: z.string().optional(),
  AGNES_BASE_URL: z.string().default("https://apihub.agnes-ai.com/v1"),
  AGNES_MODEL: z.string().default("agnes-video-2.5-flash"),
  NEXT_PUBLIC_APP_URL: z.string().default("http://localhost:3000"),
});

export const config = envSchema.parse({
  DATABASE_URL: process.env.DATABASE_URL,
  REDIS_URL: process.env.REDIS_URL,
  FFMPEG_PATH: process.env.FFMPEG_PATH,
  FFPROBE_PATH: process.env.FFPROBE_PATH,
  ENCRYPTION_KEY: process.env.ENCRYPTION_KEY,
  JWT_SECRET: process.env.JWT_SECRET,
  DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY,
  DEEPSEEK_BASE_URL: process.env.DEEPSEEK_BASE_URL,
  ARK_API_KEY: process.env.ARK_API_KEY,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  PEXELS_API_KEY: process.env.PEXELS_API_KEY,
  AGNES_API_KEY: process.env.AGNES_API_KEY,
  AGNES_BASE_URL: process.env.AGNES_BASE_URL,
  AGNES_MODEL: process.env.AGNES_MODEL,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
});

export const ffmpegBin = config.FFMPEG_PATH;
export const ffprobeBin = config.FFPROBE_PATH;
