import type { Row } from './types';

/** 최근 공지 5건 (고정 우선) */
export async function listRecent(db: D1Database, limit = 5): Promise<Row[]> {
  const r = await db
    .prepare('SELECT id, title, content, is_pinned FROM notices ORDER BY is_pinned DESC, id DESC LIMIT ?')
    .bind(limit)
    .all<Row>();
  return r.results;
}
