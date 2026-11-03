import type { Row } from './types';

/**
 * 세션 매퍼 — user_sessions / admin_sessions.
 *
 * 토큰은 항상 `?` 바인딩. 만료 비교는 DB 시각(datetime('now'))으로 통일해
 * Workers 의 로컬 시계 오차 영향을 받지 않게 한다.
 */

/* ── 고객 세션 ──────────────────────────────────────────────────────── */

export async function createUserSession(db: D1Database, token: string, userId: number, days = 30): Promise<void> {
  // 주의: SQLite 의 datetime() 수정자는 **문자열**이어야 한다.
  //   datetime('now','+? days')  → '+? days' 는 잘못된 수정자라 무시되고
  //                                만료시각이 "지금"이 되어 세션이 즉시 만료된다.
  //   datetime('now', ?)         → 바인딩된 '+30 days' 를 수정자로 인식한다.
  await db
    .prepare("INSERT INTO user_sessions (token, user_id, expires_at) VALUES (?,?,datetime('now', ?))")
    .bind(token, userId, `+${Math.trunc(days)} days`)
    .run();
}

export async function deleteUserSession(db: D1Database, token: string): Promise<void> {
  await db.prepare('DELETE FROM user_sessions WHERE token = ?').bind(token).run();
}

/** 유효 세션의 사용자 (만료·미존재 시 null) */
export async function findUserByToken(db: D1Database, token: string): Promise<Row | null> {
  return db
    .prepare(
      `SELECT u.id, u.email, u.name, u.phone, u.created_at
         FROM user_sessions s JOIN users u ON u.id = s.user_id
        WHERE s.token = ? AND s.expires_at > datetime('now')`,
    )
    .bind(token)
    .first<Row>();
}

/* ── 관리자 세션 ────────────────────────────────────────────────────── */

export async function createAdminSession(db: D1Database, token: string, adminId: number, hours = 12): Promise<void> {
  await db
    .prepare("INSERT INTO admin_sessions (token, admin_id, expires_at) VALUES (?,?,datetime('now', ?))")
    .bind(token, adminId, `+${Math.trunc(hours)} hours`)
    .run();
}

export async function deleteAdminSession(db: D1Database, token: string): Promise<void> {
  await db.prepare('DELETE FROM admin_sessions WHERE token = ?').bind(token).run();
}

/** 유효 세션의 관리자 */
export async function findAdminByToken(db: D1Database, token: string): Promise<Row | null> {
  return db
    .prepare(
      `SELECT a.id, a.username, a.name
         FROM admin_sessions s JOIN admin_users a ON a.id = s.admin_id
        WHERE s.token = ? AND s.expires_at > datetime('now')`,
    )
    .bind(token)
    .first<Row>();
}
