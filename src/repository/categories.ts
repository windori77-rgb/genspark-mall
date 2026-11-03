import type { Row } from './types';

/* ── 고객 노출용 ─────────────────────────────────────────────────────── */

/** 활성 카테고리 (노출 순서) */
export async function listActive(db: D1Database): Promise<Row[]> {
  const r = await db
    .prepare('SELECT id, name, slug, icon FROM categories WHERE is_active = 1 ORDER BY sort_order')
    .all<Row>();
  return r.results;
}

/* ── 관리자용 ───────────────────────────────────────────────────────── */

/** 카테고리 + 상품 수 */
export async function listWithCount(db: D1Database): Promise<Row[]> {
  const r = await db
    .prepare(
      'SELECT c.*, (SELECT COUNT(*) FROM products WHERE category_id = c.id) AS product_count FROM categories c ORDER BY sort_order',
    )
    .all<Row>();
  return r.results;
}

/** 카테고리 생성 */
export async function insert(
  db: D1Database,
  v: { name: string; slug: string; icon: string; sortOrder: number },
): Promise<void> {
  await db
    .prepare('INSERT INTO categories (name, slug, icon, sort_order, is_active) VALUES (?,?,?,?,1)')
    .bind(v.name, v.slug, v.icon, v.sortOrder)
    .run();
}
