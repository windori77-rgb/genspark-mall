/* MOA SHOP · 고객용 모바일웹 SPA */
'use strict';

/* ─────────────── 유틸 ─────────────── */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const won = (n) => Number(n || 0).toLocaleString('ko-KR') + '원';
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const flat = (s) => String(s || '').replace(/\s+/g, ' ').trim();

const state = {
  config: null,
  cart: { items: [], subtotal: 0, count: 0 },
  user: null,
  counts: { orders: 0, wishes: 0 },
  wishes: new Set(),
  install: null,
  deferredPrompt: null,
};

async function api(path, opts = {}) {
  const res = await fetch('/api/shop' + path, {
    credentials: 'include',
    headers: { 'content-type': 'application/json', ...(opts.headers || {}) },
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || '요청을 처리할 수 없습니다.'), { status: res.status, data });
  return data;
}

let toastTimer;
function toast(msg) {
  const old = $('.toast');
  if (old) old.remove();
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  document.body.appendChild(el);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.remove(), 2200);
}

function go(path) { location.hash = path; }
function back(fallback = '#/') {
  if (history.length > 1) history.back();
  else go(fallback);
}

/* ─────────────── 라우터 ─────────────── */
const ROUTES = [
  [/^\/$/, 'home'],
  [/^\/category\/([^/]+)$/, 'category'],
  [/^\/search$/, 'search'],
  [/^\/product\/(\d+)$/, 'product'],
  [/^\/cart$/, 'cart'],
  [/^\/checkout$/, 'checkout'],
  [/^\/done\/([^/]+)$/, 'done'],
  [/^\/orders$/, 'orders'],
  [/^\/orders\/([^/]+)$/, 'orderDetail'],
  [/^\/lookup$/, 'lookup'],
  [/^\/login$/, 'login'],
  [/^\/join$/, 'join'],
  [/^\/mypage$/, 'mypage'],
  [/^\/wishlist$/, 'wishlist'],
  [/^\/notices$/, 'notices'],
];

