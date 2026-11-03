import * as productsRepo from '../repository/products';
import { badRequest, notFound } from '../lib/http';
import { parseJsonList } from '../lib/sql';

/** 관리자 상품 관리 서비스 */

export async function list(db: D1Database, f: { q?: string; category?: string }) {
  const rows = await productsRepo.adminList(db, { q: f.q, category: f.category, limit: 300 });
  return {
    items: rows.map((p) => ({
      ...p,
      images: parseJsonList(p.images),
      options: parseJsonList(p.options),
    })),
  };
}

/** 요청 바디 → 저장 모델 변환 (신규 등록) */
function toNewModel(b: any): productsRepo.ProductWriteModel {
  return {
    categoryId: Number(b.categoryId || 1),
    name: b.name,
    brand: String(b.brand || ''),
    summary: String(b.summary || ''),
    description: String(b.description || ''),
    price: Number(b.price || 0),
    salePrice: b.salePrice ? Number(b.salePrice) : null,
    thumbnail: String(b.thumbnail || ''),
    images: JSON.stringify(b.images || []),
    options: JSON.stringify(b.options || []),
    stock: Number(b.stock || 0),
    badge: String(b.badge || ''),
    shippingFee: Number(b.shippingFee || 0),
    isActive: b.isActive === false ? 0 : 1,
  };
}

export async function create(db: D1Database, b: any) {
  if (!b.name) throw badRequest('상품명은 필수입니다.');
  const id = await productsRepo.create(db, toNewModel(b));
  return { id };
}

/** 기존 값 기준으로 누락 필드를 채우는 병합 저장 */
export async function update(db: D1Database, id: number, b: any) {
  const cur = await productsRepo.findById(db, id);
  if (!cur) throw notFound('상품이 없습니다.');

  // salePrice 는 '' / null 이면 "할인 없음"으로 명시적 해제한다
  const salePrice =
    b.salePrice === '' || b.salePrice === null
      ? null
      : Number(b.salePrice ?? cur.sale_price);

  await productsRepo.update(db, id, {
    categoryId: Number(b.categoryId ?? cur.category_id),
    name: b.name ?? cur.name,
    brand: b.brand ?? cur.brand,
    summary: b.summary ?? cur.summary,
    description: b.description ?? cur.description,
    price: Number(b.price ?? cur.price),
    salePrice: salePrice === null || Number.isNaN(salePrice) ? null : salePrice,
    thumbnail: b.thumbnail ?? cur.thumbnail,
    images: JSON.stringify(b.images ?? parseJsonList(cur.images)),
    options: JSON.stringify(b.options ?? parseJsonList(cur.options)),
    stock: Number(b.stock ?? cur.stock),
    badge: b.badge ?? cur.badge,
    shippingFee: Number(b.shippingFee ?? cur.shipping_fee),
    isActive: b.isActive === false ? 0 : 1,
  });
}

export async function remove(db: D1Database, id: number) {
  await productsRepo.remove(db, id);
}

export async function setStock(db: D1Database, id: number, rawStock: unknown) {
  await productsRepo.setStock(db, id, Math.max(Number(rawStock || 0), 0));
}
