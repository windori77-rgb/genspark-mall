import type { Row } from './types';

/** 리뷰 매퍼 (reviews) */

export async function listByProduct(db: D1Database, productId: number, limit = 20): Promise<Row[]> {
  const r = await db
    .prepare('SELECT id, author, rating, content, created_at FROM reviews WHERE product_id = ? ORDER BY id DESC LIMIT ?')
    .bind(productId, limit)
    .all<Row>();
  return r.results;
}

/** 관리자 최근 리뷰 (상품명 포함) */
export async function adminList(db: D1Database, limit = 200): Promise<Row[]> {
  const r = await db
    .prepare(
      `SELECT r.*, p.name AS product_name FROM reviews r LEFT JOIN products p ON p.id = r.product_id
        ORDER BY r.id DESC LIMIT ?`,
    )
    .bind(limit)
    .all<Row>();
  return r.results;
}

export async function findById(db: D1Database, id: number): Promise<{ product_id: number } | null> {
  return db.prepare('SELECT product_id FROM reviews WHERE id = ?').bind(id).first<{ product_id: number }>();
}

export async function remove(db: D1Database, id: number): Promise<void> {
  await db.prepare('DELETE FROM reviews WHERE id = ?').bind(id).run();
}

/** 리뷰 삭제 후 상품의 review_count / rating 재계산 */
export async function refreshProductRating(db: D1Database, productId: number): Promise<void> {
  await db
    .prepare(
      `UPDATE products SET review_count = (SELECT COUNT(*) FROM reviews WHERE product_id = ?),
         rating = COALESCE((SELECT ROUND(AVG(rating),1) FROM reviews WHERE product_id = ?), 0) WHERE id = ?`,
    )
    .bind(productId, productId, productId)
    .run();
}
