import * as addressesRepo from '../repository/addresses';
import { badRequest, unauthorized } from '../lib/http';

/** 배송지 서비스 */

export async function list(db: D1Database, user: any) {
  if (!user) return { items: [] };
  return { items: await addressesRepo.listByUser(db, user.id) };
}

export async function create(db: D1Database, user: any, b: any) {
  if (!user) throw unauthorized('로그인이 필요합니다.');
  if (!b.receiver || !b.phone || !b.addr1) {
    throw badRequest('받는분, 연락처, 주소를 입력해주세요.');
  }

  const isDefault = b.isDefault ? 1 : 0;
  if (isDefault) await addressesRepo.clearDefault(db, user.id);

  await addressesRepo.insert(db, {
    userId: user.id,
    label: String(b.label || '기본 배송지'),
    receiver: b.receiver,
    phone: b.phone,
    zipcode: String(b.zipcode || ''),
    addr1: b.addr1,
    addr2: String(b.addr2 || ''),
    isDefault,
  });

  return { ok: true, items: await addressesRepo.listByUser(db, user.id) };
}
