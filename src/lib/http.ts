import type { Context } from 'hono';
import { resolveEnvName } from './env';

/**
 * 서비스 계층 ↔ HTTP 계층 사이의 계약.
 *
 * ── 계층 규칙 ─────────────────────────────────────────────────────────
 *  route     : 쿠키/쿼리/바디 파싱, 응답 직렬화. SQL 없음.
 *  service   : 비즈니스 규칙(검증·계산·상태전이). Hono Context 를 모른다.
 *  repository: SQL 만. 판단 없음.
 *
 * 서비스는 "의도된 실패"를 HttpError 로 던지고, 라우트가 이를
 * `{ error }` + 상태코드로 변환한다. 예상 외 예외는 그대로 던져
 * 라우터의 onError 가 500 으로 처리한다.
 */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export const badRequest = (msg: string) => new HttpError(400, msg);
export const unauthorized = (msg: string) => new HttpError(401, msg);
export const forbidden = (msg: string) => new HttpError(403, msg);
export const notFound = (msg: string) => new HttpError(404, msg);
export const conflict = (msg: string) => new HttpError(409, msg);

/** JSON 응답 (no-store) */
export function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

/**
 * API 오류 → 응답 변환. 라우터의 onError 에서 사용한다.
 *
 * 운영(production)에서는 상세 메시지를 숨긴다.
 *   DB 오류 메시지에는 "no such column: xxx" 처럼 스키마 정보가 담긴다.
 *   응답에 실어 보내면 테이블/컬럼 구조를 추측하는 단서가 된다.
 *   개발 편의를 위해 preview/local 에서만 detail 을 노출한다.
 */
export function apiErrorResponse(c: Context, err: any): Response {
  if (err instanceof HttpError) {
    return c.json({ error: err.message }, err.status as any);
  }
  console.error('[error]', err);
  const isProd = resolveEnvName((c.env as any)?.APP_ENV, c.req.header('host')) === 'production';
  if (isProd) return c.json({ error: '서버 오류가 발생했습니다.' }, 500);
  return c.json({ error: '서버 오류가 발생했습니다.', detail: String(err?.message || err) }, 500);
}
