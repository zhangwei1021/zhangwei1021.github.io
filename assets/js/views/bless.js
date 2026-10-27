/* =========================================================================
 *  祝福墙 💌（访客也能写：昵称或匿名，谁都能看）
 *  —— 和「悄悄话」不同，这一页是给来做客的人用的，不需要登录
 * ========================================================================= */
window.Views = window.Views || {};
window.Views.bless = (function () {
  'use strict';
  const U = window.U;
  const esc = U.esc;

  const COOL = 20 * 1000;       // 同一台设备 20 秒内只能送一次
  const LAST_KEY = 'love.bless.last';

  function listOf(ctx) {
    const arr = (ctx.blessings || []).slice();
    arr.sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
    return arr;
  }

  function avaOf(b) {
    if (b.is_anon || !b.name) return { txt: '💗', anon: true };
    const ch = String(b.name).trim().charAt(0).toUpperCase();
    return { txt: ch || '💗', anon: false };
  }

  function cardHtml(b, ctx) {
    const a = avaOf(b);
    const who = a.anon ? '匿名访客' : (b.name || '访客');
    return `<div class="bless ${a.anon ? 'is-anon' : ''}">
      <div class="bless__ava">${esc(a.txt)}</div>
      <div class="bless__body">
        <div class="bless__top">
          <span class="bless__name">${esc(who)}</span>
          <span class="bless__time">${esc(U.relTime(b.created_at))}</span>
        </div>
        <div class="bless__text">${esc(b.content)}</div>
        ${ctx.canEdit ? `<button class="bless__del" data-bless-del="${esc(b.id)}" title="删除这条祝福">删除</button>` : ''}
      </div>
    </div>`;
  }

  function render(ctx) {
    const list = listOf(ctx);
    const max = (window.DB.blessings && window.DB.blessings.MAX) || 300;
    const myName = ctx.canEdit && ctx.me && ctx.me.key ? ctx.me.name : '';

    return `
    <section class="section">
      <div class="section__head">
        <h2 class="section__title">💌 祝福墙</h2>
        <p class="section__desc">${list.length ? `已经有 <b>${list.length}</b> 位朋友留下了祝福` : '第一个留下祝福的人，会是你吗？'}</p>
      </div>

      <div class="bless-hero card card--pad">
        <div class="bless-hero__txt">
          <div class="bless-hero__title">谢谢你来看我们的故事</div>
          <div class="bless-hero__sub">不用注册、不用登录，写一句祝福就能留在这里。<br>想留名字就写昵称，不想留就勾上「匿名」。</div>
        </div>
        <div class="bless-hero__ico">🎁</div>
      </div>

      <div class="card card--pad bless-form-wrap">
        <form id="bless-form" autocomplete="off">
          <div class="bless-row">
            <label class="field" style="flex:1;min-width:180px">
              <span class="field__label">你的昵称</span>
              <input class="input" name="name" maxlength="24" value="${esc(myName)}" placeholder="怎么称呼你？">
            </label>
            <label class="check bless-anon">
              <input type="checkbox" name="anon" ${myName ? '' : 'checked'}>
              <span>匿名送出</span>
            </label>
          </div>

          <label class="field">
            <span class="field__label">想说的话</span>
            <textarea class="input" name="content" rows="3" maxlength="${max}"
              placeholder="祝你们一直这样好下去，白头到老 💗"></textarea>
            <span class="field__hint"><span id="bless-count">0</span> / ${max} 字</span>
          </label>

          <input type="text" name="website" class="bless-hp" tabindex="-1" autocomplete="off" aria-hidden="true">

          <div class="bless-actions">
            <button class="btn btn--primary" type="submit">💌 送出祝福</button>
            <span class="bless-tip" id="bless-tip">祝福会立刻出现在下面的墙上</span>
          </div>
        </form>
      </div>

      ${list.length
        ? `<div class="bless-wall stagger">${list.map((b) => cardHtml(b, ctx)).join('')}</div>`
        : `<div class="empty"><div class="empty__icon">💌</div>
             <div class="empty__title">还没有人留言</div>
             <div class="empty__desc">第一个祝福会出现在这里</div></div>`}
    </section>`;
  }

  function mount(root, ctx) {
    const form = root.querySelector('#bless-form');
    if (!form) return;

    const nameEl = form.elements.name;
    const anonEl = form.elements.anon;
    const ta = form.elements.content;
    const hp = form.elements.website;
    const countEl = root.querySelector('#bless-count');
    const tipEl = root.querySelector('#bless-tip');

    const syncAnon = () => {
      nameEl.disabled = anonEl.checked;
      if (anonEl.checked) nameEl.classList.add('is-off'); else nameEl.classList.remove('is-off');
    };
    syncAnon();
    anonEl.addEventListener('change', syncAnon);

    ta.addEventListener('input', () => {
      if (countEl) countEl.textContent = ta.value.length;
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (hp && hp.value) return;                      // 机器人填了隐藏栏：静默丢弃

      const content = (ta.value || '').trim();
      if (content.length < 1) return U.toast('写点什么再送出去吧 💗', 'warn');

      const now = Date.now();
      const last = Number(localStorage.getItem(LAST_KEY) || 0);
      if (now - last < COOL) {
        const s = Math.ceil((COOL - (now - last)) / 1000);
        return U.toast(`刚送过啦，${s} 秒后可以再送一条 💗`, 'warn');
      }

      const btn = form.querySelector('button[type="submit"]');
      btn.disabled = true;
      const old = btn.textContent;
      btn.textContent = '送出中…';
      try {
        await window.DB.blessings.addBless({
          name: anonEl.checked ? '' : (nameEl.value || '').trim(),
          content: content,
          is_anon: anonEl.checked
        });
        localStorage.setItem(LAST_KEY, String(Date.now()));
        ta.value = '';
        if (countEl) countEl.textContent = '0';
        if (tipEl) { tipEl.textContent = '收到啦，谢谢你 💗'; tipEl.classList.add('is-ok'); }
        U.toast('祝福已经贴上墙了 💗', 'success');
        window.App.refresh();
      } catch (err) {
        U.toast(err.message || '没送出去，稍后再试试', 'error');
        btn.disabled = false;
        btn.textContent = old;
      }
    });

    root.addEventListener('click', async (e) => {
      const del = e.target.closest('[data-bless-del]');
      if (!del) return;
      if (!ctx.canEdit) return;
      if (!(await U.confirmBox('删掉这条祝福？删了就找不回来了', { title: '删除祝福', okText: '删除', danger: true }))) return;
      try {
        await window.DB.blessings.remove(del.getAttribute('data-bless-del'));
        U.toast('已删除');
        window.App.refresh();
      } catch (err) { U.toast(err.message, 'error'); }
    });
  }

  return { render, mount, title: '祝福墙', cardHtml };
})();