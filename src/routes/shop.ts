import { Hono } from 'hono';
import { ensureDb, json } from '../lib/db';
import {
  currentUser, cookieOpts, cartKey, clearSession, newToken, orderNo,
  setSession, verifyPassword, hashPassword, SESSION_COOKIE, CART_COOKIE,
} from '../lib/auth';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { ORDER_STATUSES } from '../lib/schema';

const shop = new Hono<any>();

shop.use('*', async (c, next) => {
  await ensureDb(c.env.DB);
  await next();
});

/* ───────────────────────── 공통 설정 / 카탈로그 ───────────────────────── */

shop.get('/config', async (c) => {
  const db = c.env.DB;
  const [settings, cats, bannersRes, noticesRes] = await Promise.all([
    db.prepare('SELECT key, value FROM settings').all(),
    db.prepare('SELECT id, name, slug, icon FROM categories WHERE is_active = 1 ORDER BY sort_order').all(),
    db.prepare('SELECT id, title, subtitle, image, bg, link FROM banners WHERE is_active = 1 ORDER BY sort_order').all(),
    db.prepare('SELECT id, title, content, is_pinned FROM notices ORDER BY is_pinned DESC, id DESC LIMIT 5').all(),
  ]);
  const conf: Record<string, string> = {};
  for (const r of settings.results as any[]) conf[r.key] = r.value;
  return json({
    settings: conf,
    categories: cats.results,
    banners: bannersRes.results,
    notices: noticesRes.results,
    statuses: ORDER_STATUSES,
  });
});

