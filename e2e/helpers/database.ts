import mysql, { Pool, PoolConnection, RowDataPacket } from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.DB_HOST || '127.0.0.1',
      port: Number(process.env.DB_PORT) || 3307,
      database: process.env.DB_DATABASE || 'tresopilot',
      user: process.env.DB_USER || 'sail',
      password: process.env.DB_PASSWORD || 'password',
      waitForConnections: true,
      connectionLimit: 5,
      queueLimit: 0,
      // DECIMAL(15,2) columns (montant, etc.) must be returned as numbers, not strings
      decimalNumbers: true,
    });
  }
  return pool;
}

export async function query<T extends RowDataPacket[] = RowDataPacket[]>(
  sql: string,
  params?: unknown[]
): Promise<T> {
  const [rows] = await getPool().execute<T>(sql, params);
  return rows;
}

export async function findOne<T extends RowDataPacket = RowDataPacket>(
  table: string,
  where: Record<string, unknown>
): Promise<T | null> {
  const keys = Object.keys(where);
  const conditions = keys.map((k) => `\`${k}\` = ?`).join(' AND ');
  const values = keys.map((k) => where[k]);

  const sql = `SELECT * FROM \`${table}\` WHERE ${conditions} LIMIT 1`;
  const rows = await query<(T & RowDataPacket)[]>(sql, values);
  return rows.length > 0 ? rows[0] : null;
}

export async function findMany<T extends RowDataPacket = RowDataPacket>(
  table: string,
  where: Record<string, unknown>
): Promise<T[]> {
  const keys = Object.keys(where);
  const conditions = keys.map((k) => `\`${k}\` = ?`).join(' AND ');
  const values = keys.map((k) => where[k]);

  const sql = `SELECT * FROM \`${table}\` WHERE ${conditions}`;
  return query<(T & RowDataPacket)[]>(sql, values);
}

export async function assertExists(
  table: string,
  where: Record<string, unknown>
): Promise<RowDataPacket> {
  const row = await findOne(table, where);
  if (!row) {
    const desc = Object.entries(where)
      .map(([k, v]) => `${k}=${v}`)
      .join(', ');
    throw new Error(`Expected row in "${table}" matching {${desc}} but none found`);
  }
  return row;
}

export async function assertNotExists(
  table: string,
  where: Record<string, unknown>
): Promise<void> {
  const row = await findOne(table, where);
  if (row) {
    const desc = Object.entries(where)
      .map(([k, v]) => `${k}=${v}`)
      .join(', ');
    throw new Error(`Expected no row in "${table}" matching {${desc}} but found one`);
  }
}

export async function count(
  table: string,
  where?: Record<string, unknown>
): Promise<number> {
  let sql = `SELECT COUNT(*) as cnt FROM \`${table}\``;
  const values: unknown[] = [];

  if (where && Object.keys(where).length > 0) {
    const keys = Object.keys(where);
    const conditions = keys.map((k) => `\`${k}\` = ?`).join(' AND ');
    values.push(...keys.map((k) => where[k]));
    sql += ` WHERE ${conditions}`;
  }

  const rows = await query(sql, values);
  return Number(rows[0].cnt);
}

export async function cleanup(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

export const db = {
  query,
  findOne,
  findMany,
  assertExists,
  assertNotExists,
  count,
  cleanup,
};
