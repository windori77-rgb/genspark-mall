# MOA SHOP — 모바일 인터넷 쇼핑몰

모바일 퍼스트 이커머스 플랫폼. **고객용 모바일웹 / 고객용 모바일앱(PWA) / 관리자 콘솔** 3개 진입점을 하나의 Cloudflare Workers 프로젝트로 제공합니다.

## 1. 프로젝트 개요

| 항목 | 내용 |
|---|---|
| 이름 | MOA SHOP |
| 목표 | 모바일에서 바로 쓰는 경량 이커머스 (고객몰 + 관리자) |
| 스택 | Hono 4 + TypeScript + Cloudflare Workers + D1(SQLite) |
| 프론트 | 바닐라 JS SPA (해시 라우터) + 커스텀 CSS (Pretendard) |
| 결제 | **데모 결제** (실결제 미연동) |
| 상태 | ✅ 운영 가능 (샘플 데이터 28개 상품) |

## 2. 접속 URL

**운영 사이트**: https://19f07bfe-e7de-421b-ae43-9b2da204a8f9.vip.gensparksite.com
**GitHub 저장소**: https://github.com/windori77-rgb/genspark-mall

| 용도 | 경로 |
|---|---|
| 고객용 모바일웹 | `/` 또는 `/app` |
| 고객용 모바일앱 (PWA) | `/app` → 브라우저 "홈 화면에 추가" |
| 관리자 콘솔 | `/admin` |
| PWA 매니페스트 | `/manifest.webmanifest` |
| 서비스 워커 | `/sw.js` |
| 헬스체크 | `/api/health` |

### 계정
- **관리자**: `admin` — 비밀번호는 **2026-10-26 변경 완료** (보안상 저장소에 기록하지 않음)
- **고객(데모)**: `demo@moa.shop` / `demo1234`

> ⚠️ 관리자 비밀번호는 코드/문서에 평문으로 남기지 마세요. 변경은 관리자 로그인 → 쇼핑몰 설정 → 비밀번호 변경.
> `src/lib/seed.ts` 의 초기값(`admin1234`)은 **DB가 비어 있을 때 최초 1회만** 사용되며, 현재 운영 DB에는 적용되지 않습니다.

### ⚠️ 중요: 프리뷰 환경과 운영 환경의 DB는 완전히 분리되어 있습니다

이 프로젝트는 **두 개의 독립된 데이터베이스**를 사용합니다.

| 환경 | 접속 주소 | DB 위치 | 용도 |
|---|---|---|---|
| **운영(Production)** | `https://19f07bfe-e7de-421b-ae43-9b2da204a8f9.vip.gensparksite.com` | Cloudflare D1 (실제) | **실제 고객 주문이 저장되는 곳** |
| 프리뷰(Preview) | 샌드박스 미리보기 URL (`localhost:3000` 등) | 로컬 SQLite (`.wrangler/state/v3/d1`) | 개발·테스트 전용 (임시) |

### ✅ 해결: 프리뷰 API → 운영 서버 리버스 프록시

**프리뷰의 `/api/*` 요청을 운영 서버로 그대로 전달**하도록 구현했습니다 (`src/lib/env.ts` + `src/index.tsx`).
이제 어느 주소에서 주문하든 **동일한 운영 D1에 저장**되며, 프리뷰 관리자페이지도 운영 데이터를 그대로 조회합니다.

- 프리뷰 판별: `APP_ENV=preview` 바인딩, `localhost` / `127.0.0.1`, `*.sandbox.novita.ai`, `*.e2b.dev`
- 운영 배포본에서는 판별 결과가 항상 `false` → **프록시 자체가 동작하지 않음**
- 확인: `GET /api/health`
  - 운영 → `{"env":"production","dataSource":"production"}`
  - 프리뷰 → `{"env":"preview","dataSource":"proxied→production"}`