shop.get('/products', async (c) => {
  const db = c.env.DB;
  const q = (c.req.query('q') || '').trim();
  const cat = c.req.query('category') || '';
  const sort = c.req.query('sort') || 'popular';
  const badge = c.req.query('badge') || '';
  const limit = Math.min(Number(c.req.query('limit') || 20), 60);
  const page = Math.max(Number(c.req.query('page') || 1), 1);

  const where: string[] = ['p.is_active = 1'];
  const binds: any[] = [];
  if (cat) {
    where.push('(c.slug = ? OR c.id = ?)');
    binds.push(cat, Number(isNaN(Number(cat)) ? -1 : Number(cat)));
  }
  if (q) {
    where.push('(p.name LIKE ? OR p.brand LIKE ? OR p.summary LIKE ?)');
    binds.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  if (badge) { where.push('p.badge = ?'); binds.push(badge); }

  const orderBy: Record<string, string> = {
    popular: 'p.sales_count DESC, p.id DESC',
    new: 'p.id DESC',
    price_asc: 'COALESCE(p.sale_price, p.price) ASC',
    price_desc: 'COALESCE(p.sale_price, p.price) DESC',
    rating: 'p.rating DESC, p.review_count DESC',
  };

  // ── 정렬 키 화이트리스트 검증 ─────────────────────────────────────────
  // sort 는 사용자 입력이다. `orderBy[sort] || orderBy.popular` 처럼 쓰면
  // JS 객체가 프로토타입 체인까지 탐색하므로
  //   ?sort=constructor → "function Object() { [native code] }"
  //   ?sort=toString    → "function toString() { [native code] }"
  //   ?sort=__proto__   → "[object Object]"
  // 가 SQL 에 그대로 들어가 구문 오류(500)를 유발한다.
  // Object.hasOwn 으로 'own property' 만 허용해 프로토타입 오염 경로를 차단한다.
  const orderSql = Object.hasOwn(orderBy, sort) ? orderBy[sort] : orderBy.popular;

  const wsql = where.join(' AND ');
  const totalRow: any = await db.prepare(
    `SELECT COUNT(*) AS n FROM products p JOIN categories c ON c.id = p.category_id WHERE ${wsql}`
  ).bind(...binds).first();

  const rows = await db.prepare(
    `SELECT p.id, p.name, p.brand, p.summary, p.price, p.sale_price, p.thumbnail, p.badge,
            p.rating, p.review_count, p.sales_count, p.stock, p.shipping_fee, c.name AS category_name, c.slug AS category_slug
       FROM products p JOIN categories c ON c.id = p.category_id
      WHERE ${wsql}
      ORDER BY ${orderSql}
      LIMIT ? OFFSET ?`
  ).bind(...binds, limit, (page - 1) * limit).all();

  return json({
    items: rows.results,
    total: totalRow?.n || 0,
    page,
    limit,
    hasMore: (totalRow?.n || 0) > page * limit,
  });
});

shop.get('/products/:id', async (c) => {
  const db = c.env.DB;
  const id = Number(c.req.param('id'));
  const p: any = await db.prepare(
    `SELECT p.*, c.name AS category_name, c.slug AS category_slug
       FROM products p JOIN categories c ON c.id = p.category_id WHERE p.id = ?`
  ).bind(id).first();
  if (!p) return json({ error: '상품을 찾을 수 없습니다.' }, 404);

  const reviews = await db.prepare(
    'SELECT id, author, rating, content, created_at FROM reviews WHERE product_id = ? ORDER BY id DESC LIMIT 20'
  ).bind(id).all();

  const related = await db.prepare(
    `SELECT id, name, price, sale_price, thumbnail, rating FROM products
      WHERE category_id = ? AND id != ? AND is_active = 1 ORDER BY sales_count DESC LIMIT 6`
  ).bind(p.category_id, id).all();

  return json({
    product: {
      ...p,
      images: JSON.parse(p.images || '[]'),
      options: JSON.parse(p.options || '[]'),
    },
    reviews: reviews.results,
    related: related.results,
  });
});

/* ───────────────────────── 인증 ───────────────────────── */

shop.post('/auth/register', async (c) => {
  const db = c.env.DB;
  const b = await c.req.json().catch(() => ({}));
  const email = String(b.email || '').trim().toLowerCase();
  const password = String(b.password || '');
  const name = String(b.name || '').trim();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: '이메일 형식이 올바르지 않습니다.' }, 400);
  if (password.length < 6) return json({ error: '비밀번호는 6자 이상이어야 합니다.' }, 400);
  if (!name) return json({ error: '이름을 입력해주세요.' }, 400);

  const dup: any = await db.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
  if (dup) return json({ error: '이미 가입된 이메일입니다.' }, 409);

  const hash = await hashPassword(password);
  const res = await db.prepare(
    'INSERT INTO users (email, password_hash, name, phone, marketing_agree) VALUES (?,?,?,?,?)'
  ).bind(email, hash, name, String(b.phone || ''), b.marketing ? 1 : 0).run();

  const userId = Number((res.meta as any).last_row_id);
  await mergeGuestCart(c, userId);

  const token = newToken();
  await db.prepare("INSERT INTO user_sessions (token, user_id, expires_at) VALUES (?,?,datetime('now','+30 days'))")
    .bind(token, userId).run();
  setSession(c, token);

  return json({ user: { id: userId, email, name, phone: String(b.phone || '') } });
});

shop.post('/auth/login', async (c) => {
  const db = c.env.DB;
  const b = await c.req.json().catch(() => ({}));
  const email = String(b.email || '').trim().toLowerCase();
  const password = String(b.password || '');

  const u: any = await db.prepare('SELECT * FROM users WHERE email = ?').bind(email).first();
  if (!u || !(await verifyPassword(password, u.password_hash))) {
    return json({ error: '이메일 또는 비밀번호가 올바르지 않습니다.' }, 401);
  }

  await mergeGuestCart(c, u.id);

  const token = newToken();
  await db.prepare("INSERT INTO user_sessions (token, user_id, expires_at) VALUES (?,?,datetime('now','+30 days'))")
    .bind(token, u.id).run();
  setSession(c, token);

  return json({ user: { id: u.id, email: u.email, name: u.name, phone: u.phone } });
});

