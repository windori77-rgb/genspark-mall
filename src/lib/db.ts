import { SCHEMA_SQL } from './schema';
import { seedDatabase } from './seed';

let ready: Promise<void> | null = null;

/** 세미콜론 기준으로 SQL 문장을 분해 (문자열 리터럴 고려) */
function splitStatements(sql: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inStr = false;
  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    if (ch === "'") {
      // 이스케이프된 '' 처리
      if (inStr && sql[i + 1] === "'") { cur += "''"; i++; continue; }
      inStr = !inStr;
      cur += ch;
      continue;
    }
    if (ch === ';' && !inStr) {
      const t = cur.trim();
      if (t) out.push(t);
      cur = '';
      continue;
    }
    cur += ch;
  }
  const tail = cur.trim();
  if (tail) out.push(tail);
  return out;
}

async function init(db: D1Database) {
  // 1) 스키마 생성 (문장별 실행 — D1 exec 의 줄 단위 분리 문제 회피)
  const stmts = splitStatements(SCHEMA_SQL);
  for (let i = 0; i < stmts.length; i += 20) {
    const chunk = stmts.slice(i, i + 20);
    await db.batch(chunk.map((s) => db.prepare(s)));
  }

  // 2) 최초 1회 시드
  const row: any = await db.prepare('SELECT COUNT(*) AS n FROM products').first();
  if (!row || Number(row.n) === 0) {
    await seedDatabase(db);
  }
}

/** 최초 1회 스키마 생성 + 시드 (콜드스타트당 1회 캐시) */
export function ensureDb(db: D1Database): Promise<void> {
  if (!ready) {
    ready = init(db).catch((e) => {
      ready = null;
      throw e;
    });
  }
  return ready;
}

export function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

export const won = (n: number) => `${Number(n || 0).toLocaleString('ko-KR')}원`;
