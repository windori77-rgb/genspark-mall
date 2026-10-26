import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import type { Context } from 'hono';

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
    256
  );
  return `${s}$${b64(bits)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const salt = stored.split('$')[0];
  const candidate = await hashPassword(password, salt);
  if (candidate.length !== stored.length) return false;
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

/** 로그인 사용자 조회 (없으면 null) */
export async function currentUser(c: Context): Promise<any | null> {
  const token = getCookie(c, SESSION_COOKIE);
  if (!token) return null;
  const row = await (c.env as any).DB.prepare(
    `SELECT u.id, u.email, u.name, u.phone, u.created_at
       FROM user_sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token = ? AND s.expires_at > datetime('now')`
  ).bind(token).first();
  return row || null;
}

export async function currentAdmin(c: Context): Promise<any | null> {
  const token = getCookie(c, ADMIN_COOKIE);
  if (!token) return null;
  const row = await (c.env as any).DB.prepare(
    `SELECT a.id, a.username, a.name
       FROM admin_sessions s JOIN admin_users a ON a.id = s.admin_id
      WHERE s.token = ? AND s.expires_at > datetime('now')`
  ).bind(token).first();
  return row || null;
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

export function newToken(): string {
  return randomToken(24);
}

export function orderNo(): string {
  const d = new Date();
  const ymd = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`;
  return `MOA${ymd}${randomToken(3).toUpperCase()}`;
}
