import * as couponsRepo from '../repository/coupons';
import * as bannersRepo from '../repository/banners';
import * as categoriesRepo from '../repository/categories';
import * as reviewsRepo from '../repository/reviews';
import * as settingsRepo from '../repository/settings';
import { badRequest, conflict, notFound } from '../lib/http';

/* ───────────── 쿠폰 ───────────── */

export async function listCoupons(db: D1Database) {
  return { items: await couponsRepo.listAll(db) };
}

export async function createCoupon(db: D1Database, b: any) {
  if (!b.code || !b.name) throw badRequest('쿠폰 코드와 이름은 필수입니다.');
  try {
    await couponsRepo.insert(db, {
      code: String(b.code).toUpperCase(),
      name: b.name,
      type: b.type || 'amount',
      value: Number(b.value || 0),
      minOrder: Number(b.minOrder || 0),
      maxDiscount: Number(b.maxDiscount || 0),
      expiresAt: String(b.expiresAt || '2027-12-31'),
      totalCount: Number(b.totalCount || 0),
    });
  } catch {
    // UNIQUE(code) 위반 → 사용자에게 의미 있는 메시지로 변환
    throw conflict('이미 존재하는 쿠폰 코드입니다.');
  }
}

export async function setCouponActive(db: D1Database, id: number, b: any) {
  const cur = await couponsRepo.findById(db, id);
  if (!cur) throw notFound('쿠폰이 없습니다.');
  await couponsRepo.setActive(db, id, b.isActive === false || b.isActive === 0 ? 0 : 1);
}

export async function removeCoupon(db: D1Database, id: number) {
  await couponsRepo.remove(db, id);
}

/* ───────────── 배너 ───────────── */

export async function listBanners(db: D1Database) {
  return { items: await bannersRepo.listAll(db) };
}

export async function createBanner(db: D1Database, b: any) {
  if (!b.title) throw badRequest('배너 제목은 필수입니다.');
  await bannersRepo.insert(db, {
    title: b.title,
    subtitle: String(b.subtitle || ''),
    image: String(b.image || ''),
    bg: String(b.bg || '#111827'),
    link: String(b.link || '/'),
    sortOrder: Number(b.sortOrder || 0),
  });
}

export async function updateBanner(db: D1Database, id: number, b: any) {
  const cur = await bannersRepo.findById(db, id);
  if (!cur) throw notFound('배너가 없습니다.');
  await bannersRepo.update(db, id, {
    title: b.title ?? cur.title,
    subtitle: b.subtitle ?? cur.subtitle,
    image: b.image ?? cur.image,
    bg: b.bg ?? cur.bg,
    link: b.link ?? cur.link,
    sortOrder: Number(b.sortOrder ?? cur.sort_order),
    isActive: b.isActive === false || b.isActive === 0 ? 0 : 1,
  });
}

export async function removeBanner(db: D1Database, id: number) {
  await bannersRepo.remove(db, id);
}

/* ───────────── 카테고리 ───────────── */

export async function listCategories(db: D1Database) {
  return { items: await categoriesRepo.listWithCount(db) };
}

export async function createCategory(db: D1Database, b: any) {
  if (!b.name || !b.slug) throw badRequest('이름과 슬러그는 필수입니다.');
  await categoriesRepo.insert(db, {
    name: b.name,
    slug: b.slug,
    icon: String(b.icon || '🛍️'),
    sortOrder: Number(b.sortOrder || 99),
  });
}

/* ───────────── 리뷰 ───────────── */

export async function listReviews(db: D1Database) {
  return { items: await reviewsRepo.adminList(db, 200) };
}

/** 리뷰 삭제 후 상품 평점/리뷰수 재계산 */
export async function removeReview(db: D1Database, id: number) {
  const r = await reviewsRepo.findById(db, id);
  if (r) {
    await reviewsRepo.remove(db, id);
    await reviewsRepo.refreshProductRating(db, r.product_id);
  }
}

/* ───────────── 설정 ───────────── */

export async function getSettings(db: D1Database) {
  return { settings: await settingsRepo.asMap(db) };
}

export async function saveSettings(db: D1Database, body: any) {
  const entries: [string, string][] = Object.entries(body || {}).map(([k, v]) => [k, String(v)]);
  await settingsRepo.upsertMany(db, entries);
}
