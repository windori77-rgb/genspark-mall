import type { Row } from './types';
import { Where, pickOrder, type Bind } from '../lib/sql';

/**
 * 상품 매퍼.
 *
 * 정렬 키는 화이트리스트 맵에서만 고른다 (MyBatis `<choose>` 대응).
 * 사용자 입력 `sort` 를 SQL 에 직접 넣는 경로는 존재하지 않는다.
 */
const SORT_MAP: Record<string, string> = {
  popular: 'p.sales_count DESC, p.id DESC',
  new: 'p.id DESC',
  price_asc: 'COALESCE(p.sale_price, p.price) ASC',
  price_desc: 'COALESCE(p.sale_price, p.price) DESC',
  rating: 'p.rating DESC, p.review_count DESC',
};

const LIST_COLUMNS = `p.id, p.name, p.brand, p.summary, p.price, p.sale_price, p.thumbnail, p.badge,
            p.rating, p.review_count, p.sales_count, p.stock, p.shipping_fee, c.name AS category_name, c.slug AS category_slug`;

export type SearchFilter = {
  q?: string;
  category?: string;
  badge?: string;
  sort?: string;
  limit: number;
  page: number;
};

/** 고객 상품 목록 (필터 + 정렬 + 페이지) */
export async function search(db: D1Database, f: SearchFilter): Promise<{ items: Row[]; total: number }> {
  const w = new Where('p.is_active = 1');

  if (f.category) {
    const cat = f.category;
    w.and(true, '(c.slug = ? OR c.id = ?)', cat, Number.isNaN(Number(cat)) ? -1 : Number(cat));
  }
  if (f.q) {
    const like = `%${f.q}%`;
    w.and(true, '(p.name LIKE ? OR p.brand LIKE ? OR p.summary LIKE ?)', like, like, like);
  }
  if (f.badge) w.and(true, 'p.badge = ?', f.badge);

  const orderSql = pickOrder(SORT_MAP, f.sort || 'popular', 'popular');

  const totalRow = await db
    .prepare(`SELECT COUNT(*) AS n FROM products p JOIN categories c ON c.id = p.category_id WHERE ${w.sql}`)
    .bind(...w.params)
    .first<{ n: number }>();

  const offset = (f.page - 1) * f.limit;
  const rows = await db
    .prepare(
      `SELECT ${LIST_COLUMNS}
         FROM products p JOIN categories c ON c.id = p.category_id
        WHERE ${w.sql}
        ORDER BY ${orderSql}
        LIMIT ? OFFSET ?`,
    )
    .bind(...w.params, f.limit, offset)
    .all<Row>();

  return { items: rows.results, total: totalRow?.n || 0 };
}

/** 상품 단건 (카테고리명 포함) */
export async function findDetail(db: D1Database, id: number): Promise<Row | null> {
  return db
    .prepare(
      `SELECT p.*, c.name AS category_name, c.slug AS category_slug
         FROM products p JOIN categories c ON c.id = p.category_id WHERE p.id = ?`,
    )
    .bind(id)
    .first<Row>();
}

/** 같은 카테고리의 다른 상품 (추천) */
export async function listRelated(
  db: D1Database,
  categoryId: number,
  excludeId: number,
  limit = 6,
): Promise<Row[]> {
  const r = await db
    .prepare(
      `SELECT id, name, price, sale_price, thumbnail, rating FROM products
        WHERE category_id = ? AND id != ? AND is_active = 1 ORDER BY sales_count DESC LIMIT ?`,
    )
    .bind(categoryId, excludeId, limit)
    .all<Row>();
  return r.results;
}

/** 주문 가능한(판매중) 상품 */
export async function findActive(db: D1Database, id: number): Promise<Row | null> {
  return db.prepare('SELECT * FROM products WHERE id = ? AND is_active = 1').bind(id).first<Row>();
}

/** 장바구니 추가 시 재고 확인용 (id + stock) */
export async function findStock(db: D1Database, id: number): Promise<{ id: number; stock: number } | null> {
  return db.prepare('SELECT id, stock FROM products WHERE id = ? AND is_active = 1').bind(id).first<{ id: number; stock: number }>();
}

