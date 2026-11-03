import { Hono } from 'hono';
import { getCookie } from 'hono/cookie';
import { ensureDb } from '../lib/db';
import { json } from '../lib/http';
import { currentAdmin, clearAdminSession, setAdminSession, ADMIN_COOKIE } from '../lib/auth';
import * as adminAuth from '../service/adminAuth';
import * as dashboard from '../service/adminDashboard';
import * as adminProducts from '../service/adminProducts';
import * as adminCatalog from '../service/adminCatalog';

/**
 * 관리자용 API — **HTTP 계층**.
 *
 * ── 이 파일이 하는 일 ────────────────────────────────────────────────
 *   · 세션 쿠키 확인 / 인증 가드
 *   · 요청 파라미터 파싱
 *   · 서비스 호출 + 응답 직렬화
 *
 * ── 이 파일이 하지 않는 일 ───────────────────────────────────────────
 *   · SQL          → repository/*
 *   · 재고 복구 판단 → service/adminDashboard
 *   · 비밀번호 해시   → service/adminAuth
 */
const admin = new Hono<any>();

admin.use('*', async (c, next) => {
  await ensureDb(c.env.DB);
  await next();
});

/* ───────────── 로그인 / 로그아웃 / 세션 ───────────── */

admin.post('/login', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { admin: a, token } = await adminAuth.login(c.env.DB, body);
  setAdminSession(c, token);
  return json({ admin: a });
});

admin.post('/logout', async (c) => {
  await adminAuth.logout(c.env.DB, getCookie(c, ADMIN_COOKIE));
  clearAdminSession(c);
  return json({ ok: true });
});

admin.get('/me', async (c) => json({ admin: await currentAdmin(c) }));

/* ───────────── 인증 가드 ───────────── */
admin.use('*', async (c, next) => {
  const path = c.req.path.replace(/^\/api\/admin/, '');
  if (['/login', '/logout', '/me'].includes(path)) return next();

  const a = await currentAdmin(c);
  if (!a) return json({ error: '관리자 로그인이 필요합니다.' }, 401);
  c.set('admin', a);
  await next();
});

/* ───────────── 대시보드 / 주문 / 회원 ───────────── */

admin.get('/dashboard', async (c) => json(await dashboard.dashboard(c.env.DB)));

admin.get('/orders', async (c) =>
  json(await dashboard.listOrders(c.env.DB, { status: c.req.query('status'), q: c.req.query('q') })),
);

admin.get('/orders/:id', async (c) => json(await dashboard.orderDetail(c.env.DB, Number(c.req.param('id')))));

admin.patch('/orders/:id', async (c) =>
  json(
    await dashboard.updateOrderStatus(
      c.env.DB,
      Number(c.req.param('id')),
      await c.req.json().catch(() => ({})),
    ),
  ),
);

admin.get('/users', async (c) => json(await dashboard.listUsers(c.env.DB, (c.req.query('q') || '').trim())));

/* ───────────── 상품 ───────────── */

admin.get('/products', async (c) =>
  json(await adminProducts.list(c.env.DB, { q: c.req.query('q'), category: c.req.query('category') })),
);

admin.post('/products', async (c) =>
  json(await adminProducts.create(c.env.DB, await c.req.json().catch(() => ({})))),
);

admin.put('/products/:id', async (c) => {
  await adminProducts.update(
    c.env.DB,
    Number(c.req.param('id')),
    await c.req.json().catch(() => ({})),
  );
  return json({ ok: true });
});

admin.delete('/products/:id', async (c) => {
  await adminProducts.remove(c.env.DB, Number(c.req.param('id')));
  return json({ ok: true });
});

admin.patch('/products/:id/stock', async (c) => {
  const b = await c.req.json().catch(() => ({}));
  await adminProducts.setStock(c.env.DB, Number(c.req.param('id')), b.stock);
  return json({ ok: true });
});

/* ───────────── 쿠폰 ───────────── */

admin.get('/coupons', async (c) => json(await adminCatalog.listCoupons(c.env.DB)));

admin.post('/coupons', async (c) => {
  await adminCatalog.createCoupon(c.env.DB, await c.req.json().catch(() => ({})));
  return json({ ok: true });
});

admin.patch('/coupons/:id', async (c) => {
  await adminCatalog.setCouponActive(
    c.env.DB,
    Number(c.req.param('id')),
    await c.req.json().catch(() => ({})),
  );
  return json({ ok: true });
});

admin.delete('/coupons/:id', async (c) => {
  await adminCatalog.removeCoupon(c.env.DB, Number(c.req.param('id')));
  return json({ ok: true });
});

/* ───────────── 배너 ───────────── */

admin.get('/banners', async (c) => json(await adminCatalog.listBanners(c.env.DB)));

admin.post('/banners', async (c) => {
  await adminCatalog.createBanner(c.env.DB, await c.req.json().catch(() => ({})));
  return json({ ok: true });
});

admin.patch('/banners/:id', async (c) => {
  await adminCatalog.updateBanner(
    c.env.DB,
    Number(c.req.param('id')),
    await c.req.json().catch(() => ({})),
  );
  return json({ ok: true });
});

admin.delete('/banners/:id', async (c) => {
  await adminCatalog.removeBanner(c.env.DB, Number(c.req.param('id')));
  return json({ ok: true });
});

/* ───────────── 카테고리 / 리뷰 / 설정 ───────────── */

admin.get('/categories', async (c) => json(await adminCatalog.listCategories(c.env.DB)));

admin.post('/categories', async (c) => {
  await adminCatalog.createCategory(c.env.DB, await c.req.json().catch(() => ({})));
  return json({ ok: true });
});

admin.get('/reviews', async (c) => json(await adminCatalog.listReviews(c.env.DB)));

admin.delete('/reviews/:id', async (c) => {
  await adminCatalog.removeReview(c.env.DB, Number(c.req.param('id')));
  return json({ ok: true });
});

admin.get('/settings', async (c) => json(await adminCatalog.getSettings(c.env.DB)));

admin.put('/settings', async (c) => {
  await adminCatalog.saveSettings(c.env.DB, await c.req.json().catch(() => ({})));
  return json({ ok: true });
});

/* ───────────── 비밀번호 변경 ───────────── */

admin.post('/password', async (c) => {
  await adminAuth.changePassword(
    c.env.DB,
    c.get('admin'),
    await c.req.json().catch(() => ({})),
  );
  return json({ ok: true });
});

export default admin;