shop.post('/auth/logout', async (c) => {
  const token = getCookie(c, SESSION_COOKIE);
  if (token) await c.env.DB.prepare('DELETE FROM user_sessions WHERE token = ?').bind(token).run();
  clearSession(c);
  return json({ ok: true });
});

shop.get('/auth/me', async (c) => {
  const user = await currentUser(c);
  if (!user) return json({ user: null });
  const counts: any = await c.env.DB.prepare(
    `SELECT (SELECT COUNT(*) FROM orders WHERE user_id = ?) AS orders,
            (SELECT COUNT(*) FROM wishlist WHERE user_id = ?) AS wishes`
  ).bind(user.id, user.id).first();
  return json({ user, counts });
});

shop.patch('/auth/me', async (c) => {
  const user = await currentUser(c);
  if (!user) return json({ error: '로그인이 필요합니다.' }, 401);
  const b = await c.req.json().catch(() => ({}));
  await c.env.DB.prepare('UPDATE users SET name = ?, phone = ? WHERE id = ?')
    .bind(b.name ?? user.name, b.phone ?? user.phone, user.id).run();
  return json({ ok: true });
});

/* 로그인 시 비회원 장바구니 병합 */
async function mergeGuestCart(c: any, userId: number) {
  const guest = getCookie(c, CART_COOKIE);
  if (!guest) return;
  const db = c.env.DB;
  const rows = await db.prepare('SELECT * FROM cart_items WHERE session_key = ?').bind(`g:${guest}`).all();
  for (const r of rows.results as any[]) {
    const exist: any = await db.prepare(
      'SELECT id, qty FROM cart_items WHERE session_key = ? AND product_id = ? AND option_text = ?'
    ).bind(`u:${userId}`, r.product_id, r.option_text).first();
    if (exist) {
      await db.prepare('UPDATE cart_items SET qty = qty + ? WHERE id = ?').bind(r.qty, exist.id).run();
      await db.prepare('DELETE FROM cart_items WHERE id = ?').bind(r.id).run();
    } else {
      await db.prepare('UPDATE cart_items SET session_key = ?, user_id = ? WHERE id = ?')
        .bind(`u:${userId}`, userId, r.id).run();
    }
  }
}

function keyOf(c: any, user: any) {
  return user ? `u:${user.id}` : null;
}

function resolveKey(c: any, user: any) {
  if (user) return `u:${user.id}`;
  return `g:${cartKey(c)}`;
}

/* ───────────────────────── 장바구니 ───────────────────────── */

async function cartPayload(c: any, key: string) {
  const db = c.env.DB;
  const rows = await db.prepare(
    `SELECT ci.id, ci.product_id, ci.option_text, ci.qty,
            p.name, p.thumbnail, p.price, p.sale_price, p.stock, p.shipping_fee, p.brand
       FROM cart_items ci JOIN products p ON p.id = ci.product_id
      WHERE ci.session_key = ? ORDER BY ci.id DESC`
  ).bind(key).all();

  const items = (rows.results as any[]).map((r) => ({
    id: r.id,
    productId: r.product_id,
    name: r.name,
    brand: r.brand,
    thumbnail: r.thumbnail,
    optionText: r.option_text,
    qty: r.qty,
    price: r.sale_price ?? r.price,
    originalPrice: r.price,
    stock: r.stock,
    amount: (r.sale_price ?? r.price) * r.qty,
  }));
  const subtotal = items.reduce((s, i) => s + i.amount, 0);
  return { items, subtotal, count: items.reduce((s, i) => s + i.qty, 0) };
}

shop.get('/cart', async (c) => {
  const user = await currentUser(c);
  return json(await cartPayload(c, resolveKey(c, user)));
});

