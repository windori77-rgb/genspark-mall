import * as cartRepo from '../repository/cart';
import * as productsRepo from '../repository/products';
import { badRequest, notFound } from '../lib/http';

/**
 * 장바구니 서비스.
 *
 * ── 규칙 ─────────────────────────────────────────────────────────────
 * · 재고를 넘는 수량은 담기지 않는다 (조용히 stock 으로 클램프).
 * · 합계·개수는 항상 DB 의 현재가로 다시 계산한다.
 *   (클라이언트가 보낸 금액은 신뢰하지 않는다)
 * · sessionKey 는 라우트가 만든다: 회원 `u:<id>` / 비회원 `g:<cookie>`.
 */

export type CartItem = {
  id: number;
  productId: number;
  name: string;
  brand: string;
  thumbnail: string;
  optionText: string;
  qty: number;
  price: number;
  originalPrice: number;
  stock: number;
  amount: number;
};

export type CartPayload = { items: CartItem[]; subtotal: number; count: number };

/** 장바구니 조회 + 금액 계산 */
export async function getCart(db: D1Database, sessionKey: string): Promise<CartPayload> {
  const rows = await cartRepo.listWithProduct(db, sessionKey);

  const items: CartItem[] = rows.map((r) => {
    const price = r.sale_price ?? r.price;
    return {
      id: r.id,
      productId: r.product_id,
      name: r.name,
      brand: r.brand,
      thumbnail: r.thumbnail,
      optionText: r.option_text,
      qty: r.qty,
      price,
      originalPrice: r.price,
      stock: r.stock,
      amount: price * r.qty,
    };
  });

  return {
    items,
    subtotal: items.reduce((s, i) => s + i.amount, 0),
    count: items.reduce((s, i) => s + i.qty, 0),
  };
}

/** 상품 담기 (같은 상품+옵션이면 수량 합산, 재고 상한 적용) */
export async function addItem(
  db: D1Database,
  v: { sessionKey: string; userId: number | null; productId: number; qty: number; optionText: string },
): Promise<CartPayload> {
  const product = await productsRepo.findStock(db, v.productId);
  if (!product) throw notFound('상품을 찾을 수 없습니다.');

  const qty = Math.max(v.qty, 1);
  const exist = await cartRepo.findItem(db, v.sessionKey, v.productId, v.optionText);

  if (exist) {
    const next = Math.min(exist.qty + qty, product.stock);
    await cartRepo.updateQty(db, exist.id, next);
  } else {
    await cartRepo.insert(db, {
      sessionKey: v.sessionKey,
      userId: v.userId,
      productId: v.productId,
      optionText: v.optionText,
      qty: Math.min(qty, product.stock),
    });
  }

  return getCart(db, v.sessionKey);
}

/** 수량 변경 (0 이하면 삭제) */
export async function setQty(
  db: D1Database,
  v: { sessionKey: string; itemId: number; qty: number },
): Promise<CartPayload> {
  if (v.qty <= 0) {
    await cartRepo.removeOwned(db, v.itemId, v.sessionKey);
    return getCart(db, v.sessionKey);
  }

  const row = await cartRepo.findOwnedWithStock(db, v.itemId, v.sessionKey);
  if (!row) throw notFound('항목이 없습니다.');

  await cartRepo.updateQty(db, row.id, Math.min(v.qty, row.stock));
  return getCart(db, v.sessionKey);
}

export async function removeItem(db: D1Database, sessionKey: string, itemId: number): Promise<CartPayload> {
  await cartRepo.removeOwned(db, itemId, sessionKey);
  return getCart(db, sessionKey);
}

export async function clearCart(db: D1Database, sessionKey: string): Promise<CartPayload> {
  await cartRepo.clear(db, sessionKey);
  return { items: [], subtotal: 0, count: 0 };
}

/**
 * 비회원 장바구니 → 회원 장바구니 병합 (로그인/가입 직후).
 *
 * 같은 상품+옵션이 이미 있으면 수량을 합치고 비회원 행을 지운다.
 * 없으면 행 주인만 바꾼다. 변경은 batch 로 한 번에 반영한다.
 */
export async function mergeGuestCart(db: D1Database, guestKey: string, userId: number): Promise<void> {
  const guestRows = await cartRepo.findByKey(db, guestKey);
  if (!guestRows.length) return;

  const userKey = `u:${userId}`;
  const merges: { keepId: number; dropId: number; addQty: number }[] = [];
  const transfers: { id: number }[] = [];

  for (const r of guestRows) {
    const exist = await cartRepo.findItem(db, userKey, r.product_id, r.option_text);
    if (exist) merges.push({ keepId: exist.id, dropId: r.id, addQty: r.qty });
    else transfers.push({ id: r.id });
  }

  await cartRepo.mergeBatch(db, merges);
  for (const t of transfers) await cartRepo.transferOwner(db, t.id, userKey, userId);
}

/** 주문 생성 시 사용할 라인 추출 (요청 items 우선, 없으면 장바구니 전체) */
export async function orderLines(
  db: D1Database,
  sessionKey: string,
  requested?: unknown,
): Promise<{ productId: number; optionText: string; qty: number }[]> {
  if (Array.isArray(requested) && requested.length) {
    return requested.map((it: any) => ({
      productId: Number(it.productId),
      optionText: String(it.optionText || ''),
      qty: Math.max(Number(it.qty || 1), 1),
    }));
  }
  const cart = await getCart(db, sessionKey);
  return cart.items.map((i) => ({ productId: i.productId, optionText: i.optionText, qty: i.qty }));
}

export { badRequest };