function parseHash() {
  const raw = location.hash.replace(/^#/, '') || '/';
  const [pathPart, queryPart] = raw.split('?');
  const params = new URLSearchParams(queryPart || '');
  for (const [re, name] of ROUTES) {
    const m = pathPart.match(re);
    if (m) return { name, args: m.slice(1), params, path: pathPart };
  }
  return { name: 'home', args: [], params, path: '/' };
}

let renderSeq = 0;
async function route() {
  const r = parseHash();
  const seq = ++renderSeq;
  const root = $('#root');

  // 탭 활성 표시 대상
  const tabOf = {
    home: 'home', category: 'category', search: 'category',
    cart: 'cart', checkout: 'cart', product: 'home',
    orders: 'orders', orderDetail: 'orders', lookup: 'orders',
    mypage: 'me', login: 'me', join: 'me', wishlist: 'me', notices: 'me', done: 'home',
  }[r.name];

  try {
    const html = await SCREENS[r.name](r, seq);
    if (seq !== renderSeq) return;
    root.innerHTML = `<div class="app">${html}${r.name === 'product' ? '' : renderTabbar(tabOf, r)}</div>`;
    window.scrollTo(0, 0);
    if (r.name === 'product') mountProductEvents(r);
    if (r.name === 'checkout') mountCheckout(r);
    if (r.name === 'home') mountHome();
    if (r.name === 'login' || r.name === 'join') mountAuth(r.name);
    if (r.name === 'cart') mountCart();
    if (r.name === 'mypage' || r.name === 'wishlist') mountWish();
  } catch (err) {
    if (seq !== renderSeq) return;
    root.innerHTML = `<div class="app">${renderSubHeader('오류')}<div class="empty"><b>⚠️</b><p>${esc(err.message)}</p>
      <button class="btn btn-line mt16" data-nav="#/">홈으로</button></div></div>`;
  }
  if (r.name !== 'login' && r.name !== 'join') window.__lastScreen = r.name;
}

/* ─────────────── 공통 컴포넌트 ─────────────── */
function renderTabbar(active, r) {
  const c = state.cart.count || 0;
  const tabs = [
    ['home', '#/', '🏠', '홈'],
    ['category', '#/category/fashion', '🧭', '카테고리'],
    ['cart', '#/cart', '🛍️', '장바구니'],
    ['orders', '#/orders', '📦', '주문'],
    ['me', '#/mypage', '👤', '마이'],
  ];
  return `<nav class="tabbar">${tabs.map(([k, href, ico, label]) =>
    `<a class="tab ${active === k ? 'on' : ''}" href="${href}">
       <b>${ico}</b><span>${label}</span>
       ${k === 'cart' && c ? `<i class="cnt">${c > 99 ? '99+' : c}</i>` : ''}
     </a>`).join('')}</nav>`;
}

function renderSubHeader(title, opts = {}) {
  return `<header class="subhdr">
    <button class="back" data-act="back" aria-label="뒤로">‹</button>
    <h2>${esc(title)}</h2>
    ${opts.right || ''}
  </header>`;
}

function renderTopbar() {
  return `<header class="hdr"><div class="hdr-in">
    <a class="hdr-logo" href="#/">MOA<b>SHOP</b></a>
    <div class="grow"></div>
    <a class="hdr-ico" href="#/search" aria-label="검색">🔍</a>
    <a class="hdr-ico" href="#/cart" aria-label="장바구니">🛍️
      ${state.cart.count ? `<i class="hdr-badge">${state.cart.count > 99 ? '99+' : state.cart.count}</i>` : ''}
    </a>
  </div></header>`;
}

function pcard(p, opts = {}) {
  const price = p.sale_price ?? p.price;
  const off = p.sale_price ? Math.round((1 - p.sale_price / p.price) * 100) : 0;
  const wished = state.wishes.has(p.id);
  const badge = p.badge ? `<span class="pcard-badge ${p.badge === 'BEST' || p.badge === '특가' ? 'hot' : ''}">${esc(p.badge)}</span>` : '';
  return `<a class="pcard" href="#/product/${p.id}">
    <div class="pcard-img">
      <img src="${esc(p.thumbnail || '/static/img/tee-1.jpg')}" alt="${esc(p.name)}" loading="lazy">
      ${badge}
      <button class="pcard-like ${wished ? 'on' : ''}" data-act="wish" data-id="${p.id}" aria-label="찜">♥</button>
    </div>
    <div class="pcard-body">
      ${p.brand ? `<div class="pcard-brand">${esc(p.brand)}</div>` : ''}
      <div class="pcard-name">${esc(p.name)}</div>
      <div class="pcard-price">
        ${off ? `<span class="off">${off}%</span>` : ''}
        <span class="now">${won(price)}</span>
        ${off ? `<span class="was">${won(p.price)}</span>` : ''}
      </div>
      <div class="pcard-meta"><em>★ ${Number(p.rating || 0).toFixed(1)}</em><span>리뷰 ${p.review_count || 0}</span></div>
    </div>
  </a>`;
}

function skelGrid(n = 4) {
  return `<div class="grid">${Array.from({ length: n }).map(() => `
    <div><div class="skel skel-card" style="aspect-ratio:1"></div>
    <div class="skel mt8" style="height:11px;width:44%"></div>
    <div class="skel mt8" style="height:13px;width:88%"></div>
    <div class="skel mt8" style="height:15px;width:62%"></div></div>`).join('')}</div>`;
}

/* ─────────────── SCREENS ─────────────── */
const SCREENS = {};

/* 홈 */
SCREENS.home = async () => {
  const [featured, best, newItems] = await Promise.all([
    api('/products?sort=price_asc&limit=6&badge=특가'),
    api('/products?sort=popular&limit=4'),
    api('/products?sort=new&limit=6'),
  ]);
  const cfg = state.config;
  const banners = cfg.banners || [];
  const cats = cfg.categories || [];
  const mallName = (cfg.settings && cfg.settings.mall_name) || 'MOA SHOP';
  const tagline = (cfg.settings && cfg.settings.mall_tagline) || '';

  return `${renderTopbar()}
  <section class="hero" id="hero-section">
    <div class="hero-track" id="hero-track">
      ${banners.map((b) => `<a class="hero-card" href="${esc(b.link || '#/')}" style="background:${esc(b.bg || '#111827')}">
        <h3>${esc(b.title)}</h3><p>${esc(b.subtitle)}</p>
        <span class="cta">바로보기 →</span>
        ${b.image ? `<img src="${esc(b.image)}" alt="">` : ''}
      </a>`).join('') || `<div class="hero-card" style="background:#111827"><h3>${esc(mallName)}</h3><p>${esc(tagline)}</p></div>`}
    </div>
    <div class="hero-dots" id="hero-dots">${banners.map((_, i) => `<i class="${i === 0 ? 'on' : ''}"></i>`).join('')}</div>
  </section>

  <nav class="cats" id="cat-chips" aria-label="카테고리">
    ${cats.map((c) => `<a class="cat-chip" href="#/category/${esc(c.slug)}"><b>${esc(c.icon || '🛍️')}</b>${esc(c.name)}</a>`).join('')}
  </nav>

  <section class="sec" id="section-deal">
    <div class="sec-hd"><h3>지금 <span>특가</span> 🔥</h3><a href="#/category/fashion">전체보기</a></div>
    <div class="hscroll">${featured.items.map((p) => pcard(p)).join('') || '<p class="muted pad">상품 준비중입니다.</p>'}</div>
  </section>

  <section class="sec" id="section-best">
    <div class="sec-hd"><h3>${esc(mallName)} <span>베스트</span></h3><a href="#/search?sort=popular">더보기</a></div>
    <div class="grid">${best.items.map((p) => pcard(p)).join('')}</div>
  </section>

  <section class="sec" id="section-new">
    <div class="sec-hd"><h3>새로 나왔어요</h3><a href="#/search?sort=new">더보기</a></div>
    <div class="grid">${newItems.items.map((p) => pcard(p)).join('')}</div>
  </section>

  <section class="sec" id="section-notice" style="padding-bottom:28px">
    <div class="sec-hd"><h3>공지사항</h3><a href="#/notices">전체</a></div>
    <div class="menu-list">
      ${(cfg.notices || []).slice(0, 3).map((n) => `<a class="menu-item" href="#/notices">
        <b>${n.is_pinned ? '📌' : '·'}</b><span class="grow">${esc(n.title)}</span><span class="arrow">›</span></a>`).join('')}
    </div>
  </section>
  <div style="height:20px"></div>`;
};

function mountHome() {
  const track = $('#hero-track');
  const dots = $$('#hero-dots i');
  if (!track || !dots.length) return;
  track.addEventListener('scroll', () => {
    const i = Math.round(track.scrollLeft / track.clientWidth);
    dots.forEach((d, k) => d.classList.toggle('on', k === i));
  }, { passive: true });
  // 자동 슬라이드
  let idx = 0;
  const timer = setInterval(() => {
    if (!document.body.contains(track)) return clearInterval(timer);
    if (dots.length < 2) return;
    idx = (idx + 1) % dots.length;
    track.scrollTo({ left: idx * track.clientWidth, behavior: 'smooth' });
  }, 4500);
}

/* 카테고리 목록 */
SCREENS.category = async (r) => {
  const slug = r.args[0];
  const cfg = state.config;
  const cat = (cfg.categories || []).find((c) => c.slug === slug || String(c.id) === slug);
  const sort = r.params.get('sort') || 'popular';
  const data = await api(`/products?category=${encodeURIComponent(slug)}&sort=${sort}&limit=40`);
  return `${renderSubHeader(cat ? cat.name : '카테고리')}
  <nav class="cats" style="padding-top:10px">
    ${(cfg.categories || []).map((c) => `<a class="cat-chip ${c.slug === slug ? 'on' : ''}" href="#/category/${esc(c.slug)}"><b>${esc(c.icon || '🛍️')}</b>${esc(c.name)}</a>`).join('')}
  </nav>
  ${sortbar(sort, `#/category/${slug}`)}
  <div class="sec" style="padding:14px 0 0">
    <div class="between pad mb8"><span class="muted">총 <b>${data.total}</b>개 상품</span></div>
    <div class="grid">${data.items.map((p) => pcard(p)).join('')}</div>
    ${data.items.length ? '' : `<div class="empty"><b>🛍️</b><p>해당 카테고리에 상품이 없습니다.</p></div>`}
  </div>
  <div style="height:16px"></div>`;
};

function sortbar(sort, base) {
  const items = [['popular', '인기순'], ['new', '신상품'], ['price_asc', '낮은가격'], ['price_desc', '높은가격'], ['rating', '평점순']];
  return `<div class="sortbar">${items.map(([k, l]) =>
    `<a href="${base}?sort=${k}"><button class="${sort === k ? 'on' : ''}">${l}</button></a>`).join('')}</div>`;
}

/* 검색 */
SCREENS.search = async (r) => {
  const q = r.params.get('q') || '';
  const sort = r.params.get('sort') || 'popular';
  let data = { items: [], total: 0 };
  if (q) data = await api(`/products?q=${encodeURIComponent(q)}&sort=${sort}&limit=40`);
  const hot = ['에어프라이어', '립스틱', '스니커즈', '세럼', '원두', '요가매트', '헤드폰'];
  return `${renderSubHeader('검색')}
  <div class="searchbar">
    <div class="box">🔍<input id="q-input" type="search" placeholder="어떤 상품을 찾으세요?" value="${esc(q)}" enterkeyhint="search"></div>
  </div>
  ${q ? `
    ${sortbar(sort, `#/search?q=${encodeURIComponent(q)}`)}
    <div style="padding:14px 16px 0"><span class="muted">'<b>${esc(q)}</b>' 검색결과 <b>${data.total}</b>개</span></div>
    <div class="grid mt12">${data.items.map((p) => pcard(p)).join('')}</div>
    ${data.items.length ? '' : `<div class="empty"><b>🔍</b><p>'${esc(q)}'에 대한 상품이 없어요.<br>다른 키워드로 검색해보세요.</p></div>`}`
  : `
    <section class="sec"><div class="sec-hd"><h3>인기 검색어</h3></div>
      <div class="keywords">${hot.map((k) => `<a href="#/search?q=${encodeURIComponent(k)}"><button>${esc(k)}</button></a>`).join('')}</div>
    </section>
    <section class="sec"><div class="sec-hd"><h3>MD 추천</h3></div>
      <div class="grid">${(await api('/products?sort=popular&limit=4')).items.map((p) => pcard(p)).join('')}</div>
    </section>`}
  <div style="height:16px"></div>`;
};

/* 상품 상세 */
SCREENS.product = async (r) => {
  const id = r.args[0];
  const [data, wish] = await Promise.all([
    api(`/products/${id}`),
    state.user ? api('/wishlist').catch(() => ({ items: [] })) : Promise.resolve({ items: [] }),
  ]);
  const p = data.product;
  const idx = wish.items.findIndex((w) => Number(w.product_id) === Number(p.id));
  const wished = idx >= 0 || state.wishes.has(Number(p.id));
  const price = p.sale_price ?? p.price;
  const off = p.sale_price ? Math.round((1 - p.sale_price / p.price) * 100) : 0;
  const opts = p.options || [];

  return `${renderSubHeader('상품 상세', {
    right: `<a class="hdr-ico" href="#/cart" style="margin-left:auto">🛍️${state.cart.count ? `<i class="hdr-badge">${state.cart.count}</i>` : ''}</a>`,
  })}
  <div class="screen">
    <div class="gallery">
      <div class="gallery-track" id="gal">
        ${(p.images.length ? p.images : [p.thumbnail]).map((src) => `<img src="${esc(src)}" alt="${esc(p.name)}">`).join('')}
      </div>
      <div class="gallery-num" id="gal-num">1 / ${Math.max(p.images.length, 1)}</div>
    </div>

    <div class="pd-head">
      <div class="pd-brand">${esc(p.brand || p.category_name)}</div>
      <h1 class="pd-name">${esc(p.name)}</h1>
      <p class="pd-summary">${esc(p.summary)}</p>
      <div class="pd-price">
        ${off ? `<span class="off">${off}%</span>` : ''}
        <span class="now">${won(price)}</span>
        ${off ? `<span class="was">${won(p.price)}</span>` : ''}
      </div>
      <div class="pd-rate"><em>★ ${Number(p.rating || 0).toFixed(1)}</em><span>리뷰 ${p.review_count}</span><span>·</span><span>판매 ${p.sales_count}</span></div>
    </div>

    <div class="opt-box">
      ${opts.map((o, i) => `<div>
        <div class="opt-label"><span>${esc(o.name)}</span><span class="tiny">필수</span></div>
        <select class="opt-sel" data-opt="${i}">
          <option value="">${esc(o.name)} 선택</option>
          ${o.values.map((v) => `<option value="${esc(v)}">${esc(v)}</option>`).join('')}
        </select>
      </div>`).join('')}
      <div class="opt-label"><span>수량</span><span class="tiny">재고 ${p.stock}개</span></div>
      <div class="between">
        <div class="qty">
          <button data-act="qty" data-d="-1">−</button>
          <span id="pd-qty">1</span>
          <button data-act="qty" data-d="1">＋</button>
        </div>
        <div style="font-size:17px;font-weight:800;letter-spacing:-.02em" id="pd-amount">${won(price)}</div>
      </div>
    </div>

    <div class="desc">
      <h4>상품 정보</h4>${esc(p.description)}
      <div class="divider"></div>
      <h4>배송 안내</h4>${p.shipping_fee > 0 ? `기본 배송비 ${won(p.shipping_fee)} · 3만원 이상 무료배송` : '무료배송'}
    </div>

    <div style="padding:20px 16px;border-top:8px solid var(--bg)">
      <h4 style="font-size:15px;font-weight:800;margin-bottom:6px">리뷰 <span style="color:var(--coral)">${data.reviews.length}</span></h4>
      ${data.reviews.length ? data.reviews.map((rv) => `
        <div class="review">
          <div class="review-hd"><b>${esc(rv.author || '구매자')}</b><em>${'★'.repeat(rv.rating)}${'☆'.repeat(5 - rv.rating)}</em>
            <span class="tiny" style="margin-left:auto">${esc((rv.created_at || '').slice(0, 10))}</span></div>
          <p>${esc(rv.content)}</p>
        </div>`).join('') : '<p class="muted mt12">아직 작성된 리뷰가 없습니다.</p>'}
    </div>

    <section class="sec" style="padding-bottom:20px">
      <div class="sec-hd"><h3>함께 보면 좋은 상품</h3></div>
      <div class="hscroll" style="padding:0">${data.related.map((x) => pcard(x)).join('')}</div>
    </section>
  </div>

  <div class="buybar">
    <button class="like ${wished ? 'on' : ''}" data-act="wish" data-id="${p.id}" aria-label="찜하기">♥</button>
    <button class="btn btn-line" data-act="add-cart" data-id="${p.id}">장바구니</button>
    <button class="btn btn-primary" data-act="buy-now" data-id="${p.id}">바로구매</button>
  </div>
  <div style="height:80px"></div>`;
};

let pdState = null;
function mountProductEvents() {
  const gal = $('#gal');
  if (gal) {
    const num = $('#gal-num');
    gal.addEventListener('scroll', () => {
      const i = Math.round(gal.scrollLeft / gal.clientWidth) + 1;
      if (num) num.textContent = `${i} / ${gal.children.length}`;
    }, { passive: true });
  }
  pdState = { qty: 1, price: 0, productId: null };
}

function buyPayload() {
  const selects = $$('.opt-sel');
  const missing = selects.find((s) => !s.value);
  const pid = Number(location.hash.match(/product\/(\d+)/)[1]);
  const productId = pid;
  const optionText = selects.map((s) => {
    const name = s.previousElementSibling?.querySelector('span')?.textContent || '';
    return `${name}: ${s.value}`;
  }).join(' / ');
  const qty = Number($('#pd-qty')?.textContent || 1);
  if (missing) { toast('옵션을 선택해주세요.'); return null; }
  return { productId, optionText, qty };
}

function recalcAmount() {
  const nowEl = $('.pd-price .now');
  const qty = Number($('#pd-qty')?.textContent || 1);
  const raw = (nowEl?.textContent || '0').replace(/[^0-9]/g, '');
  const unit = Number(raw || 0);
  const amt = $('#pd-amount');
  if (amt) amt.textContent = won(unit * qty);
}

/* ─────────────── 장바구니 ─────────────── */
SCREENS.cart = async () => {
  const cart = await api('/cart');
  state.cart = cart;
  const freeOver = Number(state.config?.settings?.free_shipping_over || 30000);
  const shipFee = cart.subtotal === 0 || cart.subtotal >= freeOver ? 0 : Number(state.config?.settings?.base_shipping_fee || 3000);
  const remain = Math.max(freeOver - cart.subtotal, 0);

  if (!cart.items.length) {
    return `${renderSubHeader('장바구니')}
      <div class="empty"><b>🛍️</b><p>장바구니가 비어 있어요.<br>마음에 드는 상품을 담아보세요.</p>
      <a class="btn btn-primary mt16" href="#/">쇼핑하러 가기</a></div>`;
  }

  return `${renderSubHeader('장바구니', { right: `<button class="btn btn-sm btn-line" style="margin-left:auto" data-act="cart-clear">전체삭제</button>` })}
  <div class="pad" style="padding-top:14px">
    ${remain > 0
      ? `<div class="card" style="background:var(--coral-soft);box-shadow:none;padding:13px 14px">
           <div class="between"><span style="font-size:12.5px;font-weight:700;color:var(--coral-dark)">${won(remain)} 더 담으면 무료배송!</span><span class="tiny">🚚</span></div>
           <div style="height:6px;background:#fff;border-radius:99px;margin-top:9px;overflow:hidden">
             <i style="display:block;height:100%;width:${Math.min(100, (cart.subtotal / freeOver) * 100)}%;background:var(--coral);border-radius:99px"></i>
           </div></div>`
      : `<div class="card" style="background:#ECFDF5;box-shadow:none;padding:13px 14px"><span style="font-size:12.5px;font-weight:700;color:#047857">🎉 무료배송 조건을 충족했어요!</span></div>`}

    <div class="card mt12">
      ${cart.items.map((it) => `
        <div class="citem">
          <a href="#/product/${it.productId}"><img src="${esc(it.thumbnail)}" alt="${esc(it.name)}"></a>
          <div class="grow">
            <a href="#/product/${it.productId}"><div class="citem-name">${esc(it.name)}</div></a>
            ${it.optionText ? `<div class="citem-opt">${esc(it.optionText)}</div>` : ''}
            <div class="between" style="margin-top:8px;align-items:flex-end">
              <div class="qty" style="transform:scale(.88);transform-origin:left bottom">
                <button data-act="cart-qty" data-id="${it.id}" data-q="${it.qty - 1}">−</button>
                <span>${it.qty}</span>
                <button data-act="cart-qty" data-id="${it.id}" data-q="${it.qty + 1}">＋</button>
              </div>
              <div class="citem-price">${won(it.amount)}</div>
            </div>
          </div>
        </div>`).join('')}
    </div>

    <div class="card mt12">
      <div class="summary">
        <div class="summary-line"><span>상품금액</span><span>${won(cart.subtotal)}</span></div>
        <div class="summary-line"><span>배송비</span><span>${shipFee ? won(shipFee) : '무료'}</span></div>
        <div class="summary-line total"><span>결제예상금액</span><b>${won(cart.subtotal + shipFee)}</b></div>
      </div>
      <button class="btn btn-primary btn-block mt12" data-act="go-checkout">${cart.count}개 상품 주문하기</button>
      <a class="btn btn-line btn-block mt8" href="#/">계속 쇼핑하기</a>
    </div>
  </div>
  <div style="height:24px"></div>`;
};

function mountCart() { syncBadges(); }

/* ─────────────── 주문서 ─────────────── */
SCREENS.checkout = async (r) => {
  const direct = r.params.get('direct') === '1';
  let items = [];
  if (direct) {
    const raw = sessionStorage.getItem('moa_direct');
    items = raw ? JSON.parse(raw) : [];
  } else {
    const c = await api('/cart');
    items = c.items.map((i) => ({ productId: i.productId, optionText: i.optionText, qty: i.qty, name: i.name, thumbnail: i.thumbnail, price: i.price, amount: i.amount }));
  }
  if (!items.length) return `${renderSubHeader('주문서')}<div class="empty"><b>🧾</b><p>주문할 상품이 없습니다.</p><a class="btn btn-line mt16" href="#/">홈으로</a></div>`;

  const subtotal = items.reduce((s, i) => s + (i.price || 0) * i.qty, 0);
  const freeOver = Number(state.config?.settings?.free_shipping_over || 30000);
  const shipFee = subtotal >= freeOver ? 0 : Number(state.config?.settings?.base_shipping_fee || 3000);
  const addrs = state.user ? (await api('/addresses')).items : [];
  const def = addrs.find((a) => a.is_default) || addrs[0] || null;

  return `${renderSubHeader('주문서')}
  <div class="steps"><span class="on">01 장바구니</span><i></i><span class="on">02 주문서</span><i></i><span>03 완료</span></div>
  <div class="pad" style="padding-top:14px">

    <section class="card">
      <h3 style="font-size:14px;font-weight:800;margin-bottom:10px">주문 상품 ${items.length}건</h3>
      ${items.map((it) => `<div class="citem" style="padding:9px 0">
        <img src="${esc(it.thumbnail)}" alt="" style="width:56px;height:56px">
        <div class="grow"><div class="citem-name" style="font-size:13px">${esc(it.name)}</div>
          ${it.optionText ? `<div class="citem-opt">${esc(it.optionText)}</div>` : ''}
          <div class="tiny" style="margin-top:3px">${won(it.price)} × ${it.qty}개</div></div>
        <div style="font-weight:800;font-size:14px">${won(it.price * it.qty)}</div>
      </div>`).join('')}
    </section>

    <section class="card mt12">
      <div class="between mb8"><h3 style="font-size:14px;font-weight:800">배송 정보</h3>
        ${addrs.length ? `<button class="btn btn-sm btn-soft" data-act="pick-addr">배송지 선택</button>` : ''}</div>
      <div class="field"><label>받는분 *</label>
        <input id="co-receiver" value="${esc(def?.receiver || state.user?.name || '')}" placeholder="받는분 이름"></div>
      <div class="field"><label>연락처 *</label>
        <input id="co-phone" value="${esc(def?.phone || state.user?.phone || '')}" placeholder="010-0000-0000" inputmode="tel"></div>
      <div class="field"><label>주소 *</label>
        <input id="co-zip" value="${esc(def?.zipcode || '')}" placeholder="우편번호" style="margin-bottom:6px">
        <input id="co-addr1" value="${esc(def?.addr1 || '')}" placeholder="도로명 주소" style="margin-bottom:6px">
        <input id="co-addr2" value="${esc(def?.addr2 || '')}" placeholder="상세주소"></div>
      <div class="field" style="margin-bottom:0"><label>배송 요청사항</label>
        <select class="opt-sel" id="co-memo" style="margin-bottom:0">
          <option value="">선택 안함</option>
          <option>문 앞에 놓아주세요</option>
          <option>경비실에 맡겨주세요</option>
          <option>배송 전 연락주세요</option>
          <option>택배함에 넣어주세요</option>
        </select></div>
    </section>

    <section class="card mt12">
      <h3 style="font-size:14px;font-weight:800;margin-bottom:10px">쿠폰 / 할인</h3>
      <div class="field-row">
        <input id="co-coupon" placeholder="쿠폰 코드 입력" style="flex:1;border:1.5px solid var(--line);border-radius:12px;padding:12px 13px;outline:none">
        <button class="btn btn-dark" style="flex:0 0 auto;padding:12px 16px;font-size:13.5px" data-act="apply-coupon">적용</button>
      </div>
      <div id="coupon-result" class="tiny" style="margin-top:8px"></div>
      <div class="keywords" style="padding:10px 0 0" id="coupon-chips"></div>
    </section>

    <section class="card mt12">
      <h3 style="font-size:14px;font-weight:800;margin-bottom:10px">결제 수단</h3>
      <div class="pay-opt on" data-pay="demo"><span class="dot"></span>데모 결제 (테스트)</div>
      <div class="pay-opt" data-pay="bank"><span class="dot"></span>무통장 입금</div>
      <p class="tiny" style="margin-top:8px">※ 본 사이트는 데모 버전으로 실제 결제가 발생하지 않습니다.</p>
    </section>

    <section class="card mt12">
      <div class="summary">
        <div class="summary-line"><span>상품금액</span><span>__SUBTOTAL__</span></div>
        <div class="summary-line"><span>쿠폰 할인</span><span id="co-discount">-0원</span></div>
        <div class="summary-line"><span>배송비</span><span>__SHIP__</span></div>
        <div class="summary-line total"><span>총 결제금액</span><b id="co-total">__TOTAL__</b></div>
      </div>
    </section>

    <button class="btn btn-primary btn-block mt12" data-act="pay" id="pay-btn">__TOTAL__ 결제하기</button>
    <p class="tiny" style="text-align:center;margin-top:10px">주문 시 개인정보 수집·이용에 동의하게 됩니다.</p>
  </div>
  <div style="height:28px"></div>`
    .replace(/__SUBTOTAL__/g, won(subtotal))
    .replace(/__SHIP__/g, shipFee ? won(shipFee) : '무료')
    .replace(/__TOTAL__/g, won(subtotal + shipFee));
};

let coState = null;
async function mountCheckout(r) {
  const direct = r.params.get('direct') === '1';
  let items = [];
  if (direct) {
    items = JSON.parse(sessionStorage.getItem('moa_direct') || '[]');
  } else {
    const c = await api('/cart');
    items = c.items.map((i) => ({ productId: i.productId, optionText: i.optionText, qty: i.qty, name: i.name, thumbnail: i.thumbnail, price: i.price }));
  }
  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
  coState = { items, subtotal, discount: 0, couponCode: '', payMethod: 'demo', direct };

  // 사용 가능 쿠폰 칩
  try {
    const cps = await api('/coupons');
    const box = $('#coupon-chips');
    if (box) {
      box.innerHTML = cps.items.map((c) => {
        const ok = subtotal >= c.min_order;
        return `<button data-act="coupon-chip" data-code="${esc(c.code)}" style="${ok ? '' : 'opacity:.45'}"
          title="${ok ? '' : '최소 주문금액 미달'}">🎟 ${esc(c.code)}</button>`;
      }).join('');
    }
  } catch (_) {}

  // 결제수단 선택
  $$('.pay-opt').forEach((el) => {
    el.addEventListener('click', () => {
      $$('.pay-opt').forEach((x) => x.classList.remove('on'));
      el.classList.add('on');
      coState.payMethod = el.dataset.pay;
    });
  });
}

function recalcCheckout() {
  if (!coState) return;
  const freeOver = Number(state.config?.settings?.free_shipping_over || 30000);
  const shipFee = coState.subtotal >= freeOver || coState.subtotal === 0 ? 0 : Number(state.config?.settings?.base_shipping_fee || 3000);
  const total = coState.subtotal - coState.discount + shipFee;
  const dEl = $('#co-discount');
  const tEl = $('#co-total');
  const pEl = $('#pay-btn');
  if (dEl) dEl.textContent = '-' + won(coState.discount);
  if (tEl) tEl.textContent = won(total);
  if (pEl) pEl.textContent = won(total) + ' 결제하기';
}

/* ─────────────── 주문 완료 ─────────────── */
SCREENS.done = async (r) => {
  const no = decodeURIComponent(r.args[0]);
  let order = null;
  try { order = (await api('/orders/' + encodeURIComponent(no))).order; } catch (_) {}
  const cached = sessionStorage.getItem('moa_last_order');
  if (!order && cached) {
    const c = JSON.parse(cached);
    if (c.orderNo === no) order = c;
  }
  const point = order ? Math.floor(order.total * Number(state.config?.settings?.point_rate || 1) / 100) : 0;

  return `<header class="subhdr"><h2>주문 완료</h2></header>
  <div class="done">
    <div class="done-ico">✓</div>
    <h2>주문이 완료되었습니다</h2>
    <p>주문번호 <b style="color:var(--ink)">${esc(no)}</b><br>${order ? '결제금액 ' + won(order.total) : ''}</p>
    ${point ? `<div style="display:inline-block;margin-top:14px;background:var(--coral-soft);color:var(--coral-dark);font-size:12.5px;font-weight:800;padding:7px 14px;border-radius:99px">🎁 ${won(point)} 적립 예정</div>` : ''}
  </div>
  ${order ? `<div class="pad">
    <div class="card">
      <div class="between mb8"><h3 style="font-size:14px;font-weight:800">배송지</h3></div>
      <p style="font-size:13.5px;color:var(--ink-2)">${esc(order.receiver)} · ${esc(order.receiver_phone)}</p>
      <p class="muted mt8">${esc(order.addr1)} ${esc(order.addr2 || '')}</p>
      <div class="divider"></div>
      ${(order.items || []).map((it) => `<div class="citem" style="padding:8px 0">
        <img src="${esc(it.thumbnail)}" alt="" style="width:52px;height:52px">
        <div class="grow"><div class="citem-name" style="font-size:13px">${esc(it.name)}</div>
          ${it.option_text ? `<div class="citem-opt">${esc(it.option_text)}</div>` : ''}</div>
        <div style="font-weight:700;font-size:13px">${won(it.price * it.qty)}</div>
      </div>`).join('')}
    </div>
  </div>` : ''}
  <div class="pad mt12">
    <a class="btn btn-primary btn-block" href="#/orders/${encodeURIComponent(no)}">주문 상세보기</a>
    <a class="btn btn-line btn-block mt8" href="#/">계속 쇼핑하기</a>
  </div>
  <div style="height:24px"></div>`;
};

/* ─────────────── 주문 내역 ─────────────── */
SCREENS.orders = async () => {
  if (!state.user) return loginPrompt('주문 내역을 확인하려면 로그인이 필요합니다.');
  const data = await api('/orders');
  if (!data.items.length) {
    return `${renderSubHeader('주문 내역')}
    <div class="empty"><b>📦</b><p>아직 주문 내역이 없습니다.</p><a class="btn btn-primary mt16" href="#/">쇼핑하러 가기</a></div>`;
  }
  return `${renderSubHeader('주문 내역')}
  <div class="pad" style="padding-top:14px">
    ${data.items.map((o) => `<a class="ocard" href="#/orders/${encodeURIComponent(o.order_no)}">
      <div class="between"><span class="ostatus ${o.status}">${esc(o.statusLabel)}</span>
        <span class="tiny">${esc((o.created_at || '').slice(0, 10))}</span></div>
      <div class="row mt12" style="align-items:flex-start">
        <img src="${esc(o.thumbnail || '')}" alt="" style="width:56px;height:56px;border-radius:10px;object-fit:cover;background:var(--bg)">
        <div class="grow">
          <div class="citem-name" style="font-size:13.5px">${esc(o.first_item || '')} ${o.item_count > 1 ? `외 ${o.item_count - 1}건` : ''}</div>
          <div class="tiny" style="margin-top:4px">${esc(o.order_no)}</div>
        </div>
        <div style="font-weight:800;font-size:15px">${won(o.total)}</div>
      </div>
    </a>`).join('')}
  </div>
  <div style="height:20px"></div>`;
};

/* 주문 상세 */
SCREENS.orderDetail = async (r) => {
  const no = decodeURIComponent(r.args[0]);
  const { order: o } = await api('/orders/' + encodeURIComponent(no));
  const canCancel = ['paid', 'preparing', 'pending'].includes(o.status);
  return `${renderSubHeader('주문 상세')}
  <div class="pad" style="padding-top:14px">
    <div class="card">
      <div class="between"><h3 style="font-size:15px;font-weight:800">${esc(o.order_no)}</h3>
        <span class="ostatus ${o.status}">${esc(o.statusLabel)}</span></div>
      <p class="tiny mt8">${esc((o.created_at || '').replace('T', ' ').slice(0, 16))}</p>
    </div>
    <div class="card mt12">
      <h3 style="font-size:14px;font-weight:800;margin-bottom:10px">주문 상품</h3>
      ${o.items.map((it) => `<div class="citem" style="padding:9px 0">
        <img src="${esc(it.thumbnail)}" alt="" style="width:56px;height:56px">
        <div class="grow"><div class="citem-name" style="font-size:13px">${esc(it.name)}</div>
          ${it.option_text ? `<div class="citem-opt">${esc(it.option_text)}</div>` : ''}
          <div class="tiny" style="margin-top:3px">${won(it.price)} × ${it.qty}개</div></div>
        <div style="font-weight:800;font-size:14px">${won(it.price * it.qty)}</div>
      </div>`).join('')}
      <div class="divider"></div>
      <div class="summary-line"><span>상품금액</span><span>${won(o.subtotal)}</span></div>
      ${o.discount ? `<div class="summary-line"><span>쿠폰 할인</span><span style="color:var(--coral)">-${won(o.discount)}</span></div>` : ''}
      <div class="summary-line"><span>배송비</span><span>${o.shipping_fee ? won(o.shipping_fee) : '무료'}</span></div>
      <div class="summary-line total"><span>총 결제금액</span><b>${won(o.total)}</b></div>
    </div>
    <div class="card mt12">
      <h3 style="font-size:14px;font-weight:800;margin-bottom:10px">배송 정보</h3>
      <div class="summary-line"><span>받는분</span><span>${esc(o.receiver)}</span></div>
      <div class="summary-line"><span>연락처</span><span>${esc(o.receiver_phone)}</span></div>
      <div class="summary-line"><span>주소</span><span style="text-align:right;max-width:60%">${esc(o.addr1)} ${esc(o.addr2 || '')}</span></div>
      ${o.memo ? `<div class="summary-line"><span>요청사항</span><span>${esc(o.memo)}</span></div>` : ''}
    </div>
    ${canCancel ? `<button class="btn btn-line btn-block mt12" data-act="cancel-order" data-no="${esc(o.order_no)}">주문 취소</button>` : ''}
  </div>
  <div style="height:24px"></div>`;
};

/* 비회원 주문조회 */
SCREENS.lookup = async () => `${renderSubHeader('비회원 주문조회')}
  <div class="pad" style="padding-top:16px">
    <div class="card">
      <div class="field"><label>주문번호</label><input id="lk-no" placeholder="MOA20260101XXXX"></div>
      <div class="field"><label>주문자 연락처</label><input id="lk-phone" placeholder="010-0000-0000" inputmode="tel"></div>
      <button class="btn btn-primary btn-block" data-act="lookup">주문 조회</button>
    </div>
    <div id="lk-result" class="mt12"></div>
  </div>`;

/* ─────────────── 로그인 / 회원가입 ─────────────── */
function loginPrompt(msg) {
  return `${renderSubHeader('로그인 필요')}
    <div class="empty"><b>🔐</b><p>${esc(msg)}</p>
      <a class="btn btn-primary mt16" href="#/login">로그인</a>
      <a class="btn btn-line mt8" href="#/join">회원가입</a>
    </div>`;
}

SCREENS.login = async () => `<header class="subhdr">
    <button class="back" data-act="back">✕</button><h2>로그인</h2></header>
  <div style="padding:34px 20px 24px">
    <div style="text-align:center;margin-bottom:26px">
      <div style="font-size:27px;font-weight:800;letter-spacing:-.05em">MOA<b style="color:var(--coral)">SHOP</b></div>
      <p class="muted mt8">${esc(state.config?.settings?.mall_tagline || '')}</p>
    </div>
    <div class="field"><label>이메일</label><input id="lg-email" type="email" placeholder="you@example.com" autocomplete="email"></div>
    <div class="field"><label>비밀번호</label><input id="lg-pw" type="password" placeholder="비밀번호" autocomplete="current-password"></div>
    <div id="lg-error" class="tiny" style="color:#DC2626;min-height:16px;margin-bottom:6px"></div>
    <button class="btn btn-primary btn-block" data-act="login">로그인</button>
    <div class="between mt16">
      <a class="tiny" href="#/join" style="color:var(--gray)">회원가입</a>
      <a class="tiny" href="#/lookup" style="color:var(--gray)">비회원 주문조회</a>
    </div>
    <div class="card mt24" style="background:var(--bg);box-shadow:none">
      <p class="tiny" style="font-weight:700;color:var(--ink-2)">데모 계정</p>
      <p class="tiny mt8">demo@moa.shop / demo1234</p>
    </div>
  </div>`;

SCREENS.join = async () => `<header class="subhdr">
    <button class="back" data-act="back">‹</button><h2>회원가입</h2></header>
  <div style="padding:24px 20px">
    <div class="field"><label>이름 *</label><input id="jn-name" placeholder="홍길동"></div>
    <div class="field"><label>이메일 *</label><input id="jn-email" type="email" placeholder="you@example.com" autocomplete="email"></div>
    <div class="field"><label>비밀번호 * (6자 이상)</label><input id="jn-pw" type="password" placeholder="비밀번호" autocomplete="new-password"></div>
    <div class="field"><label>휴대폰</label><input id="jn-phone" placeholder="010-0000-0000" inputmode="tel"></div>
    <label class="check mt8"><input type="checkbox" id="jn-mkt" checked>마케팅 정보 수신 동의 (선택)</label>
    <div id="jn-error" class="tiny" style="color:#DC2626;min-height:16px;margin:10px 0 6px"></div>
    <button class="btn btn-primary btn-block" data-act="join">가입하고 3,000원 쿠폰 받기</button>
    <p class="tiny" style="text-align:center;margin-top:14px">이미 회원이신가요? <a href="#/login" style="color:var(--coral);font-weight:700">로그인</a></p>
  </div>`;

function mountAuth(kind) {
  const submit = async () => {
    const btn = $('.btn-primary');
    if (btn && btn.disabled) return; // 중복 제출 방지
    if (btn) btn.disabled = true;
    try {
      if (kind === 'login') {
        const email = $('#lg-email').value.trim();
        const password = $('#lg-pw').value;
        if (!email || !password) throw new Error('이메일과 비밀번호를 입력해주세요.');
        const { user } = await api('/auth/login', { method: 'POST', body: { email, password } });
        state.user = user;
        await refreshAll();
        toast(user.name + '님 환영합니다!');
        const dest = sessionStorage.getItem('moa_after_login') || '#/mypage';
        sessionStorage.removeItem('moa_after_login');
        go(dest);
      } else {
        const name = $('#jn-name').value.trim();
        const email = $('#jn-email').value.trim();
        const password = $('#jn-pw').value;
        const phone = $('#jn-phone').value.trim();
        const marketing = $('#jn-mkt').checked;
        if (!name || !email || !password) throw new Error('필수 항목을 입력해주세요.');
        const { user } = await api('/auth/register', { method: 'POST', body: { name, email, password, phone, marketing } });
        state.user = user;
        await refreshAll();
        toast('가입을 환영합니다! 3,000원 쿠폰이 발급되었어요 🎉');
        go('#/mypage');
      }
    } catch (e) {
      const err = kind === 'login' ? $('#lg-error') : $('#jn-error');
      if (err) err.textContent = e.message;
      else toast(e.message);
    } finally {
      if (btn) btn.disabled = false;
    }
  };
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (location.hash.includes('/login') || location.hash.includes('/join'))) submit();
  }, { once: true });
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-act="login"],[data-act="join"]');
    if (t) submit();
  });
}