shop.post('/cart', async (c) => {
  const user = await currentUser(c);
  const key = resolveKey(c, user);
  const b = await c.req.json().catch(() => ({}));
  const productId = Number(b.productId);
  const qty = Math.max(Number(b.qty || 1), 1);
  const optionText = String(b.optionText || '');

  const p: any = await c.env.DB.prepare('SELECT id, stock FROM products WHERE id = ? AND is_active = 1').bind(productId).first();
  if (!p) return json({ error: '상품을 찾을 수 없습니다.' }, 404);

  const exist: any = await c.env.DB.prepare(
    'SELECT id, qty FROM cart_items WHERE session_key = ? AND product_id = ? AND option_text = ?'
  ).bind(key, productId, optionText).first();

  if (exist) {
    const next = Math.min(exist.qty + qty, p.stock);
    await c.env.DB.prepare('UPDATE cart_items SET qty = ? WHERE id = ?').bind(next, exist.id).run();
  } else {
    await c.env.DB.prepare(
      'INSERT INTO cart_items (session_key, user_id, product_id, option_text, qty) VALUES (?,?,?,?,?)'
    ).bind(key, user?.id ?? null, productId, optionText, Math.min(qty, p.stock)).run();
  }

  return json(await cartPayload(c, key));
});

shop.patch('/cart/:id', async (c) => {
  const user = await currentUser(c);
  const key = resolveKey(c, user);
  const id = Number(c.req.param('id'));
  const b = await c.req.json().catch(() => ({}));
  const qty = Number(b.qty || 1);

  if (qty <= 0) {
    await c.env.DB.prepare('DELETE FROM cart_items WHERE id = ? AND session_key = ?').bind(id, key).run();
  } else {
    const row: any = await c.env.DB.prepare(
      'SELECT ci.id, p.stock FROM cart_items ci JOIN products p ON p.id = ci.product_id WHERE ci.id = ? AND ci.session_key = ?'
    ).bind(id, key).first();
    if (!row) return json({ error: '항목이 없습니다.' }, 404);
    await c.env.DB.prepare('UPDATE cart_items SET qty = ? WHERE id = ?').bind(Math.min(qty, row.stock), id).run();
  }
  return json(await cartPayload(c, key));
});

shop.delete('/cart/:id', async (c) => {
  const user = await currentUser(c);
  const key = resolveKey(c, user);
  await c.env.DB.prepare('DELETE FROM cart_items WHERE id = ? AND session_key = ?')
    .bind(Number(c.req.param('id')), key).run();
  return json(await cartPayload(c, key));
});

shop.delete('/cart', async (c) => {
  const user = await currentUser(c);
  const key = resolveKey(c, user);
  await c.env.DB.prepare('DELETE FROM cart_items WHERE session_key = ?').bind(key).run();
  return json({ items: [], subtotal: 0, count: 0 });
});

/* ───────────────────────── 쿠폰 ───────────────────────── */

shop.get('/coupons', async (c) => {
  const rows = await c.env.DB.prepare(
    `SELECT code, name, type, value, min_order, max_discount, expires_at
       FROM coupons WHERE is_active = 1 ORDER BY id`
  ).all();
  return json({ items: rows.results });
});

shop.post('/coupons/apply', async (c) => {
  const b = await c.req.json().catch(() => ({}));
  const code = String(b.code || '').trim().toUpperCase();
  const subtotal = Number(b.subtotal || 0);
  const coupon: any = await c.env.DB.prepare(
    'SELECT * FROM coupons WHERE code = ? AND is_active = 1'
  ).bind(code).first();

  if (!coupon) return json({ error: '사용할 수 없는 쿠폰입니다.' }, 400);
  if (subtotal < coupon.min_order) {
    return json({ error: `최소 주문금액 ${coupon.min_order.toLocaleString('ko-KR')}원 이상 사용 가능합니다.` }, 400);
  }
  let discount = coupon.type === 'percent'
    ? Math.floor((subtotal * coupon.value) / 100)
    : coupon.value;
  if (coupon.max_discount > 0) discount = Math.min(discount, coupon.max_discount);
  discount = Math.min(discount, subtotal);
  return json({ code: coupon.code, name: coupon.name, discount });
});

