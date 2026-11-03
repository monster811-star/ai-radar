(() => {
  'use strict';

  const CATS = ['웨어러블·안경', '홈·로봇', '새 입력 방식', '쇼핑·결제', '매장·리테일', '패션·뷰티', '콘텐츠 제작', 'SNS 트렌드', '참고(규제)'];
  const catColor = (c) => `var(--c${CATS.indexOf(c) + 1 || 9})`;
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
    items: [], daily: null, today: '',
    saved: new Set(store.get('radar.saved', [])),
    ar: { tab: 'all', q: '', cats: new Set(), period: 0, sort: store.get('radar.sort', 'new'), view: store.get('radar.view', 'card') },
    panelList: [], panelIdx: -1, lastFocus: null,
  };

  /* ---------- 날짜 유틸 ---------- */
  const toDate = (s) => new Date(s + 'T00:00:00');
  const daysBetween = (a, b) => Math.round((toDate(a) - toDate(b)) / DAY);
  const mmdd = (s) => { const [, m, d] = s.split('-'); return `${m}.${d}`; };
  const korDate = (s) => { const d = toDate(s); return `${d.getMonth() + 1}월 ${d.getDate()}일`; };
  const korDateFull = (s) => { const d = toDate(s); return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 ${'일월화수목금토'[d.getDay()]}요일`; };

  const isNew = (it) => {
    if (it.date_added !== state.today || !state.daily?.updated_at) return false;
    return Date.now() - Date.parse(state.daily.updated_at) < DAY;
  };
  const primary = (it) => it.categories?.[0] || '참고(규제)';
  const popOf = (it) => (typeof it.popularity === 'number' ? it.popularity : -1);
  const byPopularity = (a, b) => popOf(b) - popOf(a) || b.date_added.localeCompare(a.date_added) || b.date_announced.localeCompare(a.date_announced) || a.title.localeCompare(b.title);
  const byNewest = (a, b) => b.date_added.localeCompare(a.date_added) || b.date_announced.localeCompare(a.date_announced) || popOf(b) - popOf(a);

  /* ---------- 카드 ---------- */
  // 인기 점수(0~100): 웹 보도량·매체·조회수로 매긴 화제도
  const popBadge = (it) => {
    const p = it.popularity;
    if (typeof p !== 'number') return '';
    const hot = p >= 70 ? ' hot' : p >= 40 ? ' warm' : '';
    return `<span class="pop${hot}" role="img" aria-label="인기 점수 ${p}점">${icon('fire')}<b class="tnum">${p}</b></span>`;
  };
  const catTag = (c) => `<span class="cat-tag"><span class="dot" style="--dot:${catColor(c)}"></span>${esc(c)}</span>`;
  const meta = (it) => [it.company, it.price, it.availability].filter(Boolean).map(esc).join(' · ');
  // 대표 이미지: 원문 사진이 있으면 톤을 맞춰 쓰고, 없으면 카테고리 바탕 + 겹친 패널 타일
  function media(it, { overlay = false } = {}) {
    const c = primary(it);
    const style = `--cat:${catColor(c)}`;
    const over = overlay
      ? `<span class="float tl">${catTag(c)}</span><span class="float tr">${it.status === '미확인' ? '<span class="badge-unv">미확인</span>' : ''}${popBadge(it)}</span>`
      : '';
    if (it.image) return `<div class="media" style="${style}"><img src="${esc(it.image)}" alt="" decoding="async">${over}</div>`;
    return `<div class="media tile" style="${style}"><div class="tile-stack" aria-hidden="true"><span class="tile-back"></span><span class="tile-front"><svg class="ic"><use href="#i-cat${CATS.indexOf(c) + 1}"/></svg><b>${esc(it.product)}</b><span>${esc(it.company)}</span></span></div>${over}</div>`;
  }
  const saveBtn = (it, cls = 'save-btn') => `<button type="button" class="${cls}" data-save="${esc(it.id)}" aria-pressed="${state.saved.has(it.id)}" aria-label="저장">${icon('star')}</button>`;

  function card(it) {
    const unv = it.status === '미확인';
    return `<article class="card${unv ? ' unverified' : ''}" data-id="${esc(it.id)}">
      ${media(it, { overlay: true })}
      <h3 class="c-title"><button type="button" class="stretch" data-open="${esc(it.id)}">${isNew(it) ? '<i class="new-tag">NEW</i>' : ''}${esc(it.title)}</button></h3>
      <p class="c-meta">${meta(it)}</p>
      <p class="c-desc">${esc(it.what_is_new)}</p>
      <p class="idea">💡 ${esc(it.idea)}</p>
      <div class="c-foot"><span class="tnum">${mmdd(it.date_announced)} 발표</span><span class="grow"></span>
        <a class="link-btn" href="${esc(it.source_url)}" target="_blank" rel="noopener">원문 ${icon('ext')}</a>${saveBtn(it)}</div>
    </article>`;
  }
  function row(it) {
    return `<div class="row${it.status === '미확인' ? ' unverified' : ''}" data-id="${esc(it.id)}">
      ${media(it)}
      <span class="r-cat">${catTag(primary(it))}</span>
      <button type="button" class="r-title" data-open="${esc(it.id)}" style="text-align:left">${isNew(it) ? '<i class="new-tag">NEW</i>' : ''}${esc(it.title)}</button>
      <span class="r-co">${esc(it.company)}</span>
      <span class="r-idea">💡 ${esc(it.idea)}</span>
      <span class="r-pop">${popBadge(it)}</span>
      <span class="r-date tnum">${mmdd(it.date_added)}</span>
      ${saveBtn(it)}
    </div>`;
  }
  const skeletonCard = () => `<div class="card skeleton" aria-hidden="true"><span class="sk" style="aspect-ratio:16/10"></span><span class="sk" style="height:48px"></span><span class="sk sk-line w40"></span><span class="sk" style="height:44px"></span><span class="sk" style="height:66px"></span><span class="sk sk-line w30"></span></div>`;

  /* ---------- 아카이브 (단일 뷰) ---------- */
  function archiveItems() {
    const a = state.ar;
    const q = a.q.trim().toLowerCase();
    return state.items.filter((it) => {
      if (a.tab === 'saved' && !state.saved.has(it.id)) return false;
      if (a.cats.size && !it.categories.some((c) => a.cats.has(c))) return false;
      if (a.period) { const g = daysBetween(state.today, it.date_added); if (g < 0 || g >= a.period) return false; }
      if (q && ![it.title, it.company, it.product, it.idea].join(' ').toLowerCase().includes(q)) return false;
      return true;
    }).sort(a.sort === 'new' ? byNewest : byPopularity);
  }

  function renderArchive() {
    const a = state.ar;
    $('#hlDate').textContent = state.daily ? korDateFull(state.today) : '';
    $('#hlSummary').textContent = state.daily?.summary || 'AI 신제품 레이더';
    $$('.ar-tab').forEach((b) => b.setAttribute('aria-selected', b.dataset.tab === a.tab));
    $('#savedCount').textContent = state.saved.size;
    $('#arChips').innerHTML = CATS.map((c) => `<button type="button" class="chip" data-arcat="${esc(c)}" aria-pressed="${a.cats.has(c)}"><span class="dot" style="--dot:${catColor(c)}"></span>${esc(c)}</button>`).join('');
    $$('#period button').forEach((b) => b.setAttribute('aria-pressed', +b.dataset.v === a.period));
    $$('#sort button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.v === a.sort));
    $$('#viewMode button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.v === a.view));

    const items = archiveItems();
    const parts = [a.tab === 'saved' ? '저장' : null, a.cats.size ? [...a.cats].join('·') : '전체 카테고리', PERIOD_LABEL[a.period], a.q.trim() ? `‘${a.q.trim()}’` : null, a.sort === 'pop' ? '인기순' : '최신순'].filter(Boolean);
    $('#resultLine').textContent = `${parts.join(' · ')} · ${items.length}개`;

    const out = $('#archiveList');
    if (!items.length) {
      out.innerHTML = `<div class="empty"><h2>${a.tab === 'saved' && !state.saved.size ? '저장한 항목이 없어요' : '조건에 맞는 항목이 없어요'}</h2><p>${a.tab === 'saved' && !state.saved.size ? '카드의 ☆를 누르면 여기에 모입니다.' : '카테고리나 기간을 넓혀 보세요.'}</p></div>`;
      out.dataset.list = '';
      return;
    }
    const render = (list) => a.view === 'list' ? `<div class="list">${list.map(row).join('')}</div>` : `<div class="grid">${list.map((it) => card(it)).join('')}</div>`;
    if (a.sort === 'new') {
      const groups = new Map();
      items.forEach((it) => { if (!groups.has(it.date_added)) groups.set(it.date_added, []); groups.get(it.date_added).push(it); });
      out.innerHTML = [...groups].map(([d, list]) => `<h2 class="group-h">${korDate(d)} <span class="muted tnum">· ${list.length}개</span></h2>${render(list)}`).join('');
    } else {
      out.innerHTML = render(items);
    }
    out.dataset.list = items.map((it) => it.id).join(',');
  }

  /* ---------- 상세 패널 ---------- */
  const byId = (id) => state.items.find((it) => it.id === id);

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
    const related = state.items.filter((x) => x.id !== it.id && primary(x) === primary(it)).sort(byPopularity).slice(0, 3);
    const n = state.panelList.length;
    $('#pPrev').disabled = $('#pNext').disabled = n < 2;
    $('#panelBody').innerHTML = `
      ${media(it)}
      ${it.image ? `<p class="credit">이미지 출처: 원문 대표 이미지</p>` : ''}
      <div class="c-row1"><span class="c-row1-r" style="gap:16px">${it.categories.map(catTag).join('')}</span><span class="c-row1-r">${it.status === '미확인' ? '<span class="badge-unv">미확인</span>' : ''}${popBadge(it)}</span></div>
      <h2 id="pTitle">${esc(it.title)}</h2>
      <p class="c-meta" style="white-space:normal">${meta(it)}</p>
      <p class="p-desc">${esc(it.what_is_new)}</p>
      <p class="idea">💡 ${esc(it.idea)}</p>
      <dl class="facts tnum">
        <dt>회사</dt><dd>${esc(it.company)}</dd>
        <dt>제품</dt><dd>${esc(it.product)}</dd>
        <dt>가격</dt><dd>${esc(it.price ?? '공개 안 됨')}</dd>
        <dt>출시 상태</dt><dd>${esc(it.availability)}</dd>
        <dt>발표일</dt><dd>${korDate(it.date_announced)}</dd>
        <dt>추가일</dt><dd>${korDate(it.date_added)}</dd>
        <dt>인기 점수</dt><dd>${typeof it.popularity === 'number' ? `${it.popularity} / 100` : '—'}</dd>
        <dt>확인</dt><dd>${esc(it.status)}</dd>
      </dl>
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
    $('#savedCount').textContent = state.saved.size;
    if (state.ar.tab === 'saved') renderArchive();
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
      if (ac) { const c = ac.dataset.arcat; state.ar.cats.has(c) ? state.ar.cats.delete(c) : state.ar.cats.add(c); renderArchive(); return; }
      const holder = t.closest('[data-id]');
      if (holder && !t.closest('.panel')) {
        const listEl = holder.closest('[data-list]');
        openPanel(holder.dataset.id, listEl?.dataset.list ? listEl.dataset.list.split(',') : null);
      }
    });
    $('#brandLink').addEventListener('click', (e) => {
      e.preventDefault();
      state.ar = { ...state.ar, tab: 'all', q: '', cats: new Set(), period: 0 };
      $('#q').value = '';
      closePanel();
      renderArchive();
      window.scrollTo(0, 0);
    });
    $$('.ar-tab').forEach((b) => b.addEventListener('click', () => { state.ar.tab = b.dataset.tab; renderArchive(); }));
    $('#period').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { state.ar.period = +b.dataset.v; renderArchive(); } });
    $('#sort').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { state.ar.sort = b.dataset.v; store.set('radar.sort', b.dataset.v); renderArchive(); } });
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
          const f = $$('#panel button:not([disabled]), #panel a[href]');
          if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
          else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
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
  async function load() {
    $('#archiveList').innerHTML = `<div class="grid">${Array.from({ length: 6 }, skeletonCard).join('')}</div>`;
    try {
      const [items, daily] = await Promise.all([
        fetch('data/items.json', { cache: 'no-store' }).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); }),
        fetch('data/daily.json', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
      ]);
      state.items = items.filter((it) => it && it.id);
      state.daily = daily;
      state.today = daily?.date || state.items.map((it) => it.date_added).sort().pop();
      if (daily?.updated_at) {
        const d = new Date(daily.updated_at);
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
