import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url: process.env.DATABASE_URL?.startsWith("file:") ? process.env.DATABASE_URL : "file:./data/stuido.db",
  },
  verbose: true,
});
