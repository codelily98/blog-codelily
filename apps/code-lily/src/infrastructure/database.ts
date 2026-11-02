import { Pool } from 'pg';
import type { PGlite } from '@electric-sql/pglite';
import path from 'node:path';
import fs from 'node:fs/promises';

export interface QueryResult<T> {
  rows: T[];
  rowCount: number | null;
  fields?: unknown[];
}
export interface Connection {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<QueryResult<T>>;
  release(): void;
  on(...args: unknown[]): void;
}
export interface Database {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<QueryResult<T>>;
  connect(): Promise<Connection>;
  end(): Promise<void>;
  on(...args: unknown[]): void;
}

export class EmbeddedPool implements Database {
  private gate: Promise<void> = Promise.resolve();
  constructor(private db: PGlite) {}
  on() {}
  async connect(): Promise<Connection> {
    const previous = this.gate;
    let unlock!: () => void;
    this.gate = new Promise<void>((resolve) => {
      unlock = resolve;
    });
    await previous;
    let released = false;
    return {
      query: async <T>(sql: string, params: unknown[] = []) => {
        const result =
          !params.length && sql.includes(';')
            ? (await this.db.exec(sql)).at(-1)!
            : await this.db.query<T>(sql, params);
        return {
          rows: result.rows as T[],
          rowCount: result.affectedRows ?? result.rows.length,
          fields: result.fields,
        };
      },
      release: () => {
        if (!released) {
          released = true;
          unlock();
        }
      },
      on: () => {},
    };
  }
  async query<T>(sql: string, params: unknown[] = []) {
    const connection = await this.connect();
    try {
      return await connection.query<T>(sql, params);
    } finally {
      connection.release();
    }
  }
  async end() {
    await this.gate;
    await this.db.close();
  }
}

async function createPool(): Promise<Database> {
  if (process.env.DATABASE_URL) {
    const max = Number(process.env.DB_POOL_MAX || 5);
    if (!Number.isInteger(max) || max < 1 || max > 10) throw new Error('DB_POOL_MAX must be 1..10');
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 2_000,
      statement_timeout: 5_000,
      options: '-c search_path=blog_schema,pg_catalog',
      application_name: 'code-lily',
    });
    pool.on('error', () =>
      console.error(
        JSON.stringify({ level: 'error', event: 'db.pool.error', service: 'code-lily' }),
      ),
    );
    return pool as unknown as Database;
  }
  if (
    process.env.NODE_ENV === 'production' &&
    process.env.NEXT_PHASE !== 'phase-production-build'
  ) {
    throw new Error('Production requires DATABASE_URL. PGlite is development-only.');
  }
  const { PGlite } = await import('@electric-sql/pglite');
  const root = process.cwd().endsWith('code-lily')
    ? path.resolve(process.cwd(), '../..')
    : process.cwd();
  const directory = path.join(root, '.local', 'code-lily-db');
  await fs.mkdir(directory, { recursive: true });
  const db = new PGlite(directory);
  await db.exec(
    'CREATE SCHEMA IF NOT EXISTS blog_schema; SET search_path TO blog_schema, pg_catalog;',
  );
  return new EmbeddedPool(db);
}
const globalDatabase = globalThis as unknown as { codeLilyDatabase?: Promise<Database> };
export function getDatabase(): Promise<Database> {
  return (globalDatabase.codeLilyDatabase ??= createPool());
}
export async function transaction<T>(
  db: Database,
  work: (connection: Connection) => Promise<T>,
): Promise<T> {
  const connection = await db.connect();
  try {
    await connection.query('BEGIN');
    const result = await work(connection);
    await connection.query('COMMIT');
    return result;
  } catch (error) {
    await connection.query('ROLLBACK');
    throw error;
  } finally {
    connection.release();
  }
}
