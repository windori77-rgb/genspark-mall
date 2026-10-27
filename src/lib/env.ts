/**
 * 환경 판별 유틸.
 *
 * 이 프로젝트는 세 가지 실행 환경을 가진다.
 *  - 운영(production):  Cloudflare Workers + 실제 D1            (vip.gensparksite.com)
 *  - 프리뷰(preview):   샌드박스 wrangler pages dev --local       (sandbox.novita.ai)
 *  - 로컬(local):       개발자 노트북의 vite dev server          (localhost:5173)
 *
 * ┌ 프리뷰 vs 운영 ────────────────────────────────────────────────┐
 * │ 두 환경의 DB 는 물리적으로 분리되어 있어, 프리뷰에서 만든 주문은 │
 * │ 운영 관리자페이지에서 절대 조회되지 않았다. (3회 반복 원인)      │
 * │ 따라서 프리뷰의 /api/* 요청을 운영 서버로 프록시하여             │
 * │ "운영 데이터를 그대로 보는 미러"로 만든다.                       │
 * └────────────────────────────────────────────────────────────────┘
 *
 * ┌ 로컬(노트북)은 절대 프록시하지 않는다 ─────────────────────────┐
 * │ 노트북에서 프록시가 동작하면, 개발 중 상품 수정·주문 삭제가      │
 * │ 곧바로 "실제 운영 DB"에 반영되어 고객이 보는 서비스가 바뀐다.    │
 * │ 그래서 loopback(localhost / 127.0.0.1) 은 프리뷰로 취급하지 않고 │
 * │ 로컬 SQLite 만 사용하도록 격리한다.                              │
 * └────────────────────────────────────────────────────────────────┘
 */

/** APP_ENV 값으로 명시된 환경 (가장 우선순위가 높다) */
export type AppEnv = 'production' | 'preview' | 'local';

function readAppEnv(env: unknown): string {
  return String((env as any)?.APP_ENV ?? '').trim().toLowerCase();
}

/** 개발자 PC 에서 도는 서버인가 (localhost / 127.0.0.1 / ::1) */
export function isLoopbackHost(host?: string | null): boolean {
  const h = String(host || '').toLowerCase();
  if (!h) return false;
  const name = h.split(':')[0].replace(/^\[|\]$/g, ''); // [::1]:5173 → ::1
  return name === 'localhost' || name === '127.0.0.1' || name === '::1' || name === '0.0.0.0';
}

/** Genspark 샌드박스가 발급한 공개 호스트인가 */
export function isSandboxHost(host?: string | null): boolean {
  const h = String(host || '').toLowerCase();
  if (!h) return false;
  return h.includes('sandbox.novita.ai') || h.includes('sandbox.gensparksite.com') || h.includes('.e2b.dev');
}

/**
 * 프리뷰(운영 미러) 환경이면 true.
 *
 * 규칙 (위에서부터 먼저 맞는 것이 적용된다):
 *   1. APP_ENV=preview   → true   (샌드박스: ecosystem.config.cjs 가 주입)
 *   2. APP_ENV=local     → false  (노트북 격리 모드)
 *   3. APP_ENV=production→ false  (운영 배포본)
 *   4. loopback 호스트    → false  (노트북의 vite dev server → 로컬 DB만 사용)
 *   5. 샌드박스 호스트    → true
 *   6. 그 외             → false  (운영 도메인에서 절대 true 가 되면 안 된다)
 */
export function isPreviewEnv(env: unknown, host?: string | null): boolean {
  const appEnv = readAppEnv(env);
  if (appEnv === 'preview') return true;
  if (appEnv === 'local' || appEnv === 'production') return false;

  // APP_ENV 가 없을 때의 추론: 노트북(loopback)은 먼저 배제한다.
  if (isLoopbackHost(host)) return false;
  if (isSandboxHost(host)) return true;

  return false;
}

/** 사람이 읽는 환경 이름 (배너·로그·health 응답용) */
export function resolveEnvName(env: unknown, host?: string | null): AppEnv {
  const appEnv = readAppEnv(env);
  if (appEnv === 'preview' || appEnv === 'local' || appEnv === 'production') {
    return appEnv as AppEnv;
  }
  if (isLoopbackHost(host)) return 'local';
  if (isSandboxHost(host)) return 'preview';
  return 'production';
}

/** 이 환경의 API 가 실제로 어느 DB 를 쓰는지 */
export function resolveDataSource(env: unknown, host?: string | null): string {
  switch (resolveEnvName(env, host)) {
    case 'preview':
      return 'proxied→production'; // 샌드박스 프리뷰: 운영 D1 을 그대로 미러
    case 'local':
      return 'local-sqlite'; // 노트북: .wrangler/state/v3/d1 의 로컬 SQLite
    default:
      return 'production';
  }
}

/** 운영 사이트 주소 (프리뷰 안내 문구에 사용) */
export const PRODUCTION_URL = 'https://19f07bfe-e7de-421b-ae43-9b2da204a8f9.vip.gensparksite.com';
