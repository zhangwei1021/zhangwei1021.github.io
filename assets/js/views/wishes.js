/* =========================================================================
 *  心愿清单：想一起做的事
 * ========================================================================= */
window.Views = window.Views || {};
window.Views.wishes = (function () {
  'use strict';
  const U = window.U;
  const esc = U.esc;

  function render(ctx) {
    // 心愿清单同样是私密的
    if (!ctx.canEdit) {
      return U.lockCard('🔒', '心愿清单只有你们两个人能看到',
        '登录之后再一起写下想做的事吧');
    }
    const list = (ctx.wishes || []).slice().sort((a, b) => {
      if (!!a.done !== !!b.done) return a.done ? 1 : -1;
      return String(b.created_at || '').localeCompare(String(a.created_at || ''));
    });
    const done = list.filter((w) => w.done).length;
    const pct = list.length ? Math.round((done / list.length) * 100) : 0;

    return `
    <section class="section">
      <div class="section__head">
        <h2 class="section__title">🌟 心愿清单</h2>
        <p class="section__desc">想和你一起做的 ${list.length} 件事 · 已完成 ${done} 件</p>
        <div class="section__actions">
          ${ctx.canEdit ? '<button class="btn btn--primary btn--sm" data-wish="new">＋ 加一个心愿</button>' : ''}
        </div>
      </div>

      ${list.length ? `<div class="card card--pad" style="margin-bottom:16px">
        <div style="display:flex;align-items:center;gap:12px">
          <span style="font-size:22px">${pct === 100 ? '🎉' : '🌱'}</span>
          <div style="flex:1">
            <div style="font-weight:700;font-size:14.5px">一起完成了 ${done} / ${list.length} 个心愿</div>
            <div style="height:8px;border-radius:99px;background:var(--accent-soft);margin-top:8px;overflow:hidden">
              <i style="display:block;height:100%;width:${pct}%;background:var(--accent);border-radius:99px;transition:width .5s"></i>
            </div>
          </div>
          <div class="mono" style="font-size:20px;font-weight:800;color:var(--accent-ink)">${pct}%</div>
        </div>
      </div>` : ''}

      ${list.length ? `<div class="wishes stagger">${list.map((w) => `
        <div class="wish ${w.done ? 'is-done' : ''}" data-id="${esc(w.id)}">
          <button class="wish__check" data-wish-toggle="${esc(w.id)}" title="${w.done ? '标记为未完成' : '标记为已完成'}">✓</button>
          <div class="wish__main">
            <div class="wish__title">${esc(w.title)}</div>
            ${w.description ? `<div class="wish__desc">${esc(w.description)}</div>` : ''}
            <div class="wish__meta">
              ${w.done && w.done_at ? `✅ ${esc(U.fmtDate(w.done_at))} 完成` : '还在路上'}
              ${w.author ? ` · ${esc(w.author)} 许下` : ''}
            </div>
          </div>
          ${ctx.canEdit ? `<div class="wish__tools">
            <button class="btn btn--ghost btn--sm" data-wish-edit="${esc(w.id)}">编辑</button>
            <button class="btn btn--ghost btn--sm" data-wish-del="${esc(w.id)}">删除</button>
          </div>` : ''}
        </div>`).join('')}</div>`
      : `<div class="empty card card--pad"><div class="empty__icon">🌟</div>
         <div class="empty__title">还没有心愿</div>
         <div class="empty__desc">${ctx.canEdit ? '比如「一起去看一次极光」「养一只猫」' : '登录后可以一起许愿'}</div>
         ${ctx.canEdit ? '<button class="btn btn--primary" data-wish="new">许下第一个心愿</button>' : ''}</div>`}
    </section>`;
  }

  async function openForm(ctx, id) {
    if (!ctx.canEdit) return U.needLogin();
    const editing = id ? (ctx.wishes || []).find((w) => w.id === id) : null;
    const data = await U.formBox(editing ? '编辑心愿' : '新的心愿', [
      { name: 'title', label: '想一起做的事', type: 'text', value: (editing && editing.title) || '', placeholder: '例如：一起去看一次海', required: true },
      { name: 'description', label: '备注', type: 'textarea', rows: 2, value: (editing && editing.description) || '', placeholder: '为什么想做 / 打算什么时候去' }
    ]);
    if (!data) return;
    const me = window.App.state.me;
    try {
      if (editing) await window.DB.wishes.patch(editing.id, { title: data.title, description: data.description });
      else await window.DB.wishes.add({ title: data.title, description: data.description, done: false, author: me ? me.name : '' });
      U.toast(editing ? '已更新' : '心愿已记下 🌟', 'success');
      window.App.refresh();
    } catch (e) { U.toast(e.message, 'error'); }
  }

  function mount(root, ctx) {
    root.addEventListener('click', async (e) => {
      if (e.target.closest('[data-wish="new"]')) return openForm(ctx, null);
      const ed = e.target.closest('[data-wish-edit]');
      if (ed) return openForm(ctx, ed.getAttribute('data-wish-edit'));

      const tg = e.target.closest('[data-wish-toggle]');
      if (tg) {
        if (!ctx.canEdit) return U.needLogin();
        const w = (ctx.wishes || []).find((x) => x.id === tg.getAttribute('data-wish-toggle'));
        if (!w) return;
        try {
          await window.DB.wishes.patch(w.id, w.done ? { done: false, done_at: null } : { done: true, done_at: U.todayStr() });
          if (!w.done) U.toast('又一起完成了一件 🎉', 'success');
          window.App.refresh();
        } catch (err) { U.toast(err.message, 'error'); }
        return;
      }

      const del = e.target.closest('[data-wish-del]');
      if (del) {
        if (await U.confirmBox('删除这个心愿？', { title: '删除心愿' })) {
          try { await window.DB.wishes.remove(del.getAttribute('data-wish-del')); window.App.refresh(); }
          catch (err) { U.toast(err.message, 'error'); }
        }
      }
    });
  }

  return { render, mount, title: '心愿单' };
})();