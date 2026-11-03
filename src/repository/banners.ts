import type { Row } from './types';

/* ── 고객 노출용 ─────────────────────────────────────────────────────── */

/** 활성 배너 (노출 순서) */
export async function listActive(db: D1Database): Promise<Row[]> {
  const r = await db
    .prepare('SELECT id, title, subtitle, image, bg, link FROM banners WHERE is_active = 1 ORDER BY sort_order')
    .all<Row>();
  return r.results;
}

/* ── 관리자용 ───────────────────────────────────────────────────────── */

export async function listAll(db: D1Database): Promise<Row[]> {
  const r = await db.prepare('SELECT * FROM banners ORDER BY sort_order, id').all<Row>();
  return r.results;
}

export async function findById(db: D1Database, id: number): Promise<Row | null> {
  return db.prepare('SELECT * FROM banners WHERE id = ?').bind(id).first<Row>();
}

export async function insert(
  db: D1Database,
  v: { title: string; subtitle: string; image: string; bg: string; link: string; sortOrder: number },
): Promise<void> {
  await db
    .prepare('INSERT INTO banners (title, subtitle, image, bg, link, sort_order, is_active) VALUES (?,?,?,?,?,?,1)')
    .bind(v.title, v.subtitle, v.image, v.bg, v.link, v.sortOrder)
    .run();
}

export async function update(
  db: D1Database,
  id: number,
  v: { title: string; subtitle: string; image: string; bg: string; link: string; sortOrder: number; isActive: number },
): Promise<void> {
  await db
    .prepare('UPDATE banners SET title=?, subtitle=?, image=?, bg=?, link=?, sort_order=?, is_active=? WHERE id=?')
    .bind(v.title, v.subtitle, v.image, v.bg, v.link, v.sortOrder, v.isActive, id)
    .run();
}

export async function remove(db: D1Database, id: number): Promise<void> {
  await db.prepare('DELETE FROM banners WHERE id = ?').bind(id).run();
}