/* ───────────────────────── 배송지 ───────────────────────── */

shop.get('/addresses', async (c) => {
  const user = await currentUser(c);
  if (!user) return json({ items: [] });
  const rows = await c.env.DB.prepare(
    'SELECT * FROM addresses WHERE user_id = ? ORDER BY is_default DESC, id DESC'
  ).bind(user.id).all();
  return json({ items: rows.results });
});

shop.post('/addresses', async (c) => {
  const user = await currentUser(c);
  if (!user) return json({ error: '로그인이 필요합니다.' }, 401);
  const b = await c.req.json().catch(() => ({}));
  if (!b.receiver || !b.phone || !b.addr1) return json({ error: '받는분, 연락처, 주소를 입력해주세요.' }, 400);
  const isDefault = b.isDefault ? 1 : 0;
  if (isDefault) {
    await c.env.DB.prepare('UPDATE addresses SET is_default = 0 WHERE user_id = ?').bind(user.id).run();
  }
  await c.env.DB.prepare(
    'INSERT INTO addresses (user_id, label, receiver, phone, zipcode, addr1, addr2, is_default) VALUES (?,?,?,?,?,?,?,?)'
  ).bind(user.id, String(b.label || '기본 배송지'), b.receiver, b.phone, String(b.zipcode || ''), b.addr1, String(b.addr2 || ''), isDefault).run();
  return json({ ok: true, items: (await c.env.DB.prepare('SELECT * FROM addresses WHERE user_id = ? ORDER BY is_default DESC, id DESC').bind(user.id).all()).results });
});

/* ───────────────────────── 주문 ───────────────────────── */

