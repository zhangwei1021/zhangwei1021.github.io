/* =========================================================================
 *  设置页：我们的信息 / 外观颜色 / 背景 / 音乐 / 首页大图
 * ========================================================================= */
window.Views = window.Views || {};
window.Views.settings = (function () {
  'use strict';
  const U = window.U;
  const esc = U.esc;
  const CFG = window.APP_CONFIG || {};

  function swatchHtml(t, activeId) {
    return (CFG.presets || []).map((p) => `
      <button type="button" class="swatch ${p.id === activeId ? 'is-active' : ''}" data-preset="${esc(p.id)}" title="${esc(p.name)}">
        <span class="swatch__preview" style="background:linear-gradient(140deg, ${esc(p.bg1)}, ${esc(p.bg2)} 55%, ${esc(p.accent)})"></span>
        <span class="swatch__name">${esc(p.name)}</span>
      </button>`).join('');
  }

  function render(ctx) {
    const s = ctx.s || {};
    const t = window.Theme.normalize(s.theme);
    const m = Object.assign({}, (CFG.defaults || {}).music, s.music || {});
    const coverOpts = [{ value: '', label: '不用大图（纯色/渐变背景）' }].concat(
      (ctx.photos || []).map((p) => ({ value: p.id, label: (p.caption || '照片') + ' · ' + U.fmtDate(p.taken_at, { short: true }) }))
    );
    const cover = (ctx.photos || []).find((p) => p.id === s.coverPhotoId);

    if (!ctx.canEdit) {
      return `<section class="section"><div class="empty card card--pad">
        <div class="empty__icon">🔒</div>
        <div class="empty__title">设置需要登录后修改</div>
        <div class="empty__desc">登录之后，颜色、背景、照片墙、音乐都可以随时改</div>
        <button class="btn btn--primary" data-go="#/login">去登录</button>
      </div></section>`;
    }

    return `
    <section class="section">
      <div class="section__head">
        <h2 class="section__title">⚙️ 网站设置</h2>
        <p class="section__desc">所有改动对你们两个人、所有设备都生效（需要接入 Supabase 云同步）</p>
      </div>

      <form id="set-form" autocomplete="off">
        <!-- ============ 我们的信息 ============ -->
        <div class="card card--pad set-sec">
          <h3 class="set-sec__title">💑 我们的信息</h3>
          <div class="set-grid">
            <label class="field"><span class="field__label">网站标题</span>
              <input class="input" name="title" value="${esc(s.title)}" placeholder="张张包和止咳药的日常"></label>
            <label class="field"><span class="field__label">副标题</span>
              <input class="input" name="subtitle" value="${esc(s.subtitle)}" placeholder="Zzzw ❤ Zzzky"></label>
            <label class="field"><span class="field__label">在一起的日子（纪念日）</span>
              <input class="input" type="date" name="anniversary" value="${esc(s.anniversary)}">
              <span class="field__hint">首页的「相恋第几天 / 计时器」按这一天计算</span></label>
            <label class="field"><span class="field__label">首页签名</span>
              <input class="input" name="tagline" value="${esc(s.tagline)}"></label>
          </div>

          <div class="set-grid" style="margin-top:4px">
            <div class="field">
              <span class="field__label">TA 的昵称（A）</span>
              <div style="display:flex;gap:8px;align-items:center">
                <input class="input" name="nicknameA" value="${esc(s.nicknameA)}" placeholder="Zzzw">
                <button type="button" class="avatar-pick" data-avatar="A" title="上传头像">
                  <img id="av-a" src="${esc(s.avatarA || '')}" alt="" class="${s.avatarA ? '' : 'hide'}">
                  <span id="av-a-ph" class="ph-fallback ${s.avatarA ? 'hide' : ''}">＋</span>
                </button>
              </div>
              <input type="hidden" name="avatarA" value="${esc(s.avatarA || '')}">
            </div>
            <div class="field">
              <span class="field__label">TA 的昵称（B）</span>
              <div style="display:flex;gap:8px;align-items:center">
                <input class="input" name="nicknameB" value="${esc(s.nicknameB)}" placeholder="Zzzky">
                <button type="button" class="avatar-pick" data-avatar="B" title="上传头像">
                  <img id="av-b" src="${esc(s.avatarB || '')}" alt="" class="${s.avatarB ? '' : 'hide'}">
                  <span id="av-b-ph" class="ph-fallback ${s.avatarB ? 'hide' : ''}">＋</span>
                </button>
              </div>
              <input type="hidden" name="avatarB" value="${esc(s.avatarB || '')}">
            </div>
          </div>

          <label class="field" style="max-width:420px">
            <span class="field__label">谁能看到这个网站</span>
            <select class="input" name="visibility">
              <option value="public" ${s.visibility === 'public' ? 'selected' : ''}>任何人都能浏览（推荐）</option>
              <option value="private" ${s.visibility === 'private' ? 'selected' : ''}>只有登录后才能浏览</option>
            </select>
            <span class="field__hint">「只有登录后」= 打开网址先看到登录页</span>
          </label>
        </div>

        <!-- ============ 外观 ============ -->
        <div class="card card--pad set-sec">
          <h3 class="set-sec__title">🎨 颜色与背景</h3>

          <div class="field"><span class="field__label">配色预设（点一下就换整套配色）</span>
            <div class="swatches" data-swatches>${swatchHtml(t, t.preset)}</div>
          </div>

          <div class="set-grid" style="margin-top:16px">
            <label class="field"><span class="field__label">明暗模式</span>
              <select class="input" name="mode">
                <option value="light" ${t.mode === 'light' ? 'selected' : ''}>浅色</option>
                <option value="dark" ${t.mode === 'dark' ? 'selected' : ''}>深色</option>
                <option value="auto" ${t.mode === 'auto' ? 'selected' : ''}>跟随系统</option>
              </select></label>
            <label class="field"><span class="field__label">主题色（按钮 / 强调色）</span>
              <div style="display:flex;gap:8px;align-items:center">
                <input type="color" class="input" style="width:56px;padding:4px;height:42px" name="accent" value="${esc(t.accent)}">
                <input class="input" name="accentText" value="${esc(t.accent)}" placeholder="#ff6f91">
              </div></label>
            <label class="field"><span class="field__label">背景主色</span>
              <div style="display:flex;gap:8px;align-items:center">
                <input type="color" class="input" style="width:56px;padding:4px;height:42px" name="bg1" value="${esc(t.bg1)}">
                <input class="input" name="bg1Text" value="${esc(t.bg1)}">
              </div></label>
            <label class="field"><span class="field__label">背景次色（渐变用）</span>
              <div style="display:flex;gap:8px;align-items:center">
                <input type="color" class="input" style="width:56px;padding:4px;height:42px" name="bg2" value="${esc(t.bg2)}">
                <input class="input" name="bg2Text" value="${esc(t.bg2)}">
              </div></label>
            <label class="field"><span class="field__label">背景样式</span>
              <select class="input" name="bgStyle">
                <option value="gradient" ${t.bgStyle === 'gradient' ? 'selected' : ''}>渐变（推荐）</option>
                <option value="solid" ${t.bgStyle === 'solid' ? 'selected' : ''}>纯色</option>
                <option value="image" ${t.bgStyle === 'image' ? 'selected' : ''}>自定义背景图</option>
              </select></label>
            <label class="field"><span class="field__label">圆角大小：<b data-radius-val>${t.radius}</b> px</span>
              <input type="range" min="0" max="32" step="2" name="radius" value="${t.radius}" style="accent-color:var(--accent)">
            </label>
            <label class="field"><span class="field__label">首页照片墙列数</span>
              <select class="input" name="wallCols">
                ${[2, 3, 4, 5].map((n) => `<option value="${n}" ${t.wallCols === n ? 'selected' : ''}>${n} 列</option>`).join('')}
              </select></label>
          </div>

          <div class="field" style="margin-top:6px">
            <span class="field__label">背景图（选择「自定义背景图」时生效）</span>
            <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
              <button type="button" class="btn btn--ghost btn--sm" data-upload="bg">📁 上传图片</button>
              <input class="input" style="flex:1;min-width:200px" name="bgImage" value="${esc(t.bgImage || '')}" placeholder="也可以直接粘贴图片直链 https://...">
              <button type="button" class="btn btn--ghost btn--sm" data-clear="bgImage">清空</button>
            </div>
            ${t.bgImage ? `<img src="${esc(t.bgImage)}" alt="" style="margin-top:10px;max-height:120px;border-radius:12px;border:1px solid var(--line)">` : ''}
          </div>

          <div class="banner banner--info" style="margin-top:14px"><span>👀</span>
            <div>改颜色时会<b>立刻生效预览</b>，喜欢了再点最下面的「保存设置」。</div></div>
        </div>

        <!-- ============ 首页展示 ============ -->
        <div class="card card--pad set-sec">
          <h3 class="set-sec__title">🖼️ 首页展示</h3>
          <label class="field" style="max-width:520px">
            <span class="field__label">首页顶部大图</span>
            <select class="input" name="coverPhotoId">
              ${coverOpts.map((o) => `<option value="${esc(o.value)}" ${s.coverPhotoId === o.value ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}
            </select>
            <span class="field__hint">也可以直接去相册，把鼠标放到照片上点 🖼️ 设为首页大图</span>
          </label>
          ${cover ? `<img src="${esc(cover.src)}" alt="" style="margin-top:10px;max-height:150px;border-radius:14px;border:1px solid var(--line)">` : ''}

          <div style="margin-top:14px;display:flex;gap:10px;align-items:center;flex-wrap:wrap">
            <span class="field__label" style="margin:0">首页照片墙：当前 <b>${(ctx.photos || []).filter((p) => p.is_home).length}</b> 张</span>
            <button type="button" class="btn btn--ghost btn--sm" data-go-home-pick>🖼️ 去相册挑选照片</button>
          </div>
          <div class="field__hint" style="margin-top:8px">
            相册里点照片上的 🏠 就能把它放进首页照片墙；一张都没选时首页会自动显示最新 9 张。
          </div>
        </div>

        <!-- ============ 背景音乐 ============ -->
        <div class="card card--pad set-sec">
          <h3 class="set-sec__title">🎵 背景音乐</h3>
          <div class="set-grid">
            <label class="field"><span class="field__label">音乐地址（mp3 直链）</span>
              <input class="input" name="musicUrl" value="${esc(m.url || '')}" placeholder="https://.../song.mp3"></label>
            <label class="field"><span class="field__label">歌名</span>
              <input class="input" name="musicTitle" value="${esc(m.title || '')}"></label>
            <label class="field"><span class="field__label">歌手</span>
              <input class="input" name="musicArtist" value="${esc(m.artist || '')}"></label>
            <label class="field"><span class="field__label">音量：<b data-vol-val>${Math.round((m.volume || 0.6) * 100)}</b>%</span>
              <input type="range" min="0" max="1" step="0.05" name="musicVolume" value="${m.volume || 0.6}" style="accent-color:var(--accent)"></label>
          </div>
          <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:6px">
            <button type="button" class="btn btn--ghost btn--sm" data-upload="music">🎧 上传 mp3</button>
            <label class="check"><input type="checkbox" name="musicAutoplay" ${m.autoplay ? 'checked' : ''}> 打开网站自动播放</label>
            <span class="field__hint">自动播放常被手机浏览器拦截，建议让 TA 点一下右下角的小唱片</span>
          </div>
        </div>

        <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin-top:18px">
          <button class="btn btn--primary" type="submit">💾 保存设置</button>
          <button class="btn btn--ghost" type="button" data-reset>恢复默认外观</button>
          <span class="field__hint" id="set-hint"></span>
        </div>
      </form>

      <div class="banner banner--warn" style="margin-top:22px">
        <span>🔐</span>
        <div><b>账号密码：</b>在 Supabase 后台 Authentication → Users 里点用户 → Reset password 可以改；
        登录后也可以用下面这个入口改自己的密码。</div>
      </div>
      <div class="card card--pad" style="margin-top:12px">
        <div class="set-grid">
          <label class="field"><span class="field__label">新密码（至少 6 位）</span>
            <input class="input" type="password" id="new-pass" placeholder="••••••"></label>
          <div class="field"><span class="field__label">&nbsp;</span>
            <button class="btn btn--ghost" type="button" data-pass>修改我的密码</button></div>
        </div>
      </div>
    </section>`;
  }

  /* ------------------------------------------------------------- 取值 */
  function readForm(form) {
    const v = (n) => (form.elements[n] ? String(form.elements[n].value || '').trim() : '');
    const themeNow = window.Theme.current();
    const accentText = v('accentText');
    const bg1Text = v('bg1Text');
    const bg2Text = v('bg2Text');
    return {
      info: {
        title: v('title'),
        subtitle: v('subtitle'),
        anniversary: v('anniversary'),
        tagline: v('tagline'),
        nicknameA: v('nicknameA') || '我',
        nicknameB: v('nicknameB') || 'TA',
        avatarA: v('avatarA'),
        avatarB: v('avatarB'),
        visibility: v('visibility') || 'public',
        coverPhotoId: v('coverPhotoId')
      },
      theme: {
        mode: v('mode') || 'light',
        preset: themeNow.preset,
        accent: /^#[0-9a-f]{3,8}$/i.test(accentText) ? accentText : v('accent'),
        bg1: /^#[0-9a-f]{3,8}$/i.test(bg1Text) ? bg1Text : v('bg1'),
        bg2: /^#[0-9a-f]{3,8}$/i.test(bg2Text) ? bg2Text : v('bg2'),
        bgStyle: v('bgStyle') || 'gradient',
        bgImage: v('bgImage'),
        radius: Number(v('radius')),
        wallCols: Number(v('wallCols'))
      },
      music: {
        url: v('musicUrl'),
        title: v('musicTitle'),
        artist: v('musicArtist'),
        autoplay: !!(form.elements.musicAutoplay && form.elements.musicAutoplay.checked),
        volume: Number(v('musicVolume')),
        cover: (themeNow.cover !== undefined ? themeNow.cover : ((CFG.defaults.music || {}).cover || ''))
      }
    };
  }

  function preview(form) {
    const d = readForm(form);
    window.Theme.apply(d.theme);
    const rv = form.querySelector('[data-radius-val]'); if (rv) rv.textContent = d.theme.radius;
    const vv = form.querySelector('[data-vol-val]'); if (vv) vv.textContent = Math.round(d.music.volume * 100);
    // 颜色文本框与取色器互相同步
    syncPair(form, 'accent', 'accentText');
    syncPair(form, 'bg1', 'bg1Text');
    syncPair(form, 'bg2', 'bg2Text');
  }
  function syncPair(form, a, b) {
    const elA = form.elements[a], elB = form.elements[b];
    if (!elA || !elB) return;
    if (document.activeElement === elA && /^#[0-9a-f]{6}$/i.test(elA.value)) elB.value = elA.value;
    if (document.activeElement === elB && /^#[0-9a-f]{6}$/i.test(elB.value)) elA.value = elB.value;
  }

  /* ------------------------------------------------------------- 挂载 */
  function mount(root, ctx) {
    const form = root.querySelector('#set-form');
    if (!form) {
      root.addEventListener('click', (e) => {
        const g = e.target.closest('[data-go]');
        if (g) location.hash = g.getAttribute('data-go');
      });
      return;
    }

    ctx._setDraft = readForm(form);

    form.addEventListener('input', (e) => {
      if (e.target.name === 'preset') return;
      preview(form);
      ctx._setDraft = readForm(form);
    });
    form.addEventListener('change', () => { preview(form); ctx._setDraft = readForm(form); });

    // 预设
    form.querySelector('[data-swatches]').addEventListener('click', (e) => {
      const b = e.target.closest('[data-preset]');
      if (!b) return;
      const p = window.Theme.preset(b.getAttribute('data-preset'));
      if (!p) return;
      form.elements.bg1.value = p.bg1; form.elements.bg1Text.value = p.bg1;
      form.elements.bg2.value = p.bg2; form.elements.bg2Text.value = p.bg2;
      form.elements.accent.value = p.accent; form.elements.accentText.value = p.accent;
      form.elements.bgStyle.value = 'gradient';
      form.querySelectorAll('.swatch').forEach((s) => s.classList.toggle('is-active', s === b));
      window.__themeCache.preset = p.id;
      preview(form);
      U.toast('已套用「' + p.name + '」，记得保存', 'success');
    });

    // 上传（头像 / 背景图 / 音乐）
    form.addEventListener('click', async (e) => {
      const up = e.target.closest('[data-upload]');
      if (up) {
        const kind = up.getAttribute('data-upload');
        const inp = document.createElement('input');
        inp.type = 'file';
        inp.accept = kind === 'music' ? 'audio/*' : 'image/*';
        inp.onchange = async () => {
          const f = inp.files && inp.files[0];
          if (!f) return;
          up.textContent = '上传中…'; up.disabled = true;
          try {
            const url = await window.DB.media.upload(f, kind);
            if (kind === 'avatar') {
              const who = up.getAttribute('data-avatar') || (ctx._avatarSlot || 'A');
              form.elements['avatar' + who].value = url;
              const img = root.querySelector('#av-' + who.toLowerCase());
              const ph = root.querySelector('#av-' + who.toLowerCase() + '-ph');
              if (img) { img.src = url; img.classList.remove('hide'); }
              if (ph) ph.classList.add('hide');
            } else if (kind === 'bg') {
              form.elements.bgImage.value = url;
              form.elements.bgStyle.value = 'image';
            } else if (kind === 'music') {
              form.elements.musicUrl.value = url;
              if (!form.elements.musicTitle.value) form.elements.musicTitle.value = f.name.replace(/\.[^.]+$/, '');
            }
            preview(form);
            U.toast('上传成功，记得点保存', 'success');
          } catch (err) { U.toast(err.message, 'error'); }
          up.textContent = kind === 'music' ? '🎧 上传 mp3' : (kind === 'bg' ? '📁 上传图片' : '上传');
          up.disabled = false;
        };
        inp.click();
        return;
      }

      const av = e.target.closest('[data-avatar]');
      if (av) {
        ctx._avatarSlot = av.getAttribute('data-avatar');
        const inp = document.createElement('input');
        inp.type = 'file'; inp.accept = 'image/*';
        inp.onchange = async () => {
          const f = inp.files && inp.files[0];
          if (!f) return;
          const who = ctx._avatarSlot;
          try {
            U.toast('头像上传中…');
            const url = await window.DB.media.upload(f, 'avatar');
            form.elements['avatar' + who].value = url;
            const img = root.querySelector('#av-' + who.toLowerCase());
            const ph = root.querySelector('#av-' + who.toLowerCase() + '-ph');
            if (img) { img.src = url; img.classList.remove('hide'); }
            if (ph) ph.classList.add('hide');
            U.toast('头像已换，记得保存', 'success');
          } catch (err) { U.toast(err.message, 'error'); }
        };
        inp.click();
        return;
      }

      const cl = e.target.closest('[data-clear]');
      if (cl) {
        const n = cl.getAttribute('data-clear');
        if (form.elements[n]) form.elements[n].value = '';
        if (n === 'bgImage') form.elements.bgStyle.value = 'solid';
        preview(form);
        return;
      }

      if (e.target.closest('[data-go-home-pick]')) {
        window.App.state.galFilter = 'home';
        location.hash = '#/gallery';
        return;
      }

      if (e.target.closest('[data-reset]')) {
        if (!(await U.confirmBox('把颜色、背景恢复成默认的樱花粉？', { title: '恢复默认外观' }))) return;
        const d = window.Theme.normalize(null);
        form.elements.mode.value = d.mode; form.elements.bgStyle.value = d.bgStyle;
        form.elements.bg1.value = d.bg1; form.elements.bg1Text.value = d.bg1;
        form.elements.bg2.value = d.bg2; form.elements.bg2Text.value = d.bg2;
        form.elements.accent.value = d.accent; form.elements.accentText.value = d.accent;
        form.elements.radius.value = d.radius; form.elements.wallCols.value = d.wallCols;
        form.elements.bgImage.value = '';
        window.__themeCache.preset = 'sakura';
        preview(form);
        return;
      }

      if (e.target.closest('[data-pass]')) {
        const inp = root.querySelector('#new-pass');
        const pw = (inp.value || '').trim();
        if (pw.length < 6) return U.toast('新密码至少 6 位', 'warn');
        try {
          await window.DB.auth.updatePassword(pw);
          inp.value = '';
          U.toast('密码已修改', 'success');
        } catch (err) { U.toast(err.message, 'error'); }
      }
    });

    // 保存
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const hint = root.querySelector('#set-hint');
      const btn = form.querySelector('button[type="submit"]');
      const d = readForm(form);
      btn.disabled = true; btn.textContent = '保存中…';
      if (hint) hint.textContent = '';
      try {
        await window.DB.settings.patch(Object.assign({}, d.info, { theme: d.theme, music: d.music }));
        window.Theme.apply(d.theme);
        if (window.App) { window.App.state.s = Object.assign({}, window.App.state.s, d.info, { theme: d.theme, music: d.music }); }
        U.toast('设置已保存 💾', 'success');
        if (hint) hint.textContent = '已保存 ✓';
        if (window.App) window.App.refresh();
      } catch (err) {
        U.toast(err.message, 'error');
        if (hint) hint.textContent = '保存失败：' + err.message;
      }
      btn.disabled = false; btn.textContent = '💾 保存设置';
    });

    preview(form);
  }

  return { render, mount, title: '设置' };
})();