import type { Row } from './types';

/** settings 테이블 전체 (key, value 쌍) */
export async function keyValues(db: D1Database): Promise<{ key: string; value: string }[]> {
  const r = await db.prepare('SELECT key, value FROM settings').all<{ key: string; value: string }>();
  return r.results;
}

/** settings 를 Record 로 변환 (조회 실패 시 빈 객체) */
export async function asMap(db: D1Database): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const r of await keyValues(db)) out[r.key] = r.value;
  return out;
}

/** 여러 설정을 한 트랜잭션(batch)으로 저장 */
export async function upsertMany(db: D1Database, entries: [string, string][]): Promise<void> {
  if (!entries.length) return;
  await db.batch(
    entries.map(([k, v]) => db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?,?)').bind(k, v)),
  );
}

/** 단일 설정 값 (없으면 undefined) */
export async function findOne(db: D1Database, key: string): Promise<string | undefined> {
  const r = await db.prepare('SELECT value FROM settings WHERE key = ?').bind(key).first<Row>();
  return r?.value;
}
