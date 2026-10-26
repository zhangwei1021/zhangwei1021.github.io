/* =========================================================================
 *  悄悄话留言板（默认仅两人可见）
 * ========================================================================= */
window.Views = window.Views || {};
window.Views.notes = (function () {
  'use strict';
  const U = window.U;
  const esc = U.esc;

  function render(ctx) {
    if (!ctx.canEdit) {
      return U.lockCard('🔒', '悄悄话只有你们两个人能看到', '登录之后就能在这里给对方留言啦');
    }
    const list = (ctx.notes || []).slice().sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
    const meName = ctx.me ? ctx.me.name : '';
    const unread = list.filter((n) => !n.is_read && n.author !== meName).length;

    return `
    <section class="section">
      <div class="section__head">
        <h2 class="section__title">💌 悄悄话</h2>
        <p class="section__desc">${list.length} 条留言${unread ? ` · <b style="color:var(--accent-ink)">${unread} 条未读</b>` : ''}</p>
        <div class="section__actions">
          ${unread && ctx.canEdit ? '<button class="btn btn--ghost btn--sm" data-note="readall">全部标为已读</button>' : ''}
        </div>
      </div>

      ${ctx.canEdit ? `<div class="card card--pad" style="margin-bottom:18px">
        <form id="note-form">
          <textarea class="input" name="content" rows="3" placeholder="想跟 TA 说点什么？写在这里，TA 下次打开就能看到～"></textarea>
          <div style="display:flex;gap:8px;align-items:center;margin-top:10px;flex-wrap:wrap">
            <button class="btn btn--primary" type="submit">💗 发送悄悄话</button>
            <span style="font-size:12.5px;color:var(--muted)">只有你们两个人能看到</span>
          </div>
        </form>
      </div>`
      : `<div class="banner banner--info"><span>🔒</span><div>悄悄话只有你们两个人登录后才能看到哦。</div></div>`}

      ${list.length ? `<div class="notes-grid stagger">${list.map((n) => `
        <div class="note ${!n.is_read && n.author !== meName ? 'is-unread' : ''}">
          <div class="note__text">${esc(n.content)}</div>
          <div class="note__meta">
            <span class="note__who">${esc(n.author || 'TA')}</span>
            <span>${esc(U.relTime(n.created_at))}</span>
            ${!n.is_read && n.author !== meName ? '<span style="color:var(--accent-ink);font-weight:700">· 未读</span>' : ''}
            ${ctx.canEdit ? `<button class="note__del" data-note-del="${esc(n.id)}">删除</button>` : ''}
          </div>
        </div>`).join('')}</div>`
      : `<div class="empty"><div class="empty__icon">💌</div><div class="empty__title">还没有悄悄话</div>
         <div class="empty__desc">${ctx.canEdit ? '写下第一句吧' : ''}</div></div>`}
    </section>`;
  }

  function mount(root, ctx) {
    const form = root.querySelector('#note-form');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const ta = form.elements.content;
        const text = (ta.value || '').trim();
        if (!text) return U.toast('先写点什么吧～', 'warn');
        const me = window.App.state.me;
        try {
          await window.DB.notes.add({ content: text, author: me ? me.name : '我', is_read: false });
          ta.value = '';
          U.toast('悄悄话已送达 💗', 'success');
          window.App.refresh();
        } catch (err) { U.toast(err.message, 'error'); }
      });
    }

    root.addEventListener('click', async (e) => {
      const del = e.target.closest('[data-note-del]');
      if (del) {
        if (await U.confirmBox('删除这条悄悄话？', { title: '删除' })) {
          try { await window.DB.notes.remove(del.getAttribute('data-note-del')); window.App.refresh(); }
          catch (err) { U.toast(err.message, 'error'); }
        }
        return;
      }
      if (e.target.closest('[data-note="readall"]')) {
        const meName = ctx.me ? ctx.me.name : '';
        const un = (ctx.notes || []).filter((n) => !n.is_read && n.author !== meName);
        try {
          for (const n of un) await window.DB.notes.patch(n.id, { is_read: true });
          window.App.refresh();
        } catch (err) { U.toast(err.message, 'error'); }
      }
    });

    // 进入页面即把对方发给我的标为已读
    if (ctx.canEdit) {
      const meName = ctx.me ? ctx.me.name : '';
      const un = (ctx.notes || []).filter((n) => !n.is_read && n.author !== meName);
      if (un.length) {
        setTimeout(async () => {
          try {
            for (const n of un) await window.DB.notes.patch(n.id, { is_read: true });
            window.App.refresh();
          } catch (e) { /* 忽略 */ }
        }, 700);
      }
    }
  }

  return { render, mount, title: '悄悄话' };
})();