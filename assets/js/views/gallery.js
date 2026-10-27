/* =========================================================================
 *  相册：上传、标签筛选、设为首页展示 / 封面、编辑、删除
 * ========================================================================= */
window.Views = window.Views || {};
window.Views.gallery = (function () {
  'use strict';
  const U = window.U;
  const esc = U.esc;
  let busy = false;

  function render(ctx) {
    const photos = ctx.photos || [];
    let list = photos;
    if (ctx.galFilter === 'home') list = photos.filter((p) => p.is_home);
    else if (/^city:/.test(ctx.galFilter || '')) {
      const c = ctx.galFilter.slice(5);
      list = photos.filter((p) => (p.city || '') === c);
    } else if (ctx.galFilter) list = photos.filter((p) => (p.tags || []).includes(ctx.galFilter));

    const tags = [];
    photos.forEach((p) => (p.tags || []).forEach((t) => { if (!tags.includes(t)) tags.push(t); }));
    const cities = [];
    photos.forEach((p) => { if (p.city && !cities.includes(p.city)) cities.push(p.city); });

    return `
    <section class="section">
      <div class="section__head">
        <h2 class="section__title">📷 我们的相册</h2>
        <p class="section__desc">共 ${photos.length} 张 · 首页展示 ${photos.filter((p) => p.is_home).length} 张</p>
        <div class="section__actions">
          ${ctx.canEdit ? '<button class="btn btn--primary btn--sm" data-gal="pick">＋ 上传照片</button>' : ''}
        </div>
      </div>

      ${ctx.canEdit ? `
      <div class="drop" id="dropzone">
        <div class="drop__icon">📤</div>
        <div class="drop__main">点击选择照片，或把图片拖到这里</div>
        <div class="drop__sub">支持一次选多张 · 会自动压缩到 1800px 再上传，不占空间</div>
        <input type="file" accept="image/*" multiple hidden id="file-input">
      </div>
      <div class="upload-list" id="upload-list"></div>` : ''}

      ${photos.length ? `
      <div class="filters" style="margin:18px 0 16px">
        <button class="chip ${!ctx.galFilter ? 'is-active' : ''}" data-gal-filter="">全部</button>
        <button class="chip ${ctx.galFilter === 'home' ? 'is-active' : ''}" data-gal-filter="home">🏠 首页展示</button>
        ${cities.map((c) => `<button class="chip ${ctx.galFilter === 'city:' + c ? 'is-active' : ''}" data-gal-filter="city:${esc(c)}">📍 ${esc(c)}</button>`).join('')}
        ${tags.map((t) => `<button class="chip ${ctx.galFilter === t ? 'is-active' : ''}" data-gal-filter="${esc(t)}">${esc(t)}</button>`).join('')}
      </div>` : ''}

      ${list.length
        ? `<div class="masonry" data-wall>${list.map((p) => window.App.photoCard(p, { context: 'gallery' })).join('')}</div>`
        : (photos.length
            ? `<div class="empty"><div class="empty__icon">🔍</div><div class="empty__title">这个分类下还没有照片</div></div>`
            : `<div class="empty"><div class="empty__icon">🌱</div><div class="empty__title">相册还是空的</div>
               <div class="empty__desc">${ctx.canEdit ? '上传你们的第一张合照吧' : '登录后就可以上传啦'}</div></div>`)}
    </section>

    ${ctx.canEdit ? `<div class="banner banner--info">
      <span>💡</span>
      <div>把鼠标移到照片上：<b>🏠</b> 放到首页照片墙 · <b>🖼️</b> 设为首页顶部大图 · <b>✏️</b> 改描述和标签 · <b>🗑️</b> 删除（手机上直接点这些图标即可）</div>
    </div>` : ''}`;
  }

  function mount(root, ctx) {
    const drop = root.querySelector('#dropzone');
    const input = root.querySelector('#file-input');

    if (drop && input) {
      drop.addEventListener('click', () => input.click());
      input.addEventListener('change', () => { handleFiles(Array.from(input.files || [])); input.value = ''; });
      ['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('is-over'); }));
      ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('is-over'); }));
      drop.addEventListener('drop', (e) => {
        const files = Array.from((e.dataTransfer && e.dataTransfer.files) || []).filter((f) => /^image\//.test(f.type));
        if (files.length) handleFiles(files);
      });
    }

    root.addEventListener('click', (e) => {
      const pick = e.target.closest('[data-gal="pick"]');
      if (pick && input) input.click();
      const f = e.target.closest('[data-gal-filter]');
      if (f) {
        const v = f.getAttribute('data-gal-filter');
        ctx.galFilter = (v === 'home' || v) ? v : '';
        window.App.render();
      }
    });
  }

  /** 选择文件 → 问一次公共信息 → 逐张上传 */
  async function handleFiles(files) {
    if (!files.length) return;
    if (busy) { U.toast('上一批还在上传中…', 'warn'); return; }
    if (!window.App.state.canEdit) return U.needLogin();

    const meta = await U.formBox('这批照片的信息（可留空）', [
      { name: 'taken_at', label: '拍摄日期', type: 'date', value: U.todayStr(), hint: '会显示在照片下方' },
      {
        name: 'city', label: '在哪个城市拍的', type: 'text', placeholder: '例如：杭州',
        hint: cityHint()
      },
      { name: 'tags', label: '标签', type: 'text', placeholder: '约会, 旅行, 日常', hint: '用逗号分隔，之后可按标签筛选' },
      { name: 'caption', label: '一句话描述', type: 'text', placeholder: '例如：第一次一起看海' },
      { name: 'toHome', label: '直接放到首页', type: 'checkbox', checkLabel: '上传后立即出现在首页照片墙', value: files.length <= 9 }
    ], { okText: '开始上传 ' + files.length + ' 张' });
    if (!meta) return;

    const tags = String(meta.tags || '').split(/[,，\s]+/).map((x) => x.trim()).filter(Boolean);
    const city = String(meta.city || '').trim();
    const province = guessProvince(city);
    const listEl = document.getElementById('upload-list');
    const rows = files.map((f) => {
      const el = document.createElement('div');
      el.className = 'up-item';
      el.innerHTML = `<span>🖼️</span><span class="up-item__name">${U.esc(f.name)}</span><span class="up-item__state">排队中</span>`;
      if (listEl) listEl.appendChild(el);
      return el;
    });

    busy = true;
    let ok = 0, fail = 0;
    const me = window.App.state.me;
    let firstHomeId = null;

    for (let i = 0; i < files.length; i++) {
      const stateEl = rows[i].querySelector('.up-item__state');
      try {
        stateEl.textContent = '压缩中…';
        const rec = await window.DB.photos.add(files[i], {
          caption: meta.caption || '',
          taken_at: meta.taken_at || U.todayStr(),
          tags: tags,
          city: city,
          province: province,
          author: me ? me.name : ''
        }, (step) => { stateEl.textContent = step === 'uploading' ? '上传中…' : '压缩中…'; });
        if (rec) {
          ok++;
          rows[i].classList.add('is-done');
          stateEl.textContent = '✓ 完成 ' + (rec.width ? rec.width + '×' + rec.height : '');
          if (meta.toHome && !firstHomeId) firstHomeId = rec.id;
        } else { fail++; rows[i].classList.add('is-fail'); stateEl.textContent = '✗ 失败'; }
      } catch (err) {
        fail++; rows[i].classList.add('is-fail');
        stateEl.textContent = '✗ ' + (err.message || '失败');
      }
    }
    busy = false;

    // 一次性把这批照片打成「首页展示」
    if (meta.toHome) {
      try {
        const all = await window.DB.photos.list();
        const mine = all.slice(0, files.length).filter((p) => !p.is_home);
        for (const p of mine) await window.DB.photos.patch(p.id, { is_home: true });
      } catch (e) { console.warn(e); }
    }

    U.toast(`上传完成：成功 ${ok} 张${fail ? '，失败 ' + fail + ' 张' : ''}`, fail ? 'warn' : 'success');
    setTimeout(() => window.App.refresh(), 300);
  }

  /** 上传时给「城市」输入框的提示：列出打过卡的城市 */
  function cityHint() {
    const rows = (window.App && window.App.state && window.App.state.trips) || [];
    const names = window.DB.trips.cityNames(rows);
    return names.length
      ? '填了就会出现在「旅行地图」里 · 去过：' + names.slice(0, 6).join('、')
      : '填了之后照片会出现在「旅行地图」里';
  }

  /** 城市名 → 省份（从打卡记录里猜，猜不到就空着） */
  function guessProvince(city) {
    if (!city) return '';
    const rows = (window.App && window.App.state && window.App.state.trips) || [];
    const hit = rows.filter((r) => r.city && r.city === city)[0];
    return hit ? (hit.province || '') : '';
  }

  /** 从一个地方唤起上传（首页的「传照片」按钮） */
  function uploadPrompt() {
    if (!window.App.state.canEdit) return U.needLogin();
    const input = document.getElementById('file-input');
    if (input) { input.click(); return; }
    const tmp = document.createElement('input');
    tmp.type = 'file'; tmp.accept = 'image/*'; tmp.multiple = true;
    tmp.onchange = () => handleFiles(Array.from(tmp.files || []));
    tmp.click();
  }

  return { render, mount, uploadPrompt, title: '相册' };
})();