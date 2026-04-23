import dotenv from "dotenv";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { Database } from "bun:sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import * as schema from "./schema.js";

dotenv.config();

const sqlite = new Database("db.sqlite");
export const db = drizzle({ client: sqlite, schema });


export const migrateDb = () => {
  console.log("Running migrations...");
  migrate(db, { migrationsFolder: "./drizzle" });
  console.log("Migrations applied!");
};