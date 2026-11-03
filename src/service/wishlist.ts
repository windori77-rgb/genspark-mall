import * as wishlistRepo from '../repository/wishlist';
import { unauthorized } from '../lib/http';

/** 찜(위시리스트) 서비스 — 토글 방식 */

export async function list(db: D1Database, user: any) {
  if (!user) return { items: [] };
  return { items: await wishlistRepo.listByUser(db, user.id) };
}

/** 찜 추가/해제 토글 → 최종 상태 반환 */
export async function toggle(db: D1Database, user: any, productId: number) {
  if (!user) throw unauthorized('로그인이 필요합니다.');

  const exists = await wishlistRepo.find(db, user.id, productId);
  if (exists) {
    await wishlistRepo.remove(db, exists.id);
    return { wished: false };
  }

  await wishlistRepo.insert(db, user.id, productId);
  return { wished: true };
}
