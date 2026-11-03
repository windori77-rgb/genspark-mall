import type { Row } from './types';

/** 찜 매퍼 (wishlist) */

export async function listByUser(db: D1Database, userId: number): Promise<Row[]> {
  const r = await db
    .prepare(
      `SELECT w.product_id, p.name, p.price, p.sale_price, p.thumbnail, p.rating
         FROM wishlist w JOIN products p ON p.id = w.product_id WHERE w.user_id = ? ORDER BY w.id DESC`,
    )
    .bind(userId)
    .all<Row>();
  return r.results;
}

export async function find(db: D1Database, userId: number, productId: number): Promise<{ id: number } | null> {
  return db.prepare('SELECT id FROM wishlist WHERE user_id = ? AND product_id = ?').bind(userId, productId).first<{ id: number }>();
}

export async function insert(db: D1Database, userId: number, productId: number): Promise<void> {
  await db.prepare('INSERT INTO wishlist (user_id, product_id) VALUES (?,?)').bind(userId, productId).run();
}

export async function remove(db: D1Database, id: number): Promise<void> {
  await db.prepare('DELETE FROM wishlist WHERE id = ?').bind(id).run();
}
