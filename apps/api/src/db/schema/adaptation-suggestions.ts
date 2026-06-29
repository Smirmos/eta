import { type AdaptationSuggestion } from '@eta/shared-types';
import { date, index, jsonb, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';
import { macroPlans } from './macro-plans.js';

/**
 * One row per Pass 3 generation. Append-only — re-running Pass 3 for the same
 * upcoming week inserts a new row. `findLatestForWeek` orders by generated_at DESC.
 * Cascade delete from macro_plans cleans up children.
 */
export const adaptationSuggestions = pgTable(
  'adaptation_suggestions',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    macroPlanId: uuid('macro_plan_id')
      .notNull()
      .references(() => macroPlans.id, { onDelete: 'cascade' }),

    forWeekStart: date('for_week_start').notNull(),

    data: jsonb('data').$type<AdaptationSuggestion>().notNull(),

    generatedAt: timestamp('generated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    macroForWeekIdx: index('adaptation_suggestions_macro_week_idx').on(
      table.macroPlanId,
      table.forWeekStart,
    ),
  }),
);

export type AdaptationSuggestionRow = typeof adaptationSuggestions.$inferSelect;
export type NewAdaptationSuggestionRow = typeof adaptationSuggestions.$inferInsert;
