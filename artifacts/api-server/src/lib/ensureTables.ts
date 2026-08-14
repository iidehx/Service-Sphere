import { pool } from "@workspace/db";
import { logger } from "./logger";

/**
 * Creates the push notification tables if they don't already exist.
 * Runs once at server startup so the API works in fresh deployments without
 * requiring a manual drizzle-kit push step.
 */
export async function ensureTables(): Promise<void> {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS push_tokens (
        user_id   TEXT PRIMARY KEY,
        token     TEXT NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS sent_notifications (
        key      TEXT PRIMARY KEY,
        sent_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    logger.info("Push notification tables ready.");
  } catch (err) {
    // Log but don't crash — push notifications are best-effort. The main
    // application continues to run; in-app notifications still work.
    logger.warn({ err }, "Could not ensure push notification tables. Push delivery will be unavailable.");
  }
}
