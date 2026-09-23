import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;
const globalForDb = globalThis as unknown as { meliSql?: ReturnType<typeof postgres> };

function getClient() {
  if (!connectionString) throw new Error("DATABASE_URL is not configured");
  globalForDb.meliSql ??= postgres(connectionString, { prepare: false, max: 5 });
  return globalForDb.meliSql;
}

export function getDb() {
  return drizzle(getClient(), { schema });
}