- 프리뷰 화면 상단에는 "주문·회원가입은 운영 DB에 그대로 저장됩니다" 안내 배너가 표시됩니다.

**실측 검증 (2026-10-26)**
| 검증 | 결과 |
|---|---|
| 프리뷰에서 주문 생성 | 로컬 DB 0건 / **운영 D1에 저장됨** |
| 프리뷰 관리자페이지 조회 | 운영 주문 3건 그대로 표시 |
| 운영 관리자페이지 조회 | 3건 정상 (₩17,500 / ₩89,000 / ₩22,900) |

> 📌 이 문제가 발생한 이력 (수동 이관으로 복구)
> - `MOA20261026D7E3FD` (김인수, ₩17,500) — 프리뷰 DB → 운영 D1 이관
> - `MOA202610261E79D5` (김인수, ₩89,000) — 동일 원인 → 운영 D1 이관
> - `MOA2026102601FE64` (김인수, ₩22,900) — 동일 원인 → 운영 D1 이관
>
> 세 건 모두 **데이터 유실은 아니었습니다**(프리뷰 DB에 그대로 존재). 현재는 프록시 적용으로 재발하지 않습니다.

## 3. 고객용 기능

- **홈**: 자동 슬라이드 배너 캐러셀, 카테고리 칩, 특가 가로 스크롤, 베스트/신상품 그리드, 공지사항
- **카테고리**: 6개 카테고리(패션·뷰티·푸드·리빙·디지털·스포츠) + 정렬(인기/신상/낮은가격/높은가격/평점)
- **검색**: 상품명·브랜드·요약 검색, 인기 검색어
- **상품 상세**: 스와이프 이미지 갤러리(현재/전체 표시), 옵션 선택(사이즈·색상 등 다중), 수량 조절, 실시간 금액 계산, 리뷰, 연관 상품, 찜하기
- **장바구니**: 수량 변경/삭제/전체삭제, 무료배송까지 남은 금액 프로그레스 바, 비회원 담기 → 로그인 시 자동 병합
- **주문서**: 배송지 입력, 배송 요청사항, 쿠폰 코드 적용(칩 선택 가능), 결제수단 선택, 실시간 합계 갱신
- **주문 완료/조회**: 주문번호 발급, 적립 예정 포인트, 주문 상세, 주문 취소(재고 자동 복구)
- **비회원 주문조회**: 주문번호 + 연락처
- **마이페이지**: 주문·찜·장바구니 카운트, 회원정보 수정, 로그아웃
- **회원**: 회원가입 / 로그인 / 로그아웃 (PBKDF2-SHA256 해시, HttpOnly 쿠키 세션 30일)

### PWA (고객용 모바일앱)
- `manifest.webmanifest`: standalone, 테마 `#FF5A2C`, 아이콘 192/512/maskable, 바로가기 3종
- 서비스 워커: 앱 셸 프리캐시, 이미지 캐시 우선, 문서 네트워크 우선 → 오프라인 폴백, API는 503 JSON
- **설치 배너**: Android/Chrome은 `beforeinstallprompt` 네이티브 프롬프트, iOS는 "공유 → 홈 화면에 추가" 안내
- 오프라인 전용 페이지 `/offline`
- iOS 메타(`apple-mobile-web-app-*`), safe-area 대응(노치/홈 인디케이터)

## 4. 관리자 기능 (`/admin`)

