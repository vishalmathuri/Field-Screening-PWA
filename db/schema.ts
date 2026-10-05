import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
export const submissions = sqliteTable('submissions', {
 id:text('id').primaryKey(), participant:text('participant').notNull(), age:integer('age').notNull(),
 location:text('location').notNull(), worker:text('worker').notNull(), date:text('date').notNull(),
 outcome:text('outcome').notNull(), notes:text('notes').notNull(), consent:integer('consent').notNull(),
 status:text('status').notNull().default('Pending review'), reviewNote:text('review_note').notNull().default(''),
 receivedAt:text('received_at').notNull(), reviewedAt:text('reviewed_at'),
}, table => [index('idx_submissions_received_at').on(table.receivedAt)]);
