import * as ordersRepo from '../repository/orders';
import * as productsRepo from '../repository/products';
import * as settingsRepo from '../repository/settings';
import * as couponsService from './coupons';
import type { CartPayload } from './cart';
import { orderNo } from '../lib/auth';
import { ORDER_STATUSES } from '../lib/schema';
import { badRequest, forbidden, notFound } from '../lib/http';

/**
 * 주문 서비스.
 *
 * ── 계산 규칙 (한 곳에서만 정의) ──────────────────────────────────────
 *   subtotal  = Σ (판매가 × 수량)          ← DB 의 현재가 기준 (클라이언트 금액 불신)
 *   discount  = 쿠폰 규칙 (service/coupons)
 *   shipping  = (subtotal - discount) >= 무료배송기준 ? 0 : 기본배송비
 *   total     = subtotal - discount + shipping
 *
 * ── 재고 ─────────────────────────────────────────────────────────────
 *   주문 시 차감, 취소 시 복구. 둘 다 db.batch() 로 원자 처리.
 */

export type PlaceOrderInput = {
  receiver?: unknown;
  receiverPhone?: unknown;
  addr1?: unknown;
  addr2?: unknown;
  zipcode?: unknown;
  ordererName?: unknown;
  ordererPhone?: unknown;
  memo?: unknown;
  payMethod?: unknown;
  couponCode?: unknown;
  items?: unknown;
};

const CANCELLABLE = ['paid', 'preparing', 'pending'];

export async function placeOrder(
  db: D1Database,
  v: {
    userId: number | null;
    /** 로그인 회원 이름 — ordererName 미입력 시 fallback (비회원이면 null) */
    userName: string | null;
    cartKey: string;
    input: PlaceOrderInput;
    lines: { productId: number; optionText: string; qty: number }[];
  },
) {
  const { input } = v;
  const receiver = String(input.receiver || '').trim();
  const receiverPhone = String(input.receiverPhone || '').trim();
  const addr1 = String(input.addr1 || '').trim();
  const addr2 = String(input.addr2 || '');
  const zipcode = String(input.zipcode || '');

  if (!receiver || !receiverPhone || !addr1) {
    throw badRequest('받는분, 연락처, 주소는 필수입니다.');
  }
  if (!v.lines.length) throw badRequest('주문할 상품이 없습니다.');

  // ── 상품 검증 + 소계 ────────────────────────────────────────────────
  let subtotal = 0;
  const lines: ordersRepo.OrderLineWriteModel[] = [];

  for (const it of v.lines) {
    const p = await productsRepo.findActive(db, it.productId);
    if (!p) throw badRequest('판매 중지된 상품이 포함되어 있습니다.');

    const qty = Math.max(it.qty, 1);
    if (p.stock < qty) {
      throw badRequest(`'${p.name}' 재고가 부족합니다. (남은 수량 ${p.stock}개)`);
    }

    const price = p.sale_price ?? p.price;
    subtotal += price * qty;
    lines.push({
      productId: p.id,
      name: p.name,
      thumbnail: p.thumbnail,
      optionText: it.optionText,
      price,
      qty,
    });
  }

  // ── 쿠폰 / 배송비 / 적립 ────────────────────────────────────────────
  const settings = await settingsRepo.asMap(db);
  const freeOver = Number(settings.free_shipping_over || 30000);
  const baseFee = Number(settings.base_shipping_fee || 3000);

  const coupon = await couponsService.resolveForOrder(db, input.couponCode, subtotal);
  const payable = subtotal - coupon.discount;
  const shippingFee = payable >= freeOver ? 0 : baseFee;
  const total = payable + shippingFee;
  const point = Math.floor((total * Number(settings.point_rate || 1)) / 100);

  const no = orderNo();
  // 우선순위: 입력값 → 로그인 회원 이름 → 받는분 이름
  const ordererName = String(input.ordererName || v.userName || receiver).trim();

  const orderId = await ordersRepo.insertHeader(db, {
    orderNo: no,
    userId: v.userId,
    ordererName,
    ordererPhone: String(input.ordererPhone || receiverPhone),
    receiver,
    receiverPhone,
    zipcode,
    addr1,
    addr2,
    memo: String(input.memo || ''),
    subtotal,
    discount: coupon.discount,
    shippingFee,
    total,
    payMethod: String(input.payMethod || 'demo'),
    couponCode: coupon.code,
    status: 'paid',
  });

  await ordersRepo.commitOrder(db, orderId, lines, { couponCode: coupon.code, cartKey: v.cartKey });

  return {
    order: {
      id: orderId,
      orderNo: no,
      subtotal,
      discount: coupon.discount,
      shippingFee,
      total,
      status: 'paid',
      statusLabel: ORDER_STATUSES.paid,
      point,
      receiver,
      receiverPhone,
      addr1,
      addr2,
      items: lines.map((l) => ({
        name: l.name,
        thumbnail: l.thumbnail,
        optionText: l.optionText,
        price: l.price,
        qty: l.qty,
      })),
      createdAt: new Date().toISOString(),
    },
  };
}

/** 내 주문 목록 */
export async function myOrders(db: D1Database, user: any) {
  if (!user) return { items: [] };
  const rows = await ordersRepo.listByUser(db, user.id, 50);
  return { items: rows.map((r) => ({ ...r, statusLabel: ORDER_STATUSES[r.status] || r.status })) };
}

/** 주문 단건 (소유권 검사) */
export async function orderDetail(db: D1Database, orderNoValue: string, user: any) {
  const o = await ordersRepo.findByNo(db, orderNoValue);
  if (!o) throw notFound('주문을 찾을 수 없습니다.');

  // 회원 주문은 본인만. 비회원 주문(user_id NULL)은 주문번호를 아는 사람이 조회 가능.
  if (o.user_id && (!user || user.id !== o.user_id)) {
    throw forbidden('본인 주문만 조회할 수 있습니다.');
  }

  const items = await ordersRepo.listItems(db, o.id);
  return { order: { ...o, statusLabel: ORDER_STATUSES[o.status] || o.status, items } };
}

/** 비회원 주문조회 (주문번호 + 연락처) */
export async function lookup(db: D1Database, rawNo: unknown, rawPhone: unknown) {
  const no = String(rawNo || '').trim();
  const phone = String(rawPhone || '').trim();

  const o = await ordersRepo.findByNo(db, no);
  if (!o || o.receiver_phone !== phone) {
    throw notFound('주문번호 또는 연락처가 일치하지 않습니다.');
  }

  const items = await ordersRepo.listItems(db, o.id);
  return { order: { ...o, statusLabel: ORDER_STATUSES[o.status] || o.status, items } };
}

/** 고객 주문 취소 */
export async function cancelOrder(db: D1Database, no: string, user: any) {
  const o = await ordersRepo.findByNo(db, no);
  if (!o) throw notFound('주문을 찾을 수 없습니다.');

  if (o.user_id && (!user || user.id !== o.user_id)) throw forbidden('권한이 없습니다.');
  if (!CANCELLABLE.includes(o.status)) throw badRequest('현재 상태에서는 취소할 수 없습니다.');

  await ordersRepo.cancel(db, o.id);
  return { ok: true, status: 'cancelled' };
}

export type { CartPayload };
