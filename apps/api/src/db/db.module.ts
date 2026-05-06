import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema/index.js';
import type { Env } from '../config/env.schema.js';

export const DB = Symbol('DB');
export type Db = PostgresJsDatabase<typeof schema>;

@Module({
  providers: [
    {
      provide: DB,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>): Db => {
        const url = config.get('DATABASE_URL', { infer: true });
        const client = postgres(url);
        return drizzle(client, { schema });
      },
    },
  ],
  exports: [DB],
})
export class DbModule {}
