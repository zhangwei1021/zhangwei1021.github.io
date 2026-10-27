/* =========================================================================
 *  旅行轨迹：中国地图点亮 + 打卡记录 + 按城市看照片
 * ========================================================================= */
window.Views = window.Views || {};
window.Views.map = (function () {
  'use strict';
  const U = window.U;
  const esc = U.esc;
  const S = { pv: '' };   // 当前选中的省份

  function s(ctx) { return ctx.s || ctx.settings || {}; }
  function rows(ctx) { return ctx.trips || []; }

  /** 小省份的角标错开一点，免得挤在一起 */
  const PIN_SHIFT = {
    北京: [0, -15], 天津: [16, 4], 上海: [15, -2], 香港: [4, 13], 澳门: [-9, 15],
    海南: [0, 4], 台湾: [8, 0], 宁夏: [-12, 0], 重庆: [0, 6]
  };

  function provinceNames() {
    const M = window.CHINA_MAP;
    return M ? M.provinces.map((p) => p.name) : [];
  }

  function statsHtml(ctx) {
    const st = window.DB.trips.summary(rows(ctx));
    return `<div class="trip-stat">
      <div class="trip-stat__cell"><b>${st.provinces}</b><span>个省份</span></div>
      <div class="trip-stat__cell"><b>${st.cities}</b><span>座城市</span></div>
      <div class="trip-stat__cell"><b>${st.times}</b><span>次出发</span></div>
    </div>`;
  }

  function mapHtml(ctx) {
    const M = window.CHINA_MAP;
    if (!M) return '<div class="banner banner--warn"><span>🗺️</span><div>地图还没加载出来，刷新一下页面试试</div></div>';
    const groups = window.DB.trips.group(rows(ctx));
    const lit = {};
    groups.forEach((g) => { lit[g.province] = g; });

    const paths = M.provinces.map((p) => {
      const g = lit[p.name];
      const lv = g ? (g.times >= 4 ? 3 : (g.times >= 2 ? 2 : 1)) : 0;
      return `<path class="map__pv${g ? ' is-lit lv' + lv : ''}${S.pv === p.name ? ' is-sel' : ''}" data-pv="${esc(p.name)}" d="${p.d}"></path>`;
    }).join('');

    const pins = M.provinces.map((p) => {
      const g = lit[p.name];
      if (!g) return '';
      const sh = PIN_SHIFT[p.name] || [0, 0];
      const x = (p.cx + sh[0]).toFixed(1);
      const y = (p.cy + sh[1]).toFixed(1);
      return `<g class="map__pin" data-pv="${esc(p.name)}">
        <circle cx="${x}" cy="${y}" r="10.5"></circle>
        <text x="${x}" y="${(+y + 3.5).toFixed(1)}">${g.times}</text>
        <title>${esc(p.name)} · ${g.cities.length} 座城市 · 去过 ${g.times} 次</title>
      </g>`;
    }).join('');

    return `<div class="mapbox">
      <svg class="map" viewBox="0 0 ${M.w} ${M.h}" role="img" aria-label="中国地图">
        <g class="map__pvs">${paths}</g>
        <g class="map__pins">${pins}</g>
      </svg>
      <div class="map__legend"><span class="map__dot"></span> 点亮的省份＝你们去过的地方，数字是去过的次数</div>
    </div>`;
  }

  function cityChips(g) {
    if (!g || !g.cities.length) return '';
    return `<div class="pvchips">${g.cities.map((c) =>
      `<button class="pvchip${S.city === c ? ' is-active' : ''}" data-city="${esc(c)}">${esc(c)}</button>`).join('')}</div>`;
  }

  function photoThumbs(list) {
    if (!list.length) return '';
    return `<div class="mapph">${list.slice(0, 12).map((p) =>
      `<button class="mapph__one" data-ph-zoom="${esc(p.id)}" title="${esc(p.caption || p.city || '')}">
         <img src="${esc(p.src || '')}" alt="" loading="lazy">
       </button>`).join('')}</div>`;
  }

  function panelHtml(ctx) {
    const all = rows(ctx);
    if (!all.length) {
      return `<aside class="mappanel mappanel--empty">
        <div class="empty">
          <div class="empty__icon">🧭</div>
          <div class="empty__title">还没有打卡记录</div>
          <div class="empty__desc">${ctx.canEdit ? '记下你们一起去过的第一座城市，地图就会亮起来' : '登录后就可以记录啦'}</div>
        </div>
        ${ctx.canEdit ? '<button class="btn btn--primary btn--block" data-trip="new">＋ 打卡一座城市</button>' : ''}
      </aside>`;
    }

    const groups = window.DB.trips.group(all);
    const pv = S.pv || (groups[0] && groups[0].province) || '';
    const g = groups.filter((x) => x.province === pv)[0];

    if (!g) {
      return `<aside class="mappanel">
        <div class="mappanel__head">
          <div class="mappanel__pv">${esc(pv || '中国')}</div>
          <div class="mappanel__sub">这里还没有你们的脚印</div>
        </div>
        <div class="mappanel__hint">${ctx.canEdit ? '要不要把这里记上一笔？' : '等你们去过之后，这里就会亮起来 ✨'}</div>
        ${ctx.canEdit ? `<button class="btn btn--primary btn--block" data-trip="new" data-pv="${esc(pv)}">＋ 打卡${esc(pv)}</button>` : ''}
      </aside>`;
    }

    const list = g.cities.length && S.city
      ? all.filter((r) => r.province === pv && r.city === S.city)
      : all.filter((r) => r.province === pv);
    const imgs = window.DB.trips.photosOf(ctx.photos || [], pv, g.cities.length > 1 ? S.city : '');

    return `<aside class="mappanel">
      <div class="mappanel__head">
        <div class="mappanel__pv">${esc(pv)}</div>
        <div class="mappanel__sub">第一次去 ${esc(U.fmtDate(g.first) || '—')} · 一共 ${g.times} 次${g.cities.length ? ' · ' + g.cities.length + ' 座城市' : ''}</div>
      </div>
      ${cityChips(g)}
      ${imgs.length ? `<div class="mappanel__label">📷 这里的照片（${imgs.length}）</div>${photoThumbs(imgs)}` : ''}
      <div class="mappanel__label">✍️ 打卡记录</div>
      <div class="trip-list">
        ${list.map((r) => `<div class="trip">
          <div class="trip__main">
            <div class="trip__city">${esc(r.city || pv)}${Number(r.times) > 1 ? ` <i>×${Number(r.times)}</i>` : ''}</div>
            <div class="trip__meta">${esc(U.fmtDate(r.first_date) || '')}${r.last_date && r.last_date !== r.first_date ? ' ~ ' + esc(U.fmtDate(r.last_date)) : ''}${r.author ? ' · ' + esc(r.author) : ''}</div>
            ${r.note ? `<div class="trip__note">${esc(r.note)}</div>` : ''}
          </div>
          ${ctx.canEdit ? `<div class="trip__tools">
            <button class="ph__tool" data-trip-edit="${esc(r.id)}" title="编辑">✏️</button>
            <button class="ph__tool" data-trip-del="${esc(r.id)}" title="删除">🗑️</button>
          </div>` : ''}
        </div>`).join('')}
      </div>
      ${ctx.canEdit ? `<button class="btn btn--ghost btn--block" data-trip="new" data-pv="${esc(pv)}" data-city="${esc(S.city || '')}">＋ 再记一笔</button>` : ''}
    </aside>`;
  }

  function render(ctx) {
    const all = rows(ctx);
    // 第一次进来默认选中最近去过的那一站，右边面板就不是空的
    if (!S.pv && all.length) {
      const stamp = (r) => String((r && (r.last_date || r.first_date)) || '');
      const last = all.slice().sort((a, b) => stamp(b).localeCompare(stamp(a)))[0];
      if (last && last.province) S.pv = last.province;
    }
    return `
    <section class="section">
      <div class="section__head">
        <div>
          <h2 class="section__title">🗺️ 旅行轨迹</h2>
          <p class="section__desc">你们一起去过的地方，都会在地图上亮起来</p>
        </div>
        <div class="section__actions">
          ${ctx.canEdit ? '<button class="btn btn--primary btn--sm" data-trip="new">＋ 打卡一座城市</button>' : ''}
        </div>
      </div>
      ${statsHtml(ctx)}
      <div class="mapwrap">
        ${mapHtml(ctx)}
        ${panelHtml(ctx)}
      </div>
      ${all.length ? `<div class="banner banner--info"><span>💡</span>
        <div>点地图上<b>点亮的省份</b>可以看第一次去的时间、去过几次、那里的照片；<b>点城市名</b>只看那座城市。上传照片时填一个城市名，照片就会出现在这里。</div>
      </div>` : ''}
    </section>`;
  }

  /* ------------------------------------------------------------ 交互 */
  async function openForm(pre) {
    const st = window.App.state;
    if (!st.canEdit) return U.needLogin();
    const pre2 = pre || {};
    const cur = pre2.id ? (st.trips || []).filter((r) => r.id === pre2.id)[0] || {} : {};
    const names = provinceNames();
    const cities = window.DB.trips.cityNames(st.trips || []);

    const data = await U.formBox(cur.id ? '编辑这次打卡' : '打卡一座城市', [
      {
        name: 'province', label: '省份 / 直辖市', type: 'select', required: true,
        value: cur.province || pre2.province || names[0] || '',
        options: names.map((n) => ({ value: n, label: n }))
      },
      { name: 'city', label: '城市', type: 'text', value: cur.city || pre2.city || '', placeholder: '例如：杭州', required: true, hint: cities.length ? '你们打过卡的城市：' + cities.slice(0, 6).join('、') : '填城市名，以后按城市找照片' },
      { name: 'first_date', label: '第一次去', type: 'date', value: cur.first_date || U.todayStr() },
      { name: 'last_date', label: '最近一次去', type: 'date', value: cur.last_date || '', hint: '只去过一次就留空' },
      { name: 'times', label: '一共去过几次', type: 'text', value: cur.times == null ? '1' : String(cur.times) },
      { name: 'note', label: '那天的回忆', type: 'textarea', rows: 2, value: cur.note || '', placeholder: '例如：第一次一起看海，风很大' }
    ], { okText: cur.id ? '保存' : '记下来' });
    if (!data) return;

    const row = {
      province: data.province,
      city: data.city,
      first_date: data.first_date || null,
      last_date: data.last_date || null,
      times: Math.max(1, parseInt(data.times, 10) || 1),
      note: data.note || ''
    };
    try {
      if (cur.id) await window.DB.trips.patch(cur.id, row);
      else await window.DB.trips.add(Object.assign({ author: (st.me && st.me.name) || '' }, row));
      S.pv = row.province;
      U.toast(cur.id ? '改好了 ✓' : '打卡成功，地图亮了 ✨', 'success');
      window.App.refresh();
    } catch (err) {
      U.toast('保存失败：' + (err.message || ''), 'error');
    }
  }

  function mount(root, ctx) {
    root.addEventListener('click', async (e) => {
      const pv = e.target.closest('[data-pv]');
      const city = e.target.closest('[data-city]');
      const add = e.target.closest('[data-trip="new"]');
      const edit = e.target.closest('[data-trip-edit]');
      const del = e.target.closest('[data-trip-del]');

      if (edit) return openForm({ id: edit.getAttribute('data-trip-edit') });
      if (del) {
        const id = del.getAttribute('data-trip-del');
        const r = (ctx.trips || []).filter((x) => x.id === id)[0] || {};
        if (!(await U.confirmBox(`删除「${r.city || r.province || '这条记录'}」的打卡记录？`, { danger: true, okText: '删除' }))) return;
        try {
          await window.DB.trips.remove(id);
          U.toast('已删除', 'success');
          window.App.refresh();
        } catch (err) { U.toast('删除失败：' + (err.message || ''), 'error'); }
        return;
      }
      if (add) {
        return openForm({ province: add.getAttribute('data-pv') || '', city: add.getAttribute('data-city') || '' });
      }
      if (city) {
        const name = city.getAttribute('data-city');
        S.city = S.city === name ? '' : name;
        window.App.render();
        return;
      }
      if (pv) {
        const name = pv.getAttribute('data-pv');
        S.pv = name;
        S.city = '';
        window.App.render();
      }
    });
  }

  return { render, mount, title: '旅行地图', select(name) { S.pv = name || ''; S.city = ''; } };
})();