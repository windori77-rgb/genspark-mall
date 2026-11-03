import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import type { Context } from 'hono';
import * as sessionsRepo from '../repository/sessions';

/**
 * 인증 유틸 — 쿠키/해시 담당.
 *
 * ⚠️ 계층 규칙: 이 파일에는 **SQL 이 없다**. 세션 조회는
 *    repository/sessions.ts 에 위임한다. (3계층 분리)
 */

const enc = new TextEncoder();

function b64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function randomToken(bytes = 24): string {
  const arr = crypto.getRandomValues(new Uint8Array(bytes));
  return Array.from(arr).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function hashPassword(password: string, salt?: string): Promise<string> {
  const s = salt || randomToken(8);
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: enc.encode(s), iterations: 12000, hash: 'SHA-256' },
    key,
    256,
  );
  return `${s}$${b64(bits)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const salt = stored.split('$')[0];
  const candidate = await hashPassword(password, salt);
  if (candidate.length !== stored.length) return false;
  // 타이밍 공격 완화 — 길이가 같으면 전 구간을 비교한다
  let diff = 0;
  for (let i = 0; i < candidate.length; i++) diff |= candidate.charCodeAt(i) ^ stored.charCodeAt(i);
  return diff === 0;
}

export const SESSION_COOKIE = 'moa_sid';
export const CART_COOKIE = 'moa_cart';
export const ADMIN_COOKIE = 'moa_admin';

export function cookieOpts(maxAge: number) {
  return { path: '/', httpOnly: true, sameSite: 'Lax' as const, maxAge, secure: true };
}

export function setSession(c: Context, token: string) {
  setCookie(c, SESSION_COOKIE, token, cookieOpts(60 * 60 * 24 * 30));
}
export function clearSession(c: Context) {
  deleteCookie(c, SESSION_COOKIE, { path: '/' });
}
export function setAdminSession(c: Context, token: string) {
  setCookie(c, ADMIN_COOKIE, token, cookieOpts(60 * 60 * 12));
}
export function clearAdminSession(c: Context) {
  deleteCookie(c, ADMIN_COOKIE, { path: '/' });
}

/** 로그인 사용자 조회 (없으면 null) — SQL 은 sessions 저장소가 담당 */
export async function currentUser(c: Context): Promise<any | null> {
  const token = getCookie(c, SESSION_COOKIE);
  if (!token) return null;
  return sessionsRepo.findUserByToken((c.env as any).DB, token);
}

/** 로그인 관리자 조회 (없으면 null) */
export async function currentAdmin(c: Context): Promise<any | null> {
  const token = getCookie(c, ADMIN_COOKIE);
  if (!token) return null;
  return sessionsRepo.findAdminByToken((c.env as any).DB, token);
}

/** 비로그인 장바구니 식별키 (없으면 발급) */
export function cartKey(c: Context): string {
  let key = getCookie(c, CART_COOKIE);
  if (!key) {
    key = randomToken(12);
    setCookie(c, CART_COOKIE, key, cookieOpts(60 * 60 * 24 * 180));
  }
  return key;
}

/** 현재 요청의 장바구니 키. 로그인 했으면 회원 키, 아니면 비회원 키 */
export function resolveCartKey(c: Context, user: any | null): string {
  if (user) return `u:${user.id}`;
  return `g:${cartKey(c)}`;
}

/** 비회원 쿠키의 장바구니 키 (로그인/가입 시 병합용, 없으면 null) */
export function guestCartKey(c: Context): string | null {
  const g = getCookie(c, CART_COOKIE);
  return g ? `g:${g}` : null;
}

export function newToken(): string {
  return randomToken(24);
}

export function orderNo(): string {
  const d = new Date();
  const ymd = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`;
  return `MOA${ymd}${randomToken(3).toUpperCase()}`;
}
