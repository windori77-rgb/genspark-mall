import { Hono } from 'hono';
import { ensureDb, json } from '../lib/db';
import {
  currentAdmin, setAdminSession, clearAdminSession, verifyPassword, hashPassword, newToken, ADMIN_COOKIE,
} from '../lib/auth';
import { getCookie } from 'hono/cookie';
import { ORDER_STATUSES } from '../lib/schema';

const admin = new Hono<any>();

admin.use('*', async (c, next) => {
  await ensureDb(c.env.DB);
  await next();
});

/* 로그인 / 로그아웃 / 세션 */
admin.post('/login', async (c) => {
  const b = await c.req.json().catch(() => ({}));
  const username = String(b.username || '').trim();
  const password = String(b.password || '');
  const row: any = await c.env.DB.prepare('SELECT * FROM admin_users WHERE username = ?').bind(username).first();
  if (!row || !(await verifyPassword(password, row.password_hash))) {
    return json({ error: '아이디 또는 비밀번호가 올바르지 않습니다.' }, 401);
  }
  const token = newToken();
  await c.env.DB.prepare("INSERT INTO admin_sessions (token, admin_id, expires_at) VALUES (?,?,datetime('now','+12 hours'))")
    .bind(token, row.id).run();
  setAdminSession(c, token);
  return json({ admin: { id: row.id, username: row.username, name: row.name } });
});

admin.post('/logout', async (c) => {
  const token = getCookie(c, ADMIN_COOKIE);
  if (token) await c.env.DB.prepare('DELETE FROM admin_sessions WHERE token = ?').bind(token).run();
  clearAdminSession(c);
  return json({ ok: true });
});

admin.get('/me', async (c) => {
  const a = await currentAdmin(c);
  return json({ admin: a });
});

/* 인증 가드 */
admin.use('*', async (c, next) => {
  const path = c.req.path.replace(/^\/api\/admin/, '');
  if (['/login', '/logout', '/me'].includes(path)) return next();
  const a = await currentAdmin(c);
  if (!a) return json({ error: '관리자 로그인이 필요합니다.' }, 401);
  c.set('admin', a);
  await next();
});

/* ───────────── 대시보드 ───────────── */
admin.get('/dashboard', async (c) => {
  const db = c.env.DB;
  const [today, week, month, users, products, lowStock, statusRows, recentOrders, topProducts, daily] = await Promise.all([
    db.prepare("SELECT COUNT(*) n, COALESCE(SUM(total),0) amount FROM orders WHERE date(created_at) = date('now') AND status NOT IN ('cancelled','refunded')").first(),
    db.prepare("SELECT COUNT(*) n, COALESCE(SUM(total),0) amount FROM orders WHERE created_at >= datetime('now','-7 days') AND status NOT IN ('cancelled','refunded')").first(),
    db.prepare("SELECT COUNT(*) n, COALESCE(SUM(total),0) amount FROM orders WHERE created_at >= datetime('now','-30 days') AND status NOT IN ('cancelled','refunded')").first(),
    db.prepare('SELECT COUNT(*) n FROM users').first(),
    db.prepare('SELECT COUNT(*) n FROM products WHERE is_active = 1').first(),
    db.prepare('SELECT id, name, stock FROM products WHERE stock <= 20 AND is_active = 1 ORDER BY stock ASC LIMIT 8').all(),
    db.prepare('SELECT status, COUNT(*) n FROM orders GROUP BY status').all(),
    db.prepare(`SELECT o.id, o.order_no, o.orderer_name, o.total, o.status, o.created_at,
                       (SELECT name FROM order_items WHERE order_id = o.id LIMIT 1) AS first_item
                  FROM orders o ORDER BY o.id DESC LIMIT 8`).all(),
    db.prepare(`SELECT id, name, sales_count, thumbnail FROM products ORDER BY sales_count DESC LIMIT 5`).all(),
    db.prepare(`SELECT date(created_at) d, COUNT(*) n, COALESCE(SUM(total),0) amount
                  FROM orders WHERE created_at >= datetime('now','-13 days') AND status NOT IN ('cancelled','refunded')
                 GROUP BY date(created_at) ORDER BY d`).all(),
  ]);

  return json({
    today: today || { n: 0, amount: 0 },
    week: week || { n: 0, amount: 0 },
    month: month || { n: 0, amount: 0 },
    users: (users as any)?.n || 0,
    products: (products as any)?.n || 0,
    lowStock: lowStock.results,
    statusCounts: statusRows.results,
    recentOrders: (recentOrders.results as any[]).map((o) => ({ ...o, statusLabel: ORDER_STATUSES[o.status] || o.status })),
    topProducts: topProducts.results,
    daily: daily.results,
  });
});

