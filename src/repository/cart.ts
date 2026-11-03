import type { Row } from './types';

/** 장바구니 매퍼 (cart_items) */

/** 장바구니 항목 + 상품 정보 (최근 추가 순) */
export async function listWithProduct(db: D1Database, sessionKey: string): Promise<Row[]> {
  const r = await db
    .prepare(
      `SELECT ci.id, ci.product_id, ci.option_text, ci.qty,
              p.name, p.thumbnail, p.price, p.sale_price, p.stock, p.shipping_fee, p.brand
         FROM cart_items ci JOIN products p ON p.id = ci.product_id
        WHERE ci.session_key = ? ORDER BY ci.id DESC`,
    )
    .bind(sessionKey)
    .all<Row>();
  return r.results;
}

export async function findItem(
  db: D1Database,
  sessionKey: string,
  productId: number,
  optionText: string,
): Promise<{ id: number; qty: number } | null> {
  return db
    .prepare('SELECT id, qty FROM cart_items WHERE session_key = ? AND product_id = ? AND option_text = ?')
    .bind(sessionKey, productId, optionText)
    .first<{ id: number; qty: number }>();
}

export async function findByKey(db: D1Database, sessionKey: string): Promise<Row[]> {
  const r = await db.prepare('SELECT * FROM cart_items WHERE session_key = ?').bind(sessionKey).all<Row>();
  return r.results;
}

export async function insert(
  db: D1Database,
  v: { sessionKey: string; userId: number | null; productId: number; optionText: string; qty: number },
): Promise<void> {
  await db
    .prepare('INSERT INTO cart_items (session_key, user_id, product_id, option_text, qty) VALUES (?,?,?,?,?)')
    .bind(v.sessionKey, v.userId, v.productId, v.optionText, v.qty)
    .run();
}

export async function updateQty(db: D1Database, id: number, qty: number): Promise<void> {
  await db.prepare('UPDATE cart_items SET qty = ? WHERE id = ?').bind(qty, id).run();
}

export async function incrementQty(db: D1Database, id: number, delta: number): Promise<void> {
  await db.prepare('UPDATE cart_items SET qty = qty + ? WHERE id = ?').bind(delta, id).run();
}

/** 소유 검증을 포함한 단건 조회 (재고 포함) */
export async function findOwnedWithStock(
  db: D1Database,
  id: number,
  sessionKey: string,
): Promise<{ id: number; stock: number } | null> {
  return db
    .prepare(
      'SELECT ci.id, p.stock FROM cart_items ci JOIN products p ON p.id = ci.product_id WHERE ci.id = ? AND ci.session_key = ?',
    )
    .bind(id, sessionKey)
    .first<{ id: number; stock: number }>();
}

export async function removeOwned(db: D1Database, id: number, sessionKey: string): Promise<void> {
  await db.prepare('DELETE FROM cart_items WHERE id = ? AND session_key = ?').bind(id, sessionKey).run();
}

export async function removeById(db: D1Database, id: number): Promise<void> {
  await db.prepare('DELETE FROM cart_items WHERE id = ?').bind(id).run();
}

export async function clear(db: D1Database, sessionKey: string): Promise<void> {
  await db.prepare('DELETE FROM cart_items WHERE session_key = ?').bind(sessionKey).run();
}

/** 비회원 → 회원 장바구니 이관 (소유자 변경) */
export async function transferOwner(
  db: D1Database,
  id: number,
  sessionKey: string,
  userId: number,
): Promise<void> {
  await db.prepare('UPDATE cart_items SET session_key = ?, user_id = ? WHERE id = ?').bind(sessionKey, userId, id).run();
}

/** 장바구니 병합용 배치 (수량 합산 + 중복행 제거) */
export async function mergeBatch(
  db: D1Database,
  ops: { keepId: number; dropId: number; addQty: number }[],
): Promise<void> {
  if (!ops.length) return;
  const stmts: D1PreparedStatement[] = [];
  for (const op of ops) {
    stmts.push(db.prepare('UPDATE cart_items SET qty = qty + ? WHERE id = ?').bind(op.addQty, op.keepId));
    stmts.push(db.prepare('DELETE FROM cart_items WHERE id = ?').bind(op.dropId));
  }
  await db.batch(stmts);
}
