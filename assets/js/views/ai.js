/* =========================================================================
 *  AI 分身 —— 她可以和一个「AI 版的你」聊天
 *  说明：真正的模型调用在 Supabase 的 Edge Function（supabase/functions/ai-chat）
 *        里完成，网页这边只负责显示和发送，DeepSeek 的钥匙不会出现在这里。
 * ========================================================================= */
window.Views = window.Views || {};
window.Views.ai = (function () {
  'use strict';
  const U = window.U;
  const DB = window.DB;
  const esc = U.esc;

  /* 模块级状态：换页面、刷新数据都不会丢，避免聊天记录被反复重画 */
  const S = {
    msgs: [],
    loaded: false,
    sending: false,
    err: '',
    warn: '',
    remaining: null,
    greeting: ''       // 已经自动问候过哪种（本轮页面生命周期内不再重复）
  };

  const CHIPS = ['今天想你了', '今天有点累', '夸夸我', '你在干嘛呀'];

  function s(ctx) { return ctx.settings || ctx.s || {}; }

  function ownerInfo(ctx) {
    const cfg = ctx.aiConfig || {};
    const st = s(ctx);
    const owner = cfg.owner === 'B' ? 'B' : 'A';
    return {
      owner: owner,
      name: (owner === 'A' ? st.nicknameA : st.nicknameB) || '我',
      avatar: (owner === 'A' ? st.avatarA : st.avatarB) || '',
      herName: (owner === 'A' ? st.nicknameB : st.nicknameA) || 'TA'
    };
  }

  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function dayKey(tsd) {
    const d = new Date(tsd);
    return isNaN(d.getTime()) ? '' : d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }
  function timeText(tsd) {
    const d = new Date(tsd);
    if (isNaN(d.getTime())) return '';
    const today = dayKey(new Date());
    const hm = pad2(d.getHours()) + ':' + pad2(d.getMinutes());
    if (dayKey(d) === today) return hm;
    return (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + hm;
  }
  function dayText(tsd) {
    const d = new Date(tsd);
    if (isNaN(d.getTime())) return '';
    const today = dayKey(new Date());
    if (dayKey(d) === today) return '今天';
    const y = new Date(Date.now() - 86400000);
    if (dayKey(d) === dayKey(y)) return '昨天';
    return (d.getMonth() + 1) + '月' + d.getDate() + '日';
  }

  function avaHtml(avatar, name, cls) {
    const ch = String(name || '我').trim().charAt(0) || '我';
    if (avatar) {
      // 头像地址失效时（比如换过图/本地缓存过期）由 mount 里的 error 捕获降级成文字头像
      return '<div class="chat__ava ' + (cls || '') + '" data-ch="' + esc(ch) + '"><img src="' + esc(avatar) + '" alt=""></div>';
    }
    return '<div class="chat__ava chat__ava--txt ' + (cls || '') + '">' + esc(ch) + '</div>';
  }

  function bubbleHtml(m, ctx, oi) {
    const mine = m.role === 'user';
    // 本地模式没登录时 me.name 是 'local'，显示成「我」更自然
    const myName = (ctx.me && ctx.me.name && ctx.me.name !== 'local') ? ctx.me.name : '我';
    const who = mine ? myName : oi.name;
    const avatar = mine ? ((ctx.me && ctx.me.avatar) || '') : oi.avatar;
    const isGreet = /^greeting/.test(String(m.kind || ''));
    return `
      <div class="chat__row ${mine ? 'is-me' : 'is-ai'}">
        ${avaHtml(avatar, who, mine ? 'chat__ava--me' : 'chat__ava--ai')}
        <div class="chat__body">
          <div class="chat__bubble">${U.nl2br(esc(m.content || ''))}</div>
          <div class="chat__meta">
            <span>${esc(mine ? who : who + ' · AI 分身')}</span>
            ${isGreet ? '<span class="chat__tag">主动问候</span>' : ''}
            <span>${esc(timeText(m.created_at))}</span>
          </div>
        </div>
      </div>`;
  }

  function listHtml(ctx) {
    const oi = ownerInfo(ctx);
    if (!S.loaded) return '<div class="chat__empty"><div class="spin"></div><p>正在打开你们的聊天…</p></div>';
    if (!S.msgs.length) {
      return `<div class="chat__empty">
        <div class="empty__icon">💬</div>
        <div class="empty__title">还没有聊过</div>
        <div class="empty__desc">下面随便点一句开始吧，或者直接打字</div>
      </div>`;
    }
    let last = '';
    return S.msgs.map((m) => {
      const k = dayKey(m.created_at);
      const div = k && k !== last ? `<div class="chat__day">${esc(dayText(m.created_at))}</div>` : '';
      last = k;
      return div + bubbleHtml(m, ctx, oi);
    }).join('');
  }

  function typingHtml() {
    if (!S.sending) return '';
    return `<div class="chat__row is-ai chat__row--typing">
      <div class="chat__ava chat__ava--txt">…</div>
      <div class="chat__body"><div class="chat__bubble chat__bubble--typing">
        <span class="chat__dot"></span><span class="chat__dot"></span><span class="chat__dot"></span>
      </div><div class="chat__meta"><span>正在打字…</span></div></div>
    </div>`;
  }

  function render(ctx) {
    if (!ctx.canEdit) {
      return U.lockCard('🔒', 'AI 分身只有你们两个人能打开', '登录之后就能和 TA 的分身说说话啦');
    }
    if (!DB.isCloud()) {
      return `
      <section class="section">
        <div class="section__head">
          <h2 class="section__title">💬 AI 分身</h2>
          <p class="section__desc">一个用你们的聊天调教出来的小分身，随时都在</p>
        </div>
        <div class="banner banner--info"><span>🛠️</span><div>
          <b>还差两步才能开始聊天。</b><br>
          AI 分身需要一个「中间人」替你保管 DeepSeek 的钥匙（不然会被别人偷走），
          所以它只在<b>云端模式</b>下能用。照着 <b>README 第八节</b> 做一遍就好：
          <ol style="margin:8px 0 0 18px;line-height:1.9">
            <li>Supabase → SQL Editor → 跑一次 <b>supabase/ai.sql</b></li>
            <li>DeepSeek 官网建一个 API key，存到 Supabase 的 Secret：<b>DEEPSEEK_API_KEY</b></li>
            <li>Supabase → Edge Functions → 建一个叫 <b>ai-chat</b> 的函数，把我写好的代码粘进去</li>
            <li>在 <a href="#/settings">设置 → AI 分身</a> 里写上你的人设，然后回到这一页</li>
          </ol>
        </div></div>
      </section>`;
    }

    const oi = ownerInfo(ctx);
    const cfg = ctx.aiConfig || {};
    const meIsOwner = ctx.me && ctx.me.key === oi.owner;

    return `
    <section class="section">
      <div class="section__head">
        <h2 class="section__title">💬 和 ${esc(oi.name)} 的 AI 分身聊聊</h2>
        <p class="section__desc">${esc(oi.herName)} 打开这一页，看到的就是这个分身 · 不联网聊不了天，但随时都在</p>
        <div class="section__actions">
          <button class="btn btn--ghost btn--sm" data-ai="settings">⚙️ 改人设和记忆</button>
          ${S.msgs.length ? '<button class="btn btn--ghost btn--sm" data-ai="clear">🧹 清空对话</button>' : ''}
        </div>
      </div>

      ${cfg.enabled === false ? '<div class="banner banner--warn"><span>⏸️</span><div>分身现在被关掉了（设置 → AI 分身 → 总开关）。</div></div>' : ''}
      ${meIsOwner ? `<div class="banner banner--info"><span>🙋</span><div>这一页现在是你自己（${esc(oi.name)}）在跟自己的分身说话。她那边看到的就是这个页面。</div></div>` : ''}
      <div id="ai-warn"></div>
      <div id="ai-err"></div>

      <div class="card chat">
        <div class="chat__list" id="chat-list">${listHtml(ctx)}${typingHtml()}</div>
        <form class="chat__form" id="chat-form">
          <textarea class="input chat__input" id="chat-input" rows="1"
            placeholder="想说什么就说什么…（Enter 发送，Shift+Enter 换行）"></textarea>
          <button class="btn btn--primary chat__send" type="submit" id="chat-send">发送</button>
        </form>
        <div class="chat__foot">
          <div class="chat__chips">${CHIPS.map((c) => `<button class="chat__chip" data-ai-chip="${esc(c)}">${esc(c)}</button>`).join('')}</div>
          <div class="chat__note" id="chat-note">💡 这是 AI 分身，说得不像的地方，去「设置 → AI 分身」改人设和记忆就好。</div>
        </div>
      </div>
    </section>`;
  }

  /* --------------------------------------------------------------- 画面刷新 */
  let listEl = null, inputEl = null, formEl = null;

  function paint(root, ctx) {
    root = root || document;
    if (!listEl || !document.body.contains(listEl)) listEl = root.querySelector('#chat-list');
    if (!listEl) return;
    listEl.innerHTML = listHtml(ctx) + typingHtml();
    listEl.scrollTop = listEl.scrollHeight;

    const warnEl = root.querySelector('#ai-warn');
    if (warnEl) warnEl.innerHTML = S.warn ? `<div class="banner banner--warn"><span>⚠️</span><div>${esc(S.warn)}</div></div>` : '';
    const errEl = root.querySelector('#ai-err');
    if (errEl) errEl.innerHTML = S.err ? `<div class="banner banner--warn"><span>😵</span><div>${esc(S.err)}</div></div>` : '';

    const noteEl = root.querySelector('#chat-note');
    if (noteEl && S.remaining !== null) {
      noteEl.textContent = '💡 今天还能聊 ' + S.remaining + ' 句（每天上限可以在设置里改）。说得不像的地方，去「设置 → AI 分身」改人设和记忆就好。';
    }
    const sendBtn = root.querySelector('#chat-send');
    if (sendBtn) { sendBtn.disabled = S.sending; sendBtn.textContent = S.sending ? '…' : '发送'; }
  }

  async function load(root, ctx) {
    if (S.sending) return;                 // 正在等回复时不要重画，免得把气泡弄丢
    try {
      const list = await DB.ai.history(60);
      S.msgs = list || [];
      S.loaded = true;
      S.err = '';
    } catch (e) {
      S.loaded = true;
      S.err = e.message + '（如果是「relation … does not exist」，就是还没跑 supabase/ai.sql）';
    }
    paint(root, ctx);
  }

  async function send(root, ctx, text) {
    text = String(text || '').trim();
    if (!text || S.sending) return;
    S.sending = true;
    S.err = '';
    S.msgs.push({
      id: 'tmp-' + U.uid(), role: 'user', content: text,
      author: (ctx.me && ctx.me.name) || '我', kind: 'chat', created_at: new Date().toISOString()
    });
    if (inputEl) inputEl.value = '';
    paint(root, ctx);
    try {
      const res = await DB.ai.send(text, {});
      if (res && res.reply) {
        S.msgs.push({
          id: 'tmp-' + U.uid(), role: 'assistant', content: res.reply,
          author: ownerInfo(ctx).name, kind: res.kind || 'chat', created_at: new Date().toISOString()
        });
      }
      if (typeof res.remaining === 'number') S.remaining = res.remaining;
      if (res.warn) S.warn = res.warn;
    } catch (e) {
      S.err = e.message;
    }
    S.sending = false;
    paint(root, ctx);
  }

  /* 早上/晚上打开时，让分身主动说一句（一天只自动问候一次） */
  function greetSlot() {
    const h = new Date().getHours();
    if (h >= 5 && h < 11) return 'morning';
    if (h >= 21 || h < 2) return 'night';
    return '';
  }

  async function maybeGreet(root, ctx) {
    const slot = greetSlot();
    if (!slot || S.greeting === slot || S.sending || !S.loaded) return;
    const cfg = ctx.aiConfig || {};
    if (slot === 'morning' && cfg.greet_morning === false) return;
    if (slot === 'night' && cfg.greet_night === false) return;
    const today = dayKey(new Date());
    const has = S.msgs.some((m) => String(m.kind || '') === 'greeting-' + slot && dayKey(m.created_at) === today);
    if (has) { S.greeting = slot; return; }
    S.greeting = slot;
    S.sending = true;
    paint(root, ctx);
    try {
      const res = await DB.ai.send('', { mode: 'greeting', greeting: slot });
      if (res && res.reply) {
        S.msgs.push({
          id: 'tmp-' + U.uid(), role: 'assistant', content: res.reply,
          author: ownerInfo(ctx).name, kind: 'greeting-' + slot, created_at: new Date().toISOString()
        });
      }
    } catch (e) {
      S.greeting = '';                    // 问候失败就当作没发生，别打扰她
    }
    S.sending = false;
    paint(root, ctx);
  }

  function mount(root, ctx) {
    listEl = root.querySelector('#chat-list');
    inputEl = root.querySelector('#chat-input');
    formEl = root.querySelector('#chat-form');

    paint(root, ctx);

    // 头像加载失败（地址过期 / 本地缓存清掉了）→ 自动降级成文字头像
    root.addEventListener('error', (e) => {
      const img = e.target;
      if (!img || img.tagName !== 'IMG' || !img.parentNode) return;
      const box = img.parentNode;
      if (!box.classList || !box.classList.contains('chat__ava')) return;
      box.classList.add('chat__ava--txt');
      box.textContent = box.getAttribute('data-ch') || '我';
    }, true);

    if (formEl) {
      formEl.addEventListener('submit', (e) => { e.preventDefault(); send(root, ctx, inputEl ? inputEl.value : ''); });
    }
    if (inputEl) {
      inputEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
          e.preventDefault();
          send(root, ctx, inputEl.value);
        }
      });
      inputEl.addEventListener('input', () => {
        inputEl.style.height = 'auto';
        inputEl.style.height = Math.min(120, inputEl.scrollHeight) + 'px';
      });
    }

    root.addEventListener('click', async (e) => {
      const chip = e.target.closest('[data-ai-chip]');
      if (chip) { send(root, ctx, chip.getAttribute('data-ai-chip')); return; }

      const act = e.target.closest('[data-ai]');
      if (act) {
        const what = act.getAttribute('data-ai');
        if (what === 'settings') { location.hash = '#/settings'; return; }
        if (what === 'clear') {
          if (await U.confirmBox('把你们的聊天记录全部删掉？（两个人的都会没）', { title: '清空对话', okText: '清空', danger: true })) {
            try {
              await DB.ai.clear();
              S.msgs = [];
              S.loaded = true;
              S.remaining = null;
              U.toast('已经清空了', 'success');
              paint(root, ctx);
            } catch (err) { U.toast(err.message, 'error'); }
          }
          return;
        }
      }
    });

    // 先拿记录，再决定要不要自动问候
    load(root, ctx).then(() => { maybeGreet(root, ctx); });
  }

  return { render, mount, title: 'AI 分身' };
})();