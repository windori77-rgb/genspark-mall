import * as couponsRepo from '../repository/coupons';
import { badRequest } from '../lib/http';

/**
 * 쿠폰 서비스 — 할인액 계산 규칙을 한 곳에 모은다.
 * 장바구니 미리보기(`/coupons/apply`)와 실제 주문 생성이 **같은 함수**를 쓴다.
 */

export type Discount = { code: string; name: string; discount: number };

/** 쿠폰 규칙으로 할인액 산출 (최소주문·최대할인·소계 상한 적용) */
export function discountFor(
  coupon: { type: string; value: number; min_order: number; max_discount: number },
  subtotal: number,
): number {
  let discount =
    coupon.type === 'percent' ? Math.floor((subtotal * coupon.value) / 100) : coupon.value;
  if (coupon.max_discount > 0) discount = Math.min(discount, coupon.max_discount);
  return Math.min(discount, subtotal);
}

/** 활성 쿠폰 목록 */
export async function listActive(db: D1Database) {
  return { items: await couponsRepo.listActive(db) };
}

/** 쿠폰 코드 검증 + 할인액 미리보기 */
export async function apply(db: D1Database, rawCode: unknown, subtotal: number): Promise<Discount> {
  const code = String(rawCode || '').trim().toUpperCase();
  const coupon = await couponsRepo.findActiveByCode(db, code);
  if (!coupon) throw badRequest('사용할 수 없는 쿠폰입니다.');

  if (subtotal < coupon.min_order) {
    throw badRequest(
      `최소 주문금액 ${coupon.min_order.toLocaleString('ko-KR')}원 이상 사용 가능합니다.`,
    );
  }

  return { code: coupon.code, name: coupon.name, discount: discountFor(coupon, subtotal) };
}

/**
 * 주문에 적용할 쿠폰 해석 — 조건 미충족이면 조용히 미적용(주문은 계속 진행).
 * (미리보기와 달리 주문 흐름을 막지 않는다 — 기존 동작 유지)
 */
export async function resolveForOrder(
  db: D1Database,
  rawCode: unknown,
  subtotal: number,
): Promise<{ code: string; discount: number }> {
  const code = String(rawCode || '').trim().toUpperCase();
  if (!code) return { code: '', discount: 0 };

  const coupon = await couponsRepo.findActiveByCode(db, code);
  if (!coupon || subtotal < coupon.min_order) return { code: '', discount: 0 };

  return { code: coupon.code, discount: discountFor(coupon, subtotal) };
}
