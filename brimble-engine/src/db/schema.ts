import {
  integer,
  sqliteTable,
  text,
  
} from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";



export const Deployment = sqliteTable("deployment", {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()), 
  
  gitUrl: text("git_url").notNull(),
  status: text("status").notNull().default("pending"),
  imageTag: text("image_tag", { length: 255 }),
  liveUrl: text("live_url", { length: 255 }),
  port: integer("port"),
  containerId: text("container_id", { length: 255 }),
  logs: text("logs").notNull(),

  createdAt: integer("created_at", { mode: "timestamp" })
    .default(sql`(strftime('%s', 'now'))`)
    .notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .default(sql`(strftime('%s', 'now'))`)
    .notNull(),
});
