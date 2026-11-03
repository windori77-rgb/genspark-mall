import * as settingsRepo from '../repository/settings';
import * as categoriesRepo from '../repository/categories';
import * as bannersRepo from '../repository/banners';
import * as noticesRepo from '../repository/notices';
import * as productsRepo from '../repository/products';
import * as reviewsRepo from '../repository/reviews';
import { ORDER_STATUSES } from '../lib/schema';
import { notFound } from '../lib/http';
import { parseJsonList, toLimit, toPage } from '../lib/sql';

/**
 * 카탈로그 서비스 — 앱 부트스트랩 데이터와 상품 조회.
 * 고객 화면이 처음 뜰 때 필요한 것을 한 번에 내려준다.
 */

/** 앱 초기 설정 + 카테고리 + 배너 + 공지 (4개 조회를 병렬로) */
export async function config(db: D1Database) {
  const [settings, categories, banners, notices] = await Promise.all([
    settingsRepo.asMap(db),
    categoriesRepo.listActive(db),
    bannersRepo.listActive(db),
    noticesRepo.listRecent(db, 5),
  ]);
  return { settings, categories, banners, notices, statuses: ORDER_STATUSES };
}

export type ProductSearchInput = {
  q?: string;
  category?: string;
  sort?: string;
  badge?: string;
  limit?: string;
  page?: string;
};

/** 상품 목록 (필터·정렬·페이지네이션) */
export async function searchProducts(db: D1Database, input: ProductSearchInput) {
  const page = toPage(input.page, 1);
  const limit = toLimit(input.limit, 20, 60);

  const { items, total } = await productsRepo.search(db, {
    q: (input.q || '').trim() || undefined,
    category: input.category || undefined,
    badge: input.badge || undefined,
    sort: input.sort || 'popular',
    limit,
    page,
  });

  return { items, total, page, limit, hasMore: total > page * limit };
}

/** 상품 상세 + 리뷰 + 추천 상품 */
export async function productDetail(db: D1Database, rawId: string) {
  const id = Number(rawId);
  if (!Number.isFinite(id)) throw notFound('상품을 찾을 수 없습니다.');

  const p = await productsRepo.findDetail(db, id);
  if (!p) throw notFound('상품을 찾을 수 없습니다.');

  const [reviews, related] = await Promise.all([
    reviewsRepo.listByProduct(db, id, 20),
    productsRepo.listRelated(db, p.category_id, id, 6),
  ]);

  return {
    product: {
      ...p,
      // TEXT 컬럼에 JSON 문자열로 저장된 값 — 깨져 있어도 [] 로 복원
      images: parseJsonList(p.images),
      options: parseJsonList(p.options),
    },
    reviews,
    related,
  };
}