/* ─────────────── 마이페이지 ─────────────── */
SCREENS.mypage = async () => {
  if (!state.user) return loginPrompt('로그인하고 주문·찜 내역을 확인하세요.');
  const me = await api('/auth/me');
  state.counts = me.counts || { orders: 0, wishes: 0 };
  const u = me.user;
  return `${renderTopbar()}
  <section class="me-head">
    <div class="between"><div>
      <div class="me-name">${esc(u.name)} <span class="tiny" style="font-weight:500">님</span></div>
      <p class="tiny" style="margin-top:4px">${esc(u.email)}</p>
    </div><button class="btn btn-sm btn-line" data-act="logout">로그아웃</button></div>
    <div class="me-stats">
      <a class="me-stat" href="#/orders"><b>${state.counts.orders}</b><span>주문내역</span></a>
      <a class="me-stat" href="#/wishlist"><b>${state.counts.wishes}</b><span>찜한상품</span></a>
      <a class="me-stat" href="#/cart"><b>${state.cart.count}</b><span>장바구니</span></a>
    </div>
  </section>
  <div class="pad" style="padding-top:16px">
    <div class="menu-list">
      <a class="menu-item" href="#/orders"><b>📦</b><span>주문 내역</span><span class="arrow">›</span></a>
      <a class="menu-item" href="#/wishlist"><b>♥</b><span>찜한 상품</span><span class="arrow">›</span></a>
      <a class="menu-item" href="#/lookup"><b>🔎</b><span>비회원 주문조회</span><span class="arrow">›</span></a>
      <a class="menu-item" href="#/notices"><b>📢</b><span>공지사항</span><span class="arrow">›</span></a>
    </div>
    <div class="menu-list mt12">
      <button class="menu-item" data-act="edit-profile" style="width:100%;text-align:left"><b>✏️</b><span>회원정보 수정</span><span class="arrow">›</span></button>
      <a class="menu-item" href="#/app"><b>📲</b><span>앱으로 설치하기</span><span class="arrow">›</span></a>
    </div>
    <div class="card mt16" style="background:var(--bg);box-shadow:none">
      <p class="tiny" style="font-weight:700;color:var(--ink-2)">고객센터</p>
      <p class="tiny mt8">${esc(state.config?.settings?.cs_phone || '1588-0000')} · ${esc(state.config?.settings?.cs_hours || '')}</p>
    </div>
    <a class="btn btn-line btn-block mt12" href="/admin" target="_blank" rel="noopener">관리자 페이지 (데모)</a>
  </div>
  <div style="height:24px"></div>`;
};

