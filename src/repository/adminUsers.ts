import type { Row } from './types';

/** 관리자 계정 매퍼 (admin_users) */

export async function findByUsername(db: D1Database, username: string): Promise<Row | null> {
  return db.prepare('SELECT * FROM admin_users WHERE username = ?').bind(username).first<Row>();
}

export async function findById(db: D1Database, id: number): Promise<Row | null> {
  return db.prepare('SELECT * FROM admin_users WHERE id = ?').bind(id).first<Row>();
}

export async function updatePassword(db: D1Database, id: number, passwordHash: string): Promise<void> {
  await db.prepare('UPDATE admin_users SET password_hash = ? WHERE id = ?').bind(passwordHash, id).run();
}
