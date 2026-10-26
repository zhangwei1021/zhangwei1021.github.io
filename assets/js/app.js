/* =========================================================================
 *  应用主控：路由 / 顶栏 / 数据加载 / 照片操作 / 音乐 / 大图查看
 * ========================================================================= */
window.App = (function () {
  'use strict';
  const U = window.U;
  const DB = window.DB;
  const esc = U.esc;
  window.Views = window.Views || {};
  const Views = window.Views;

  /* --------------------------------------------------------------- 状态 */
  const state = {
    settings: null,
    s: null,            // settings 的别名（设置页用 ctx.s）
    me: null,
    user: null,
    mode: 'local',
    canEdit: false,
    locked: false,      // 站点设为「仅登录可见」且未登录
    photos: [],
    diary: [],
    notes: [],
    wishes: [],
    events: [],
    pokes: [],
    aiConfig: null,     // AI 分身设置（人设、模型、限额）
    aiMemories: [],     // 记忆清单
    route: 'home',
    galFilter: '',
    homeTag: '',
    showAllMs: false
  };

  const ROUTES = [
    { id: 'home',     hash: '#/',         label: '首页',   icon: '🏠', view: 'home' },
    { id: 'gallery',  hash: '#/gallery',  label: '相册',   icon: '📷', view: 'gallery' },
    { id: 'diary',    hash: '#/diary',    label: '日记',   icon: '✍️', view: 'diary' },
    { id: 'notes',    hash: '#/notes',    label: '悄悄话', icon: '💌', view: 'notes' },
    { id: 'ai',       hash: '#/ai',       label: 'AI 分身', icon: '💬', view: 'ai' },
    { id: 'wishes',   hash: '#/wishes',   label: '心愿单', icon: '🌟', view: 'wishes' },
    { id: 'settings', hash: '#/settings', label: '设置',   icon: '⚙️', view: 'settings' }
  ];
  const LOGIN_ROUTE = { id: 'login', hash: '#/login', label: '登录', icon: '🔑', view: 'login' };

  function routeInfo() {
    const raw = (location.hash || '#/').replace(/^#/, '');
    const path = (raw.split('?')[0] || '/').replace(/\/+$/, '') || '/';
    if (path === '/login') return LOGIN_ROUTE;
    if (path === '/' || path === '') return ROUTES[0];
    return ROUTES.find((r) => r.hash.replace(/^#/, '') === path) || ROUTES[0];
  }

  /* ------------------------------------------------------- 登录 / 身份 */
  const login = {
    title: '登录',
    render(ctx) {
      const cloud = DB.isCloud();
      const s = ctx.settings || {};
      if (cloud && ctx.user && ctx.needIdentity) return identityHtml(s);

      return `
      <div class="login">
        <div class="card login__card">
          <div class="login__logo">💗</div>
          <h1 class="login__title">${esc(s.title || '我们的恋爱日常')}</h1>
          <div class="login__sub">${cloud ? '登录后就能上传照片、写日记、改设置' : '当前是本地预览模式'}</div>

          ${cloud ? `
          <form id="login-form">
            <label class="field"><span class="field__label">邮箱</span>
              <input class="input" type="email" name="email" required placeholder="you@example.com" autocomplete="username"></label>
            <label class="field"><span class="field__label">密码</span>
              <input class="input" type="password" name="password" required placeholder="••••••" autocomplete="current-password"></label>
            <button class="btn btn--primary btn--block" type="submit">登录</button>
          </form>
          <div class="login__tip">
            账号是在 Supabase 后台创建的（Authentication → Users → Add user），
            你们两个人各建一个就好，不需要开放注册。<br>
            忘记密码：Supabase 后台点该用户 → Reset password，或登录后在「设置」里改。
          </div>`
          : `
          <div class="banner banner--info" style="text-align:left"><span>📦</span>
            <div>还没有填写 Supabase 配置，数据只存在这台设备的浏览器里。<br>
            想实现两个人登录 + 云同步，按 README 填好 <code>assets/js/config.js</code> 后刷新即可。</div></div>
          <div style="margin-top:16px">
            <button class="btn btn--primary btn--block" data-local-enter>先看看效果（本机预览）</button>
          </div>`}

          ${ctx.user && cloud ? `<div style="margin-top:14px">
            <button class="btn btn--ghost btn--block" data-pick-identity>切换「我是谁」</button>
            <button class="btn btn--ghost btn--block" style="margin-top:8px" data-logout>退出登录</button>
          </div>` : ''}

          ${ctx.locked ? '<div class="login__tip">这个网站被设置为「仅登录后可见」，登录后就能看到全部内容啦。</div>' : ''}
        </div>
        <div class="login__tip" style="text-align:center">
          <a href="#/">← 先看看首页</a>
        </div>
      </div>`;
    },
    mount(root, ctx) {
      const form = root.querySelector('#login-form');
      if (form) {
        form.addEventListener('submit', async (e) => {
          e.preventDefault();
          const btn = form.querySelector('button[type="submit"]');
          const email = form.elements.email.value.trim();
          const pw = form.elements.password.value;
          btn.disabled = true; btn.textContent = '登录中…';
          try {
            await DB.auth.signIn(email, pw);
            if (!DB.identity.get()) ctx.needIdentity = true;
            U.toast('登录成功 💗', 'success');
            if (location.hash === '#/login') location.hash = '#/';
            await refresh();
          } catch (err) {
            U.toast(err.message || '登录失败', 'error');
            btn.disabled = false; btn.textContent = '登录';
          }
        });
      }
      root.addEventListener('click', async (e) => {
        const b = e.target.closest('[data-ident]');
        if (b) {
          DB.identity.set(b.getAttribute('data-ident'));
          ctx.needIdentity = false;
          U.toast('以后就以「' + b.getAttribute('data-name') + '」的身份出现啦', 'success');
          await refresh();
          return;
        }
        if (e.target.closest('[data-pick-identity]')) { ctx.needIdentity = true; render(); return; }
        if (e.target.closest('[data-logout]')) {
          if (!(await U.confirmBox('退出登录？', { title: '退出' }))) return;
          try { await DB.auth.signOut(); } catch (err) { /* 忽略 */ }
          DB.identity.clear();
          ctx.needIdentity = false;
          U.toast('已退出');
          await refresh();
          return;
        }
        if (e.target.closest('[data-local-enter]')) { location.hash = '#/'; return; }
      });
    }
  };

  function identityHtml(s) {
    return `
    <div class="login">
      <div class="card login__card">
        <div class="login__logo">👋</div>
        <h1 class="login__title">你是哪一位？</h1>
        <div class="login__sub">选一次就好，之后写日记、发悄悄话都会带上你的名字</div>
        <div class="avatars" style="justify-content:center">
          <button class="avatar-pick" data-ident="A" data-name="${esc(s.nicknameA || 'A')}">
            ${s.avatarA ? `<img src="${esc(s.avatarA)}" alt="">` : '<span class="ph-fallback">🙂</span>'}
            <div class="who__name">${esc(s.nicknameA || 'A')}</div>
          </button>
          <button class="avatar-pick" data-ident="B" data-name="${esc(s.nicknameB || 'B')}">
            ${s.avatarB ? `<img src="${esc(s.avatarB)}" alt="">` : '<span class="ph-fallback">🙂</span>'}
            <div class="who__name">${esc(s.nicknameB || 'B')}</div>
          </button>
        </div>
        <div class="login__tip">名字和头像在「设置 → 我们的信息」里可以改</div>
      </div>
    </div>`;
  }
  Views.login = login;

  /* ------------------------------------------------------------ 顶栏/页脚 */
  function topbarHtml() {
    const s = state.settings || {};
    const r = state.route;
    const u = state.user;
    const dark = document.documentElement.getAttribute('data-mode') === 'dark';
    const me = state.me || {};
    return `
    <header class="topbar">
      <div class="wrap topbar__inner">
        <a class="brand" href="#/">
          <span class="brand__logo">💗</span>
          <span class="brand__name">${esc(s.title || '我们的恋爱日常')}</span>
        </a>
        <nav class="nav">
          ${ROUTES.map((x) => `<a class="nav__link ${r === x.id ? 'is-active' : ''}" href="${x.hash}"><span class="nav__ico">${x.icon}</span>${x.label}</a>`).join('')}
        </nav>
        <div class="topbar__right">
          <button class="btn btn--icon btn--ghost" data-mode-toggle title="切换深浅色">${dark ? '☀️' : '🌙'}</button>
          ${state.locked
            ? '<a class="btn btn--primary btn--sm" href="#/login">登录</a>'
            : `<div class="who" data-who>
                 <span class="who__avatar">${me.avatar ? `<img src="${esc(me.avatar)}" alt="" style="width:100%;height:100%;border-radius:50%;object-fit:cover">` : '🙂'}</span>
                 <span class="who__name">${esc(me.name || '访客')}</span>
               </div>
               ${u ? '<button class="btn btn--ghost btn--sm" data-logout-quick>退出</button>'
                   : '<a class="btn btn--ghost btn--sm" href="#/login">登录</a>'}`}
        </div>
      </div>
    </header>`;
  }

  function footerHtml() {
    const s = state.settings || {};
    const cloud = DB.isCloud();
    const n = state.photos.length;
    const start = U.parseDate(s.anniversary);
    const days = start ? U.dayDiff(U.startOfDay(), start) + 1 : 0;
    return `
    <footer class="footer wrap">
      <div>${esc(s.subtitle || '')}${days ? ' · 一起走过 ' + days + ' 天' : ''}</div>
      <div style="margin-top:8px">
        <span class="footer__mode">${cloud ? '☁️ 云端同步' : '📦 本地模式'}</span>
        <span class="footer__mode" style="margin-left:6px">🖼️ ${n} 张照片</span>
        ${state.canEdit ? '' : '<span class="footer__mode" style="margin-left:6px">👀 访客模式</span>'}
      </div>
      <div style="margin-top:8px;opacity:.75">Made with ❤️ · ${new Date().getFullYear()}</div>
    </footer>`;
  }

  /* ------------------------------------------------------------- 照片卡片 */
  function photoCard(p, opts) {
    const o = opts || {};
    const cover = state.settings && state.settings.coverPhotoId === p.id;
    const tools = state.canEdit ? `<div class="ph__tools">
        <button class="ph__tool" data-ph-home="${esc(p.id)}" title="${p.is_home ? '从首页移除' : '放到首页照片墙'}">🏠</button>
        <button class="ph__tool" data-ph-cover="${esc(p.id)}" title="设为首页顶部大图">🖼️</button>
        <button class="ph__tool" data-ph-edit="${esc(p.id)}" title="编辑描述 / 标签">✏️</button>
        <button class="ph__tool" data-ph-del="${esc(p.id)}" title="删除">🗑️</button>
      </div>` : '';
    return `<figure class="ph" data-ph-zoom="${esc(p.id)}" data-ctx="${esc(o.context || '')}">
      ${tools}
      <div class="ph__badge">
        ${p.is_home ? '<span class="ph__flag ph__flag--home">首页</span>' : ''}
        ${cover ? '<span class="ph__flag">封面</span>' : ''}
      </div>
      <img src="${esc(p.src)}" alt="${esc(p.caption || '')}" loading="lazy">
      <figcaption class="ph__meta">
        ${p.caption ? `<div class="ph__cap">${esc(p.caption)}</div>` : ''}
        <div class="ph__date">${esc(U.fmtDate(p.taken_at))}${p.author ? ' · ' + esc(p.author) : ''}</div>
        ${(p.tags && p.tags.length) ? `<div class="ph__tags">${p.tags.map((t) => `<span class="ph__tag">${esc(t)}</span>`).join('')}</div>` : ''}
      </figcaption>
    </figure>`;
  }

  /* ------------------------------------------------------------ 数据加载 */
  async function computeAuth() {
    const cloud = DB.isCloud();
    let u = null;
    if (cloud) { try { u = await DB.auth.getUser(); } catch (e) { u = null; } }
    state.user = u || null;
    state.canEdit = cloud ? !!u : true;      // 本地模式：本机随便改，方便预览
    state.locked = cloud && (state.settings.visibility === 'private') && !u;
    state.me = await DB.me();
  }

  async function loadData() {
    if (state.locked) {
      state.photos = []; state.diary = []; state.notes = []; state.wishes = []; state.events = []; state.pokes = [];
      state.aiConfig = null; state.aiMemories = [];
      return;
    }
    const safe = (p) => p.catch((e) => { console.warn(e); return []; });
    const [photos, diary, notes, wishes, events, pokes] = await Promise.all([
      safe(DB.photos.list()), safe(DB.diary.list()), safe(DB.notes.list()),
      safe(DB.wishes.list()), safe(DB.events.list()), safe(DB.pokes.list())
    ]);
    state.photos = photos || [];
    state.diary = diary || [];
    state.notes = notes || [];
    state.wishes = wishes || [];
    state.events = events || [];
    state.pokes = pokes || [];
    try { state.aiConfig = await DB.ai.config.get(); } catch (e) { console.warn(e); state.aiConfig = null; }
    state.aiMemories = await DB.ai.memories.list().catch((e) => { console.warn(e); return []; });
  }

  let refreshing = false, pendingRefresh = false;
  async function refresh() {
    if (refreshing) { pendingRefresh = true; return; }
    refreshing = true;
    try {
      state.settings = await DB.settings.get();
      state.s = state.settings;
      await computeAuth();
      applyThemeFromSettings();
      await loadData();
      notifyNewPokes();
      render();
    } catch (e) {
      console.error(e);
      U.toast(e.message || '加载失败', 'error');
    }
    refreshing = false;
    if (pendingRefresh) { pendingRefresh = false; refresh(); }
  }

  /** 对方刚戳了我一下 → 弹个提示（首次加载不提醒，避免一开页面就弹） */
  let lastPokeSeen = null;
  function notifyNewPokes() {
    if (!state.canEdit) { lastPokeSeen = null; return; }
    const meName = (state.me && state.me.name) || '';
    const t0 = U.startOfDay().getTime();
    const other = (state.pokes || []).filter((p) => {
      const t = p && p.created_at ? new Date(p.created_at).getTime() : 0;
      return t >= t0 && p.author !== meName;
    });
    if (lastPokeSeen === null) { lastPokeSeen = other.length; return; }
    if (other.length > lastPokeSeen) {
      const s = state.settings || {};
      const k = state.me && state.me.key;
      const who = k === 'A' ? (s.nicknameB || 'TA') : (k === 'B' ? (s.nicknameA || 'TA') : 'TA');
      U.toast('💗 ' + who + ' 戳了你一下', 'success');
    }
    lastPokeSeen = other.length;
  }

  function applyThemeFromSettings() {
    const base = (state.settings && state.settings.theme) || {};
    const pv = !state.canEdit ? window.Theme.previewGet() : null;
    window.Theme.apply(pv ? Object.assign({}, base, pv) : base);
    document.title = (state.settings && state.settings.title) || '我们的恋爱日常';
  }

  /* --------------------------------------------------------------- 渲染 */
  let viewCleanup = null;   // 上一个视图返回的清理函数（定时器、监听等）

  function render() {
    const r = state.locked ? LOGIN_ROUTE : routeInfo();
    state.route = r.id;
    const view = Views[r.view] || Views.home;

    // 上一页的定时器/监听器先收尾，避免每次渲染叠一堆
    if (typeof viewCleanup === 'function') { try { viewCleanup(); } catch (e) { /* 忽略 */ } }
    viewCleanup = null;

    const topEl = document.getElementById('topbar-slot');
    const oldView = document.getElementById('view');
    const footEl = document.getElementById('footer-slot');
    if (!oldView) return;

    // 换一个全新的容器：旧 DOM 上的事件监听随元素一起丢弃
    const viewEl = document.createElement('main');
    viewEl.id = 'view';
    viewEl.className = oldView.className;
    oldView.replaceWith(viewEl);

    if (topEl) topEl.innerHTML = topbarHtml();
    viewEl.innerHTML = `<div class="rise">${view.render(state)}</div>`;
    if (footEl) footEl.innerHTML = footerHtml();
    try { viewCleanup = view.mount(viewEl, state) || null; } catch (e) { console.error('[mount]', e); }
    renderMusic();
    if (r.id !== state._lastRoute) {
      state._lastRoute = r.id;
      window.scrollTo(0, 0);
    }
  }

  /* ------------------------------------------------------------ 背景音乐 */
  let audio = null, playing = false, musicWarned = false;
  function renderMusic() {
    const slot = document.getElementById('music-slot');
    if (!slot) return;
    const m = (state.settings && state.settings.music) || {};
    if (!m.url) { slot.innerHTML = ''; return; }
    if (!audio) {
      audio = new Audio();
      audio.loop = true;
      audio.preload = 'none';
      audio.addEventListener('play', () => { playing = true; paintMusic(); });
      audio.addEventListener('pause', () => { playing = false; paintMusic(); });
      audio.addEventListener('ended', () => { playing = false; paintMusic(); });
    }
    if (audio.src !== m.url) { audio.src = m.url; audio.load(); }
    audio.volume = typeof m.volume === 'number' ? m.volume : 0.6;
    slot.innerHTML = `
      <div class="music ${playing ? 'is-playing' : ''}" id="music-btn" title="点一下播放 / 暂停">
        <span class="music__disc">${m.cover ? `<img src="${esc(m.cover)}" alt="" style="width:100%;height:100%;border-radius:50%;object-fit:cover">` : '♪'}</span>
        <span class="music__info">
          <span class="music__title">${esc(m.title || '我们的歌')}</span>
          <span class="music__artist">${esc(playing ? (m.artist || '正在播放') : (m.artist || '点击播放'))}</span>
        </span>
        <input class="music__vol" type="range" min="0" max="1" step="0.05" value="${audio.volume}" title="音量">
      </div>`;
    const btn = slot.querySelector('#music-btn');
    const vol = slot.querySelector('.music__vol');
    if (btn) btn.addEventListener('click', (e) => { if (e.target === vol) return; toggleMusic(); });
    if (vol) vol.addEventListener('input', () => { audio.volume = Number(vol.value); });
    if (m.autoplay && !playing && !state._autoplayTried) { state._autoplayTried = true; toggleMusic(true); }
  }
  function paintMusic() {
    const btn = document.getElementById('music-btn');
    if (!btn) return;
    btn.classList.toggle('is-playing', playing);
    const m = (state.settings && state.settings.music) || {};
    const ar = btn.querySelector('.music__artist');
    if (ar) ar.textContent = playing ? (m.artist || '正在播放') : (m.artist || '点击播放');
  }
  async function toggleMusic(auto) {
    if (!audio) return;
    try {
      if (playing) audio.pause();
      else await audio.play();
    } catch (e) {
      if (!musicWarned) { musicWarned = true; U.toast('浏览器不让自动播放，点右下角的小唱片就能听啦 🎵', 'warn'); }
    }
    paintMusic();
  }

  /* ---------------------------------------------------------- 大图查看器 */
  let zoomId = null;
  function zoomList() {
    return state.photos || [];
  }
  function openZoom(id) {
    zoomId = id;
    paintZoom();
  }
  function closeZoom() {
    zoomId = null;
    const slot = document.getElementById('zoom-slot');
    if (slot) slot.innerHTML = '';
    document.body.style.overflow = '';
  }
  function stepZoom(d) {
    const list = zoomList();
    const i = list.findIndex((p) => p.id === zoomId);
    if (i < 0) return;
    const n = list[(i + d + list.length) % list.length];
    if (n) { zoomId = n.id; paintZoom(); }
  }
  function paintZoom() {
    const slot = document.getElementById('zoom-slot');
    if (!slot) return;
    const p = zoomList().find((x) => x.id === zoomId);
    if (!p) { slot.innerHTML = ''; return; }
    const i = zoomList().findIndex((x) => x.id === zoomId);
    slot.innerHTML = `
      <div class="zoom">
        <div class="zoom__stage">
          <img class="zoom__img" src="${esc(p.src)}" alt="">
          <div class="zoom__bar">
            <div>
              <div class="zoom__cap">${esc(p.caption || '我们的照片')}</div>
              <div class="zoom__date">${esc(U.fmtDate(p.taken_at, { week: true }))}${p.author ? ' · ' + esc(p.author) : ''} · ${i + 1}/${zoomList().length}</div>
            </div>
            <div class="zoom__acts">
              ${state.canEdit ? `
                <button class="btn btn--sm" data-ph-home="${esc(p.id)}">${p.is_home ? '🏠 从首页移除' : '🏠 放到首页'}</button>
                <button class="btn btn--sm" data-ph-cover="${esc(p.id)}">🖼️ 设为封面</button>
                <button class="btn btn--sm" data-ph-edit="${esc(p.id)}">✏️ 编辑</button>
                <button class="btn btn--sm" data-ph-del="${esc(p.id)}">🗑️ 删除</button>` : ''}
            </div>
          </div>
        </div>
        <button class="zoom__close" data-zoom-close>✕</button>
        ${zoomList().length > 1 ? `<button class="zoom__nav zoom__nav--prev" data-zoom-step="-1">‹</button>
        <button class="zoom__nav zoom__nav--next" data-zoom-step="1">›</button>` : ''}
      </div>`;
    document.body.style.overflow = 'hidden';
  }

  /* ------------------------------------------------------- 全局事件绑定 */
  function bindGlobal() {
    // 顶栏 / 全局
    document.addEventListener('click', async (e) => {
      /* 大图查看器 */
      if (e.target.closest('[data-zoom-close]')) return closeZoom();
      const st = e.target.closest('[data-zoom-step]');
      if (st) return stepZoom(Number(st.getAttribute('data-zoom-step')));
      if (e.target.classList && e.target.classList.contains('zoom')) return closeZoom();

      /* 照片操作（工具按钮优先） */
      const home = e.target.closest('[data-ph-home]');
      if (home) {
        e.preventDefault();
        const p = findPhoto(home.getAttribute('data-ph-home'));
        if (!p) return;
        if (!state.canEdit) return U.needLogin();
        try {
          await DB.photos.patch(p.id, { is_home: !p.is_home });
          p.is_home = !p.is_home;
          U.toast(p.is_home ? '已经放到首页照片墙 🏠' : '已从首页移除', 'success');
          render(); if (zoomId) paintZoom();
        } catch (err) { U.toast(err.message, 'error'); }
        return;
      }
      const cover = e.target.closest('[data-ph-cover]');
      if (cover) {
        e.preventDefault();
        const p = findPhoto(cover.getAttribute('data-ph-cover'));
        if (!p) return;
        if (!state.canEdit) return U.needLogin();
        try {
          await DB.settings.patch({ coverPhotoId: state.settings.coverPhotoId === p.id ? '' : p.id });
          state.settings.coverPhotoId = state.settings.coverPhotoId === p.id ? '' : p.id;
          U.toast('首页大图已更新 🖼️', 'success');
          render(); if (zoomId) paintZoom();
        } catch (err) { U.toast(err.message, 'error'); }
        return;
      }
      const ed = e.target.closest('[data-ph-edit]');
      if (ed) {
        e.preventDefault();
        const p = findPhoto(ed.getAttribute('data-ph-edit'));
        if (!p) return;
        if (!state.canEdit) return U.needLogin();
        const d = await U.formBox('编辑这张照片', [
          { name: 'caption', label: '描述', type: 'text', value: p.caption || '', placeholder: '例如：第一次一起看海' },
          { name: 'taken_at', label: '拍摄日期', type: 'date', value: p.taken_at || U.todayStr() },
          { name: 'tags', label: '标签', type: 'text', value: (p.tags || []).join(', '), hint: '用逗号分隔' },
          { name: 'is_home', label: '首页展示', type: 'checkbox', checkLabel: '放进首页照片墙', value: !!p.is_home }
        ]);
        if (!d) return;
        try {
          await DB.photos.patch(p.id, {
            caption: d.caption, taken_at: d.taken_at,
            tags: String(d.tags || '').split(/[,，\s]+/).map((x) => x.trim()).filter(Boolean),
            is_home: !!d.is_home
          });
          U.toast('已保存', 'success');
          await refresh(); if (zoomId) paintZoom();
        } catch (err) { U.toast(err.message, 'error'); }
        return;
      }
      const del = e.target.closest('[data-ph-del]');
      if (del) {
        e.preventDefault();
        const p = findPhoto(del.getAttribute('data-ph-del'));
        if (!p) return;
        if (!state.canEdit) return U.needLogin();
        if (!(await U.confirmBox('删除这张照片？照片会从相册和存储里一起删掉。', { title: '删除照片' }))) return;
        try {
          await DB.photos.remove(p);
          U.toast('已删除', 'success');
          closeZoom();
          await refresh();
        } catch (err) { U.toast(err.message, 'error'); }
        return;
      }

      const z = e.target.closest('[data-ph-zoom]');
      if (z) { e.preventDefault(); return openZoom(z.getAttribute('data-ph-zoom')); }

      /* 顶栏 */
      if (e.target.closest('[data-mode-toggle]')) {
        const isDark = document.documentElement.getAttribute('data-mode') === 'dark';
        await window.Theme.save({ mode: isDark ? 'light' : 'dark' }, { local: !state.canEdit });
        if (!state.canEdit) U.toast('已切换（只在这台设备上生效）');
        render();
        return;
      }
      if (e.target.closest('[data-logout-quick]')) {
        if (!(await U.confirmBox('退出登录？', { title: '退出' }))) return;
        try { await DB.auth.signOut(); } catch (err) { /* 忽略 */ }
        DB.identity.clear();
        U.toast('已退出');
        await refresh();
        return;
      }
      const who = e.target.closest('[data-who]');
      if (who) { location.hash = state.canEdit ? '#/settings' : '#/login'; return; }

      /* 通用跳转 */
      const go = e.target.closest('[data-go]');
      if (go) { e.preventDefault(); location.hash = go.getAttribute('data-go'); return; }

      // 私密页面的「登录后查看」按钮
      if (e.target.closest('[data-act="login"]')) { location.hash = '#/login'; return; }
    });

    // 键盘
    document.addEventListener('keydown', (e) => {
      if (!zoomId) return;
      if (e.key === 'Escape') closeZoom();
      if (e.key === 'ArrowLeft') stepZoom(-1);
      if (e.key === 'ArrowRight') stepZoom(1);
    });

    // 路由
    window.addEventListener('hashchange', () => { state._lastRoute = null; render(); });

    // 数据变化（实时同步 / 本地写操作）
    DB.on(U.debounce(() => { refresh(); }, 400));
  }

  function findPhoto(id) {
    return (state.photos || []).find((p) => p.id === id);
  }

  /* --------------------------------------------------------------- 启动 */
  async function boot() {
    const viewEl = document.getElementById('view');
    if (viewEl) viewEl.innerHTML = '<div style="display:grid;place-items:center;min-height:60vh"><div class="spin"></div></div>';
    try {
      const r = await DB.init();
      state.mode = r.mode;
      if (r.cdnFailed) U.toast('Supabase 脚本没加载成功，已先用本地模式', 'warn');
      state.settings = await DB.settings.get();
      state.s = state.settings;
      await computeAuth();
      applyThemeFromSettings();
      await loadData();
      bindGlobal();
      if (DB.isCloud() && !state.user) { /* 公开站点也允许浏览 */ }
      if (!location.hash) location.hash = '#/';
      render();
    } catch (e) {
      console.error(e);
      if (viewEl) viewEl.innerHTML = `<div class="empty"><div class="empty__icon">😢</div>
        <div class="empty__title">加载失败</div><div class="empty__desc">${esc(e.message || e)}</div>
        <div style="margin-top:12px"><button class="btn btn--primary" onclick="location.reload()">刷新重试</button></div></div>`;
    }
  }

  /* --------------------------------------------------------------- 导出 */
  const App = {
    state,
    boot,
    render,
    refresh,
    photoCard,
    findPhoto,
    uploadPrompt: (...a) => Views.gallery.uploadPrompt(...a),
    gallery: null,                 // boot 后指向相册视图，兼容 home.js 的调用
    toggleMusic,
    openZoom
  };
  App.gallery = Views.gallery;
  return App;
})();