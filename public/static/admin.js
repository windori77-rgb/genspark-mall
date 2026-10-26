/* MOA SHOP · 관리자 SPA */
'use strict';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const won = (n) => Number(n || 0).toLocaleString('ko-KR') + '원';
const num = (n) => Number(n || 0).toLocaleString('ko-KR');
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const dt = (s) => String(s || '').replace('T', ' ').slice(0, 16);

const STATUS = {
  pending: '결제대기', paid: '결제완료', preparing: '상품준비중',
  shipping: '배송중', delivered: '배송완료', cancelled: '취소', refunded: '환불',
};

const S = {
  admin: null,
  route: 'dashboard',
  categories: [],
  products: [],
  settings: {},
};

async function api(path, opts = {}) {
  const res = await fetch('/api/admin' + path, {
    credentials: 'include',
    headers: { 'content-type': 'application/json', ...(opts.headers || {}) },
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) { S.admin = null; renderLogin(); throw new Error('로그인이 필요합니다.'); }
  if (!res.ok) throw new Error(data.error || '요청 실패');
  return data;
}

let toastTimer;
function toast(msg) {
  const old = $('.toast'); if (old) old.remove();
  const el = document.createElement('div');
  el.className = 'toast'; el.textContent = msg;
  document.body.appendChild(el);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.remove(), 2300);
}

/* ── 모달 ── */
function modal({ title, body, footer = '', wide = false, onMount }) {
  closeModal();
  const bg = document.createElement('div');
  bg.className = 'modal-bg';
  bg.innerHTML = `<div class="modal ${wide ? 'wide' : ''}">
    <div class="modal-hd"><h3>${esc(title)}</h3><button class="modal-x" data-close>✕</button></div>
    <div class="modal-bd">${body}</div>
    ${footer ? `<div class="modal-ft">${footer}</div>` : ''}
  </div>`;
  document.body.appendChild(bg);
  bg.addEventListener('click', (e) => { if (e.target === bg || e.target.closest('[data-close]')) closeModal(); });
  if (onMount) onMount(bg);
  return bg;
}
function closeModal() { const m = $('.modal-bg'); if (m) m.remove(); }

/* ── 로그인 화면 ── */
function renderLogin() {
  $('#admin-root').innerHTML = `<div class="login-wrap"><div class="login-card">
    <div class="login-logo">MOA<b>SHOP</b></div>
    <p class="login-sub">ADMIN CONSOLE</p>
    <div style="height:26px"></div>
    <div class="field"><label>아이디</label><input id="ad-id" placeholder="admin" autocomplete="username"></div>
    <div class="field"><label>비밀번호</label><input id="ad-pw" type="password" placeholder="••••••••" autocomplete="current-password"></div>
    <div id="ad-err" class="tiny" style="color:#DC2626;min-height:16px;margin-bottom:8px"></div>
    <button class="btn btn-primary btn-block" id="ad-login" style="padding:12px">로그인</button>
    <p class="tiny" style="text-align:center;margin-top:16px">데모 계정 · admin / admin1234</p>
  </div></div>`;

  const submit = async () => {
    const btn = $('#ad-login');
    btn.disabled = true;
    try {
      const { admin } = await api('/login', {
        method: 'POST',
        body: { username: $('#ad-id').value.trim(), password: $('#ad-pw').value },
      });
      S.admin = admin;
      location.hash = '#/dashboard';
      renderShell();
    } catch (e) {
      $('#ad-err').textContent = e.message;
    } finally { btn.disabled = false; }
  };
  $('#ad-login').addEventListener('click', submit);
  $('#admin-root').addEventListener('keydown', (e) => { if (e.key === 'Enter' && !S.admin) submit(); });
}

/* ── 셸 ── */
const NAV = [
  { sec: '운영' },
  { k: 'dashboard', label: '대시보드', ico: '📊' },
  { k: 'orders', label: '주문 관리', ico: '📦' },
  { k: 'products', label: '상품 관리', ico: '🏷️' },
  { k: 'categories', label: '카테고리', ico: '🗂️' },
  { sec: '고객' },
  { k: 'users', label: '회원 관리', ico: '👥' },
  { k: 'reviews', label: '리뷰 관리', ico: '💬' },
  { sec: '마케팅' },
  { k: 'coupons', label: '쿠폰', ico: '🎟️' },
  { k: 'banners', label: '배너', ico: '🖼️' },
  { sec: '설정' },
  { k: 'settings', label: '쇼핑몰 설정', ico: '⚙️' },
];

function renderShell() {
  if (!S.admin) return renderLogin();
  const a = S.admin;
  $('#admin-root').innerHTML = `
  <div class="shell">
    <aside class="sidebar" id="sidebar">
      <div class="sb-brand"><b>MOA SHOP</b><span>ADMIN</span></div>
      <nav class="sb-nav">
        ${NAV.map((n) => n.sec
          ? `<div class="sb-sec">${esc(n.sec)}</div>`
          : `<button class="sb-item" data-nav="${n.k}"><b>${n.ico}</b>${n.label}</button>`).join('')}
      </nav>
      <div class="sb-foot">
        <div class="sb-user">
          <span class="sb-avatar">${esc((a.name || a.username || 'A').slice(0, 1))}</span>
          <div><b>${esc(a.name || a.username)}</b><span>${esc(a.username)}</span></div>
        </div>
        <button class="btn btn-outline btn-block btn-sm" id="ad-logout">로그아웃</button>
      </div>
    </aside>
    <div class="overlay" id="ov"></div>
    <div class="main">
      <header class="topbar">
        <button class="menu-btn" id="menu-btn">☰</button>
        <h1 id="page-title">대시보드</h1>
        <div class="sp"></div>
        <a class="btn btn-outline btn-sm" href="/" target="_blank" rel="noopener">쇼핑몰 보기 ↗</a>
      </header>
      <main class="content" id="page"></main>
    </div>
  </div>`;

  $('#ad-logout').addEventListener('click', async () => {
    await api('/logout', { method: 'POST' }).catch(() => {});
    S.admin = null;
    renderLogin();
  });
  const sb = $('#sidebar'), ov = $('#ov');
  const openSb = () => { sb.classList.add('open'); ov.classList.add('show'); };
  const closeSb = () => { sb.classList.remove('open'); ov.classList.remove('show'); };
  $('#menu-btn').addEventListener('click', openSb);
  ov.addEventListener('click', closeSb);

  $$('.sb-item').forEach((b) => b.addEventListener('click', () => {
    location.hash = '#/' + b.dataset.nav;
    closeSb();
  }));

  if (!location.hash || location.hash === '#/') location.hash = '#/dashboard';
  routeAdmin();
}

