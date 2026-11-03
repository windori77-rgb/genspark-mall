import type { Row } from './types';
import { Where } from '../lib/sql';

/**
 * 주문 매퍼 (orders / order_items).
 *
 * 쓰기(주문 생성 / 취소 / 상태 변경)는 여러 테이블을 함께 건드리므로
 * 반드시 db.batch() 로 묶어 원자적으로 실행한다.
 */

export type OrderWriteModel = {
  orderNo: string;
  userId: number | null;
  ordererName: string;
  ordererPhone: string;
  receiver: string;
  receiverPhone: string;
  zipcode: string;
  addr1: string;
  addr2: string;
  memo: string;
  subtotal: number;
  discount: number;
  shippingFee: number;
  total: number;
  payMethod: string;
  couponCode: string;
  status: string;
};

export type OrderLineWriteModel = {
  productId: number;
  name: string;
  thumbnail: string;
  optionText: string;
  price: number;
  qty: number;
};

/** 주문 헤더 생성 → order id 반환 */
export async function insertHeader(db: D1Database, v: OrderWriteModel): Promise<number> {
  const res = await db
    .prepare(
      `INSERT INTO orders (order_no, user_id, orderer_name, orderer_phone, receiver, receiver_phone,
         zipcode, addr1, addr2, memo, subtotal, discount, shipping_fee, total, pay_method, coupon_code, status)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    )
    .bind(
      v.orderNo, v.userId, v.ordererName, v.ordererPhone,
      v.receiver, v.receiverPhone, v.zipcode, v.addr1, v.addr2,
      v.memo, v.subtotal, v.discount, v.shippingFee, v.total,
      v.payMethod, v.couponCode, v.status,
    )
    .run();
  return Number((res.meta as any).last_row_id);
}

/**
 * 주문 확정 배치 — 한 번의 batch 로 실행되어 부분 실패가 남지 않는다.
 *   1) order_items 삽입 + 재고/판매량 반영 (라인별)
 *   2) 쿠폰 사용횟수 증가 (사용한 경우)
 *   3) 장바구니 비우기
 */
export async function commitOrder(
  db: D1Database,
  orderId: number,
  lines: OrderLineWriteModel[],
  opts: { couponCode: string; cartKey: string },
): Promise<void> {
  const stmts: D1PreparedStatement[] = [];

  for (const l of lines) {
    stmts.push(
      db
        .prepare(
          'INSERT INTO order_items (order_id, product_id, name, thumbnail, option_text, price, qty) VALUES (?,?,?,?,?,?,?)',
        )
        .bind(orderId, l.productId, l.name, l.thumbnail, l.optionText, l.price, l.qty),
    );
    stmts.push(
      db
        .prepare('UPDATE products SET stock = stock - ?, sales_count = sales_count + ? WHERE id = ?')
        .bind(l.qty, l.qty, l.productId),
    );
  }

  if (opts.couponCode) {
    stmts.push(db.prepare('UPDATE coupons SET used_count = used_count + 1 WHERE code = ?').bind(opts.couponCode));
  }

  stmts.push(db.prepare('DELETE FROM cart_items WHERE session_key = ?').bind(opts.cartKey));

  await db.batch(stmts);
}

/** 주문번호로 조회 */
export async function findByNo(db: D1Database, orderNo: string): Promise<Row | null> {
  return db.prepare('SELECT * FROM orders WHERE order_no = ?').bind(orderNo).first<Row>();
}

export async function findById(db: D1Database, id: number): Promise<Row | null> {
  return db.prepare('SELECT * FROM orders WHERE id = ?').bind(id).first<Row>();
}

/** 주문 상품 라인 (전체 컬럼) */
export async function listItems(db: D1Database, orderId: number): Promise<Row[]> {
  const r = await db.prepare('SELECT * FROM order_items WHERE order_id = ?').bind(orderId).all<Row>();
  return r.results;
}

/** 재고 복구용 라인 (product_id + qty 만) */
export async function listItemStocks(db: D1Database, orderId: number): Promise<{ product_id: number; qty: number }[]> {
  const r = await db
    .prepare('SELECT product_id, qty FROM order_items WHERE order_id = ?')
    .bind(orderId)
    .all<{ product_id: number; qty: number }>();
  return r.results;
}

/** 고객 주문 내역 (요약 컬럼 + 첫 상품) */
export async function listByUser(db: D1Database, userId: number, limit = 50): Promise<Row[]> {
  const r = await db
    .prepare(
      `SELECT o.id, o.order_no, o.total, o.status, o.created_at,
              (SELECT COUNT(*) FROM order_items WHERE order_id = o.id) AS item_count,
              (SELECT name FROM order_items WHERE order_id = o.id LIMIT 1) AS first_item,
              (SELECT thumbnail FROM order_items WHERE order_id = o.id LIMIT 1) AS thumbnail
         FROM orders o WHERE o.user_id = ? ORDER BY o.id DESC LIMIT ?`,
    )
    .bind(userId, limit)
    .all<Row>();
  return r.results;
}

/**
 * 주문 취소 — 상태 변경 + 재고 복구를 한 batch 로.
 * 동시에 두 번 눌려도 이미 cancelled 면 서비스가 걸러낸다.
 */
export async function cancel(db: D1Database, orderId: number): Promise<void> {
  const items = await listItemStocks(db, orderId);
  const stmts: D1PreparedStatement[] = [
    db.prepare("UPDATE orders SET status = 'cancelled', updated_at = datetime('now') WHERE id = ?").bind(orderId),
  ];
  for (const it of items) {
    stmts.push(db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?').bind(it.qty, it.product_id));
  }
  await db.batch(stmts);
}

/** 취소 상태로 전환하며 재고 복구 (관리자) */
export async function restoreStockFor(db: D1Database, orderId: number): Promise<void> {
  const items = await listItemStocks(db, orderId);
  if (!items.length) return;
  await db.batch(
    items.map((it) => db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?').bind(it.qty, it.product_id)),
  );
}

/** 상태 + 관리자 메모 갱신 */
export async function updateStatus(
  db: D1Database,
  id: number,
  status: string,
  adminMemo: string,
): Promise<void> {
  await db
    .prepare("UPDATE orders SET status = ?, admin_memo = ?, updated_at = datetime('now') WHERE id = ?")
    .bind(status, adminMemo, id)
    .run();
}

/* ── 관리자 조회 ────────────────────────────────────────────────────── */

/** 관리자 주문 목록 (상태/검색 필터) */
export async function adminList(
  db: D1Database,
  f: { status?: string; q?: string; limit?: number },
): Promise<Row[]> {
  const w = new Where('1=1');
  if (f.status) w.and(true, 'o.status = ?', f.status);
  if (f.q) {
    const like = `%${f.q}%`;
    w.and(true, '(o.order_no LIKE ? OR o.orderer_name LIKE ? OR o.receiver LIKE ?)', like, like, like);
  }
  const r = await db
    .prepare(
      `SELECT o.*, (SELECT COUNT(*) FROM order_items WHERE order_id = o.id) AS item_count
         FROM orders o WHERE ${w.sql} ORDER BY o.id DESC LIMIT ?`,
    )
    .bind(...w.params, f.limit ?? 200)
    .all<Row>();
  return r.results;
}

/* ── 대시보드 집계 ──────────────────────────────────────────────────── */

const NOT_CANCELLED = "status NOT IN ('cancelled','refunded')";

/** 오늘 / 최근 7일 / 최근 30일 매출 요약 (병렬) */
export async function salesSummary(
  db: D1Database,
): Promise<{ today: Row; week: Row; month: Row }> {
  const [today, week, month] = await Promise.all([
    db
      .prepare(`SELECT COUNT(*) n, COALESCE(SUM(total),0) amount FROM orders WHERE date(created_at) = date('now') AND ${NOT_CANCELLED}`)
      .first<Row>(),
    db
      .prepare(`SELECT COUNT(*) n, COALESCE(SUM(total),0) amount FROM orders WHERE created_at >= datetime('now','-7 days') AND ${NOT_CANCELLED}`)
      .first<Row>(),
    db
      .prepare(`SELECT COUNT(*) n, COALESCE(SUM(total),0) amount FROM orders WHERE created_at >= datetime('now','-30 days') AND ${NOT_CANCELLED}`)
      .first<Row>(),
  ]);
  return {
    today: today || { n: 0, amount: 0 },
    week: week || { n: 0, amount: 0 },
    month: month || { n: 0, amount: 0 },
  };
}

/** 상태별 주문 건수 */
export async function statusCounts(db: D1Database): Promise<Row[]> {
  const r = await db.prepare('SELECT status, COUNT(*) n FROM orders GROUP BY status').all<Row>();
  return r.results;
}

/** 최근 주문 (대시보드 카드) */
export async function recentOrders(db: D1Database, limit = 8): Promise<Row[]> {
  const r = await db
    .prepare(
      `SELECT o.id, o.order_no, o.orderer_name, o.total, o.status, o.created_at,
              (SELECT name FROM order_items WHERE order_id = o.id LIMIT 1) AS first_item
         FROM orders o ORDER BY o.id DESC LIMIT ?`,
    )
    .bind(limit)
    .all<Row>();
  return r.results;
}

/** 최근 14일 일별 매출 */
export async function dailySales(db: D1Database, days = 13): Promise<Row[]> {
  const r = await db
    .prepare(
      `SELECT date(created_at) d, COUNT(*) n, COALESCE(SUM(total),0) amount
         FROM orders WHERE created_at >= datetime('now', ?) AND ${NOT_CANCELLED}
        GROUP BY date(created_at) ORDER BY d`,
    )
    .bind(`-${Math.trunc(days)} days`)
    .all<Row>();
  return r.results;
}
