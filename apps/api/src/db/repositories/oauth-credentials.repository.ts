import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { DB, type Db } from '../db.module.js';
import {
  oauthCredentials,
  type NewOauthCredentialsRow,
  type OauthCredentialsRow,
} from '../schema/oauth-credentials.js';

export interface OauthCredentialsRecord {
  id: string;
  userId: string;
  provider: string;
  externalId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  scopes: string;
  raw: unknown;
  createdAt: Date;
  updatedAt: Date;
}

export interface UpsertOauthCredentialsInput {
  userId: string;
  provider: string;
  externalId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  scopes: string;
  raw: unknown;
}

@Injectable()
export class OauthCredentialsRepository {
  constructor(@Inject(DB) private readonly db: Db) {}

  /**
   * Upsert on (user_id, provider). Refresh-token rotation means we update on
   * every successful exchange — not just initial connect.
   */
  async upsert(input: UpsertOauthCredentialsInput): Promise<OauthCredentialsRecord> {
    const values: NewOauthCredentialsRow = {
      userId: input.userId,
      provider: input.provider,
      externalId: input.externalId,
      accessToken: input.accessToken,
      refreshToken: input.refreshToken,
      expiresAt: input.expiresAt,
      scopes: input.scopes,
      raw: input.raw,
    };
    const [row] = await this.db
      .insert(oauthCredentials)
      .values(values)
      .onConflictDoUpdate({
        target: [oauthCredentials.userId, oauthCredentials.provider],
        set: {
          externalId: input.externalId,
          accessToken: input.accessToken,
          refreshToken: input.refreshToken,
          expiresAt: input.expiresAt,
          scopes: input.scopes,
          raw: input.raw,
        },
      })
      .returning();

    if (!row) throw new Error('Upsert into oauth_credentials returned no row');
    return rowToRecord(row);
  }

  async findByUserAndProvider(
    userId: string,
    provider: string,
  ): Promise<OauthCredentialsRecord | null> {
    const rows = await this.db
      .select()
      .from(oauthCredentials)
      .where(and(eq(oauthCredentials.userId, userId), eq(oauthCredentials.provider, provider)))
      .limit(1);
    return rows[0] ? rowToRecord(rows[0]) : null;
  }

  /** Webhook lookup: provider sends owner_id; we need the user_id. */
  async findByProviderAndExternalId(
    provider: string,
    externalId: string,
  ): Promise<OauthCredentialsRecord | null> {
    const rows = await this.db
      .select()
      .from(oauthCredentials)
      .where(
        and(eq(oauthCredentials.provider, provider), eq(oauthCredentials.externalId, externalId)),
      )
      .limit(1);
    return rows[0] ? rowToRecord(rows[0]) : null;
  }
}

function rowToRecord(row: OauthCredentialsRow): OauthCredentialsRecord {
  return {
    id: row.id,
    userId: row.userId,
    provider: row.provider,
    externalId: row.externalId,
    accessToken: row.accessToken,
    refreshToken: row.refreshToken,
    expiresAt: row.expiresAt,
    scopes: row.scopes,
    raw: row.raw,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