/* ── 라우터 ── */
const PAGES = {};
function routeAdmin() {
  const key = (location.hash.replace(/^#\/?/, '') || 'dashboard').split('?')[0];
  S.route = key in PAGES ? key : 'dashboard';
  $$('.sb-item').forEach((b) => b.classList.toggle('on', b.dataset.nav === S.route));
  const nav = NAV.find((n) => n.k === S.route);
  $('#page-title').textContent = nav ? nav.label : '대시보드';
  const page = $('#page');
  page.innerHTML = `<div class="skel" style="height:120px;margin-bottom:14px"></div><div class="skel" style="height:380px"></div>`;
  PAGES[S.route](page).catch((e) => {
    page.innerHTML = `<div class="card card-pad"><p style="color:#DC2626;font-weight:700">${esc(e.message)}</p></div>`;
  });
}

/* ─────────────────── 대시보드 ─────────────────── */
PAGES.dashboard = async (el) => {
  const d = await api('/dashboard');
  const maxAmt = Math.max(...d.daily.map((x) => x.amount || 0), 1);
  const totalOrders = d.statusCounts.reduce((s, x) => s + x.n, 0);

  el.innerHTML = `
    <div class="grid g4 mb16">
      <div class="kpi"><div class="kpi-l">💰 오늘 매출</div><div class="kpi-v">${num(d.today.amount)}<small>원</small></div><div class="kpi-s">주문 ${d.today.n}건</div></div>
      <div class="kpi"><div class="kpi-l">📈 최근 7일</div><div class="kpi-v">${num(d.week.amount)}<small>원</small></div><div class="kpi-s up">주문 ${d.week.n}건</div></div>
      <div class="kpi"><div class="kpi-l">🗓 최근 30일</div><div class="kpi-v">${num(d.month.amount)}<small>원</small></div><div class="kpi-s">주문 ${d.month.n}건</div></div>
      <div class="kpi"><div class="kpi-l">👥 전체 회원</div><div class="kpi-v">${num(d.users)}<small>명</small></div><div class="kpi-s">판매 상품 ${d.products}개</div></div>
    </div>

    <div class="grid mb16" style="grid-template-columns:1.6fr 1fr">
      <div class="card card-pad">
        <div class="between mb12"><h3 style="font-size:14px;font-weight:800">최근 14일 매출 추이</h3><span class="tiny">단위: 원</span></div>
        <div class="chart">
          ${d.daily.map((x) => `<div class="bar" style="height:${Math.max(3, (x.amount / maxAmt) * 100)}%"><b>${num(x.amount)}</b></div>`).join('') || '<p class="muted">데이터 없음</p>'}
        </div>
        <div class="chart-labels">${d.daily.map((x) => `<span>${(x.d || '').slice(5)}</span>`).join('')}</div>
      </div>
      <div class="card card-pad">
        <h3 style="font-size:14px;font-weight:800;margin-bottom:10px">주문 상태</h3>
        ${d.statusCounts.length ? d.statusCounts.map((s) => `
          <div class="stat-line"><span class="row"><i class="dot" style="background:${statusColor(s.status)}"></i>${STATUS[s.status] || s.status}</span>
            <b>${s.n}건</b></div>`).join('') + `<div class="stat-line"><span>합계</span><b>${totalOrders}건</b></div>`
          : '<p class="muted">주문이 없습니다.</p>'}
      </div>
    </div>

    <div class="grid mb16" style="grid-template-columns:1fr 1fr">
      <div class="card card-pad">
        <div class="between mb12"><h3 style="font-size:14px;font-weight:800">최근 주문</h3>
          <button class="btn btn-ghost btn-sm" data-nav="orders">전체 →</button></div>
        ${d.recentOrders.length ? d.recentOrders.map((o) => `
          <div class="list-item" style="cursor:pointer" data-order="${o.id}">
            <div class="grow"><div class="trunc" style="font-weight:700">${esc(o.first_item || '주문')}</div>
              <div class="tiny">${esc(o.orderer_name)} · ${esc(o.order_no)}</div></div>
            <div style="text-align:right"><div style="font-weight:800">${won(o.total)}</div>
              <span class="badge b-${o.status}">${o.statusLabel}</span></div>
          </div>`).join('') : '<p class="muted">주문이 없습니다.</p>'}
      </div>
      <div class="card card-pad">
        <div class="between mb12"><h3 style="font-size:14px;font-weight:800">재고 부족 알림</h3><span class="tiny">20개 이하</span></div>
        ${d.lowStock.length ? d.lowStock.map((p) => `
          <div class="list-item"><div class="grow trunc">${esc(p.name)}</div>
            <span class="badge ${p.stock <= 5 ? 'b-cancelled' : 'b-preparing'}">${p.stock}개</span></div>`).join('')
          : '<p class="muted" style="padding:14px 0">재고가 충분합니다 👍</p>'}
        <div style="height:10px"></div>
        <h3 style="font-size:14px;font-weight:800;margin:14px 0 10px">판매 베스트</h3>
        ${d.topProducts.map((p, i) => `<div class="list-item">
          <b style="color:${i < 3 ? 'var(--coral)' : 'var(--gray-2)'};width:16px">${i + 1}</b>
          <img class="thumb" src="${esc(p.thumbnail)}" alt="">
          <div class="grow trunc">${esc(p.name)}</div><b class="tiny">${p.sales_count}개</b></div>`).join('')}
      </div>
    </div>`;

  $$('[data-nav]', el).forEach((b) => b.addEventListener('click', () => { location.hash = '#/' + b.dataset.nav; }));
  $$('[data-order]', el).forEach((b) => b.addEventListener('click', () => openOrder(Number(b.dataset.order))));
};

function statusColor(s) {
  return { paid: '#2563EB', preparing: '#B45309', shipping: '#4338CA', delivered: '#047857', cancelled: '#9CA3AF', refunded: '#9CA3AF', pending: '#C2410C' }[s] || '#9CA3AF';
}

/* ─────────────────── 주문 ─────────────────── */
PAGES.orders = async (el) => {
  let status = '', q = '';
  const load = async () => {
    const data = await api(`/orders?status=${status}&q=${encodeURIComponent(q)}`);
    return data.items;
  };
  const render = async () => {
    const items = await load();
    $('#order-rows').innerHTML = items.length ? items.map((o) => `
      <tr>
        <td><input type="checkbox"></td>
        <td><b style="font-family:ui-monospace,monospace;font-size:12px">${esc(o.order_no)}</b>
          <div class="tiny">${dt(o.created_at)}</div></td>
        <td><div style="font-weight:600">${esc(o.orderer_name)}</div><div class="tiny">${esc(o.receiver_phone)}</div></td>
        <td class="hide-sm"><div class="trunc" style="max-width:220px">${esc(o.receiver)}</div><div class="tiny trunc" style="max-width:220px">${esc(o.addr1 || '')}</div></td>
        <td class="num"><b>${won(o.total)}</b><div class="tiny">${o.item_count}건</div></td>
        <td><span class="badge b-${o.status}">${o.statusLabel}</span></td>
        <td><button class="btn btn-outline btn-sm" data-open="${o.id}">상세</button></td>
      </tr>`).join('') : `<tr><td colspan="7"><div class="empty-row"><b>📦</b>주문이 없습니다.</div></td></tr>`;
    $$('[data-open]').forEach((b) => b.addEventListener('click', () => openOrder(Number(b.dataset.open))));
    $('#order-count').textContent = items.length;
  };

  el.innerHTML = `
    <div class="table-wrap">
      <div class="toolbar">
        <select id="f-status">
          <option value="">전체 상태</option>
          ${Object.entries(STATUS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}
        </select>
        <input type="search" id="f-q" placeholder="주문번호 · 주문자 · 받는분 검색">
        <div class="grow"></div>
        <span class="muted">총 <b id="order-count">0</b>건</span>
        <button class="btn btn-outline btn-sm" id="f-reload">새로고침</button>
      </div>
      <div class="tscroll"><table>
        <thead><tr><th style="width:34px"></th><th>주문번호</th><th>주문자</th><th class="hide-sm">배송지</th><th class="right">결제금액</th><th>상태</th><th></th></tr></thead>
        <tbody id="order-rows"></tbody>
      </table></div>
    </div>`;

  $('#f-status').addEventListener('change', (e) => { status = e.target.value; render(); });
  let t; $('#f-q').addEventListener('input', (e) => { clearTimeout(t); t = setTimeout(() => { q = e.target.value.trim(); render(); }, 320); });
  $('#f-reload').addEventListener('click', render);
  await render();
};

async function openOrder(id) {
  const { order: o } = await api('/orders/' + id);
  modal({
    title: '주문 상세 · ' + o.order_no,
    wide: true,
    body: `
      <div class="between mb12"><span class="badge b-${o.status}" style="font-size:12px;padding:5px 11px">${o.statusLabel}</span>
        <span class="tiny">${dt(o.created_at)}</span></div>
      <div class="grid g2" style="gap:12px">
        <div class="card card-pad">
          <h4 style="font-size:12.5px;font-weight:800;margin-bottom:9px">주문 정보</h4>
          <div class="stat-line"><span class="muted">주문번호</span><b style="font-size:12px">${esc(o.order_no)}</b></div>
          <div class="stat-line"><span class="muted">주문자</span><b>${esc(o.orderer_name)}</b></div>
          <div class="stat-line"><span class="muted">연락처</span><b>${esc(o.orderer_phone || o.receiver_phone)}</b></div>
          <div class="stat-line"><span class="muted">결제수단</span><b>${o.pay_method === 'demo' ? '데모결제' : o.pay_method === 'bank' ? '무통장' : esc(o.pay_method)}</b></div>
          ${o.coupon_code ? `<div class="stat-line"><span class="muted">쿠폰</span><b>${esc(o.coupon_code)} (-${won(o.discount)})</b></div>` : ''}
        </div>
        <div class="card card-pad">
          <h4 style="font-size:12.5px;font-weight:800;margin-bottom:9px">배송 정보</h4>
          <div class="stat-line"><span class="muted">받는분</span><b>${esc(o.receiver)}</b></div>
          <div class="stat-line"><span class="muted">연락처</span><b>${esc(o.receiver_phone)}</b></div>
          <div class="stat-line"><span class="muted">주소</span><b style="text-align:right;max-width:62%">${esc(o.addr1)} ${esc(o.addr2 || '')}</b></div>
          <div class="stat-line"><span class="muted">요청</span><b>${esc(o.memo || '-')}</b></div>
        </div>
      </div>
      <div class="card mt12">
        <table><thead><tr><th>상품</th><th>옵션</th><th class="right">단가</th><th class="right">수량</th><th class="right">금액</th></tr></thead>
        <tbody>${(o.items || []).map((it) => `<tr>
          <td><div class="row"><img class="thumb" src="${esc(it.thumbnail)}" alt=""><span class="trunc">${esc(it.name)}</span></div></td>
          <td class="tiny">${esc(it.option_text || '-')}</td>
          <td class="num">${won(it.price)}</td><td class="num">${it.qty}</td>
          <td class="num"><b>${won(it.price * it.qty)}</b></td></tr>`).join('')}</tbody></table>
      </div>
      <div class="card card-pad mt12">
        <div class="stat-line"><span>상품금액</span><b>${won(o.subtotal)}</b></div>
        <div class="stat-line"><span>쿠폰 할인</span><b style="color:var(--coral)">-${won(o.discount)}</b></div>
        <div class="stat-line"><span>배송비</span><b>${o.shipping_fee ? won(o.shipping_fee) : '무료'}</b></div>
        <div class="stat-line" style="border-top:1px solid var(--line);margin-top:6px;padding-top:11px"><b style="font-size:14px">총 결제금액</b><b style="font-size:18px;color:var(--coral)">${won(o.total)}</b></div>
      </div>
      <div class="field mt12"><label>관리자 메모</label>
        <textarea id="o-memo" placeholder="내부 메모">${esc(o.admin_memo || '')}</textarea></div>
      <div class="field" style="margin-bottom:0"><label>주문 상태 변경</label>
        <select id="o-status">${Object.entries(STATUS).map(([k, v]) => `<option value="${k}" ${o.status === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div>`,
    footer: `<button class="btn btn-outline" data-close>닫기</button><button class="btn btn-primary" id="o-save">저장</button>`,
    onMount: (root) => {
      $('#o-save', root).addEventListener('click', async () => {
        try {
          const r = await api('/orders/' + id, {
            method: 'PATCH',
            body: { status: $('#o-status', root).value, adminMemo: $('#o-memo', root).value },
          });
          toast('주문 상태가 ' + (STATUS[r.status] || r.status) + '(으)로 변경되었습니다.');
          closeModal();
          if (S.route === 'orders') routeAdmin();
          if (S.route === 'dashboard') routeAdmin();
        } catch (e) { toast(e.message); }
      });
    },
  });
}

/* ─────────────────── 상품 ─────────────────── */
PAGES.products = async (el) => {
  const [prod, cats] = await Promise.all([api('/products'), api('/categories')]);
  S.categories = cats.items;
  S.products = prod.items;

  el.innerHTML = `
    <div class="table-wrap">
      <div class="toolbar">
        <select id="p-cat"><option value="">전체 카테고리</option>
          ${cats.items.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select>
        <input type="search" id="p-q" placeholder="상품명 · 브랜드 검색">
        <div class="grow"></div>
        <span class="muted">총 <b id="p-count">${S.products.length}</b>개</span>
        <button class="btn btn-primary btn-sm" id="p-new">+ 상품 등록</button>
      </div>
      <div class="tscroll"><table>
        <thead><tr><th>상품</th><th class="hide-sm">카테고리</th><th class="right">판매가</th><th class="right">재고</th><th class="hide-sm">판매량</th><th>상태</th><th></th></tr></thead>
        <tbody id="p-rows"></tbody>
      </table></div>
    </div>`;

  const draw = (items) => {
    $('#p-rows').innerHTML = items.length ? items.map((p) => `
      <tr>
        <td><div class="row"><img class="thumb" src="${esc(p.thumbnail)}" alt="">
          <div><div class="pname trunc">${esc(p.name)}</div>
            <div class="tiny">${esc(p.brand || '-')} ${p.badge ? `· <span class="badge b-hot">${esc(p.badge)}</span>` : ''}</div></div></div></td>
        <td class="hide-sm">${esc(p.category_name || '-')}</td>
        <td class="num"><b>${won(p.sale_price ?? p.price)}</b>
          ${p.sale_price ? `<div class="tiny" style="text-decoration:line-through">${won(p.price)}</div>` : ''}</td>
        <td class="num"><span style="font-weight:700;color:${p.stock <= 5 ? '#DC2626' : p.stock <= 20 ? '#B45309' : 'inherit'}">${p.stock}</span></td>
        <td class="num hide-sm">${num(p.sales_count)}</td>
        <td><span class="badge ${p.is_active ? 'b-on' : 'b-off'}">${p.is_active ? '판매중' : '판매중지'}</span></td>
        <td><div class="row" style="gap:5px">
          <button class="btn btn-outline btn-sm" data-edit="${p.id}">수정</button>
          <button class="btn btn-danger btn-sm" data-del="${p.id}">삭제</button>
        </div></td>
      </tr>`).join('') : `<tr><td colspan="7"><div class="empty-row"><b>🏷️</b>상품이 없습니다.</div></td></tr>`;

    $$('[data-edit]').forEach((b) => b.addEventListener('click', () => productForm(Number(b.dataset.edit))));
    $$('[data-del]').forEach((b) => b.addEventListener('click', async () => {
      const p = S.products.find((x) => x.id === Number(b.dataset.del));
      if (!confirm(`'${p?.name}' 상품을 삭제할까요?\n주문 이력은 유지됩니다.`)) return;
      await api('/products/' + b.dataset.del, { method: 'DELETE' });
      toast('삭제되었습니다.');
      routeAdmin();
    }));
    $('#p-count').textContent = items.length;
  };

  const filter = () => {
    const q = $('#p-q').value.trim().toLowerCase();
    const cat = $('#p-cat').value;
    draw(S.products.filter((p) =>
      (!cat || String(p.category_id) === cat) &&
      (!q || p.name.toLowerCase().includes(q) || (p.brand || '').toLowerCase().includes(q))));
  };
  $('#p-q').addEventListener('input', filter);
  $('#p-cat').addEventListener('change', filter);
  $('#p-new').addEventListener('click', () => productForm(null));
  draw(S.products);
};

function productForm(id) {
  const p = id ? S.products.find((x) => x.id === id) : null;
  const imgList = (p?.images || []).join('\n');
  modal({
    title: p ? '상품 수정' : '상품 등록',
    wide: true,
    body: `
      <div class="field-row">
        <div class="field"><label>상품명 *</label><input id="f-name" value="${esc(p?.name || '')}" placeholder="예: 데일리 코튼 티셔츠"></div>
        <div class="field"><label>브랜드</label><input id="f-brand" value="${esc(p?.brand || '')}" placeholder="MOA BASIC"></div>
      </div>
      <div class="field-row">
        <div class="field"><label>카테고리 *</label><select id="f-cat">
          ${S.categories.map((c) => `<option value="${c.id}" ${p?.category_id === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}
        </select></div>
        <div class="field"><label>배지</label><select id="f-badge">
          ${['', 'BEST', 'NEW', '특가'].map((b) => `<option value="${b}" ${p?.badge === b ? 'selected' : ''}>${b || '없음'}</option>`).join('')}
        </select></div>
        <div class="field"><label>배송비</label><input id="f-ship" type="number" value="${p?.shipping_fee ?? 0}"></div>
      </div>
      <div class="field"><label>한줄 요약</label><input id="f-summary" value="${esc(p?.summary || '')}" placeholder="사계절 입기 좋은 20수 순면"></div>
      <div class="field-row">
        <div class="field"><label>정가 *</label><input id="f-price" type="number" value="${p?.price ?? 0}"></div>
        <div class="field"><label>판매가 (할인가)</label><input id="f-sale" type="number" value="${p?.sale_price ?? ''}" placeholder="비우면 정가 판매"></div>
        <div class="field"><label>재고 *</label><input id="f-stock" type="number" value="${p?.stock ?? 0}"></div>
      </div>
      <div class="field"><label>대표 이미지 URL</label><input id="f-thumb" value="${esc(p?.thumbnail || '')}" placeholder="/static/img/tee-1.jpg"></div>
      <div class="field"><label>추가 이미지 URL (줄바꿈 구분)</label><textarea id="f-images" placeholder="/static/img/a.jpg">${esc(imgList)}</textarea></div>
      <div class="field"><label>옵션 (JSON)</label><textarea id="f-options" placeholder='[{"name":"사이즈","values":["S","M"]}]'>${esc(JSON.stringify(p?.options || [], null, 0))}</textarea></div>
      <div class="field" style="margin-bottom:0"><label>상세 설명</label><textarea id="f-desc" style="min-height:110px">${esc(p?.description || '')}</textarea></div>
      <label class="row mt12" style="font-size:13px;font-weight:600"><input type="checkbox" id="f-active" ${p?.is_active !== 0 ? 'checked' : ''}> 판매중으로 표시</label>`,
    footer: `<button class="btn btn-outline" data-close>취소</button><button class="btn btn-primary" id="f-save">${p ? '수정' : '등록'}</button>`,
    onMount: (root) => {
      $('#f-save', root).addEventListener('click', async () => {
        const name = $('#f-name', root).value.trim();
        const price = Number($('#f-price', root).value || 0);
        if (!name) return toast('상품명을 입력해주세요.');
        if (price <= 0) return toast('정가를 입력해주세요.');
        let options = [];
        try { options = JSON.parse($('#f-options', root).value || '[]'); } catch { return toast('옵션 JSON 형식이 올바르지 않습니다.'); }
        const body = {
          name, brand: $('#f-brand', root).value.trim(),
          categoryId: Number($('#f-cat', root).value),
          badge: $('#f-badge', root).value,
          shippingFee: Number($('#f-ship', root).value || 0),
          summary: $('#f-summary', root).value.trim(),
          price, salePrice: $('#f-sale', root).value ? Number($('#f-sale', root).value) : null,
          stock: Number($('#f-stock', root).value || 0),
          thumbnail: $('#f-thumb', root).value.trim(),
          images: $('#f-images', root).value.split('\n').map((s) => s.trim()).filter(Boolean),
          options, description: $('#f-desc', root).value,
          isActive: $('#f-active', root).checked,
        };
        try {
          if (p) await api('/products/' + p.id, { method: 'PUT', body });
          else await api('/products', { method: 'POST', body });
          toast(p ? '수정되었습니다.' : '등록되었습니다.');
          closeModal();
          routeAdmin();
        } catch (e) { toast(e.message); }
      });
    },
  });
}

/* ─────────────────── 카테고리 ─────────────────── */
PAGES.categories = async (el) => {
  const { items } = await api('/categories');
  el.innerHTML = `
    <div class="between mb16"><h3 style="font-size:15px;font-weight:800">카테고리 ${items.length}개</h3>
      <button class="btn btn-primary btn-sm" id="c-new">+ 카테고리 추가</button></div>
    <div class="grid g3">
      ${items.map((c) => `<div class="card card-pad">
        <div class="between"><div class="row"><b style="font-size:22px">${esc(c.icon || '🛍️')}</b>
          <div><b style="font-size:14px">${esc(c.name)}</b><div class="tiny">/${esc(c.slug)}</div></div></div>
          <span class="badge ${c.is_active ? 'b-on' : 'b-off'}">${c.is_active ? 'ON' : 'OFF'}</span></div>
        <div class="stat-line mt8"><span class="muted">등록 상품</span><b>${c.product_count}개</b></div>
        <a class="btn btn-outline btn-sm btn-block mt8" href="/#/category/${esc(c.slug)}" target="_blank">쇼핑몰에서 보기 ↗</a>
      </div>`).join('')}
    </div>`;
  $('#c-new').addEventListener('click', () => {
    modal({
      title: '카테고리 추가',
      body: `<div class="field"><label>이름 *</label><input id="c-name" placeholder="예: 반려동물"></div>
        <div class="field"><label>슬러그 * (영문)</label><input id="c-slug" placeholder="pets"></div>
        <div class="field"><label>아이콘 (이모지)</label><input id="c-icon" placeholder="🐶" value="🛍️"></div>
        <div class="field" style="margin-bottom:0"><label>정렬 순서</label><input id="c-sort" type="number" value="99"></div>`,
      footer: `<button class="btn btn-outline" data-close>취소</button><button class="btn btn-primary" id="c-save">추가</button>`,
      onMount: (root) => {
        $('#c-save', root).addEventListener('click', async () => {
          const name = $('#c-name', root).value.trim();
          const slug = $('#c-slug', root).value.trim();
          if (!name || !slug) return toast('이름과 슬러그를 입력해주세요.');
          try {
            await api('/categories', { method: 'POST', body: { name, slug, icon: $('#c-icon', root).value.trim(), sortOrder: Number($('#c-sort', root).value || 99) } });
            toast('추가되었습니다.');
            closeModal(); routeAdmin();
          } catch (e) { toast(e.message); }
        });
      },
    });
  });
};

/* ─────────────────── 회원 ─────────────────── */
PAGES.users = async (el) => {
  const load = async (q = '') => {
    const { items } = await api('/users?q=' + encodeURIComponent(q));
    $('#u-rows').innerHTML = items.length ? items.map((u) => `
      <tr>
        <td><div style="font-weight:700">${esc(u.name)}</div><div class="tiny">#${u.id}</div></td>
        <td>${esc(u.email)}</td>
        <td class="hide-sm">${esc(u.phone || '-')}</td>
        <td class="num">${u.order_count}건</td>
        <td class="num"><b>${won(u.total_spent)}</b></td>
        <td class="hide-sm">${u.marketing_agree ? '<span class="badge b-on">동의</span>' : '<span class="badge b-off">미동의</span>'}</td>
        <td class="tiny">${dt(u.created_at)}</td>
      </tr>`).join('') : `<tr><td colspan="7"><div class="empty-row"><b>👥</b>회원이 없습니다.</div></td></tr>`;
    $('#u-count').textContent = items.length;
  };
  el.innerHTML = `
    <div class="table-wrap">
      <div class="toolbar"><input type="search" id="u-q" placeholder="이름 · 이메일 검색">
        <div class="grow"></div><span class="muted">총 <b id="u-count">0</b>명</span></div>
      <div class="tscroll"><table>
        <thead><tr><th>회원</th><th>이메일</th><th class="hide-sm">연락처</th><th class="num">주문</th><th class="right">누적 구매</th><th class="hide-sm">마케팅</th><th>가입일</th></tr></thead>
        <tbody id="u-rows"></tbody></table></div>
    </div>`;
  let t;
  $('#u-q').addEventListener('input', (e) => { clearTimeout(t); t = setTimeout(() => load(e.target.value.trim()), 320); });
  await load();
};

/* ─────────────────── 쿠폰 ─────────────────── */
PAGES.coupons = async (el) => {
  const { items } = await api('/coupons');
  el.innerHTML = `
    <div class="between mb16"><h3 style="font-size:15px;font-weight:800">쿠폰 ${items.length}개</h3>
      <button class="btn btn-primary btn-sm" id="cp-new">+ 쿠폰 발급</button></div>
    <div class="table-wrap"><div class="tscroll"><table>
      <thead><tr><th>코드</th><th>쿠폰명</th><th class="right">할인</th><th class="right">최소주문</th><th class="hide-sm right">발급/사용</th><th>상태</th><th></th></tr></thead>
      <tbody>${items.length ? items.map((c) => `<tr>
        <td><b style="font-family:ui-monospace,monospace">${esc(c.code)}</b></td>
        <td>${esc(c.name)}</td>
        <td class="num">${c.type === 'percent' ? c.value + '%' : won(c.value)}${c.max_discount ? `<div class="tiny">최대 ${won(c.max_discount)}</div>` : ''}</td>
        <td class="num">${c.min_order ? won(c.min_order) : '-'}</td>
        <td class="num hide-sm">${c.total_count || '∞'} / ${c.used_count}</td>
        <td><button class="switch ${c.is_active ? 'on' : ''}" data-toggle="${c.id}" data-on="${c.is_active}"></button></td>
        <td><button class="btn btn-danger btn-sm" data-cdel="${c.id}">삭제</button></td>
      </tr>`).join('') : `<tr><td colspan="7"><div class="empty-row"><b>🎟️</b>쿠폰이 없습니다.</div></td></tr>`}</tbody>
    </table></div></div>`;

  $$('[data-toggle]').forEach((b) => b.addEventListener('click', async () => {
    const on = b.dataset.on === '1' || b.dataset.on === 'true';
    await api('/coupons/' + b.dataset.toggle, { method: 'PATCH', body: { isActive: !on } });
    toast('변경되었습니다.'); routeAdmin();
  }));
  $$('[data-cdel]').forEach((b) => b.addEventListener('click', async () => {
    if (!confirm('쿠폰을 삭제할까요?')) return;
    await api('/coupons/' + b.dataset.cdel, { method: 'DELETE' });
    toast('삭제되었습니다.'); routeAdmin();
  }));
  $('#cp-new').addEventListener('click', () => {
    modal({
      title: '쿠폰 발급',
      body: `
        <div class="field-row">
          <div class="field"><label>쿠폰 코드 *</label><input id="n-code" placeholder="SUMMER10" style="text-transform:uppercase"></div>
          <div class="field"><label>쿠폰명 *</label><input id="n-name" placeholder="여름 특가 할인"></div>
        </div>
        <div class="field-row">
          <div class="field"><label>할인 유형</label><select id="n-type"><option value="amount">정액 할인(원)</option><option value="percent">정률 할인(%)</option></select></div>
          <div class="field"><label>할인 값</label><input id="n-value" type="number" placeholder="3000"></div>
        </div>
        <div class="field-row">
          <div class="field"><label>최소 주문금액</label><input id="n-min" type="number" value="0"></div>
          <div class="field"><label>최대 할인 (정률일 때)</label><input id="n-max" type="number" value="0"></div>
        </div>
        <div class="field-row">
          <div class="field"><label>발급 수량 (0=무제한)</label><input id="n-total" type="number" value="0"></div>
          <div class="field"><label>만료일</label><input id="n-exp" type="date" value="2027-12-31"></div>
        </div>`,
      footer: `<button class="btn btn-outline" data-close>취소</button><button class="btn btn-primary" id="n-save">발급</button>`,
      onMount: (root) => {
        $('#n-save', root).addEventListener('click', async () => {
          const code = $('#n-code', root).value.trim().toUpperCase();
          const name = $('#n-name', root).value.trim();
          if (!code || !name) return toast('코드와 이름을 입력해주세요.');
          try {
            await api('/coupons', { method: 'POST', body: {
              code, name, type: $('#n-type', root).value, value: Number($('#n-value', root).value || 0),
              minOrder: Number($('#n-min', root).value || 0), maxDiscount: Number($('#n-max', root).value || 0),
              totalCount: Number($('#n-total', root).value || 0), expiresAt: $('#n-exp', root).value,
            } });
            toast('쿠폰이 발급되었습니다.');
            closeModal(); routeAdmin();
          } catch (e) { toast(e.message); }
        });
      },
    });
  });
};

/* ─────────────────── 배너 ─────────────────── */
PAGES.banners = async (el) => {
  const { items } = await api('/banners');
  el.innerHTML = `
    <div class="between mb16"><h3 style="font-size:15px;font-weight:800">배너 ${items.length}개</h3>
      <button class="btn btn-primary btn-sm" id="b-new">+ 배너 추가</button></div>
    <div class="grid g2">
      ${items.length ? items.map((b) => `<div class="card" style="overflow:hidden">
        <div style="background:${esc(b.bg)};color:#fff;padding:18px;position:relative;min-height:112px">
          <b style="font-size:16px;display:block;position:relative;z-index:2;max-width:62%">${esc(b.title)}</b>
          <p style="font-size:12px;opacity:.82;margin-top:6px;position:relative;z-index:2;max-width:62%">${esc(b.subtitle)}</p>
          ${b.image ? `<img src="${esc(b.image)}" style="position:absolute;right:-8px;bottom:-8px;width:96px;height:96px;object-fit:cover;border-radius:12px;opacity:.92">` : ''}
        </div>
        <div class="card-pad">
          <div class="between"><span class="tiny">${esc(b.link)}</span>
            <button class="switch ${b.is_active ? 'on' : ''}" data-btoggle="${b.id}" data-on="${b.is_active}"></button></div>
          <div class="row mt12" style="gap:6px">
            <button class="btn btn-outline btn-sm grow" data-bedit="${b.id}">수정</button>
            <button class="btn btn-danger btn-sm" data-bdel="${b.id}">삭제</button>
          </div>
        </div>
      </div>`).join('') : '<p class="muted">배너가 없습니다.</p>'}
    </div>`;

  $$('[data-btoggle]').forEach((b) => b.addEventListener('click', async () => {
    const on = b.dataset.on === '1' || b.dataset.on === 'true';
    await api('/banners/' + b.dataset.btoggle, { method: 'PATCH', body: { isActive: !on } });
    toast('변경되었습니다.'); routeAdmin();
  }));
  $$('[data-bdel]').forEach((b) => b.addEventListener('click', async () => {
    if (!confirm('배너를 삭제할까요?')) return;
    await api('/banners/' + b.dataset.bdel, { method: 'DELETE' });
    toast('삭제되었습니다.'); routeAdmin();
  }));
  const form = (id) => {
    const b = id ? items.find((x) => x.id === id) : null;
    modal({
      title: b ? '배너 수정' : '배너 추가',
      body: `
        <div class="field"><label>제목 *</label><input id="bn-title" value="${esc(b?.title || '')}"></div>
        <div class="field"><label>부제</label><input id="bn-sub" value="${esc(b?.subtitle || '')}"></div>
        <div class="field-row">
          <div class="field"><label>배경색</label><input id="bn-bg" value="${esc(b?.bg || '#111827')}" placeholder="#111827"></div>
          <div class="field"><label>링크</label><input id="bn-link" value="${esc(b?.link || '#/')}"></div>
        </div>
        <div class="field"><label>이미지 URL</label><input id="bn-img" value="${esc(b?.image || '')}" placeholder="/static/img/shoe-3.jpg"></div>
        <div class="field" style="margin-bottom:0"><label>정렬 순서</label><input id="bn-sort" type="number" value="${b?.sort_order ?? 0}"></div>`,
      footer: `<button class="btn btn-outline" data-close>취소</button><button class="btn btn-primary" id="bn-save">저장</button>`,
      onMount: (root) => {
        $('#bn-save', root).addEventListener('click', async () => {
          const body = {
            title: $('#bn-title', root).value.trim(), subtitle: $('#bn-sub', root).value.trim(),
            bg: $('#bn-bg', root).value.trim(), link: $('#bn-link', root).value.trim(),
            image: $('#bn-img', root).value.trim(), sortOrder: Number($('#bn-sort', root).value || 0),
          };
          if (!body.title) return toast('제목을 입력해주세요.');
          try {
            if (b) await api('/banners/' + b.id, { method: 'PATCH', body });
            else await api('/banners', { method: 'POST', body });
            toast('저장되었습니다.'); closeModal(); routeAdmin();
          } catch (e) { toast(e.message); }
        });
      },
    });
  };
  $('#b-new').addEventListener('click', () => form(null));
  $$('[data-bedit]').forEach((b) => b.addEventListener('click', () => form(Number(b.dataset.bedit))));
};

/* ─────────────────── 리뷰 ─────────────────── */
PAGES.reviews = async (el) => {
  const { items } = await api('/reviews');
  el.innerHTML = `
    <div class="between mb16"><h3 style="font-size:15px;font-weight:800">리뷰 ${items.length}개</h3></div>
    <div class="table-wrap"><div class="tscroll"><table>
      <thead><tr><th>상품</th><th>작성자</th><th>평점</th><th>내용</th><th>작성일</th><th></th></tr></thead>
      <tbody>${items.length ? items.map((r) => `<tr>
        <td class="trunc" style="max-width:180px">${esc(r.product_name || '-')}</td>
        <td>${esc(r.author || '-')}</td>
        <td style="color:#FFB020">${'★'.repeat(r.rating)}</td>
        <td class="trunc" style="max-width:320px">${esc(r.content)}</td>
        <td class="tiny">${dt(r.created_at)}</td>
        <td><button class="btn btn-danger btn-sm" data-rdel="${r.id}">삭제</button></td>
      </tr>`).join('') : `<tr><td colspan="6"><div class="empty-row"><b>💬</b>리뷰가 없습니다.</div></td></tr>`}</tbody>
    </table></div></div>`;
  $$('[data-rdel]').forEach((b) => b.addEventListener('click', async () => {
    if (!confirm('리뷰를 삭제할까요?')) return;
    await api('/reviews/' + b.dataset.rdel, { method: 'DELETE' });
    toast('삭제되었습니다.'); routeAdmin();
  }));
};

/* ─────────────────── 설정 ─────────────────── */
PAGES.settings = async (el) => {
  const { settings } = await api('/settings');
  S.settings = settings;
  const F = [
    ['mall_name', '쇼핑몰 이름'], ['mall_tagline', '슬로건'],
    ['free_shipping_over', '무료배송 기준금액(원)'], ['base_shipping_fee', '기본 배송비(원)'],
    ['point_rate', '적립률(%)'], ['cs_phone', '고객센터 전화'], ['cs_hours', '상담 시간'], ['bank_account', '입금 계좌'],
  ];
  el.innerHTML = `
    <div class="grid" style="grid-template-columns:1.4fr 1fr">
      <div class="card card-pad">
        <h3 style="font-size:14px;font-weight:800;margin-bottom:14px">쇼핑몰 기본 설정</h3>
        ${F.map(([k, label]) => `<div class="field"><label>${label}</label>
          <input data-k="${k}" value="${esc(settings[k] || '')}"></div>`).join('')}
        <button class="btn btn-primary" id="st-save">설정 저장</button>
      </div>
      <div>
        <div class="card card-pad mb12">
          <h3 style="font-size:14px;font-weight:800;margin-bottom:12px">관리자 비밀번호 변경</h3>
          <div class="field"><label>현재 비밀번호</label><input id="pw-cur" type="password"></div>
          <div class="field"><label>새 비밀번호 (6자 이상)</label><input id="pw-new" type="password"></div>
          <button class="btn btn-dark btn-block" id="pw-save">변경</button>
        </div>
        <div class="card card-pad">
          <h3 style="font-size:14px;font-weight:800;margin-bottom:10px">시스템 정보</h3>
          <div class="stat-line"><span class="muted">플랫폼</span><b>Cloudflare Workers</b></div>
          <div class="stat-line"><span class="muted">DB</span><b>D1 (SQLite)</b></div>
          <div class="stat-line"><span class="muted">프레임워크</span><b>Hono</b></div>
          <div class="stat-line"><span class="muted">결제</span><b>데모 결제</b></div>
          <div class="stat-line"><span class="muted">PWA</span><b>지원</b></div>
        </div>
      </div>
    </div>`;

  $('#st-save').addEventListener('click', async () => {
    const body = {};
    $$('[data-k]').forEach((i) => { body[i.dataset.k] = i.value; });
    await api('/settings', { method: 'PUT', body });
    toast('설정이 저장되었습니다.');
  });
  $('#pw-save').addEventListener('click', async () => {
    try {
      await api('/password', { method: 'POST', body: { current: $('#pw-cur').value, next: $('#pw-new').value } });
      toast('비밀번호가 변경되었습니다.');
      $('#pw-cur').value = ''; $('#pw-new').value = '';
    } catch (e) { toast(e.message); }
  });
};

/* ── 부트스트랩 ── */
(async function boot() {
  window.addEventListener('hashchange', () => { if (S.admin) routeAdmin(); });
  try {
    const { admin } = await api('/me');
    S.admin = admin;
  } catch (_) { S.admin = null; }
  if (S.admin) renderShell();
  else renderLogin();
})();
