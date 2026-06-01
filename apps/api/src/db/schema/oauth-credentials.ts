import { index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

/**
 * Persistence for OAuth 2.0 credentials per (user, provider). Generic shape:
 * Strava (ETA-25) is the first user, Oura (ETA-26) plugs in unchanged.
 *
 * Token values are stored unencrypted in v1 (personal-use, single-tenant).
 * Encrypting at rest is a follow-up before any multi-tenant deploy.
 */
export const oauthCredentials = pgTable(
  'oauth_credentials',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // TODO(eta-future): foreign-key to a users table once it exists.
    userId: uuid('user_id').notNull(),

    /** Provider slug — 'strava', 'oura', … */
    provider: text('provider').notNull(),

    /** Provider-native identifier (Strava athlete.id, Oura user_id, etc.). */
    externalId: text('external_id').notNull(),

    accessToken: text('access_token').notNull(),
    refreshToken: text('refresh_token').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),

    /** Comma-separated scopes as sent to the provider. */
    scopes: text('scopes').notNull(),

    /** Full last token-exchange response, for debugging. */
    raw: jsonb('raw').notNull(),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    userProviderUnique: uniqueIndex('oauth_credentials_user_provider_unique').on(
      table.userId,
      table.provider,
    ),
    providerExternalIdx: index('oauth_credentials_provider_external_idx').on(
      table.provider,
      table.externalId,
    ),
  }),
);

export type OauthCredentialsRow = typeof oauthCredentials.$inferSelect;
export type NewOauthCredentialsRow = typeof oauthCredentials.$inferInsert;