| 메뉴 | 기능 |
|---|---|
| 대시보드 | 오늘/7일/30일 매출·주문, 전체 회원·상품 수, 14일 매출 차트, 주문 상태 분포, 최근 주문, 재고 부족(≤20) 알림, 판매 베스트 |
| 주문 관리 | 상태 필터(결제대기~환불), 검색(주문번호/주문자/받는분), 상세 모달(주문·배송·금액·관리자 메모), 상태 변경(취소 시 재고 자동 복구) |
| 상품 관리 | 등록/수정/삭제, 카테고리·배지·배송비·정가·할인가·재고·이미지·옵션(JSON)·판매중지, 검색/필터 |
| 카테고리 | 목록(등록 상품 수 포함), 추가 |
| 회원 관리 | 이름/이메일 검색, 주문 건수·누적 구매액·마케팅 동의 |
| 리뷰 관리 | 목록, 삭제(상품 평점·리뷰수 자동 재계산) |
| 쿠폰 | 발급(정액/정률·최소주문·최대할인·수량·만료일), 활성 토글, 삭제 |
| 배너 | 추가/수정/삭제, 활성 토글, 썸네일 미리보기 |
| 쇼핑몰 설정 | 쇼핑몰명·슬로건·무료배송 기준·기본 배송비·적립률·고객센터·계좌, 관리자 비밀번호 변경 |

관리자 세션은 12시간 HttpOnly 쿠키이며, `/api/admin/*` 전체가 서버측 가드로 보호됩니다(미인증 시 401).

## 5. 데이터 아키텍처

**저장소**: Cloudflare D1 (SQLite). 스키마는 최초 요청 시 자동 생성(`CREATE TABLE IF NOT EXISTS`), 상품이 0개면 샘플 데이터 자동 시딩.

| 테이블 | 설명 |
|---|---|
| `categories` | 카테고리 (name, slug, icon, sort_order) |
| `products` | 상품 (가격/할인가, 이미지 JSON, 옵션 JSON, 재고, 배지, 평점, 판매량) |
| `users` | 회원 (PBKDF2 해시, 마케팅 동의) |
| `user_sessions` | 고객 세션 토큰 |
| `addresses` | 배송지 |
| `cart_items` | 장바구니 (`u:{id}` 회원 / `g:{cookie}` 비회원) |
| `orders` / `order_items` | 주문 / 주문 상품 (금액·할인·배송비·상태 스냅샷) |
| `coupons` | 쿠폰 (amount/percent, min_order, max_discount, used_count) |
| `reviews` | 리뷰 |
| `banners` | 메인 배너 |
| `notices` | 공지사항 |
| `wishlist` | 찜 (user_id + product_id UNIQUE) |
| `admin_users` / `admin_sessions` | 관리자 계정/세션 |
| `settings` | 쇼핑몰 설정 KV 형태 테이블 |

**주문 상태**: `pending(결제대기)` → `paid(결제완료)` → `preparing(상품준비중)` → `shipping(배송중)` → `delivered(배송완료)`, 예외 `cancelled`/`refunded`

**금액 계산 규칙**
- `소계 = Σ(판매가 × 수량)`
- `할인 = 쿠폰(정액 | 정률%, max_discount 상한)`, 소계 초과 불가
- `배송비 = (소계 - 할인) >= 30,000 ? 0 : 3,000` (설정값)
- `총액 = 소계 - 할인 + 배송비`, 적립 = 총액 × 1%

## 6. API 요약

### 고객 `/api/shop`
```
GET    /config                      설정·카테고리·배너·공지
GET    /products?q&category&sort&badge&limit&page
GET    /products/:id                상품 + 리뷰 + 연관상품
POST   /auth/register | /auth/login | /auth/logout
GET    /auth/me                     내 정보 + 주문/찜 카운트
PATCH  /auth/me                     회원정보 수정
GET|POST|DELETE /cart  ·  PATCH|DELETE /cart/:id
GET    /coupons  ·  POST /coupons/apply
GET|POST /addresses
POST   /orders                      주문 생성(재고차감·쿠폰사용·장바구니비움)
GET    /orders  ·  GET /orders/:no  ·  POST /orders/lookup
POST   /orders/:no/cancel           주문 취소(재고 복구)
GET    /wishlist  ·  POST /wishlist/:productId
```

