/**
 * 동적 SQL / 바인딩 유틸 — MyBatis 스타일.
 *
 * ── 왜 MyBatis 를 그대로 못 쓰는가 ─────────────────────────────────────
 * MyBatis 는 Java/JVM 프레임워크다. 동작에 필요한 것이 전부 이 런타임에 없다.
 *   · JVM                    → Cloudflare Workers 는 workerd(V8 isolate)
 *   · XML 매퍼 파일 파싱       → 런타임 파일시스템(fs) 없음
 *   · SqlSessionFactory 부팅  → 상주 프로세스/빈 컨테이너 없음
 *   · JDBC 드라이버           → D1 은 HTTP 바인딩 API
 * 즉 "MyBatis 를 얹는" 것은 불가능하다. 대신 MyBatis 가 제공하던
 * **개념**을 TypeScript 로 동일하게 구현했다.
 *
 *   MyBatis                          이 프로젝트
 *   ──────────────────────────────   ──────────────────────────────────
 *   <where> + <if test="...">         Where 빌더 (and(cond, sql, ...binds))
 *   <choose>/<when>                   pickOrder (허용 키 화이트리스트)
 *   #{param} 바인딩                    ? 플레이스홀더 + .bind()
 *   <mapper> XML                      repository/*.ts (SQL 유일 거주지)
 *   SqlSession / Mapper 인터페이스      service/*.ts (비즈니스 로직)
 *
 * ── 불변 규칙 ─────────────────────────────────────────────────────────
 * 1. 값(사용자 입력)은 절대 문자열 보간하지 않는다 → 항상 ? + bind.
 * 2. SQL 조각을 조립할 수 있는 것은 **정렬 키 같은 식별자뿐**이며,
 *    그마저도 화이트리스트 맵에서만 고른다(프로토타입 체인 차단).
 */

/** D1 에 바인딩 가능한 스칼라 값 */
export type Bind = string | number | null;

/**
 * MyBatis 의 `<where>` + `<if>` 대응물.
 *
 * ```ts
 * const w = new Where('p.is_active = 1');
 * w.and(cat, '(c.slug = ? OR c.id = ?)', cat, catNum);
 * w.and(q,   '(p.name LIKE ? OR p.brand LIKE ?)', like, like);
 * db.prepare(`... WHERE ${w.sql}`).bind(...w.params);
 * ```
 *
 * 조건이 falsy 면 절이 추가되지 않고, 바인딩도 함께 추가되지 않는다
 * (SQL 조각과 파라미터 개수가 어긋나지 않도록 한 곳에서 관리).
 */
export class Where {
  private readonly base: string;
  private readonly baseBinds: Bind[];
  private readonly clauses: string[] = [];
  private readonly params_: Bind[] = [];

  constructor(base = '', baseBinds: Bind[] = []) {
    this.base = base;
    this.baseBinds = [...baseBinds];
  }

  /** 조건이 참일 때만 AND 로 절을 덧붙인다 (MyBatis `<if test>`) */
  and(cond: unknown, clause: string, ...binds: Bind[]): this {
    if (!cond) return this;
    this.clauses.push(clause);
    this.params_.push(...binds);
    return this;
  }

  /** 조건 없이 절을 덧붙인다 */
  raw(clause: string, ...binds: Bind[]): this {
    this.clauses.push(clause);
    this.params_.push(...binds);
    return this;
  }

  /** WHERE 뒤에 들어갈 SQL (절이 하나도 없으면 `1=1`) */
  get sql(): string {
    const all = this.base ? [this.base, ...this.clauses] : this.clauses;
    return all.length ? all.join(' AND ') : '1=1';
  }

  /** `sql` 순서와 1:1 로 대응하는 바인딩 배열 */
  get params(): Bind[] {
    return [...this.baseBinds, ...this.params_];
  }
}

/**
 * MyBatis 의 `<choose>/<when>` 대응물 — 정렬 키 화이트리스트.
 *
 * `map[sort] || map[fallback]` 로 쓰면 JS 객체가 프로토타입 체인까지
 * 탐색하므로 `?sort=constructor` 같은 입력이 `"function Object() {...}"`
 * 를 반환해 SQL 구문 오류(500)를 만든다. own property 만 허용한다.
 */
export function pickOrder(map: Record<string, string>, key: string, fallback: string): string {
  if (Object.hasOwn(map, key)) return map[key];
  if (Object.hasOwn(map, fallback)) return map[fallback];
  // 맵에 fallback 조차 없으면 프로그래밍 오류다 (사용자 입력 문제 아님).
  throw new Error(`pickOrder: unknown sort key "${key}" and fallback "${fallback}"`);
}

/** 페이지 파라미터 정규화 (1 미만·NaN → 기본값) */
export function toPage(v: string | undefined, fallback = 1): number {
  const n = Number(v ?? fallback);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : fallback;
}

/** LIMIT 정규화 (상한 초과 방지) */
export function toLimit(v: string | undefined, fallback = 20, max = 60): number {
  const n = Number(v ?? fallback);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(Math.floor(n), max);
}

/** TEXT 컬럼에 JSON 문자열로 저장된 값을 배열로 복원 (깨져 있어도 예외 없이 []) */
export function parseJsonList(raw: unknown): any[] {
  if (typeof raw !== 'string' || !raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
