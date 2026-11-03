/**
 * 데이터 접근 계층(Repository) 공통 타입.
 *
 * MyBatis 의 `<mapper>` XML 이 하던 역할을 이 디렉터리가 맡는다.
 *  · 이 폴더 밖에는 SQL 문자열이 존재하지 않는다.
 *  · 서비스/라우트는 "무엇을 조회하는지"만 알고 "어떻게"는 모른다.
 */

/** D1 결과 행 (컬럼이 동적이므로 값 타입은 any 로 둔다) */
export type Row = Record<string, any>;

/** 스칼라 카운트 조회 결과 */
export type CountRow = { n: number };

/** 집계(건수 + 금액) 결과 */
export type AggregateRow = { n: number; amount: number };