SCREENS.wishlist = async () => {
  if (!state.user) return loginPrompt('로그인하고 찜한 상품을 확인하세요.');
  const data = await api('/wishlist');
  if (!data.items.length) {
    return `${renderSubHeader('찜한 상품')}<div class="empty"><b>♡</b><p>아직 찜한 상품이 없습니다.</p>
      <a class="btn btn-primary mt16" href="#/">상품 보러가기</a></div>`;
  }
  state.wishes = new Set(data.items.map((i) => Number(i.product_id)));
  return `${renderSubHeader('찜한 상품')}
  <div class="grid mt12" style="padding-top:8px">
    ${data.items.map((i) => pcard({ id: i.product_id, name: i.name, price: i.price, sale_price: i.sale_price, thumbnail: i.thumbnail, rating: i.rating, review_count: 0, brand: '' })).join('')}
  </div>
  <div style="height:20px"></div>`;
};

function mountWish() { syncBadges(); }

/* 공지사항 */
SCREENS.notices = async () => {
  const items = state.config?.notices || [];
  return `${renderSubHeader('공지사항')}
  <div class="pad" style="padding-top:14px">
    <div class="menu-list">
      ${items.map((n) => `<div class="menu-item" style="flex-direction:column;align-items:flex-start;gap:6px">
        <div class="row" style="width:100%"><b>${n.is_pinned ? '📌' : '·'}</b>
          <span style="font-weight:700;font-size:14px">${esc(n.title)}</span></div>
        <p class="muted" style="padding-left:32px;font-size:13px;line-height:1.6">${esc(n.content)}</p>
      </div>`).join('') || '<div class="menu-item">등록된 공지사항이 없습니다.</div>'}
    </div>
  </div>
  <div style="height:24px"></div>`;
};

