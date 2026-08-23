import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import * as schema from "./schema";
import { config } from "../config";

const url = config.DATABASE_URL.startsWith("file:") ? config.DATABASE_URL : "file:./data/stuido.db";
const client = createClient({ url });
export const db = drizzle(client, { schema });
export * from "./schema";
