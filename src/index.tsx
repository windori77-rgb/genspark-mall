import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import shop from './routes/shop';
import admin from './routes/admin';
import { resolveEnvName, resolveDataSource, PRODUCTION_URL, type AppEnv } from './lib/env';

type Bindings = { DB: D1Database; APP_ENV?: string };

const app = new Hono<{ Bindings: Bindings }>();

app.use('*', secureHeaders({ crossOriginEmbedderPolicy: false }));

/**
 * ── 환경별 DB 완전 분리 ────────────────────────────────────────────────
 *
 * 각 환경은 **자기 DB만** 사용하며 서로 섞이지 않는다.
 *
 *   production  ...vip.gensparksite.com  → Cloudflare D1 (운영)
 *   preview     ...sandbox.novita.ai     → 샌드박스 로컬 SQLite
 *   local       localhost:5173 (노트북)   → 노트북 로컬 SQLite
 *
 * ⚠️ 과거에는 프리뷰의 /api/* 를 운영 서버로 프록시했다.
 *    그 결과 "샌드박스에서 저장하면 운영 DB 에 저장되는" 문제가 있었다.
 *    프록시를 제거했으므로 샌드박스의 쓰기는 운영에 절대 닿지 않는다.
 *
 *    운영 데이터는 운영 URL 에서만 변경된다.
 */

app.use('/api/*', cors({ origin: (o) => o || '*', credentials: true }));

app.route('/api/shop', shop);
app.route('/api/admin', admin);

/**
 * 환경 안내 배너.
 *  - preview(샌드박스): 자기 로컬 DB 를 쓰므로 "운영과 분리됨"을 안내
 *  - local(노트북):     자기 로컬 DB 를 쓰므로 "운영에 영향 없음"을 안내
 * 운영 배포본에서는 두 경우 모두 렌더되지 않는다.
 */
function previewBanner(kind: AppEnv = 'preview'): string {
  const isLocal = kind === 'local';
  const accent = isLocal ? '#2B7FFF' : '#8B5CF6';
  const title = isLocal ? '🧪 로컬 개발 환경' : '🧪 샌드박스 (테스트) 환경';
  const body = isLocal
    ? '주문·회원가입은 <b>내 PC 의 로컬 DB에만 저장됩니다.</b> (운영 데이터에 영향 없음)'
    : '주문·회원가입은 <b>샌드박스 전용 DB에만 저장됩니다.</b> (운영 데이터에 영향 없음)';

  return `<div id="preview-banner" role="alert" style="position:fixed;top:0;left:0;right:0;z-index:99999;
background:#1F2430;color:#fff;font:600 12px/1.35 -apple-system,BlinkMacSystemFont,system-ui,'Apple SD Gothic Neo',sans-serif;
padding:8px 12px calc(8px + env(safe-area-inset-top,0px));text-align:center;letter-spacing:-.01em;
box-shadow:0 2px 10px rgba(0,0,0,.28)">
<span style="color:${accent}">${title}</span>
&nbsp;${body}
<a href="${PRODUCTION_URL}" target="_blank" rel="noopener"
 style="display:inline-block;margin-left:6px;background:#FF5A2C;color:#fff;text-decoration:none;
 padding:4px 10px;border-radius:99px;font-weight:800">운영 사이트 →</a></div>
<style>
  body { padding-top: calc(52px + env(safe-area-inset-top, 0px)) !important; }
  /* 관리자: 고정 사이드바 / 스티키 상단바를 배너 아래로 내림 */
  .sidebar { top: calc(52px + env(safe-area-inset-top, 0px)) !important; }
  .topbar  { top: calc(52px + env(safe-area-inset-top, 0px)) !important; }
  /* 부팅 스플래시도 배너를 가리지 않도록 */
  .boot { inset: calc(52px + env(safe-area-inset-top, 0px)) 0 0 0 !important; }
</style>`;
}

/** 현재 요청의 환경 (production | preview | local) */
function envOf(c: any): AppEnv {
  return resolveEnvName(c.env.APP_ENV, c.req.header('host'));
}

/** 배너가 필요한 환경이면 배너 HTML, 아니면 빈 문자열 */
function bannerFor(c: any): string {
  const e = envOf(c);
  return e === 'production' ? '' : previewBanner(e);
}

app.get('/api/health', (c) => {
  const env = envOf(c);
  return c.json({
    ok: true,
    env,
    // preview=운영 미러 / local=내 PC 로컬 DB / production=운영 D1
    dataSource: resolveDataSource(c.env.APP_ENV, c.req.header('host')),
    ts: new Date().toISOString(),
  });
});

/* ── 고객용 셸 ── */
app.get('/', (c) => c.html(shopShell(bannerFor(c))));
app.get('/app', (c) => c.html(shopShell(bannerFor(c))));

/* ── 관리자 셸 ── */
app.get('/admin', (c) => c.html(adminShell(bannerFor(c))));

