import * as ordersRepo from '../repository/orders';
import * as productsRepo from '../repository/products';
import * as usersRepo from '../repository/users';
import { ORDER_STATUSES } from '../lib/schema';
import { badRequest, notFound } from '../lib/http';

/** 관리자 대시보드 — 지표 집계를 한 번에 */

export async function dashboard(db: D1Database) {
  const [sales, users, products, lowStock, statusRows, recent, topProducts, daily] = await Promise.all([
    ordersRepo.salesSummary(db),
    usersRepo.count(db),
    productsRepo.countActive(db),
    productsRepo.listLowStock(db, 20, 8),
    ordersRepo.statusCounts(db),
    ordersRepo.recentOrders(db, 8),
    productsRepo.listTopSellers(db, 5),
    ordersRepo.dailySales(db, 13),
  ]);

  return {
    today: sales.today,
    week: sales.week,
    month: sales.month,
    users,
    products,
    lowStock,
    statusCounts: statusRows,
    recentOrders: recent.map((o) => ({ ...o, statusLabel: ORDER_STATUSES[o.status] || o.status })),
    topProducts,
    daily,
  };
}

/* ── 주문 관리 ──────────────────────────────────────────────────────── */

export async function listOrders(db: D1Database, f: { status?: string; q?: string }) {
  const rows = await ordersRepo.adminList(db, { status: f.status, q: f.q, limit: 200 });
  return { items: rows.map((o) => ({ ...o, statusLabel: ORDER_STATUSES[o.status] || o.status })) };
}

export async function orderDetail(db: D1Database, id: number) {
  const o = await ordersRepo.findById(db, id);
  if (!o) throw notFound('주문이 없습니다.');
  const items = await ordersRepo.listItems(db, id);
  return { order: { ...o, statusLabel: ORDER_STATUSES[o.status] || o.status, items } };
}

/**
 * 주문 상태 변경.
 * cancelled 로 전환할 때만 재고를 복구한다(중복 복구 방지: 이미 cancelled 면 건너뜀).
 */
export async function updateOrderStatus(
  db: D1Database,
  id: number,
  input: { status?: unknown; adminMemo?: unknown },
) {
  const cur = await ordersRepo.findById(db, id);
  if (!cur) throw notFound('주문이 없습니다.');

  const nextStatus = input.status ? String(input.status) : cur.status;
  if (!Object.hasOwn(ORDER_STATUSES, nextStatus)) {
    throw badRequest(`알 수 없는 주문 상태입니다: ${nextStatus}`);
  }

  if (nextStatus === 'cancelled' && cur.status !== 'cancelled') {
    await ordersRepo.restoreStockFor(db, id);
  }

  await ordersRepo.updateStatus(db, id, nextStatus, String(input.adminMemo ?? cur.admin_memo ?? ''));
  return { ok: true, status: nextStatus, statusLabel: ORDER_STATUSES[nextStatus] || nextStatus };
}

/* ── 회원 관리 ──────────────────────────────────────────────────────── */

export async function listUsers(db: D1Database, q: string) {
  return { items: await usersRepo.adminList(db, q, 300) };
}