/* ─────────────── 공통 동작 ─────────────── */
function syncBadges() {
  const n = state.cart.count || 0;
  $$('.hdr-badge').forEach((el) => { el.textContent = n > 99 ? '99+' : n; el.style.display = n ? 'grid' : 'none'; });
  const tabCnt = $('.tab .cnt');
  if (tabCnt) { tabCnt.textContent = n > 99 ? '99+' : n; tabCnt.style.display = n ? 'grid' : 'none'; }
}

async function refreshAll() {
  const [cfg, cart] = await Promise.all([
    api('/config').catch(() => state.config),
    api('/cart').catch(() => state.cart),
  ]);
  state.config = cfg;
  state.cart = cart;
  try {
    const me = await api('/auth/me');
    state.user = me.user;
    state.counts = me.counts || { orders: 0, wishes: 0 };
  } catch (_) { state.user = null; }
  syncBadges();
}

async function toggleWish(id) {
  if (!state.user) { toast('로그인 후 찜할 수 있어요.'); location.hash = '#/login'; return; }
  try {
    const r = await api('/wishlist/' + id, { method: 'POST' });
    if (r.wished) state.wishes.add(Number(id)); else state.wishes.delete(Number(id));
    $$(`[data-act="wish"][data-id="${id}"]`).forEach((b) => b.classList.toggle('on', r.wished));
    toast(r.wished ? '찜한 상품에 추가했어요 ♥' : '찜을 해제했어요.');
  } catch (e) { toast(e.message); }
}