### 관리자 `/api/admin` (세션 필요)
```
POST /login | /logout | GET /me
GET  /dashboard
GET|POST /products · PUT|DELETE /products/:id · PATCH /products/:id/stock
GET|POST /categories
GET  /orders · GET /orders/:id · PATCH /orders/:id
GET  /users
GET|POST /coupons · PATCH|DELETE /coupons/:id
GET|POST /banners · PATCH|DELETE /banners/:id
GET  /reviews · DELETE /reviews/:id
GET  /settings · PUT /settings
POST /password
```

## 7. 개발

```bash
cd /home/user/webapp
npm run build                          # vite build → dist/
pm2 start ecosystem.config.cjs         # wrangler pages dev :3000 (D1 local)
curl http://localhost:3000/api/health

# 로컬 D1 확인
npx wrangler d1 execute webapp-production --local --command="SELECT COUNT(*) FROM products"
```

### 프로젝트 구조
```
src/
  index.tsx        Hono 엔트리 (셸 HTML · manifest · service worker · offline)
  routes/shop.ts   고객 API
  routes/admin.ts  관리자 API
  lib/env.ts       환경 판정 (production / preview / local)
  lib/schema.ts    D1 스키마 DDL
  lib/seed.ts      샘플 데이터(상품 28 · 카테고리 6 · 쿠폰 3 · 리뷰 12)
  lib/auth.ts      PBKDF2 해시 · 세션 쿠키 · 주문번호 생성
  lib/db.ts        스키마 부트스트랩 · 시딩 (문장 단위 분해 실행)
public/static/
  app.css app.js         고객몰
  admin.css admin.js     관리자
  icons/                 PWA 아이콘
  img/                   샘플 상품 이미지 22장
scripts/
  deploy-guard.mjs       `npm run deploy` 오배포 방지 가드
docs/
  api.http               REST Client 로 API 수동 테스트
.vscode/                 VS Code 설정 (settings/launch/tasks/extensions)
```

---

## 7-1. VS Code 로컬 개발 환경 (노트북)

### 사전 준비

| 항목 | 요구 사항 | 확인 |
|---|---|---|
| Node.js | **22.12.0 이상** (`.nvmrc` = 22) | `node -v` |
| Git | 최신 | `git --version` |
| VS Code | 최신 | — |

> ⚠️ Node 20 초반/18 에서는 `vite 8` · `wrangler 4` 가 설치 단계에서 실패합니다.
> `nvm install 22 && nvm use 22` 로 맞춰주세요.

### 시작하기

```bash
git clone https://github.com/windori77-rgb/genspark-mall.git
cd genspark-mall
npm install
code .                      # VS Code 로 열기
```

VS Code 가 열리면 우측 하단에 **추천 확장 설치** 알림이 뜹니다 → `Install All`.

### 실행 (F5 또는 터미널)

| 방법 | 명령 | DB | 안전도 |
|---|---|---|---|
| **터미널** | `npm run dev` | 로컬 SQLite | ✅ 안전 |
| **디버거 ①** | F5 → `① dev (로컬 DB · 안전)` | 로컬 SQLite | ✅ 안전 |
| **디버거 ②** | F5 → `② preview (wrangler · 로컬 D1)` | 로컬 SQLite | ✅ 안전 |
| **타입 검사** | `npm run typecheck` | — | — |
| **빌드** | `npm run build` | — | — |

브라우저에서 `http://localhost:5173` 접속 → `/api/health` 가 아래처럼 나오면 정상:

```json
{ "ok": true, "env": "local", "dataSource": "local-sqlite" }
```

### 🔒 운영 데이터 보호 장치

`src/lib/env.ts` 의 `isPreviewEnv()` 는 **호스트를 보고 환경을 판정**합니다.

| 접속 호스트 | 판정 | `/api/*` 동작 | 사용 DB |
|---|---|---|---|
| `localhost:5173` (노트북) | `local` | 프록시 **안 함** | **내 PC 로컬 SQLite** |
| `...sandbox.novita.ai` (샌드박스) | `preview` | **운영으로 프록시** | 운영 D1 미러 |
| `...vip.gensparksite.com` (운영) | `production` | 프록시 안 함 | 운영 D1 |