/* ── 관리자용 ───────────────────────────────────────────────────────── */

export type AdminFilter = { q?: string; category?: string; limit?: number };

/** 관리자 상품 목록 (품절 포함 전체) */
export async function adminList(db: D1Database, f: AdminFilter): Promise<Row[]> {
  const w = new Where('1=1');
  if (f.q) {
    const like = `%${f.q}%`;
    w.and(true, '(p.name LIKE ? OR p.brand LIKE ?)', like, like);
  }
  if (f.category) w.and(true, 'p.category_id = ?', Number(f.category));

  const r = await db
    .prepare(
      `SELECT p.*, c.name AS category_name FROM products p LEFT JOIN categories c ON c.id = p.category_id
        WHERE ${w.sql} ORDER BY p.id DESC LIMIT ?`,
    )
    .bind(...w.params, f.limit ?? 300)
    .all<Row>();
  return r.results;
}

export type ProductWriteModel = {
  categoryId: number;
  name: string;
  brand: string;
  summary: string;
  description: string;
  price: number;
  salePrice: number | null;
  thumbnail: string;
  images: string;
  options: string;
  stock: number;
  badge: string;
  shippingFee: number;
  isActive: number;
};

export async function create(db: D1Database, v: ProductWriteModel): Promise<number> {
  const res = await db
    .prepare(
      `INSERT INTO products (category_id, name, brand, summary, description, price, sale_price, thumbnail, images, options, stock, badge, shipping_fee, is_active)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    )
    .bind(
      v.categoryId, v.name, v.brand, v.summary, v.description, v.price, v.salePrice,
      v.thumbnail, v.images, v.options, v.stock, v.badge, v.shippingFee, v.isActive,
    )
    .run();
  return Number((res.meta as any).last_row_id);
}

export async function findById(db: D1Database, id: number): Promise<Row | null> {
  return db.prepare('SELECT * FROM products WHERE id = ?').bind(id).first<Row>();
}

export async function update(db: D1Database, id: number, v: ProductWriteModel): Promise<void> {
  await db
    .prepare(
      `UPDATE products SET category_id=?, name=?, brand=?, summary=?, description=?, price=?, sale_price=?,
         thumbnail=?, images=?, options=?, stock=?, badge=?, shipping_fee=?, is_active=? WHERE id=?`,
    )
    .bind(
      v.categoryId, v.name, v.brand, v.summary, v.description, v.price, v.salePrice,
      v.thumbnail, v.images, v.options, v.stock, v.badge, v.shippingFee, v.isActive, id,
    )
    .run();
}

export async function remove(db: D1Database, id: number): Promise<void> {
  await db.prepare('DELETE FROM products WHERE id = ?').bind(id).run();
}

export async function setStock(db: D1Database, id: number, stock: number): Promise<void> {
  await db.prepare('UPDATE products SET stock = ? WHERE id = ?').bind(stock, id).run();
}

/** 관리자 대시보드: 판매중 상품 수 / 재고 부족 / 판매 상위 */
export async function countActive(db: D1Database): Promise<number> {
  const r = await db.prepare('SELECT COUNT(*) n FROM products WHERE is_active = 1').first<{ n: number }>();
  return r?.n || 0;
}

export async function listLowStock(db: D1Database, threshold = 20, limit = 8): Promise<Row[]> {
  const r = await db
    .prepare('SELECT id, name, stock FROM products WHERE stock <= ? AND is_active = 1 ORDER BY stock ASC LIMIT ?')
    .bind(threshold, limit)
    .all<Row>();
  return r.results;
}

export async function listTopSellers(db: D1Database, limit = 5): Promise<Row[]> {
  const r = await db
    .prepare('SELECT id, name, sales_count, thumbnail FROM products ORDER BY sales_count DESC LIMIT ?')
    .bind(limit)
    .all<Row>();
  return r.results;
}

/** 시드 여부 판별용 (products 가 비었는가) */
export async function isEmpty(db: D1Database): Promise<boolean> {
  const r = await db.prepare('SELECT COUNT(*) AS n FROM products').first<{ n: number }>();
  return !r || Number(r.n) === 0;
}

export type { Bind };
