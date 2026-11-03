import { Hono } from 'hono';
import { getCookie } from 'hono/cookie';
import { ensureDb } from '../lib/db';
import { json } from '../lib/http';
import {
  currentUser, cartKey, clearSession, guestCartKey, resolveCartKey,
  setSession, SESSION_COOKIE,
} from '../lib/auth';
import * as catalog from '../service/catalog';
import * as authService from '../service/auth';
import * as cartService from '../service/cart';
import * as couponService from '../service/coupons';
import * as addressService from '../service/addresses';
import * as orderService from '../service/orders';
import * as wishlistService from '../service/wishlist';

/**
 * 고객용 API — **HTTP 계층**.
 *
 * ── 이 파일이 하는 일 ────────────────────────────────────────────────
 *   · 쿼리/바디/쿠키 파싱
 *   · 서비스 호출
 *   · 응답 직렬화
 *   · 쿠키 쓰기 (서비스는 HTTP 를 모른다)
 *
 * ── 이 파일이 하지 않는 일 ───────────────────────────────────────────
 *   · SQL        → repository/*
 *   · 금액 계산   → service/cart, service/orders
 *   · 상태 전이   → service/orders, service/adminDashboard
 *
 * 서비스가 던진 HttpError 는 루트 onError(index.tsx)가 `{ error }` 로 변환한다.
 */
const shop = new Hono<any>();

shop.use('*', async (c, next) => {
  await ensureDb(c.env.DB);
  await next();
});

/* ───────────────────────── 카탈로그 ───────────────────────── */

shop.get('/config', async (c) => json(await catalog.config(c.env.DB)));

shop.get('/products', async (c) =>
  json(
    await catalog.searchProducts(c.env.DB, {
      q: c.req.query('q'),
      category: c.req.query('category'),
      sort: c.req.query('sort'),
      badge: c.req.query('badge'),
      limit: c.req.query('limit'),
      page: c.req.query('page'),
    }),
  ),
);

shop.get('/products/:id', async (c) => json(await catalog.productDetail(c.env.DB, c.req.param('id'))));

/* ───────────────────────── 인증 ───────────────────────── */

shop.post('/auth/register', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { user, token } = await authService.register(c.env.DB, body, guestCartKey(c));
  setSession(c, token);
  return json({ user });
});

shop.post('/auth/login', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { user, token } = await authService.login(c.env.DB, body, guestCartKey(c));
  setSession(c, token);
  return json({ user });
});

shop.post('/auth/logout', async (c) => {
  await authService.logout(c.env.DB, getCookie(c, SESSION_COOKIE));
  clearSession(c);
  return json({ ok: true });
});

shop.get('/auth/me', async (c) => {
  const user = await currentUser(c);
  if (!user) return json({ user: null });
  return json(await authService.me(c.env.DB, user));
});

shop.patch('/auth/me', async (c) => {
  const user = await currentUser(c);
  if (!user) return json({ error: '로그인이 필요합니다.' }, 401);
  await authService.updateProfile(c.env.DB, user, await c.req.json().catch(() => ({})));
  return json({ ok: true });
});

/* ───────────────────────── 장바구니 ───────────────────────── */

/** 요청마다 "나의 장바구니 키"를 확정 (회원 u:<id> / 비회원 g:<cookie>) */
async function cartContext(c: any) {
  const user = await currentUser(c);
  return { user, key: resolveCartKey(c, user) };
}

shop.get('/cart', async (c) => {
  const { key } = await cartContext(c);
  return json(await cartService.getCart(c.env.DB, key));
});

shop.post('/cart', async (c) => {
  const { user, key } = await cartContext(c);
  const b = await c.req.json().catch(() => ({}));
  return json(
    await cartService.addItem(c.env.DB, {
      sessionKey: key,
      userId: user?.id ?? null,
      productId: Number(b.productId),
      qty: Math.max(Number(b.qty || 1), 1),
      optionText: String(b.optionText || ''),
    }),
  );
});

shop.patch('/cart/:id', async (c) => {
  const { key } = await cartContext(c);
  const b = await c.req.json().catch(() => ({}));
  return json(
    await cartService.setQty(c.env.DB, {
      sessionKey: key,
      itemId: Number(c.req.param('id')),
      qty: Number(b.qty || 1),
    }),
  );
});

shop.delete('/cart/:id', async (c) => {
  const { key } = await cartContext(c);
  return json(await cartService.removeItem(c.env.DB, key, Number(c.req.param('id'))));
});

shop.delete('/cart', async (c) => {
  const { key } = await cartContext(c);
  return json(await cartService.clearCart(c.env.DB, key));
});

/* ───────────────────────── 쿠폰 ───────────────────────── */

shop.get('/coupons', async (c) => json(await couponService.listActive(c.env.DB)));

shop.post('/coupons/apply', async (c) => {
  const b = await c.req.json().catch(() => ({}));
  return json(await couponService.apply(c.env.DB, b.code, Number(b.subtotal || 0)));
});

/* ───────────────────────── 배송지 ───────────────────────── */

shop.get('/addresses', async (c) => json(await addressService.list(c.env.DB, await currentUser(c))));

shop.post('/addresses', async (c) =>
  json(
    await addressService.create(
      c.env.DB,
      await currentUser(c),
      await c.req.json().catch(() => ({})),
    ),
  ),
);

/* ───────────────────────── 주문 ───────────────────────── */

shop.post('/orders', async (c) => {
  const { user, key } = await cartContext(c);
  const body = await c.req.json().catch(() => ({}));

  // 요청에 items 가 있으면 그것을, 없으면 장바구니 전체를 주문한다
  const lines = await cartService.orderLines(c.env.DB, key, body.items);

  return json(
    await orderService.placeOrder(c.env.DB, {
      userId: user?.id ?? null,
      userName: user?.name ?? null,
      cartKey: key,
      input: body,
      lines,
    }),
  );
});

shop.get('/orders', async (c) => json(await orderService.myOrders(c.env.DB, await currentUser(c))));

shop.get('/orders/:no', async (c) =>
  json(await orderService.orderDetail(c.env.DB, c.req.param('no'), await currentUser(c))),
);

// 비회원 주문조회 (주문번호 + 연락처)
shop.post('/orders/lookup', async (c) => {
  const b = await c.req.json().catch(() => ({}));
  return json(await orderService.lookup(c.env.DB, b.orderNo, b.phone));
});

shop.post('/orders/:no/cancel', async (c) =>
  json(await orderService.cancelOrder(c.env.DB, c.req.param('no'), await currentUser(c))),
);

/* ───────────────────────── 찜 ───────────────────────── */

shop.get('/wishlist', async (c) => json(await wishlistService.list(c.env.DB, await currentUser(c))));

shop.post('/wishlist/:productId', async (c) =>
  json(await wishlistService.toggle(c.env.DB, await currentUser(c), Number(c.req.param('productId')))),
);

export default shop;
