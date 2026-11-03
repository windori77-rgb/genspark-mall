import type { Row } from './types';
import { Where } from '../lib/sql';

/** 배송지 매퍼 (addresses) */

export async function listByUser(db: D1Database, userId: number): Promise<Row[]> {
  const r = await db
    .prepare('SELECT * FROM addresses WHERE user_id = ? ORDER BY is_default DESC, id DESC')
    .bind(userId)
    .all<Row>();
  return r.results;
}

export async function clearDefault(db: D1Database, userId: number): Promise<void> {
  await db.prepare('UPDATE addresses SET is_default = 0 WHERE user_id = ?').bind(userId).run();
}

export async function insert(
  db: D1Database,
  v: {
    userId: number;
    label: string;
    receiver: string;
    phone: string;
    zipcode: string;
    addr1: string;
    addr2: string;
    isDefault: number;
  },
): Promise<void> {
  await db
    .prepare(
      'INSERT INTO addresses (user_id, label, receiver, phone, zipcode, addr1, addr2, is_default) VALUES (?,?,?,?,?,?,?,?)',
    )
    .bind(v.userId, v.label, v.receiver, v.phone, v.zipcode, v.addr1, v.addr2, v.isDefault)
    .run();
}

export type { Where };
