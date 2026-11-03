import type { Row } from './types';

/** 쿠폰 매퍼 (coupons) */

/** 고객 노출용 활성 쿠폰 */
export async function listActive(db: D1Database): Promise<Row[]> {
  const r = await db
    .prepare(
      `SELECT code, name, type, value, min_order, max_discount, expires_at
         FROM coupons WHERE is_active = 1 ORDER BY id`,
    )
    .all<Row>();
  return r.results;
}

/**
 * 할인 계산에 필요한 최소 컬럼만 담은 타입.
 * `SELECT *` 의 결과(Row)를 그대로 서비스로 넘기면 타입이 any 로 흐르므로,
 * 계산에 쓰는 컬럼을 명시적으로 좁힌다.
 */
export type CouponRule = {
  id: number;
  code: string;
  name: string;
  type: string;
  value: number;
  min_order: number;
  max_discount: number;
  expires_at: string;
  total_count: number;
  used_count: number;
  is_active: number;
};

const RULE_COLUMNS = 'id, code, name, type, value, min_order, max_discount, expires_at, total_count, used_count, is_active';

/** 코드로 활성 쿠폰 조회 (주문/적용 공통) */
export async function findActiveByCode(db: D1Database, code: string): Promise<CouponRule | null> {
  return db
    .prepare(`SELECT ${RULE_COLUMNS} FROM coupons WHERE code = ? AND is_active = 1`)
    .bind(code)
    .first<CouponRule>();
}

/** 관리자 전체 목록 */
export async function listAll(db: D1Database): Promise<Row[]> {
  const r = await db.prepare('SELECT * FROM coupons ORDER BY id DESC').all<Row>();
  return r.results;
}

export async function findById(db: D1Database, id: number): Promise<Row | null> {
  return db.prepare('SELECT * FROM coupons WHERE id = ?').bind(id).first<Row>();
}

export async function insert(
  db: D1Database,
  v: {
    code: string;
    name: string;
    type: string;
    value: number;
    minOrder: number;
    maxDiscount: number;
    expiresAt: string;
    totalCount: number;
  },
): Promise<void> {
  await db
    .prepare(
      'INSERT INTO coupons (code, name, type, value, min_order, max_discount, expires_at, total_count, is_active) VALUES (?,?,?,?,?,?,?,?,1)',
    )
    .bind(v.code, v.name, v.type, v.value, v.minOrder, v.maxDiscount, v.expiresAt, v.totalCount)
    .run();
}

export async function setActive(db: D1Database, id: number, isActive: number): Promise<void> {
  await db.prepare('UPDATE coupons SET is_active = ? WHERE id = ?').bind(isActive, id).run();
}

export async function remove(db: D1Database, id: number): Promise<void> {
  await db.prepare('DELETE FROM coupons WHERE id = ?').bind(id).run();
}