/* ── PWA: manifest / service worker 는 동적 생성 (경로 Prefix 회피) ── */
app.get('/manifest.webmanifest', (c) => {
  return c.body(
    JSON.stringify({
      name: 'MOA SHOP',
      short_name: 'MOA',
      description: '매일이 조금 더 즐거워지는 쇼핑, MOA SHOP',
      start_url: '/app',
      scope: '/',
      display: 'standalone',
      orientation: 'portrait',
      background_color: '#ffffff',
      theme_color: '#FF5A2C',
      lang: 'ko-KR',
      categories: ['shopping', 'lifestyle'],
      icons: [
        { src: '/static/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: '/static/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: '/static/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
      shortcuts: [
        { name: '장바구니', url: '/app#/cart' },
        { name: '주문조회', url: '/app#/orders' },
        { name: '마이페이지', url: '/app#/mypage' },
      ],
    }),
    { headers: { 'content-type': 'application/manifest+json; charset=utf-8', 'cache-control': 'public, max-age=3600' } }
  );
});

app.get('/sw.js', (c) => {
  return c.body(SERVICE_WORKER, {
    headers: {
      'content-type': 'application/javascript; charset=utf-8',
      'cache-control': 'no-cache',
      'service-worker-allowed': '/',
    },
  });
});

app.get('/offline', (c) => c.html(`<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>오프라인</title>
<style>body{margin:0;height:100vh;display:grid;place-items:center;font-family:system-ui,-apple-system,sans-serif;background:#F5F5F7;color:#111318;text-align:center;padding:24px}
.b{font-size:44px;margin-bottom:12px}h1{font-size:19px;margin:0 0 8px}p{color:#6B7280;font-size:14px;margin:0}
button{margin-top:20px;border:0;background:#FF5A2C;color:#fff;font-weight:700;padding:12px 22px;border-radius:12px;font-size:14px}</style></head>
<body><div><div class="b">📡</div><h1>인터넷 연결이 끊겼어요</h1><p>연결 상태를 확인한 뒤 다시 시도해주세요.</p>
<button onclick="location.reload()">다시 시도</button></div></body></html>`));

app.notFound((c) => {
  if (c.req.path.startsWith('/api/')) return c.json({ error: 'Not Found' }, 404);
  return c.html(shopShell(bannerFor(c)), 200);
});

app.onError((err, c) => {
  console.error('[error]', err);
  if (c.req.path.startsWith('/api/')) {
    return c.json({ error: '서버 오류가 발생했습니다.', detail: String(err?.message || err) }, 500);
  }
  return c.text('Internal Server Error', 500);
});

function shopShell(banner = '') {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#FF5A2C">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="apple-mobile-web-app-title" content="MOA SHOP">
<meta name="description" content="매일이 조금 더 즐거워지는 쇼핑, MOA SHOP">
<title>MOA SHOP</title>
<link rel="manifest" href="/manifest.webmanifest">
<link rel="apple-touch-icon" href="/static/icons/icon-192.png">
<link rel="icon" href="/static/icons/icon-192.png">
<link rel="stylesheet" href="/static/app.css">
</head>
<body>
${banner}
<div id="root"><div class="boot"><div class="boot-logo">MOA</div><div class="boot-bar"><i></i></div></div></div>
<noscript>이 서비스를 이용하려면 JavaScript를 활성화해주세요.</noscript>
<script src="/static/app.js" defer></script>
</body>
</html>`;
}

function adminShell(banner = '') {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>MOA SHOP · 관리자</title>
<link rel="icon" href="/static/icons/icon-192.png">
<link rel="stylesheet" href="/static/admin.css">
</head>
<body>
${banner}
<div id="admin-root"><div class="boot"><div class="boot-logo">MOA<span>ADMIN</span></div><div class="boot-bar"><i></i></div></div></div>
<script src="/static/admin.js" defer></script>
</body>
</html>`;
}

const SERVICE_WORKER = `
const CACHE = 'moa-v3';
const PRECACHE = [
  '/', '/app', '/static/app.css', '/static/app.js',
  '/static/icons/icon-192.png', '/static/icons/icon-512.png', '/offline'
];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await Promise.allSettled(PRECACHE.map((u) => c.add(new Request(u, { cache: 'reload' }))));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // API 는 네트워크 우선 (실패 시 503 JSON)
  if (url.pathname.startsWith('/api/')) {
    e.respondWith(fetch(req).catch(() => new Response(JSON.stringify({ error: '오프라인 상태입니다.' }), {
      status: 503, headers: { 'content-type': 'application/json' }
    })));
    return;
  }

  // 이미지: 캐시 우선
  if (/\.(png|jpg|jpeg|webp|svg|gif|ico)$/.test(url.pathname)) {
    e.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const hit = await cache.match(req);
      if (hit) return hit;
      try {
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      } catch {
        return new Response('', { status: 504 });
      }
    })());
    return;
  }

  // 문서/스크립트/스타일: 네트워크 우선, 실패 시 캐시 → 오프라인 페이지
  e.respondWith((async () => {
    try {
      const res = await fetch(req);
      if (res.ok && url.pathname !== '/sw.js') {
        const cache = await caches.open(CACHE);
        cache.put(req, res.clone());
      }
      return res;
    } catch {
      const cache = await caches.open(CACHE);
      const hit = await cache.match(req);
      if (hit) return hit;
      const off = await cache.match('/offline');
      return off || new Response('오프라인', { status: 503 });
    }
  })());
});
`;

export default app;
