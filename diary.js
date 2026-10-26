/* =========================================================================
 *  恋爱日记 / 时间轴
 * ========================================================================= */
window.Views = window.Views || {};
window.Views.diary = (function () {
  'use strict';
  const U = window.U;
  const esc = U.esc;
  const MOODS = ['', '😊 开心', '🥰 幸福', '🥲 想你了', '😌 平静', '😤 小情绪', '🤒 不舒服', '🎉 值得纪念'];
  const moodEmoji = (m) => (m || '').split(' ')[0] || '';

  function render(ctx) {
    // 日记是两个人的私密空间：没登录就只显示一把锁
    if (!ctx.canEdit) {
      return U.lockCard('🔒', '日记只有你们两个人能看到',
        '登录之后就能在这里翻看和记录啦（在 Supabase 后台给两个邮箱建好账号即可）');
    }
    const list = (ctx.diary || []).slice().sort((a, b) => {
      const k = String(b.entry_date || '').localeCompare(String(a.entry_date || ''));
      return k !== 0 ? k : String(b.created_at || '').localeCompare(String(a.created_at || ''));
    });

    return `
    <section class="section">
      <div class="section__head">
        <h2 class="section__title">✍️ 恋爱日记</h2>
        <p class="section__desc">${list.length} 篇记录 · 想到什么就写下来</p>
        <div class="section__actions">
          ${ctx.canEdit ? '<button class="btn btn--primary btn--sm" data-diary="new">＋ 写一篇</button>' : ''}
        </div>
      </div>
      ${list.length ? `<div class="timeline stagger">${list.map((d) => {
        const ph = d.photo_id ? (ctx.photos || []).find((p) => p.id === d.photo_id) : null;
        return `<article class="tl" data-id="${esc(d.id)}">
          <span class="tl__dot"></span>
          <div class="tl__date">${esc(U.fmtDate(d.entry_date, { week: true }))}</div>
          <div class="tl__body">
            ${d.title ? `<div class="tl__title">${d.mood ? `<span class="tl__mood">${esc(moodEmoji(d.mood))}</span>` : ''}${esc(d.title)}</div>` : ''}
            ${d.content ? `<div class="tl__text">${esc(d.content)}</div>` : ''}
            ${ph ? `<div class="tl__photo" data-ph-zoom="${esc(ph.id)}"><img src="${esc(ph.src)}" alt="" loading="lazy"></div>` : ''}
            <div class="tl__foot">
              <span>${esc(d.author || '我')}</span>
              <span>·</span>
              <span>${esc(U.relTime(d.created_at))}</span>
              ${ctx.canEdit ? `<span class="tl__tools">
                <button class="btn btn--ghost btn--sm" data-diary-edit="${esc(d.id)}">编辑</button>
                <button class="btn btn--ghost btn--sm" data-diary-del="${esc(d.id)}">删除</button>
              </span>` : ''}
            </div>
          </div>
        </article>`;
      }).join('')}</div>`
      : `<div class="empty card card--pad"><div class="empty__icon">📖</div>
         <div class="empty__title">还没有日记</div>
         <div class="empty__desc">${ctx.canEdit ? '写下今天发生的一件小事吧，哪怕是「今天也很想你」' : '登录后就可以写啦'}</div>
         ${ctx.canEdit ? '<button class="btn btn--primary" data-diary="new">写下第一篇</button>' : ''}</div>`}
    </section>`;
  }

  function fields(ctx, d) {
    const opts = [{ value: '', label: '（不配图）' }].concat((ctx.photos || []).map((p) => ({
      value: p.id, label: (p.caption || U.fmtDate(p.taken_at) || '照片') + (p.taken_at ? ' · ' + U.fmtDate(p.taken_at, { short: true }) : '')
    })));
    return [
      { name: 'entry_date', label: '日期', type: 'date', value: (d && d.entry_date) || U.todayStr(), required: true },
      { name: 'title', label: '标题', type: 'text', value: (d && d.title) || '', placeholder: '例如：第一次一起做饭' },
      { name: 'mood', label: '心情', type: 'select', value: (d && d.mood) || '', options: MOODS.map((m) => ({ value: m, label: m || '（不选）' })) },
      { name: 'content', label: '正文', type: 'textarea', rows: 6, value: (d && d.content) || '', placeholder: '今天……' },
      { name: 'photo_id', label: '配一张照片', type: 'select', value: (d && d.photo_id) || '', options: opts }
    ];
  }

  async function openForm(ctx, id) {
    if (!ctx.canEdit) return U.needLogin();
    const editing = id ? (ctx.diary || []).find((d) => d.id === id) : null;
    const data = await U.formBox(editing ? '编辑日记' : '写一篇日记', fields(ctx, editing));
    if (!data) return;
    const me = window.App.state.me;
    const row = {
      entry_date: data.entry_date,
      title: data.title,
      mood: data.mood,
      content: data.content,
      photo_id: data.photo_id || null,
      author: (editing && editing.author) || (me ? me.name : '')
    };
    try {
      if (editing) await window.DB.diary.patch(editing.id, row);
      else await window.DB.diary.add(row);
      U.toast(editing ? '已更新' : '日记已保存 💗', 'success');
      window.App.refresh();
    } catch (e) { U.toast(e.message, 'error'); }
  }

  function mount(root, ctx) {
    root.addEventListener('click', async (e) => {
      if (e.target.closest('[data-diary="new"]')) return openForm(ctx, null);
      const ed = e.target.closest('[data-diary-edit]');
      if (ed) return openForm(ctx, ed.getAttribute('data-diary-edit'));
      const del = e.target.closest('[data-diary-del]');
      if (del) {
        const id = del.getAttribute('data-diary-del');
        if (await U.confirmBox('删除这篇日记？删掉就找不回来了。', { title: '删除日记' })) {
          try { await window.DB.diary.remove(id); U.toast('已删除', 'success'); window.App.refresh(); }
          catch (err) { U.toast(err.message, 'error'); }
        }
      }
    });

    if (/new=1/.test(location.hash) && ctx.canEdit && !ctx._diaryFormOpened) {
      ctx._diaryFormOpened = true;
      setTimeout(() => openForm(ctx, null), 120);
    }
  }

  return { render, mount, title: '日记' };
})();