/* 이벤트 위임 */
document.addEventListener('click', async (e) => {
  const navEl = e.target.closest('[data-nav]');
  if (navEl) { go(navEl.dataset.nav); return; }

  const el = e.target.closest('[data-act]');
  if (!el) return;
  const act = el.dataset.act;

  if (act === 'back') { back(); return; }

  if (act === 'wish') {
    e.preventDefault(); e.stopPropagation();
    await toggleWish(Number(el.dataset.id)); return;
  }

  if (act === 'qty') {
    const span = $('#pd-qty');
    const max = (() => {
      const txt = document.querySelector('.opt-label .tiny')?.textContent || '';
      const m = txt.match(/\d+/);
      return m ? Number(m[0]) : 99;
    })();
    let v = Number(span.textContent) + Number(el.dataset.d);
    v = Math.max(1, Math.min(v, max));
    span.textContent = v;
    recalcAmount();
    return;
  }

  if (act === 'add-cart' || act === 'buy-now') {
    const payload = buyPayload();
    if (!payload) return;
    el.disabled = true;
    try {
      if (act === 'add-cart') {
        state.cart = await api('/cart', { method: 'POST', body: payload });
        syncBadges();
        toast('장바구니에 담았어요 🛍️');
        setTimeout(() => { if (confirm('장바구니로 이동할까요?')) go('#/cart'); }, 120);
      } else {
        sessionStorage.setItem('moa_direct', JSON.stringify([{
          productId: payload.productId, optionText: payload.optionText, qty: payload.qty,
          name: $('.pd-name').textContent,
          thumbnail: $('.gallery-track img').getAttribute('src'),
          price: Number(($('.pd-price .now').textContent || '0').replace(/[^0-9]/g, '')),
        }]));
        go('#/checkout?direct=1');
      }
    } catch (err) { toast(err.message); }
    finally { el.disabled = false; }
    return;
  }

  if (act === 'cart-qty') {
    const q = Number(el.dataset.q);
    try {
      state.cart = await api('/cart/' + el.dataset.id, { method: 'PATCH', body: { qty: q } });
      syncBadges(); route();
    } catch (err) { toast(err.message); }
    return;
  }

  if (act === 'cart-clear') {
    if (!confirm('장바구니를 모두 비울까요?')) return;
    state.cart = await api('/cart', { method: 'DELETE' });
    syncBadges(); route(); return;
  }

  if (act === 'go-checkout') { go('#/checkout'); return; }

  if (act === 'coupon-chip') {
    const box = $('#co-coupon');
    if (box) box.value = el.dataset.code;
    el.click && applyCoupon();
    return;
  }

  if (act === 'apply-coupon') { await applyCoupon(); return; }

  if (act === 'pay') {
    if (!coState) return;
    const receiver = $('#co-receiver').value.trim();
    const phone = $('#co-phone').value.trim();
    const addr1 = $('#co-addr1').value.trim();
    if (!receiver) return toast('받는분을 입력해주세요.');
    if (!phone) return toast('연락처를 입력해주세요.');
    if (!addr1) return toast('주소를 입력해주세요.');
    el.disabled = true;
    el.textContent = '결제 처리 중...';
    try {
      const body = {
        receiver, receiverPhone: phone,
        zipcode: $('#co-zip').value.trim(), addr1, addr2: $('#co-addr2').value.trim(),
        memo: $('#co-memo').value,
        couponCode: coState.couponCode,
        payMethod: coState.payMethod,
        ordererName: state.user?.name || receiver,
        ordererPhone: phone,
      };
      if (!coState.direct) {
        // 장바구니 주문
      } else {
        body.items = coState.items.map((i) => ({ productId: i.productId, optionText: i.optionText, qty: i.qty }));
      }
      const { order } = await api('/orders', { method: 'POST', body });
      sessionStorage.setItem('moa_last_order', JSON.stringify(order));
      sessionStorage.removeItem('moa_direct');
      state.cart = { items: [], subtotal: 0, count: 0 };
      syncBadges();
      go('#/done/' + encodeURIComponent(order.orderNo));
    } catch (err) {
      toast(err.message);
      el.disabled = false;
      recalcCheckout();
    }
    return;
  }

  if (act === 'lookup') {
    const orderNo = $('#lk-no').value.trim();
    const phone = $('#lk-phone').value.trim();
    const box = $('#lk-result');
    try {
      const { order } = await api('/orders/lookup', { method: 'POST', body: { orderNo, phone } });
      box.innerHTML = `<div class="card">
        <div class="between"><b style="font-size:14px">${esc(order.order_no)}</b>
          <span class="ostatus ${order.status}">${esc(order.statusLabel)}</span></div>
        <p class="tiny mt8">${esc((order.created_at || '').slice(0, 16))}</p>
        <div class="divider"></div>
        ${order.items.map((it) => `<div class="citem" style="padding:8px 0">
          <img src="${esc(it.thumbnail)}" style="width:52px;height:52px">
          <div class="grow"><div class="citem-name" style="font-size:13px">${esc(it.name)}</div></div>
          <div style="font-weight:700;font-size:13px">${won(it.price * it.qty)}</div></div>`).join('')}
        <div class="summary-line total" style="border-top:0"><span>결제금액</span><b>${won(order.total)}</b></div>
        <a class="btn btn-line btn-block mt8" href="#/orders/${encodeURIComponent(order.order_no)}">상세보기</a>
      </div>`;
    } catch (err) {
      box.innerHTML = `<div class="card" style="background:#FEF2F2;box-shadow:none"><p class="tiny" style="color:#DC2626">${esc(err.message)}</p></div>`;
    }
    return;
  }

  if (act === 'cancel-order') {
    if (!confirm('주문을 취소하시겠어요?')) return;
    try {
      await api('/orders/' + encodeURIComponent(el.dataset.no) + '/cancel', { method: 'POST' });
      toast('주문이 취소되었습니다.');
      route();
    } catch (err) { toast(err.message); }
    return;
  }

  if (act === 'logout') {
    await api('/auth/logout', { method: 'POST' });
    state.user = null;
    toast('로그아웃되었습니다.');
    go('#/');
    return;
  }

  if (act === 'edit-profile') {
    const name = prompt('이름', state.user.name);
    if (name == null) return;
    const phone = prompt('휴대폰 번호', state.user.phone || '');
    await api('/auth/me', { method: 'PATCH', body: { name, phone } });
    toast('회원정보가 수정되었습니다.');
    route();
    return;
  }

  if (act === 'pick-addr') {
    const items = (await api('/addresses')).items;
    if (!items.length) return toast('저장된 배송지가 없습니다.');
    const pick = prompt('배송지 선택\n' + items.map((a, i) => `${i + 1}. ${a.receiver} / ${a.addr1}`).join('\n') + '\n\n번호 입력');
    const idx = Number(pick) - 1;
    if (items[idx]) {
      $('#co-receiver').value = items[idx].receiver;
      $('#co-phone').value = items[idx].phone;
      $('#co-zip').value = items[idx].zipcode || '';
      $('#co-addr1').value = items[idx].addr1;
      $('#co-addr2').value = items[idx].addr2 || '';
    }
    return;
  }
});

