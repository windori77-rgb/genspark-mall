import * as usersRepo from '../repository/users';
import * as sessionsRepo from '../repository/sessions';
import { hashPassword, verifyPassword, newToken } from '../lib/auth';
import { badRequest, conflict, unauthorized } from '../lib/http';
import { mergeGuestCart } from './cart';

/**
 * 회원 서비스 — 가입 / 로그인 / 프로필.
 * HTTP 를 모른다: 쿠키 설정은 라우트가 한다.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type RegisterInput = {
  email?: unknown;
  password?: unknown;
  name?: unknown;
  phone?: unknown;
  marketing?: unknown;
};

export async function register(db: D1Database, input: RegisterInput, guestKey: string | null) {
  const email = String(input.email || '').trim().toLowerCase();
  const password = String(input.password || '');
  const name = String(input.name || '').trim();
  const phone = String(input.phone || '');

  if (!EMAIL_RE.test(email)) throw badRequest('이메일 형식이 올바르지 않습니다.');
  if (password.length < 6) throw badRequest('비밀번호는 6자 이상이어야 합니다.');
  if (!name) throw badRequest('이름을 입력해주세요.');

  if (await usersRepo.existsByEmail(db, email)) throw conflict('이미 가입된 이메일입니다.');

  const userId = await usersRepo.insert(db, {
    email,
    passwordHash: await hashPassword(password),
    name,
    phone,
    marketing: input.marketing ? 1 : 0,
  });

  // 비회원 장바구니가 있으면 회원 장바구니로 흡수
  if (guestKey) await mergeGuestCart(db, guestKey, userId);

  const token = newToken();
  await sessionsRepo.createUserSession(db, token, userId);

  return { user: { id: userId, email, name, phone }, token };
}

export async function login(db: D1Database, input: { email?: unknown; password?: unknown }, guestKey: string | null) {
  const email = String(input.email || '').trim().toLowerCase();
  const password = String(input.password || '');

  const u = await usersRepo.findByEmail(db, email);
  // 사용자 없음/비밀번호 불일치를 같은 메시지로 응답 (계정 존재 여부 노출 방지)
  if (!u || !(await verifyPassword(password, u.password_hash))) {
    throw unauthorized('이메일 또는 비밀번호가 올바르지 않습니다.');
  }

  if (guestKey) await mergeGuestCart(db, guestKey, u.id);

  const token = newToken();
  await sessionsRepo.createUserSession(db, token, u.id);

  return { user: { id: u.id, email: u.email, name: u.name, phone: u.phone }, token };
}

export async function logout(db: D1Database, token: string | undefined) {
  if (token) await sessionsRepo.deleteUserSession(db, token);
}

/** 마이페이지 요약 (배지 카운트 포함) */
export async function me(db: D1Database, user: any) {
  const counts = await usersRepo.countsFor(db, user.id);
  return { user, counts };
}

export async function updateProfile(db: D1Database, user: any, body: any) {
  await usersRepo.updateProfile(db, user.id, {
    name: body.name ?? user.name,
    phone: body.phone ?? user.phone,
  });
}