**즉, 노트북에서 상품을 지우거나 주문을 만들어도 실제 운영 서비스는 전혀 영향받지 않습니다.**
이건 의도된 설계입니다 — 이 프로젝트는 과거에 "프리뷰에서 만든 주문이 운영 관리자페이지에 안 보이는" 사고를 겪었고, 그 해결책이 프록시이기 때문입니다.

로컬 DB 는 `npm install` 후 **첫 요청 시 자동 생성**됩니다 (스키마·샘플 28개 상품 자동 시딩).

```bash
# 로컬 DB 직접 확인
npx wrangler d1 execute webapp-production --local --command="SELECT COUNT(*) FROM products"

# 로컬 DB 초기화 (스키마까지 다시 생성)
npm run clean && npm run build
```

### ⛔ 절대 하지 말 것

```bash
npm run deploy          # → 차단됨 (deploy-guard 가 안내 후 종료)
npx wrangler pages deploy   # → 고객님 개인 CF 계정으로 유령 배포됨
```

이 프로젝트의 운영 배포는 **Genspark 호스팅**입니다. 배포가 필요하면 커밋·push 후
Genspark 에이전트에게 **"배포해줘"** 라고 요청하세요 (승인 배너 → 승인 → 반영).

### IntelliJ / Eclipse 로 열 때

| IDE | 가능 여부 | 비고 |
|---|---|---|
| IntelliJ IDEA **Ultimate** | ✅ | TS/JS 완전 지원 |
| IntelliJ IDEA **Community** | ❌ | **JS/TS 미지원** (Ultimate 전용 기능) |
| Eclipse | △ | `Wild Web Developer` 플러그인 필요, 권장하지 않음 |

`.idea/`, `.classpath`, `.project`, `.settings/`, `out/`, `bin/` 는 `.gitignore` 에 등록되어 있어
개인 IDE 설정이 저장소에 섞이지 않습니다.

## 8. 배포

- **플랫폼**: Cloudflare Workers (Genspark 호스팅)
- **운영 URL**: https://19f07bfe-e7de-421b-ae43-9b2da204a8f9.vip.gensparksite.com
- **방법**: `gsk hosted deploy` (D1 자동 프로비저닝)
- **바인딩**: `DB` (D1) 1개 — KV/크론 미사용
- **배포 상태**: ✅ 배포 완료 (2026-10-26). D1 자동 초기화 확인: 상품 28 / 카테고리 6 / 쿠폰 3 / 관리자 1
- **재배포**: 코드 수정 후 `npm run build` → `git commit` → `gsk hosted deploy` (승인 필요)

## 9. 미구현 / 다음 단계 제안

1. **실결제 연동** — 토스페이먼츠·포트원(아임포트) REST API. 서버 라우트에서 시크릿 키 사용, 프론트는 결제창 SDK 호출
2. **이미지 업로드** — 현재 URL 입력 방식. R2 버킷 + 관리자 업로드 UI로 교체 권장
3. **배송 추적** — 택배사 송장번호 등록 및 조회 API 연동
4. **알림** — 주문 상태 변경 알림톡/이메일(Resend·SendGrid), PWA Web Push
5. **상품 옵션별 재고** — 현재 상품 단위 재고 → 옵션 조합 단위 재고 테이블 분리
6. **리뷰 작성** — 구매 확정 고객만 작성 가능하도록 구매 이력 검증 + 포토 리뷰
7. **검색 개선** — D1 FTS5 전문 검색 또는 Algolia 연동
8. **보안 강화** — 로그인 시도 제한(rate limit), CSRF 토큰, 관리자 2FA
9. **네이티브 앱 전환** — PWA를 Capacitor로 래핑하여 스토어 배포(현 환경에서는 불가)

---
최초 작성 2026-10-26 · MOA SHOP
