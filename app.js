(() => {
  'use strict';

  const PRODUCT_CATS = ['웨어러블·안경', '홈·로봇', '새 입력 방식', '쇼핑·결제', '매장·리테일', '패션·뷰티', '콘텐츠 제작', 'SNS 트렌드', '참고(규제)'];
  const NEWS_CATS = ['모델·연구', '기업·자본', '정책·규제', '인프라·칩', '개발자·도구', '안전·윤리', '산업 도입'];
  const catsFor = (feed) => (feed === 'news' ? NEWS_CATS : PRODUCT_CATS);
  // 카테고리 → 색/아이콘 (제품·뉴스 공용, 같은 팔레트 재사용)
  const CAT_COLOR = {}, CAT_ICON = {};
  PRODUCT_CATS.forEach((c, i) => { CAT_COLOR[c] = `var(--c${i + 1})`; CAT_ICON[c] = i + 1; });
  const NEWS_ICON = [7, 4, 9, 2, 3, 8, 5]; // 모델·연구/기업·자본/정책·규제/인프라·칩/개발자·도구/안전·윤리/산업도입
  NEWS_CATS.forEach((c, i) => { CAT_COLOR[c] = `var(--c${i + 1})`; CAT_ICON[c] = NEWS_ICON[i]; });
  const catColor = (c) => CAT_COLOR[c] || 'var(--c9)';
  const PERIOD_LABEL = { 1: '오늘', 7: '7일', 30: '30일', 0: '전체 기간' };
  const DAY = 86400000;

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const icon = (id) => `<svg class="ic" aria-hidden="true"><use href="#i-${id}"/></svg>`;

  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* 저장소 차단 시 무시 */ } },
    del(k) { try { localStorage.removeItem(k); } catch { /* noop */ } },
  };

  const state = {
    items: [], daily: null, news: [], newsDaily: null, today: '',
    feed: store.get('radar.feed', 'product'),
    saved: new Set(store.get('radar.saved', [])),
    ar: { tab: 'all', q: '', view: store.get('radar.view', 'card') },
    feeds: {
      product: { cats: new Set(), period: 0, sort: store.get('radar.sort.product', 'new') },
      news: { cats: new Set(), period: 0, sort: store.get('radar.sort.news', 'pop') },
    },
    panelList: [], panelIdx: -1, lastFocus: null,
  };
  const cur = () => state.feeds[state.feed];
  const feedData = () => (state.feed === 'news' ? { items: state.news, daily: state.newsDaily } : { items: state.items, daily: state.daily });

  /* ---------- 날짜 유틸 ---------- */
  const toDate = (s) => new Date(s + 'T00:00:00');
  const daysBetween = (a, b) => Math.round((toDate(a) - toDate(b)) / DAY);
  const mmdd = (s) => { const [, m, d] = s.split('-'); return `${m}.${d}`; };
  const korDate = (s) => { const d = toDate(s); return `${d.getMonth() + 1}월 ${d.getDate()}일`; };
  const korDateFull = (s) => { const d = toDate(s); return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 ${'일월화수목금토'[d.getDay()]}요일`; };

  const isNewsItem = (it) => it.kind === 'news';
  const isNew = (it) => {
    const daily = isNewsItem(it) ? state.newsDaily : state.daily;
    if (!daily?.updated_at || it.date_added !== daily.date) return false;
    return Date.now() - Date.parse(daily.updated_at) < DAY;
  };
  const primary = (it) => it.categories?.[0] || (isNewsItem(it) ? '모델·연구' : '참고(규제)');
  const scoreOf = (it) => (typeof it.popularity === 'number' ? it.popularity : (typeof it.importance === 'number' ? it.importance : -1));
  const scoreLabel = (it) => (isNewsItem(it) ? '중요도 점수' : '인기 점수');
  const insight = (it) => (isNewsItem(it) ? it.why_it_matters : it.idea);
  const insightMark = (it) => (isNewsItem(it) ? '📌' : '💡');
  const byScore = (a, b) => scoreOf(b) - scoreOf(a) || b.date_added.localeCompare(a.date_added) || b.date_announced.localeCompare(a.date_announced) || a.title.localeCompare(b.title);
  const byNewest = (a, b) => b.date_added.localeCompare(a.date_added) || b.date_announced.localeCompare(a.date_announced) || scoreOf(b) - scoreOf(a);

  /* ---------- 카드 ---------- */
  // 점수 배지(0~100): 제품=인기(화제도), 뉴스=중요도
  const scoreBadge = (it) => {
    const p = scoreOf(it);
    if (p < 0) return '';
    const heat = p >= 70 ? ' hot' : p >= 40 ? ' warm' : '';
    return `<span class="pop${heat}" role="img" aria-label="${scoreLabel(it)} ${p}점">${icon('fire')}<b class="tnum">${p}</b></span>`;
  };
  const catTag = (c) => `<span class="cat-tag"><span class="dot" style="--dot:${catColor(c)}"></span>${esc(c)}</span>`;
  const meta = (it) => (isNewsItem(it) ? [it.company] : [it.company, it.price, it.availability]).filter(Boolean).map(esc).join(' · ');
  // 대표 이미지: 원문 사진이 있으면 톤을 맞춰 쓰고, 없으면 카테고리 바탕 + 겹친 패널 타일
  function media(it, { overlay = false } = {}) {
    const c = primary(it);
    const style = `--cat:${catColor(c)}`;
    const over = overlay
      ? `<span class="float tl">${catTag(c)}</span><span class="float tr">${it.status === '미확인' ? '<span class="badge-unv">미확인</span>' : ''}${scoreBadge(it)}</span>`
      : '';
    if (it.image) return `<div class="media" style="${style}"><img src="${esc(it.image)}" alt="" decoding="async">${over}</div>`;
    const label = isNewsItem(it) ? it.company : it.product;
    const sub = isNewsItem(it) ? primary(it) : it.company;
    return `<div class="media tile" style="${style}"><div class="tile-stack" aria-hidden="true"><span class="tile-back"></span><span class="tile-front"><svg class="ic"><use href="#i-cat${CAT_ICON[c] || 9}"/></svg><b>${esc(label)}</b><span>${esc(sub)}</span></span></div>${over}</div>`;
  }
  const saveBtn = (it, cls = 'save-btn') => `<button type="button" class="${cls}" data-save="${esc(it.id)}" aria-pressed="${state.saved.has(it.id)}" aria-label="저장">${icon('star')}</button>`;

  function card(it) {
    const unv = it.status === '미확인';
    return `<article class="card${unv ? ' unverified' : ''}" data-id="${esc(it.id)}">
      ${media(it, { overlay: true })}
      <h3 class="c-title"><button type="button" class="stretch" data-open="${esc(it.id)}">${isNew(it) ? '<i class="new-tag">NEW</i>' : ''}${esc(it.title)}</button></h3>
      <p class="c-meta">${meta(it)}</p>
      <p class="c-desc">${esc(it.what_is_new)}</p>
      <p class="idea">${insightMark(it)} ${esc(insight(it))}</p>
      <div class="c-foot"><span class="tnum">${mmdd(it.date_announced)}${isNewsItem(it) ? '' : ' 발표'}</span><span class="grow"></span>
        <a class="link-btn" href="${esc(it.source_url)}" target="_blank" rel="noopener">원문 ${icon('ext')}</a>${saveBtn(it)}</div>
    </article>`;
  }
  function row(it) {
    return `<div class="row${it.status === '미확인' ? ' unverified' : ''}" data-id="${esc(it.id)}">
      ${media(it)}
      <span class="r-cat">${catTag(primary(it))}</span>
      <button type="button" class="r-title" data-open="${esc(it.id)}" style="text-align:left">${isNew(it) ? '<i class="new-tag">NEW</i>' : ''}${esc(it.title)}</button>
      <span class="r-co">${esc(it.company)}</span>
      <span class="r-idea">${insightMark(it)} ${esc(insight(it))}</span>
      <span class="r-pop">${scoreBadge(it)}</span>
      <span class="r-date tnum">${mmdd(it.date_added)}</span>
      ${saveBtn(it)}
    </div>`;
  }
  const skeletonCard = () => `<div class="card skeleton" aria-hidden="true"><span class="sk" style="aspect-ratio:16/10"></span><span class="sk" style="height:48px"></span><span class="sk sk-line w40"></span><span class="sk" style="height:44px"></span><span class="sk" style="height:66px"></span><span class="sk sk-line w30"></span></div>`;

  /* ---------- 아카이브 (피드 전환) ---------- */
  function archiveItems() {
    const a = state.ar, f = cur();
    const q = a.q.trim().toLowerCase();
    return feedData().items.filter((it) => {
      if (a.tab === 'saved' && !state.saved.has(it.id)) return false;
      if (f.cats.size && !it.categories.some((c) => f.cats.has(c))) return false;
      if (f.period) { const g = daysBetween(state.today, it.date_added); if (g < 0 || g >= f.period) return false; }
      if (q && ![it.title, it.company, it.product, insight(it)].filter(Boolean).join(' ').toLowerCase().includes(q)) return false;
      return true;
    }).sort(f.sort === 'new' ? byNewest : byScore);
  }

  function renderArchive() {
    const a = state.ar, f = cur(), fd = feedData();
    $$('.feed-tab').forEach((b) => b.setAttribute('aria-selected', b.dataset.feed === state.feed));
    $('#hlDate').textContent = fd.daily ? korDateFull(fd.daily.date) : '';
    $('#hlSummary').textContent = fd.daily?.summary || (state.feed === 'news' ? 'AI 업계 뉴스' : 'AI 신제품 레이더');
    $$('.ar-tab').forEach((b) => b.setAttribute('aria-selected', b.dataset.tab === a.tab));
    $('#savedCount').textContent = fd.items.filter((it) => state.saved.has(it.id)).length;
    $('#arChips').innerHTML = catsFor(state.feed).map((c) => `<button type="button" class="chip" data-arcat="${esc(c)}" aria-pressed="${f.cats.has(c)}"><span class="dot" style="--dot:${catColor(c)}"></span>${esc(c)}</button>`).join('');
    $$('#period button').forEach((b) => b.setAttribute('aria-pressed', +b.dataset.v === f.period));
    $$('#sort button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.v === f.sort));
    $('#sort button[data-v="pop"]').textContent = state.feed === 'news' ? '중요도순' : '인기순';
    $$('#viewMode button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.v === a.view));

    const items = archiveItems();
    const sortLabel = f.sort === 'new' ? '최신순' : (state.feed === 'news' ? '중요도순' : '인기순');
    const parts = [a.tab === 'saved' ? '저장' : null, f.cats.size ? [...f.cats].join('·') : '전체 카테고리', PERIOD_LABEL[f.period], a.q.trim() ? `‘${a.q.trim()}’` : null, sortLabel].filter(Boolean);
    $('#resultLine').textContent = `${parts.join(' · ')} · ${items.length}개`;

    const out = $('#archiveList');
    if (!items.length) {
      const empty = a.tab === 'saved' && !state.saved.size
        ? ['저장한 항목이 없어요', '카드의 ☆를 누르면 여기에 모입니다.']
        : fd.items.length ? ['조건에 맞는 항목이 없어요', '카테고리나 기간을 넓혀 보세요.']
          : state.feed === 'news' ? ['아직 뉴스가 없어요', '매일 아침 글로벌 서치로 업계 뉴스가 채워집니다.'] : ['조건에 맞는 항목이 없어요', '카테고리나 기간을 넓혀 보세요.'];
      out.innerHTML = `<div class="empty"><h2>${empty[0]}</h2><p>${empty[1]}</p></div>`;
      out.dataset.list = '';
      return;
    }
    const render = (list) => a.view === 'list' ? `<div class="list">${list.map(row).join('')}</div>` : `<div class="grid">${list.map((it) => card(it)).join('')}</div>`;
    if (f.sort === 'new') {
      const groups = new Map();
      items.forEach((it) => { if (!groups.has(it.date_added)) groups.set(it.date_added, []); groups.get(it.date_added).push(it); });
      out.innerHTML = [...groups].map(([d, list]) => `<h2 class="group-h">${korDate(d)} <span class="muted tnum">· ${list.length}개</span></h2>${render(list)}`).join('');
    } else {
      out.innerHTML = render(items);
    }
    out.dataset.list = items.map((it) => it.id).join(',');
  }

  /* ---------- 상세 패널 ---------- */
  const byId = (id) => [...state.items, ...state.news].find((it) => it.id === id);

  function openPanel(id, listIds) {
    state.panelList = listIds && listIds.length ? listIds : [id];
    state.panelIdx = Math.max(0, state.panelList.indexOf(id));
    if (!$('#panel').hidden) { renderPanel(); return; }
    state.lastFocus = document.activeElement;
    $('#scrim').hidden = false;
    $('#panel').hidden = false;
    $('#panel').style.transform = '';
    document.body.style.overflow = 'hidden';
    renderPanel();
    $('#pClose').focus();
  }
  function closePanel() {
    if ($('#panel').hidden) return;
    $('#panel').hidden = true;
    $('#scrim').hidden = true;
    document.body.style.overflow = '';
    state.lastFocus?.focus?.();
  }
  function stepPanel(dir) {
    const n = state.panelList.length;
    if (n < 2) return;
    state.panelIdx = (state.panelIdx + dir + n) % n;
    renderPanel();
  }
  function renderPanel() {
    const it = byId(state.panelList[state.panelIdx]);
    if (!it) return;
    const pool = isNewsItem(it) ? state.news : state.items;
    const related = pool.filter((x) => x.id !== it.id && primary(x) === primary(it)).sort(byScore).slice(0, 3);
    const n = state.panelList.length;
    $('#pPrev').disabled = $('#pNext').disabled = n < 2;
    const facts = isNewsItem(it)
      ? `<dt>주체</dt><dd>${esc(it.company)}</dd>
         <dt>발표일</dt><dd>${korDate(it.date_announced)}</dd>
         <dt>추가일</dt><dd>${korDate(it.date_added)}</dd>
         <dt>중요도 점수</dt><dd>${scoreOf(it) >= 0 ? `${scoreOf(it)} / 100` : '—'}</dd>
         <dt>확인</dt><dd>${esc(it.status)}</dd>`
      : `<dt>회사</dt><dd>${esc(it.company)}</dd>
         <dt>제품</dt><dd>${esc(it.product)}</dd>
         <dt>가격</dt><dd>${esc(it.price ?? '공개 안 됨')}</dd>
         <dt>출시 상태</dt><dd>${esc(it.availability)}</dd>
         <dt>발표일</dt><dd>${korDate(it.date_announced)}</dd>
         <dt>추가일</dt><dd>${korDate(it.date_added)}</dd>
         <dt>인기 점수</dt><dd>${scoreOf(it) >= 0 ? `${scoreOf(it)} / 100` : '—'}</dd>
         <dt>확인</dt><dd>${esc(it.status)}</dd>`;
    $('#panelBody').innerHTML = `
      ${media(it)}
      ${it.image ? `<p class="credit">이미지 출처: 원문 대표 이미지</p>` : ''}
      <div class="c-row1"><span class="c-row1-r" style="gap:16px">${it.categories.map(catTag).join('')}</span><span class="c-row1-r">${it.status === '미확인' ? '<span class="badge-unv">미확인</span>' : ''}${scoreBadge(it)}</span></div>
      <h2 id="pTitle">${esc(it.title)}</h2>
      <p class="c-meta" style="white-space:normal">${meta(it)}</p>
      <p class="p-desc">${esc(it.what_is_new)}</p>
      <p class="idea">${insightMark(it)} ${esc(insight(it))}</p>
      <dl class="facts tnum">${facts}</dl>
      <div class="p-actions">
        <a class="btn" href="${esc(it.source_url)}" target="_blank" rel="noopener">원문 보기 ${icon('ext')}</a>
        <button type="button" class="btn" data-save="${esc(it.id)}" aria-pressed="${state.saved.has(it.id)}">${icon('star')} ${state.saved.has(it.id) ? '저장됨' : '저장'}</button>
      </div>
      ${related.length ? `<div class="related"><h3>같은 카테고리 · ${esc(primary(it))}</h3>${related.map((r) => `<button type="button" data-rel="${esc(r.id)}">${media(r)}<b>${esc(r.title)}</b><span>${esc(r.company)} · ${mmdd(r.date_announced)}</span></button>`).join('')}</div>` : ''}
      ${n > 1 ? `<p class="p-hint tnum">${state.panelIdx + 1} / ${n} · 키보드 ← → 로 이동</p>` : ''}`;
    $('#panelBody').scrollTop = 0;
  }

  /* 모바일 하단 시트: 아래로 끌어 닫기 */
  function bindSheetDrag() {
    const panel = $('#panel');
    let y0 = null, dy = 0;
    const start = (e) => {
      if (!matchMedia('(max-width: 639px)').matches) return;
      if (e.target.closest('button') && !e.target.closest('#grab')) return;
      y0 = e.clientY; dy = 0; panel.style.transition = 'none';
      e.currentTarget.setPointerCapture?.(e.pointerId);
    };
    const move = (e) => { if (y0 == null) return; dy = Math.max(0, e.clientY - y0); panel.style.transform = `translateY(${dy}px)`; };
    const end = () => {
      if (y0 == null) return;
      y0 = null; panel.style.transition = 'transform 180ms ease';
      if (dy > 100) { panel.style.transform = 'translateY(100%)'; setTimeout(() => { closePanel(); panel.style.transition = ''; panel.style.transform = ''; }, 180); }
      else panel.style.transform = '';
    };
    ['#grab', '.panel-top'].forEach((s) => {
      const el = $(s);
      el.addEventListener('pointerdown', start);
      el.addEventListener('pointermove', move);
      el.addEventListener('pointerup', end);
      el.addEventListener('pointercancel', end);
    });
  }

  /* ---------- 저장 ---------- */
  function toggleSave(id) {
    state.saved.has(id) ? state.saved.delete(id) : state.saved.add(id);
    store.set('radar.saved', [...state.saved]);
    const on = state.saved.has(id);
    $$(`[data-save="${CSS.escape(id)}"]`).forEach((b) => {
      b.setAttribute('aria-pressed', on);
      if (b.classList.contains('btn')) b.innerHTML = `${icon('star')} ${on ? '저장됨' : '저장'}`;
    });
    renderArchive();
  }

  /* ---------- 테마 ---------- */
  const effectiveDark = () => {
    const t = document.documentElement.dataset.theme;
    return t ? t === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  };
  function paintThemeBtn() {
    const dark = effectiveDark();
    const b = $('#themeBtn');
    b.innerHTML = icon(dark ? 'sun' : 'moon');
    b.setAttribute('aria-label', dark ? '라이트 모드로 전환' : '다크 모드로 전환');
  }
  function initTheme() {
    const t = store.get('radar.theme', null);
    if (t) document.documentElement.dataset.theme = t;
    paintThemeBtn();
    matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', paintThemeBtn);
    $('#themeBtn').addEventListener('click', () => {
      const next = effectiveDark() ? 'light' : 'dark';
      const sys = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      if (next === sys) { delete document.documentElement.dataset.theme; store.del('radar.theme'); }
      else { document.documentElement.dataset.theme = next; store.set('radar.theme', next); }
      paintThemeBtn();
    });
  }

  function switchFeed(feed) {
    if (feed === state.feed) return;
    state.feed = feed;
    store.set('radar.feed', feed);
    closePanel();
    renderArchive();
    window.scrollTo(0, 0);
  }

  /* ---------- 이벤트 ---------- */
  function bind() {
    document.addEventListener('click', (e) => {
      const t = e.target;
      const save = t.closest('[data-save]');
      if (save) { e.preventDefault(); toggleSave(save.dataset.save); return; }
      if (t.closest('a')) return;
      const rel = t.closest('[data-rel]');
      if (rel) { openPanel(rel.dataset.rel, [rel.dataset.rel]); return; }
      const ac = t.closest('[data-arcat]');
      if (ac) { const c = ac.dataset.arcat, f = cur(); f.cats.has(c) ? f.cats.delete(c) : f.cats.add(c); renderArchive(); return; }
      const holder = t.closest('[data-id]');
      if (holder && !t.closest('.panel')) {
        const listEl = holder.closest('[data-list]');
        openPanel(holder.dataset.id, listEl?.dataset.list ? listEl.dataset.list.split(',') : null);
      }
    });
    $('#brandLink').addEventListener('click', (e) => {
      e.preventDefault();
      state.ar.tab = 'all'; state.ar.q = ''; $('#q').value = '';
      cur().cats = new Set(); cur().period = 0;
      closePanel(); renderArchive(); window.scrollTo(0, 0);
    });
    $$('.feed-tab').forEach((b) => b.addEventListener('click', () => switchFeed(b.dataset.feed)));
    $$('.ar-tab').forEach((b) => b.addEventListener('click', () => { state.ar.tab = b.dataset.tab; renderArchive(); }));
    $('#period').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { cur().period = +b.dataset.v; renderArchive(); } });
    $('#sort').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { cur().sort = b.dataset.v; store.set(`radar.sort.${state.feed}`, b.dataset.v); renderArchive(); } });
    $('#viewMode').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { state.ar.view = b.dataset.v; store.set('radar.view', b.dataset.v); renderArchive(); } });
    $('#q').addEventListener('input', (e) => { state.ar.q = e.target.value; renderArchive(); });
    $('#scrim').addEventListener('click', closePanel);
    $('#pClose').addEventListener('click', closePanel);
    $('#pPrev').addEventListener('click', () => stepPanel(-1));
    $('#pNext').addEventListener('click', () => stepPanel(1));
    document.addEventListener('keydown', (e) => {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName);
      if (!$('#panel').hidden) {
        if (e.key === 'Escape') { closePanel(); return; }
        if (e.key === 'ArrowLeft') { e.preventDefault(); stepPanel(-1); return; }
        if (e.key === 'ArrowRight') { e.preventDefault(); stepPanel(1); return; }
        if (e.key === 'Tab') { // 포커스를 패널 안에 가둠
          const fcs = $$('#panel button:not([disabled]), #panel a[href]');
          if (e.shiftKey && document.activeElement === fcs[0]) { e.preventDefault(); fcs[fcs.length - 1].focus(); }
          else if (!e.shiftKey && document.activeElement === fcs[fcs.length - 1]) { e.preventDefault(); fcs[0].focus(); }
        }
        return;
      }
      if (e.key === '/' && !typing) { e.preventDefault(); $('#q').focus(); }
    });
    const bar = $('#topbar');
    const onScroll = () => bar.classList.toggle('scrolled', window.scrollY > 4);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    bindSheetDrag();
  }

  /* ---------- 시작 ---------- */
  const tag = (list, kind) => (Array.isArray(list) ? list.filter((it) => it && it.id).map((it) => (it.kind = kind, it)) : []);
  async function load() {
    $('#archiveList').innerHTML = `<div class="grid">${Array.from({ length: 6 }, skeletonCard).join('')}</div>`;
    const grab = (url) => fetch(url, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    try {
      const [items, daily, news, newsDaily] = await Promise.all([
        fetch('data/items.json', { cache: 'no-store' }).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); }),
        grab('data/daily.json'), grab('data/news.json'), grab('data/news-daily.json'),
      ]);
      state.items = tag(items, 'product');
      state.news = tag(news, 'news');
      state.daily = daily;
      state.newsDaily = newsDaily;
      const allDates = [...state.items, ...state.news].map((it) => it.date_added).sort();
      state.today = daily?.date || newsDaily?.date || allDates[allDates.length - 1];
      const last = [daily?.updated_at, newsDaily?.updated_at].filter(Boolean).sort().pop();
      if (last) {
        const d = new Date(last);
        const p = (n) => String(n).padStart(2, '0');
        $('#updated').textContent = `마지막 업데이트 ${p(d.getMonth() + 1)}.${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
      }
      renderArchive();
    } catch (err) {
      $('#hlSummary').textContent = '데이터를 불러오지 못했어요';
      $('#archiveList').innerHTML = `<div class="empty"><h2>items.json을 읽을 수 없어요</h2><p>파일을 직접 열면 브라우저가 데이터 읽기를 막습니다. 폴더에서 <b>python3 -m http.server</b>를 실행한 뒤 http://localhost:8000 으로 여세요.</p></div>`;
    }
  }

  initTheme();
  bind();
  load();
})();