async function applyCoupon() {
  const code = ($('#co-coupon')?.value || '').trim().toUpperCase();
  const box = $('#coupon-result');
  if (!code) { if (box) box.textContent = ''; coState.discount = 0; coState.couponCode = ''; recalcCheckout(); return; }
  try {
    const r = await api('/coupons/apply', { method: 'POST', body: { code, subtotal: coState.subtotal } });
    coState.discount = r.discount;
    coState.couponCode = r.code;
    if (box) box.innerHTML = `<span style="color:#059669;font-weight:700">✓ ${esc(r.name)} 적용 (-${won(r.discount)})</span>`;
    recalcCheckout();
    toast('쿠폰이 적용되었습니다.');
  } catch (e) {
    coState.discount = 0; coState.couponCode = '';
    if (box) box.innerHTML = `<span style="color:#DC2626">${esc(e.message)}</span>`;
    recalcCheckout();
  }
}

/* 검색 입력 Enter */
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.id === 'q-input') {
    const q = e.target.value.trim();
    go(q ? `#/search?q=${encodeURIComponent(q)}` : '#/search');
  }
});

/* ─────────────── PWA ─────────────── */
function setupPWA() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {});
    });
  }
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    state.deferredPrompt = e;
    if (localStorage.getItem('moa_install_dismissed') === '1') return;
    showInstallBanner();
  });
  window.addEventListener('appinstalled', () => {
    state.deferredPrompt = null;
    localStorage.setItem('moa_install_dismissed', '1');
    const b = $('.install'); if (b) b.remove();
  });
  const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
  if (standalone) return;
  if (localStorage.getItem('moa_install_dismissed') === '1') return;
  // iOS 등 beforeinstallprompt 미지원 → 안내 배너
  setTimeout(() => {
    if (!state.deferredPrompt && !$('.install') && document.body.contains($('.app'))) showInstallBanner(true);
  }, 6000);
}

