/* =========================================================================
 *  首页：hero + 实时计时 + 倒数 + 里程碑 + 照片墙
 * ========================================================================= */
window.Views = window.Views || {};
window.Views.home = (function () {
  'use strict';
  const U = window.U;
  const esc = U.esc;

  /* ---------------- 里程碑计算 ---------------- */
  const DAY_MARKS = [
    100, 200, 300, 365, 400, 500, 520, 600, 700, 730, 800, 900, 1000,
    1095, 1100, 1200, 1300, 1314, 1400, 1460, 1500, 1600, 1700, 1800, 1825, 1900, 2000,
    2100, 2190, 2200, 2300, 2400, 2500, 2555, 2600, 2700, 2800, 2900, 3000,
    3100, 3200, 3285, 3300, 3400, 3500, 3600, 3650, 3700, 4000, 4380, 4500,
    5000, 5200, 5475, 6000, 7000, 7300, 8000, 9000, 9999, 10000
  ];
  const YEAR_ICON = ['🎂', '💞', '🌷', '🍰', '🌹', '✨', '🏡', '💍', '🥂', '🌟'];

  function addDays(d, n) {
    const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    x.setDate(x.getDate() + n);
    return x;
  }

  /** 从纪念日生成全部里程碑：{ n(第几天), date, label, icon } */
  function buildMilestones(anniv) {
    const start = U.parseDate(anniv);
    if (!start) return [];
    const list = [];
    for (let y = 1; y <= 60; y++) {
      const d = new Date(start.getFullYear() + y, start.getMonth(), start.getDate());
      list.push({ n: U.dayDiff(d, start) + 1, date: d, label: y + ' 周年', sub: '', icon: YEAR_ICON[(y - 1) % YEAR_ICON.length], kind: 'year' });
    }
    DAY_MARKS.forEach((n) => {
      if (n % 365 === 0 || n === 365) return;           // 和周年重复的不再单列
      list.push({ n: n, date: addDays(start, n - 1), label: n.toLocaleString(), sub: '天', icon: n === 520 ? '💗' : (n === 1314 ? '💞' : '🎈'), kind: 'day' });
    });
    const seen = new Set();
    return list.filter((m) => (seen.has(m.n) ? false : (seen.add(m.n), true)))
               .sort((a, b) => a.n - b.n);
  }

  /* ---------------- 计时器左边的小人 ---------------- */
  function counterBuddy(ctx) {
    const ai = window.Views && window.Views.ai;
    if (!ai || !ai.buddyPic) return '';
    const pic = ai.buddyPic(ctx);
    const inner = pic
      ? `<img src="${esc(pic)}" alt="${esc((ctx.me && ctx.me.name) || '')}" class="hb__pic">`
      : (ai.buddySvg ? ai.buddySvg() : '');
    if (!inner) return '';
    const st = ctx.settings || {};
    const name = st.nicknameA || '我';
    return `<div class="counter__buddy" id="home-buddy" title="${esc(name)} 一直在这儿陪着你">
      <div class="hb">${inner}</div>
      <div class="hb__tail"></div>
    </div>`;
  }

  /* ---------------- 渲染 ---------------- */
  function render(ctx) {
    const s = ctx.settings;
    const start = U.parseDate(s.anniversary);
    const today = U.startOfDay();
    const elapsedDays = start ? U.dayDiff(today, start) : 0;
    const curDay = elapsedDays + 1;

    /* 封面 */
    const cover = (ctx.photos || []).find((p) => p.id === s.coverPhotoId && p.src);
    const heroCls = cover ? 'hero has-cover' : 'hero';

    /* 首页照片 */
    const ids = (s.homePhotoIds || []).filter(Boolean);
    let wall = [];
    if (ids.length) {
      wall = ids.map((id) => ctx.photos.find((p) => p.id === id)).filter(Boolean);
    } else {
      wall = (ctx.photos || []).slice(0, 9);
    }
    if (ctx.homeTag) wall = wall.filter((p) => (p.tags || []).includes(ctx.homeTag));

    /* 倒数 */
    const cds = buildCountdowns(ctx, s, curDay);

    /* 里程碑 */
    const all = buildMilestones(s.anniversary);
    const done = all.filter((m) => m.n <= curDay);
    const next = all.filter((m) => m.n > curDay);
    const nextM = next[0];
    const prevM = done[done.length - 1];
    let prog = 1, progText = '';
    if (nextM) {
      const from = prevM ? prevM.n : 1;
      prog = U.clamp((curDay - from) / (nextM.n - from), 0, 1);
      progText = `还差 ${nextM.n - curDay} 天`;
    }
    const strip = ctx.showAllMs ? all : done.slice(-8).concat(next.slice(0, 4));

    const tags = [];
    (ctx.photos || []).forEach((p) => (p.tags || []).forEach((t) => { if (!tags.includes(t)) tags.push(t); }));

    return `
    <section class="${heroCls}">
      ${cover ? `<div class="hero__cover"><img src="${esc(cover.src)}" alt=""></div><div class="hero__veil"></div>` : ''}
      <div class="hero__inner">
        <span class="hero__eyebrow">💗 相恋第 <b class="mono" style="margin:0 3px">${curDay}</b> 天</span>
        <h1 class="hero__title">${esc(s.title)}</h1>
        <div class="hero__sub">${esc(s.subtitle)}</div>
        ${s.tagline ? `<p class="hero__tagline">${esc(s.tagline)}</p>` : ''}

        <div class="counter">
          <div class="counter__flex">
            ${counterBuddy(ctx)}
            <div class="counter__main">
              <div class="counter__row">
                <div class="counter__cell"><div class="counter__num mono" data-c="d">${elapsedDays}</div><div class="counter__unit">天</div></div>
                <div class="counter__cell"><div class="counter__num mono" data-c="h">00</div><div class="counter__unit">时</div></div>
                <div class="counter__cell"><div class="counter__num mono" data-c="m">00</div><div class="counter__unit">分</div></div>
                <div class="counter__cell"><div class="counter__num mono" data-c="s">00</div><div class="counter__unit">秒</div></div>
              </div>
              <div class="counter__sub">从 <b>${esc(U.fmtDate(s.anniversary))}</b> 到今天，我们已经在一起这么久了</div>
            </div>
          </div>
        </div>

        ${pokeBox(ctx, s)}

        <div class="hero-actions">
          ${ctx.canEdit
            ? `<button class="btn btn--primary" data-act="upload">📷 传照片</button>
               <button class="btn" data-act="diary">✍️ 写日记</button>
               <button class="btn btn--ghost" data-act="settings">⚙️ 设置</button>`
            : `<button class="btn btn--primary" data-act="gallery">📷 看相册</button>`}
        </div>
      </div>
    </section>

    ${otdSection(ctx)}

    ${cds.length ? `<section class="section"><div class="section__head">
        <h2 class="section__title">⏳ 倒数着期待</h2>
        <p class="section__desc">下一个值得庆祝的日子</p>
      </div><div class="countdowns">${cds.join('')}</div></section>` : ''}

    <section class="section">
      <div class="section__head">
        <h2 class="section__title">🏆 我们的里程碑</h2>
        <p class="section__desc">${done.length} 个已达成的纪念</p>
        <div class="section__actions">
          <button class="btn btn--ghost btn--sm" data-act="toggle-ms">${ctx.showAllMs ? '只看最近的' : '查看全部'}</button>
        </div>
      </div>
      ${nextM ? `<div class="card card--pad rise" style="margin-bottom:14px">
        <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
          <span style="font-size:26px">${nextM.icon}</span>
          <div style="flex:1;min-width:180px">
            <div style="font-weight:700">下一个里程碑：${esc(nextM.label)}${esc(nextM.sub || '')}</div>
            <div style="color:var(--muted);font-size:13px">${esc(U.fmtDate(nextM.date, { week: true }))} · ${esc(progText)}</div>
          </div>
          <div class="mono" style="font-size:22px;font-weight:800;color:var(--accent-ink)">${Math.round(prog * 100)}%</div>
        </div>
        <div class="progress" style="height:8px;border-radius:99px;background:var(--accent-soft);margin-top:12px;overflow:hidden">
          <i style="display:block;height:100%;width:${(prog * 100).toFixed(1)}%;background:var(--accent);border-radius:99px"></i>
        </div>
      </div>` : ''}
      <div class="milestones stagger">
        ${strip.map((m) => {
          const isDone = m.n <= curDay;
          const isNext = nextM && m.n === nextM.n;
          return `<div class="ms ${isDone ? 'is-done' : ''} ${isNext ? 'is-next' : ''}">
            <div class="ms__icon">${isDone ? m.icon : '🔒'}</div>
            <div class="ms__label">${esc(m.label)}${m.sub ? `<span> ${esc(m.sub)}</span>` : ''}</div>
            <div class="ms__date">${isDone ? esc(U.fmtDate(m.date, { short: true })) + ' ✓' : '还差 ' + (m.n - curDay) + ' 天'}</div>
          </div>`;
        }).join('')}
      </div>
    </section>

    <section class="section">
      <div class="section__head">
        <h2 class="section__title">📸 照片墙</h2>
        <p class="section__desc">${ids.length ? '你在设置里挑出来的这些瞬间' : '最新的这些瞬间'}</p>
        <div class="section__actions">
          <button class="btn btn--ghost btn--sm" data-act="gallery">全部相册 →</button>
        </div>
      </div>
      ${tags.length > 1 ? `<div class="filters" style="margin-bottom:14px">
        <button class="chip ${!ctx.homeTag ? 'is-active' : ''}" data-tag="">全部</button>
        ${tags.map((t) => `<button class="chip ${ctx.homeTag === t ? 'is-active' : ''}" data-tag="${esc(t)}">${esc(t)}</button>`).join('')}
      </div>` : ''}
      ${wall.length
        ? `<div class="masonry" data-wall>${wall.map((p) => window.App.photoCard(p, { context: 'home' })).join('')}</div>`
        : `<div class="empty card card--pad">
             <div class="empty__icon">🖼️</div>
             <div class="empty__title">照片墙还是空的</div>
             <div class="empty__desc">${ctx.canEdit ? '上传第一张照片，然后在相册里点「🏠」把它放到首页' : 'TA 还没有挑选要展示的照片'}</div>
             ${ctx.canEdit ? '<button class="btn btn--primary" data-act="upload">上传照片</button>' : ''}
           </div>`}
    </section>`;
  }

  /* ---------------- 戳一戳 💗 ---------------- */
  function partnerName(ctx, s) {
    const k = ctx.me && ctx.me.key;
    if (k === 'A') return s.nicknameB || 'TA';
    if (k === 'B') return s.nicknameA || 'TA';
    return 'TA';
  }

  /** 今天戳了几次：mine = 我戳的，other = 对方戳我的 */
  function pokedToday(ctx) {
    const t0 = U.startOfDay().getTime();
    const meName = (ctx.me && ctx.me.name) || '';
    let mine = 0, other = 0;
    (ctx.pokes || []).forEach((p) => {
      const t = p && p.created_at ? new Date(p.created_at).getTime() : 0;
      if (!t || t < t0) return;
      if (p.author === meName) mine++; else other++;
    });
    return { mine: mine, other: other };
  }

  function pokeBox(ctx, s) {
    if (!ctx.canEdit) return '';
    const p = pokedToday(ctx);
    const who = partnerName(ctx, s);
    let line = '想 TA 了就戳一下，TA 打开网站时会看到 💗';
    let hot = false;
    if (p.other) {
      line = `<b>${esc(who)}</b> 今天想你了 <b class="mono">${p.other}</b> 次`;
      hot = true;
    } else if (p.mine) {
      line = `你今天已经戳了 <b class="mono">${p.mine}</b> 次，等 TA 打开就能看到`;
    }
    return `<div class="poke-box${hot ? ' is-hot' : ''}">
      <button class="btn poke-btn" type="button" data-act="poke"><span class="poke-btn__ico">💗</span>戳一戳</button>
      <div class="poke-line">${line}</div>
    </div>`;
  }

  /* ---------------- 去年的今天 ---------------- */
  /** 找出往年「同月同日」的照片和日记，按年份从近到远分组 */
  function buildOnThisDay(ctx) {
    const now = new Date();
    const mm = now.getMonth() + 1, dd = now.getDate();
    const map = new Map();
    const hit = (str) => {
      const d = U.parseDate(str);
      if (!d) return null;
      if (d.getMonth() + 1 !== mm || d.getDate() !== dd) return null;
      if (d.getFullYear() >= now.getFullYear()) return null;
      return d;
    };
    const bucket = (y) => {
      if (!map.has(y)) map.set(y, { year: y, photos: [], diary: [] });
      return map.get(y);
    };
    (ctx.photos || []).forEach((p) => {
      const d = hit(p.taken_at);
      if (d) bucket(d.getFullYear()).photos.push(p);
    });
    (ctx.diary || []).forEach((e) => {
      const d = hit(e.entry_date);
      if (d) bucket(d.getFullYear()).diary.push(e);
    });
    return Array.from(map.values()).sort((a, b) => b.year - a.year);
  }

  function otdSection(ctx) {
    const now = new Date();
    const mmdd = (now.getMonth() + 1) + '月' + now.getDate() + '日';
    const groups = buildOnThisDay(ctx);
    const newest = groups[0];
    const n = newest ? now.getFullYear() - newest.year : 0;
    const title = n > 1 ? n + ' 年前的今天' : '去年的今天';
    const desc = groups.length ? mmdd + ' · 你们在那一天留下的记忆' : mmdd + ' 这一天，还没有留下记录';
    const anniv = U.parseDate(ctx.settings.anniversary);

    const body = groups.length ? groups.slice(0, 2).map((g) => {
      const yearsAgo = now.getFullYear() - g.year;
      const thatDay = new Date(g.year, now.getMonth(), now.getDate());
      const nth = anniv ? U.dayDiff(thatDay, anniv) + 1 : 0;
      const phs = g.photos.slice(0, 4);
      const more = g.photos.length - phs.length;
      return `<div class="card card--pad otd">
        <div class="otd__head">
          <span class="otd__badge">${g.year} 年</span>
          <span class="otd__ago">${yearsAgo === 1 ? '一年前' : yearsAgo + ' 年前'}${nth > 0 ? ' · 相恋第 ' + nth + ' 天' : ''}</span>
          <span class="otd__count">${g.photos.length} 张照片${g.diary.length ? ' · ' + g.diary.length + ' 篇日记' : ''}</span>
        </div>
        ${phs.length ? `<div class="otd__items">
          ${phs.map((p) => `<button class="otd__ph" type="button" data-ph-zoom="${esc(p.id)}" title="${esc(p.caption || '点击看大图')}">
            <img src="${esc(p.src)}" alt="" loading="lazy">
            ${p.caption ? `<span class="otd__cap">${esc(p.caption)}</span>` : ''}
          </button>`).join('')}
          ${more > 0 ? `<span class="otd__more">还有 ${more} 张</span>` : ''}
        </div>` : ''}
        ${g.diary.map((e) => `<div class="otd__diary">
          <div class="otd__diary-title">${e.mood ? `<span class="tl__mood">${esc((e.mood || '').split(' ')[0])}</span>` : ''}${esc(e.title || '那天的日记')}</div>
          <p class="otd__diary-text">${esc((e.content || '').slice(0, 160))}${(e.content || '').length > 160 ? '…' : ''}</p>
          ${e.author ? `<div class="otd__diary-foot">${esc(e.author)}</div>` : ''}
        </div>`).join('')}
      </div>`;
    }).join('') : `<div class="card card--pad otd otd--empty">
        <div class="otd__ico">📭</div>
        <div class="otd__empty-main">
          <div class="otd__empty-title">这一天你们还没有留下记录</div>
          <div class="otd__empty-desc">今天拍一张、写一句，明年的今天这里就会亮起来 ✨</div>
        </div>
        ${ctx.canEdit ? `<div class="otd__acts">
          <button class="btn btn--primary btn--sm" data-act="upload">📷 传一张</button>
          <button class="btn btn--ghost btn--sm" data-act="diary">✍️ 写一句</button>
        </div>` : ''}
      </div>`;

    return `<section class="section">
      <div class="section__head">
        <h2 class="section__title">🕰️ ${esc(title)}</h2>
        <p class="section__desc">${esc(desc)}</p>
      </div>
      ${body}
    </section>`;
  }

  /* ---------------- 倒数卡片 ---------------- */
  function buildCountdowns(ctx, s, curDay) {
    const out = [];
    const today = U.startOfDay();

    // 自定义纪念日（每年重复）
    (ctx.events || []).forEach((ev) => {
      const base = U.parseDate(ev.date);
      if (!base) return;
      const target = ev.yearly ? U.nextYearly(ev.date) : base;
      const d = U.dayDiff(target, today);
      if (!ev.yearly && d < 0) return;
      out.push(cdCard(ev.emoji || '💗', ev.title, d === 0 ? '就是今天！' : esc(U.fmtDate(target, { short: true, week: true })), d));
    });

    // 相恋周年
    if (s.anniversary) {
      const nextAnn = U.nextYearly(s.anniversary);
      const d = U.dayDiff(nextAnn, today);
      const years = nextAnn.getFullYear() - U.parseDate(s.anniversary).getFullYear();
      if (years >= 1) out.push(cdCard('🎂', years + ' 周年纪念', U.fmtDate(nextAnn, { short: true, week: true }), d));
    }

    // 下一个整数里程碑
    const all = buildMilestones(s.anniversary);
    const nxt = all.find((m) => m.n > curDay);
    if (nxt) out.push(cdCard(nxt.icon, '第 ' + nxt.label + (nxt.sub || '') + ' 天', U.fmtDate(nxt.date, { short: true }), nxt.n - curDay));

    return out.sort((a, b) => a.days - b.days).map((o) => o.html);
  }
  function cdCard(emoji, title, dateText, days) {
    const html = `<div class="cd">
      <span class="cd__emoji">${emoji}</span>
      <div class="cd__main">
        <div class="cd__title">${esc(title)}</div>
        <div class="cd__sub">${esc(dateText)}</div>
      </div>
      <div class="cd__num">${days === 0 ? '今天' : days + ' 天'}</div>
    </div>`;
    return { days: days, html: html };
  }

  /* ---------------- 挂载 ---------------- */
  function mount(root, ctx) {
    const nums = {
      d: root.querySelector('[data-c="d"]'),
      h: root.querySelector('[data-c="h"]'),
      m: root.querySelector('[data-c="m"]'),
      s: root.querySelector('[data-c="s"]')
    };
    const start = U.parseDate(ctx.settings.anniversary);
    let timer = null;
    function tick() {
      if (!start) return;
      const b = U.breakdown(Date.now() - start.getTime());
      if (nums.d) nums.d.textContent = b.d;
      if (nums.h) nums.h.textContent = U.pad(b.h);
      if (nums.m) nums.m.textContent = U.pad(b.m);
      if (nums.s) nums.s.textContent = U.pad(b.s);
    }
    tick();
    timer = setInterval(tick, 1000);

    // 计时器左边的小人：图挂了就整块藏起来，别留一个破图标
    const hb = root.querySelector('#home-buddy');
    if (hb) {
      const pic = hb.querySelector('.hb__pic');
      if (pic) pic.addEventListener('error', () => { hb.style.display = 'none'; });
      hb.addEventListener('click', () => { location.hash = '#/ai'; });
      hb.style.cursor = 'pointer';
    }

    root.addEventListener('click', (e) => {
      const t = e.target.closest('[data-act],[data-tag]');
      if (!t) return;
      const act = t.getAttribute('data-act');
      if (t.hasAttribute('data-tag')) {
        ctx.homeTag = t.getAttribute('data-tag') || '';
        window.App.render();
        return;
      }
      if (act === 'upload') window.App.uploadPrompt();
      if (act === 'diary') location.hash = '#/diary?new=1';
      if (act === 'settings') location.hash = '#/settings';
      if (act === 'gallery') location.hash = '#/gallery';
      if (act === 'poke') { doPoke(t, ctx); return; }
      if (act === 'toggle-ms') { ctx.showAllMs = !ctx.showAllMs; window.App.render(); }
    });

    return () => {
      clearInterval(timer);
    };
  }

  /* ---------------- 戳一戳的动作 ---------------- */
  async function doPoke(btn, ctx) {
    if (!ctx.canEdit) return U.needLogin();
    if (btn.disabled) return;
    btn.disabled = true;
    try {
      const me = await window.DB.me();
      await window.DB.pokes.add({ author: (me && me.name) || '我' });
      burstHearts(btn);
      U.toast('已经把你的想念送过去啦 💗', 'success');
      await window.App.refresh();
    } catch (err) {
      U.toast(err.message || '戳失败了，再试一次', 'error');
      btn.disabled = false;
    }
  }

  function burstHearts(btn) {
    const box = btn.closest('.poke-box') || btn.parentElement;
    if (!box) return;
    const icons = ['💗', '💖', '💕', '❤️', '💞'];
    for (let i = 0; i < 5; i++) {
      const s = document.createElement('span');
      s.className = 'heart-fly';
      s.textContent = icons[i % icons.length];
      s.style.left = (8 + Math.random() * 66) + '%';
      s.style.animationDelay = (i * 80) + 'ms';
      box.appendChild(s);
      setTimeout(() => s.remove(), 1500 + i * 80);
    }
  }

  return { render, mount, title: '首页' };
})();