/* ───────────── 상품 ───────────── */
admin.get('/products', async (c) => {
  const q = (c.req.query('q') || '').trim();
  const cat = c.req.query('category') || '';
  const where: string[] = ['1=1'];
  const binds: any[] = [];
  if (q) { where.push('(p.name LIKE ? OR p.brand LIKE ?)'); binds.push(`%${q}%`, `%${q}%`); }
  if (cat) { where.push('p.category_id = ?'); binds.push(Number(cat)); }
  const rows = await c.env.DB.prepare(
    `SELECT p.*, c.name AS category_name FROM products p LEFT JOIN categories c ON c.id = p.category_id
      WHERE ${where.join(' AND ')} ORDER BY p.id DESC LIMIT 300`
  ).bind(...binds).all();
  return json({
    items: (rows.results as any[]).map((p) => ({
      ...p, images: JSON.parse(p.images || '[]'), options: JSON.parse(p.options || '[]'),
    })),
  });
});

admin.post('/products', async (c) => {
  const b = await c.req.json().catch(() => ({}));
  if (!b.name) return json({ error: '상품명은 필수입니다.' }, 400);
  const res = await c.env.DB.prepare(
    `INSERT INTO products (category_id, name, brand, summary, description, price, sale_price, thumbnail, images, options, stock, badge, shipping_fee, is_active)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).bind(
    Number(b.categoryId || 1), b.name, String(b.brand || ''), String(b.summary || ''), String(b.description || ''),
    Number(b.price || 0), b.salePrice ? Number(b.salePrice) : null, String(b.thumbnail || ''),
    JSON.stringify(b.images || []), JSON.stringify(b.options || []), Number(b.stock || 0),
    String(b.badge || ''), Number(b.shippingFee || 0), b.isActive === false ? 0 : 1
  ).run();
  return json({ id: Number((res.meta as any).last_row_id) });
});

admin.put('/products/:id', async (c) => {
  const id = Number(c.req.param('id'));
  const b = await c.req.json().catch(() => ({}));
  const cur: any = await c.env.DB.prepare('SELECT * FROM products WHERE id = ?').bind(id).first();
  if (!cur) return json({ error: '상품이 없습니다.' }, 404);
  await c.env.DB.prepare(
    `UPDATE products SET category_id=?, name=?, brand=?, summary=?, description=?, price=?, sale_price=?,
       thumbnail=?, images=?, options=?, stock=?, badge=?, shipping_fee=?, is_active=? WHERE id=?`
  ).bind(
    Number(b.categoryId ?? cur.category_id), b.name ?? cur.name, b.brand ?? cur.brand, b.summary ?? cur.summary,
    b.description ?? cur.description, Number(b.price ?? cur.price),
    b.salePrice === '' || b.salePrice === null ? null : Number(b.salePrice ?? cur.sale_price),
    b.thumbnail ?? cur.thumbnail, JSON.stringify(b.images ?? JSON.parse(cur.images || '[]')),
    JSON.stringify(b.options ?? JSON.parse(cur.options || '[]')), Number(b.stock ?? cur.stock),
    b.badge ?? cur.badge, Number(b.shippingFee ?? cur.shipping_fee), b.isActive === false ? 0 : 1, id
  ).run();
  return json({ ok: true });
});

admin.delete('/products/:id', async (c) => {
  await c.env.DB.prepare('DELETE FROM products WHERE id = ?').bind(Number(c.req.param('id'))).run();
  return json({ ok: true });
});

admin.patch('/products/:id/stock', async (c) => {
  const b = await c.req.json().catch(() => ({}));
  await c.env.DB.prepare('UPDATE products SET stock = ? WHERE id = ?')
    .bind(Math.max(Number(b.stock || 0), 0), Number(c.req.param('id'))).run();
  return json({ ok: true });
});

/* ───────────── 주문 ───────────── */
admin.get('/orders', async (c) => {
  const status = c.req.query('status') || '';
  const q = (c.req.query('q') || '').trim();
  const where: string[] = ['1=1'];
  const binds: any[] = [];
  if (status) { where.push('o.status = ?'); binds.push(status); }
  if (q) { where.push('(o.order_no LIKE ? OR o.orderer_name LIKE ? OR o.receiver LIKE ?)'); binds.push(`%${q}%`, `%${q}%`, `%${q}%`); }
  const rows = await c.env.DB.prepare(
    `SELECT o.*, (SELECT COUNT(*) FROM order_items WHERE order_id = o.id) AS item_count
       FROM orders o WHERE ${where.join(' AND ')} ORDER BY o.id DESC LIMIT 200`
  ).bind(...binds).all();
  return json({
    items: (rows.results as any[]).map((o) => ({ ...o, statusLabel: ORDER_STATUSES[o.status] || o.status })),
  });
});

admin.get('/orders/:id', async (c) => {
  const id = Number(c.req.param('id'));
  const o: any = await c.env.DB.prepare('SELECT * FROM orders WHERE id = ?').bind(id).first();
  if (!o) return json({ error: '주문이 없습니다.' }, 404);
  const items = await c.env.DB.prepare('SELECT * FROM order_items WHERE order_id = ?').bind(id).all();
  return json({ order: { ...o, statusLabel: ORDER_STATUSES[o.status] || o.status, items: items.results } });
});

admin.patch('/orders/:id', async (c) => {
  const id = Number(c.req.param('id'));
  const b = await c.req.json().catch(() => ({}));
  const cur: any = await c.env.DB.prepare('SELECT * FROM orders WHERE id = ?').bind(id).first();
  if (!cur) return json({ error: '주문이 없습니다.' }, 404);

  const nextStatus = b.status ? String(b.status) : cur.status;
  // 취소 전환 시 재고 복구
  if (nextStatus === 'cancelled' && cur.status !== 'cancelled') {
    const items = await c.env.DB.prepare('SELECT product_id, qty FROM order_items WHERE order_id = ?').bind(id).all();
    const stmts: D1PreparedStatement[] = [];
    for (const it of items.results as any[]) {
      stmts.push(c.env.DB.prepare('UPDATE products SET stock = stock + ? WHERE id = ?').bind(it.qty, it.product_id));
    }
    if (stmts.length) await c.env.DB.batch(stmts);
  }

  await c.env.DB.prepare("UPDATE orders SET status = ?, admin_memo = ?, updated_at = datetime('now') WHERE id = ?")
    .bind(nextStatus, b.adminMemo ?? cur.admin_memo, id).run();
  return json({ ok: true, status: nextStatus, statusLabel: ORDER_STATUSES[nextStatus] || nextStatus });
});

/* ───────────── 회원 ───────────── */
admin.get('/users', async (c) => {
  const q = (c.req.query('q') || '').trim();
  const where = q ? 'WHERE u.email LIKE ? OR u.name LIKE ?' : '';
  const binds = q ? [`%${q}%`, `%${q}%`] : [];
  const rows = await c.env.DB.prepare(
    `SELECT u.id, u.email, u.name, u.phone, u.marketing_agree, u.created_at,
            (SELECT COUNT(*) FROM orders WHERE user_id = u.id) AS order_count,
            (SELECT COALESCE(SUM(total),0) FROM orders WHERE user_id = u.id AND status NOT IN ('cancelled','refunded')) AS total_spent
       FROM users u ${where} ORDER BY u.id DESC LIMIT 300`
  ).bind(...binds).all();
  return json({ items: rows.results });
});

/* ───────────── 쿠폰 ───────────── */
admin.get('/coupons', async (c) => {
  const rows = await c.env.DB.prepare('SELECT * FROM coupons ORDER BY id DESC').all();
  return json({ items: rows.results });
});

admin.post('/coupons', async (c) => {
  const b = await c.req.json().catch(() => ({}));
  if (!b.code || !b.name) return json({ error: '쿠폰 코드와 이름은 필수입니다.' }, 400);
  try {
    await c.env.DB.prepare(
      'INSERT INTO coupons (code, name, type, value, min_order, max_discount, expires_at, total_count, is_active) VALUES (?,?,?,?,?,?,?,?,1)'
    ).bind(
      String(b.code).toUpperCase(), b.name, b.type || 'amount', Number(b.value || 0),
      Number(b.minOrder || 0), Number(b.maxDiscount || 0), String(b.expiresAt || '2027-12-31'), Number(b.totalCount || 0)
    ).run();
  } catch (e: any) {
    return json({ error: '이미 존재하는 쿠폰 코드입니다.' }, 409);
  }
  return json({ ok: true });
});

admin.patch('/coupons/:id', async (c) => {
  const b = await c.req.json().catch(() => ({}));
  const cur: any = await c.env.DB.prepare('SELECT * FROM coupons WHERE id = ?').bind(Number(c.req.param('id'))).first();
  if (!cur) return json({ error: '쿠폰이 없습니다.' }, 404);
  await c.env.DB.prepare('UPDATE coupons SET is_active = ? WHERE id = ?')
    .bind(b.isActive === false || b.isActive === 0 ? 0 : 1, cur.id).run();
  return json({ ok: true });
});

admin.delete('/coupons/:id', async (c) => {
  await c.env.DB.prepare('DELETE FROM coupons WHERE id = ?').bind(Number(c.req.param('id'))).run();
  return json({ ok: true });
});

/* ───────────── 배너 ───────────── */
admin.get('/banners', async (c) => {
  const rows = await c.env.DB.prepare('SELECT * FROM banners ORDER BY sort_order, id').all();
  return json({ items: rows.results });
});

admin.post('/banners', async (c) => {
  const b = await c.req.json().catch(() => ({}));
  if (!b.title) return json({ error: '배너 제목은 필수입니다.' }, 400);
  await c.env.DB.prepare(
    'INSERT INTO banners (title, subtitle, image, bg, link, sort_order, is_active) VALUES (?,?,?,?,?,?,1)'
  ).bind(b.title, String(b.subtitle || ''), String(b.image || ''), String(b.bg || '#111827'), String(b.link || '/'), Number(b.sortOrder || 0)).run();
  return json({ ok: true });
});

admin.patch('/banners/:id', async (c) => {
  const b = await c.req.json().catch(() => ({}));
  const cur: any = await c.env.DB.prepare('SELECT * FROM banners WHERE id = ?').bind(Number(c.req.param('id'))).first();
  if (!cur) return json({ error: '배너가 없습니다.' }, 404);
  await c.env.DB.prepare(
    'UPDATE banners SET title=?, subtitle=?, image=?, bg=?, link=?, sort_order=?, is_active=? WHERE id=?'
  ).bind(
    b.title ?? cur.title, b.subtitle ?? cur.subtitle, b.image ?? cur.image, b.bg ?? cur.bg,
    b.link ?? cur.link, Number(b.sortOrder ?? cur.sort_order),
    b.isActive === false || b.isActive === 0 ? 0 : 1, cur.id
  ).run();
  return json({ ok: true });
});

admin.delete('/banners/:id', async (c) => {
  await c.env.DB.prepare('DELETE FROM banners WHERE id = ?').bind(Number(c.req.param('id'))).run();
  return json({ ok: true });
});

/* ───────────── 카테고리 ───────────── */
admin.get('/categories', async (c) => {
  const rows = await c.env.DB.prepare(
    'SELECT c.*, (SELECT COUNT(*) FROM products WHERE category_id = c.id) AS product_count FROM categories c ORDER BY sort_order'
  ).all();
  return json({ items: rows.results });
});

admin.post('/categories', async (c) => {
  const b = await c.req.json().catch(() => ({}));
  if (!b.name || !b.slug) return json({ error: '이름과 슬러그는 필수입니다.' }, 400);
  await c.env.DB.prepare('INSERT INTO categories (name, slug, icon, sort_order, is_active) VALUES (?,?,?,?,1)')
    .bind(b.name, b.slug, String(b.icon || '🛍️'), Number(b.sortOrder || 99)).run();
  return json({ ok: true });
});

/* ───────────── 리뷰 ───────────── */
admin.get('/reviews', async (c) => {
  const rows = await c.env.DB.prepare(
    `SELECT r.*, p.name AS product_name FROM reviews r LEFT JOIN products p ON p.id = r.product_id
      ORDER BY r.id DESC LIMIT 200`
  ).all();
  return json({ items: rows.results });
});

admin.delete('/reviews/:id', async (c) => {
  const id = Number(c.req.param('id'));
  const r: any = await c.env.DB.prepare('SELECT product_id FROM reviews WHERE id = ?').bind(id).first();
  if (r) {
    await c.env.DB.prepare('DELETE FROM reviews WHERE id = ?').bind(id).run();
    await c.env.DB.prepare(
      `UPDATE products SET review_count = (SELECT COUNT(*) FROM reviews WHERE product_id = ?),
         rating = COALESCE((SELECT ROUND(AVG(rating),1) FROM reviews WHERE product_id = ?), 0) WHERE id = ?`
    ).bind(r.product_id, r.product_id, r.product_id).run();
  }
  return json({ ok: true });
});

/* ───────────── 설정 ───────────── */
admin.get('/settings', async (c) => {
  const rows = await c.env.DB.prepare('SELECT key, value FROM settings').all();
  const conf: Record<string, string> = {};
  for (const r of rows.results as any[]) conf[r.key] = r.value;
  return json({ settings: conf });
});

admin.put('/settings', async (c) => {
  const b = await c.req.json().catch(() => ({}));
  const stmts: D1PreparedStatement[] = [];
  for (const [k, v] of Object.entries(b)) {
    stmts.push(c.env.DB.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?,?)').bind(k, String(v)));
  }
  if (stmts.length) await c.env.DB.batch(stmts);
  return json({ ok: true });
});

/* ───────────── 비밀번호 변경 ───────────── */
admin.post('/password', async (c) => {
  const a: any = c.get('admin');
  const b = await c.req.json().catch(() => ({}));
  const row: any = await c.env.DB.prepare('SELECT * FROM admin_users WHERE id = ?').bind(a.id).first();
  if (!row || !(await verifyPassword(String(b.current || ''), row.password_hash))) {
    return json({ error: '현재 비밀번호가 올바르지 않습니다.' }, 400);
  }
  if (String(b.next || '').length < 6) return json({ error: '새 비밀번호는 6자 이상이어야 합니다.' }, 400);
  await c.env.DB.prepare('UPDATE admin_users SET password_hash = ? WHERE id = ?')
    .bind(await hashPassword(String(b.next)), a.id).run();
  return json({ ok: true });
});

export default admin;
