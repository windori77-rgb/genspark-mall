/**
 * 환경 판별 유틸.
 *
 * 이 프로젝트는 세 가지 실행 환경을 가지며, **각자 자기 DB만 사용한다**.
 *
 *  ┌──────────────┬──────────────────────────┬─────────────────────────┐
 *  │ 환경          │ 접속 주소                 │ 사용하는 DB              │
 *  ├──────────────┼──────────────────────────┼─────────────────────────┤
 *  │ production   │ ...vip.gensparksite.com  │ Cloudflare D1 (운영)     │
 *  │ preview      │ ...sandbox.novita.ai     │ 샌드박스 로컬 SQLite      │
 *  │ local        │ localhost:5173 (노트북)   │ 노트북 로컬 SQLite        │
 *  └──────────────┴──────────────────────────┴─────────────────────────┘
 *
 * ⚠️ 과거에는 프리뷰의 /api/* 를 운영 서버로 프록시해서
 *    "샌드박스에서 저장하면 운영 DB 에 저장되는" 구조였다.
 *    이제 그 프록시를 제거했다 → 샌드박스/노트북의 쓰기는
 *    절대 운영 DB 에 닿지 않는다.
 *
 *    운영 데이터는 오직 운영 URL(vip.gensparksite.com)에서만 변경된다.
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
      return 'sandbox-sqlite'; // 샌드박스 로컬 SQLite (.wrangler/state/v3/d1)
    case 'local':
      return 'local-sqlite'; // 노트북 로컬 SQLite (.wrangler/state/v3/d1)
    default:
      return 'production'; // Cloudflare D1 (운영)
  }
}

/** 운영 사이트 주소 (프리뷰 안내 문구에 사용) */
export const PRODUCTION_URL = 'https://19f07bfe-e7de-421b-ae43-9b2da204a8f9.vip.gensparksite.com';
