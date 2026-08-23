import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const users = sqliteTable("users", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role", { enum: ["admin", "user"] }).notNull().default("user"),
  status: text("status", { enum: ["active", "disabled"] }).notNull().default("active"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch('now')*1000)`),
  lastLogin: integer("last_login", { mode: "timestamp_ms" }),
});

export const apiKeyChannels = sqliteTable("api_key_channels", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  provider: text("provider", { enum: ["deepseek", "ark", "openai", "dashscope", "pexels", "pixabay", "azure"] }).notNull(),
  name: text("name").notNull(),
  apiKeyEncrypted: text("api_key_encrypted").notNull(),
  baseUrl: text("base_url"),
  model: text("model"),
  weight: integer("weight").notNull().default(1),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  rateLimit: integer("rate_limit").default(60),
  createdBy: text("created_by").references(() => users.id),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch('now')*1000)`),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch('now')*1000)`),
});

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").references(() => users.id),
  title: text("title"),
  script: text("script"),
  voice: text("voice"),
  aspect: text("aspect"),
  status: text("status").notNull().default("pending_confirm"),
  planJson: text("plan_json", { mode: "json" }),
  finalVideoUrl: text("final_video_url"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch('now')*1000)`),
});

export const renderJobs = sqliteTable("render_jobs", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  projectId: text("project_id").references(() => projects.id).notNull(),
  channelId: text("channel_id").references(() => apiKeyChannels.id),
  status: text("status").notNull(),
  progress: text("progress", { mode: "json" }),
  log: text("log"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch('now')*1000)`),
});

export const llmUsage = sqliteTable("llm_usage", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  projectId: text("project_id").references(() => projects.id),
  channelId: text("channel_id").references(() => apiKeyChannels.id),
  tokensIn: integer("tokens_in"),
  tokensOut: integer("tokens_out"),
  cost: integer("cost"),
  latencyMs: integer("latency_ms"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch('now')*1000)`),
});

export const auditLogs = sqliteTable("audit_logs", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  actorId: text("actor_id").references(() => users.id),
  action: text("action").notNull(),
  targetType: text("target_type"),
  targetId: text("target_id"),
  meta: text("meta", { mode: "json" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch('now')*1000)`),
});