function showInstallBanner(iosHint = false) {
  if ($('.install')) return;
  const el = document.createElement('div');
  el.className = 'install';
  el.innerHTML = `<img src="/static/icons/icon-192.png" alt="">
    <div class="grow"><b>MOA SHOP 앱 설치</b>
      <span>${iosHint ? 'Safari 하단 공유 → 홈 화면에 추가' : '홈 화면에 추가하고 더 빠르게 쇼핑하세요'}</span></div>
    <button class="btn btn-sm" style="background:var(--coral);color:#fff;padding:8px 13px">설치</button>
    <button class="x" aria-label="닫기">✕</button>`;
  document.body.appendChild(el);
  el.querySelector('.btn').addEventListener('click', async () => {
    if (state.deferredPrompt) {
      state.deferredPrompt.prompt();
      const { outcome } = await state.deferredPrompt.userChoice;
      if (outcome === 'accepted') el.remove();
      state.deferredPrompt = null;
    } else {
      alert(iosHint
        ? 'Safari 하단의 공유 버튼을 누른 뒤 "홈 화면에 추가"를 선택하세요.'
        : '브라우저 메뉴에서 "앱 설치" 또는 "홈 화면에 추가"를 선택하세요.');
    }
  });
  el.querySelector('.x').addEventListener('click', () => {
    localStorage.setItem('moa_install_dismissed', '1');
    el.remove();
  });
}

/* ─────────────── 부트스트랩 ─────────────── */
(async function boot() {
  window.addEventListener('hashchange', route);
  try {
    await refreshAll();
  } catch (e) {
    console.error(e);
  }
  await route();
  setupPWA();
})();
