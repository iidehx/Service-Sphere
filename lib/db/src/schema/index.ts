import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';

/**
 * Stores Expo push tokens for registered devices.
 * Tokens are written here when users grant notification permission on a
 * physical device and are used server-side to address push notifications
 * without exposing tokens to other app users.
 */
export const pushTokens = pgTable('push_tokens', {
  userId: text('user_id').primaryKey(),
  token: text('token').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Idempotency log for push notification events.
 * Each row records a unique state-transition key so the same push cannot be
 * delivered more than once for a given job lifecycle event.
 */
export const sentNotifications = pgTable('sent_notifications', {
  key: text('key').primaryKey(),
  sentAt: timestamp('sent_at', { withTimezone: true }).notNull().defaultNow(),
});

export type PushToken = typeof pushTokens.$inferSelect;
export type NewPushToken = typeof pushTokens.$inferInsert;

export type SentNotification = typeof sentNotifications.$inferSelect;
