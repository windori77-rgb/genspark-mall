import type { Row } from './types';

/** 회원 매퍼 (users) */

export async function findByEmail(db: D1Database, email: string): Promise<Row | null> {
  return db.prepare('SELECT * FROM users WHERE email = ?').bind(email).first<Row>();
}

export async function findById(db: D1Database, id: number): Promise<Row | null> {
  return db.prepare('SELECT * FROM users WHERE id = ?').bind(id).first<Row>();
}

export async function existsByEmail(db: D1Database, email: string): Promise<boolean> {
  const r = await db.prepare('SELECT id FROM users WHERE email = ?').bind(email).first<{ id: number }>();
  return !!r;
}

export async function insert(
  db: D1Database,
  v: { email: string; passwordHash: string; name: string; phone: string; marketing: number },
): Promise<number> {
  const res = await db
    .prepare('INSERT INTO users (email, password_hash, name, phone, marketing_agree) VALUES (?,?,?,?,?)')
    .bind(v.email, v.passwordHash, v.name, v.phone, v.marketing)
    .run();
  return Number((res.meta as any).last_row_id);
}

export async function updateProfile(
  db: D1Database,
  id: number,
  v: { name: string; phone: string },
): Promise<void> {
  await db.prepare('UPDATE users SET name = ?, phone = ? WHERE id = ?').bind(v.name, v.phone, id).run();
}

/** 마이페이지 배지용 (주문 수 / 찜 수) */
export async function countsFor(db: D1Database, userId: number): Promise<{ orders: number; wishes: number }> {
  const r = await db
    .prepare(
      `SELECT (SELECT COUNT(*) FROM orders WHERE user_id = ?) AS orders,
              (SELECT COUNT(*) FROM wishlist WHERE user_id = ?) AS wishes`,
    )
    .bind(userId, userId)
    .first<{ orders: number; wishes: number }>();
  return r || { orders: 0, wishes: 0 };
}

export async function count(db: D1Database): Promise<number> {
  const r = await db.prepare('SELECT COUNT(*) n FROM users').first<{ n: number }>();
  return r?.n || 0;
}

/** 관리자 회원 목록 (검색 + 주문수/누적결제액) */
export async function adminList(db: D1Database, q: string, limit = 300): Promise<Row[]> {
  const sql = `SELECT u.id, u.email, u.name, u.phone, u.marketing_agree, u.created_at,
                      (SELECT COUNT(*) FROM orders WHERE user_id = u.id) AS order_count,
                      (SELECT COALESCE(SUM(total),0) FROM orders WHERE user_id = u.id AND status NOT IN ('cancelled','refunded')) AS total_spent
                 FROM users u ${q ? 'WHERE u.email LIKE ? OR u.name LIKE ?' : ''} ORDER BY u.id DESC LIMIT ?`;
  // WHERE 절은 상수 문자열(검색어 유무)로만 갈린다. 검색어 자체는 바인딩된다.
  const stmt = q ? db.prepare(sql).bind(`%${q}%`, `%${q}%`, limit) : db.prepare(sql).bind(limit);
  const r = await stmt.all<Row>();
  return r.results;
}
