import * as adminUsersRepo from '../repository/adminUsers';
import * as sessionsRepo from '../repository/sessions';
import { hashPassword, newToken, verifyPassword } from '../lib/auth';
import { badRequest, unauthorized } from '../lib/http';

/** 관리자 인증 서비스 */

export async function login(db: D1Database, input: { username?: unknown; password?: unknown }) {
  const username = String(input.username || '').trim();
  const password = String(input.password || '');

  const row = await adminUsersRepo.findByUsername(db, username);
  if (!row || !(await verifyPassword(password, row.password_hash))) {
    throw unauthorized('아이디 또는 비밀번호가 올바르지 않습니다.');
  }

  const token = newToken();
  await sessionsRepo.createAdminSession(db, token, row.id);

  return { admin: { id: row.id, username: row.username, name: row.name }, token };
}

export async function logout(db: D1Database, token: string | undefined) {
  if (token) await sessionsRepo.deleteAdminSession(db, token);
}

export async function changePassword(
  db: D1Database,
  admin: any,
  input: { current?: unknown; next?: unknown },
) {
  const row = await adminUsersRepo.findById(db, admin.id);
  if (!row || !(await verifyPassword(String(input.current || ''), row.password_hash))) {
    throw badRequest('현재 비밀번호가 올바르지 않습니다.');
  }

  const next = String(input.next || '');
  if (next.length < 6) throw badRequest('새 비밀번호는 6자 이상이어야 합니다.');

  await adminUsersRepo.updatePassword(db, admin.id, await hashPassword(next));
}