shop.post('/orders', async (c) => {
  const db = c.env.DB;
  const user = await currentUser(c);
  const key = resolveKey(c, user);
  const b = await c.req.json().catch(() => ({}));

  const receiver = String(b.receiver || '').trim();
  const receiverPhone = String(b.receiverPhone || '').trim();
  const addr1 = String(b.addr1 || '').trim();
  const ordererName = String(b.ordererName || user?.name || receiver).trim();

  if (!receiver || !receiverPhone || !addr1) {
    return json({ error: '받는분, 연락처, 주소는 필수입니다.' }, 400);
  }

  let items: any[] = [];
  if (Array.isArray(b.items) && b.items.length) {
    items = b.items;
  } else {
    const cart = await cartPayload(c, key);
    items = cart.items.map((i: any) => ({ productId: i.productId, optionText: i.optionText, qty: i.qty }));
  }
  if (!items.length) return json({ error: '주문할 상품이 없습니다.' }, 400);

  const settings: Record<string, string> = {};
  for (const r of (await db.prepare('SELECT key, value FROM settings').all()).results as any[]) {
    settings[r.key] = r.value;
  }
  const freeOver = Number(settings.free_shipping_over || 30000);
  const baseFee = Number(settings.base_shipping_fee || 3000);

  let subtotal = 0;
  const lines: any[] = [];
  for (const it of items) {
    const p: any = await db.prepare('SELECT * FROM products WHERE id = ? AND is_active = 1').bind(Number(it.productId)).first();
    if (!p) return json({ error: '판매 중지된 상품이 포함되어 있습니다.' }, 400);
    const qty = Math.max(Number(it.qty || 1), 1);
    if (p.stock < qty) return json({ error: `'${p.name}' 재고가 부족합니다. (남은 수량 ${p.stock}개)` }, 400);
    const price = p.sale_price ?? p.price;
    subtotal += price * qty;
    lines.push({
      product_id: p.id, name: p.name, thumbnail: p.thumbnail,
      option_text: String(it.optionText || ''), price, qty, stock: p.stock, ship: p.shipping_fee,
    });
  }

  // 쿠폰
  let discount = 0;
  let couponCode = '';
  if (b.couponCode) {
    const coupon: any = await db.prepare('SELECT * FROM coupons WHERE code = ? AND is_active = 1')
      .bind(String(b.couponCode).toUpperCase()).first();
    if (coupon && subtotal >= coupon.min_order) {
      discount = coupon.type === 'percent' ? Math.floor((subtotal * coupon.value) / 100) : coupon.value;
      if (coupon.max_discount > 0) discount = Math.min(discount, coupon.max_discount);
      discount = Math.min(discount, subtotal);
      couponCode = coupon.code;
    }
  }

  const payable = subtotal - discount;
  const shippingFee = payable >= freeOver ? 0 : baseFee;
  const total = payable + shippingFee;
  const point = Math.floor((total * Number(settings.point_rate || 1)) / 100);

  const no = orderNo();
  const res = await db.prepare(
    `INSERT INTO orders (order_no, user_id, orderer_name, orderer_phone, receiver, receiver_phone,
       zipcode, addr1, addr2, memo, subtotal, discount, shipping_fee, total, pay_method, coupon_code, status)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).bind(
    no, user?.id ?? null, ordererName, String(b.ordererPhone || receiverPhone),
    receiver, receiverPhone, String(b.zipcode || ''), addr1, String(b.addr2 || ''),
    String(b.memo || ''), subtotal, discount, shippingFee, total,
    String(b.payMethod || 'demo'), couponCode, 'paid'
  ).run();

  const orderId = Number((res.meta as any).last_row_id);
  const stmts: D1PreparedStatement[] = [];
  for (const l of lines) {
    stmts.push(db.prepare(
      'INSERT INTO order_items (order_id, product_id, name, thumbnail, option_text, price, qty) VALUES (?,?,?,?,?,?,?)'
    ).bind(orderId, l.product_id, l.name, l.thumbnail, l.option_text, l.price, l.qty));
    stmts.push(db.prepare('UPDATE products SET stock = stock - ?, sales_count = sales_count + ? WHERE id = ?')
      .bind(l.qty, l.qty, l.product_id));
  }
  if (couponCode) {
    stmts.push(db.prepare('UPDATE coupons SET used_count = used_count + 1 WHERE code = ?').bind(couponCode));
  }
  stmts.push(db.prepare('DELETE FROM cart_items WHERE session_key = ?').bind(key));
  await db.batch(stmts);

  return json({
    order: {
      id: orderId, orderNo: no, subtotal, discount, shippingFee, total,
      status: 'paid', statusLabel: ORDER_STATUSES.paid, point,
      receiver, receiverPhone, addr1, addr2: String(b.addr2 || ''),
      items: lines.map((l) => ({ name: l.name, thumbnail: l.thumbnail, optionText: l.option_text, price: l.price, qty: l.qty })),
      createdAt: new Date().toISOString(),
    },
  });
});

shop.get('/orders', async (c) => {
  const user = await currentUser(c);
  if (!user) return json({ items: [] });
  const rows = await c.env.DB.prepare(
    `SELECT o.id, o.order_no, o.total, o.status, o.created_at,
            (SELECT COUNT(*) FROM order_items WHERE order_id = o.id) AS item_count,
            (SELECT name FROM order_items WHERE order_id = o.id LIMIT 1) AS first_item,
            (SELECT thumbnail FROM order_items WHERE order_id = o.id LIMIT 1) AS thumbnail
       FROM orders o WHERE o.user_id = ? ORDER BY o.id DESC LIMIT 50`
  ).bind(user.id).all();
  return json({
    items: (rows.results as any[]).map((r) => ({ ...r, statusLabel: ORDER_STATUSES[r.status] || r.status })),
  });
});

shop.get('/orders/:no', async (c) => {
  const db = c.env.DB;
  const no = c.req.param('no');
  const user = await currentUser(c);
  const o: any = await db.prepare('SELECT * FROM orders WHERE order_no = ?').bind(no).first();
  if (!o) return json({ error: '주문을 찾을 수 없습니다.' }, 404);
  if (o.user_id && (!user || user.id !== o.user_id)) {
    return json({ error: '본인 주문만 조회할 수 있습니다.' }, 403);
  }
  const items = await db.prepare('SELECT * FROM order_items WHERE order_id = ?').bind(o.id).all();
  return json({ order: { ...o, statusLabel: ORDER_STATUSES[o.status] || o.status, items: items.results } });
});

// 비회원 주문조회 (주문번호 + 연락처)
shop.post('/orders/lookup', async (c) => {
  const b = await c.req.json().catch(() => ({}));
  const no = String(b.orderNo || '').trim();
  const phone = String(b.phone || '').trim();
  const o: any = await c.env.DB.prepare('SELECT * FROM orders WHERE order_no = ?').bind(no).first();
  if (!o || o.receiver_phone !== phone) return json({ error: '주문번호 또는 연락처가 일치하지 않습니다.' }, 404);
  const items = await c.env.DB.prepare('SELECT * FROM order_items WHERE order_id = ?').bind(o.id).all();
  return json({ order: { ...o, statusLabel: ORDER_STATUSES[o.status] || o.status, items: items.results } });
});

shop.post('/orders/:no/cancel', async (c) => {
  const db = c.env.DB;
  const no = c.req.param('no');
  const user = await currentUser(c);
  const o: any = await db.prepare('SELECT * FROM orders WHERE order_no = ?').bind(no).first();
  if (!o) return json({ error: '주문을 찾을 수 없습니다.' }, 404);
  if (o.user_id && (!user || user.id !== o.user_id)) return json({ error: '권한이 없습니다.' }, 403);
  if (!['paid', 'preparing', 'pending'].includes(o.status)) {
    return json({ error: '현재 상태에서는 취소할 수 없습니다.' }, 400);
  }
  const items = await db.prepare('SELECT product_id, qty FROM order_items WHERE order_id = ?').bind(o.id).all();
  const stmts: D1PreparedStatement[] = [
    db.prepare("UPDATE orders SET status = 'cancelled', updated_at = datetime('now') WHERE id = ?").bind(o.id),
  ];
  for (const it of items.results as any[]) {
    stmts.push(db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?').bind(it.qty, it.product_id));
  }
  await db.batch(stmts);
  return json({ ok: true, status: 'cancelled' });
});

/* ───────────────────────── 찜 ───────────────────────── */

shop.get('/wishlist', async (c) => {
  const user = await currentUser(c);
  if (!user) return json({ items: [] });
  const rows = await c.env.DB.prepare(
    `SELECT w.product_id, p.name, p.price, p.sale_price, p.thumbnail, p.rating
       FROM wishlist w JOIN products p ON p.id = w.product_id WHERE w.user_id = ? ORDER BY w.id DESC`
  ).bind(user.id).all();
  return json({ items: rows.results });
});

shop.post('/wishlist/:productId', async (c) => {
  const user = await currentUser(c);
  if (!user) return json({ error: '로그인이 필요합니다.' }, 401);
  const pid = Number(c.req.param('productId'));
  const exists: any = await c.env.DB.prepare('SELECT id FROM wishlist WHERE user_id = ? AND product_id = ?')
    .bind(user.id, pid).first();
  if (exists) {
    await c.env.DB.prepare('DELETE FROM wishlist WHERE id = ?').bind(exists.id).run();
    return json({ wished: false });
  }
  await c.env.DB.prepare('INSERT INTO wishlist (user_id, product_id) VALUES (?,?)').bind(user.id, pid).run();
  return json({ wished: true });
});

export default shop;
