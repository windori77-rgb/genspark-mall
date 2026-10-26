/**
 * 환경 판별 유틸.
 *
 * 이 프로젝트는 두 개의 독립된 실행 환경을 가진다.
 *  - 운영(production):  Cloudflare Workers + 실제 D1        (vip.gensparksite.com)
 *  - 프리뷰(preview):   wrangler pages dev --local + 로컬 SQLite (샌드박스)
 *
 * 두 환경의 DB 는 물리적으로 분리되어 있어, 프리뷰에서 만든 주문은
 * 운영 관리자페이지에서 절대 조회되지 않는다. 따라서 프리뷰에서는
 * 쓰기(주문 생성)를 차단하여 "조용한 데이터 유실"을 막는다.
 */

/** 프리뷰 환경이면 true. 운영 도메인에서는 어떤 경우에도 false 여야 한다. */
export function isPreviewEnv(env: unknown, host?: string | null): boolean {
  const appEnv = String((env as any)?.APP_ENV || '').toLowerCase();
  if (appEnv === 'preview') return true;

  const h = String(host || '').toLowerCase();
  if (!h) return false;

  if (h.startsWith('localhost') || h.startsWith('127.0.0.1') || h.startsWith('[::1]')) return true;
  if (h.includes('sandbox.novita.ai') || h.includes('.e2b.dev')) return true;

  return false;
}

/** 운영 사이트 주소 (프리뷰 안내 문구에 사용) */
export const PRODUCTION_URL = 'https://19f07bfe-e7de-421b-ae43-9b2da204a8f9.vip.gensparksite.com';
