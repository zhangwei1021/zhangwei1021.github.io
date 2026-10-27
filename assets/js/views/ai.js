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
    talkingUntil: 0,   // 刚说完话 → 卡通分身的嘴巴动一会儿
    greeting: ''       // 已经自动问候过哪种（本轮页面生命周期内不再重复）
  };

  const CHIPS = ['今天想你了', '今天有点累', '夸夸我', '你在干嘛呀'];

  /* ======================= 会动的卡通分身 =======================
   * 照着他的样子画的：黑短发 + 细框眼镜 + 灰T恤 + 背包带
   * 全部是网页里画的（SVG + CSS 动画），不依赖任何外部服务
   * ============================================================ */
  const MOODS = [
    { id: 'love', re: /想你|想我|抱抱|抱一下|亲亲|么么|爱你|喜欢你|宝贝|乖/ },
    { id: 'happy', re: /哈哈|开心|太好|真棒|嘿嘿|笑|耶|走起/ },
    { id: 'shy', re: /害羞|脸红|讨厌|别闹|不好意思|坏蛋/ },
    { id: 'soft', re: /累|难过|不开心|委屈|别哭|没事|我在|心疼/ }
  ];

  function moodOf(text) {
    const t = String(text || '');
    for (let i = 0; i < MOODS.length; i++) if (MOODS[i].re.test(t)) return MOODS[i].id;
    return 'calm';
  }

  /* 分身形象：一张图片（默认用照他照片生成的那张 Q 版小人），头像用同一张图的脸部特写 */
  const BUDDY_DEFAULT = 'assets/img/buddy-pixar.jpg';
  const BUDDY_FACE = 'assets/img/buddy-pixar-face.jpg';

  function buddyPic(ctx) {
    const v = s(ctx).buddyImage;
    if (v === 'svg') return '';
    if (v) return v;
    return BUDDY_DEFAULT;
  }

  /* 需要一张静态图时（聊天气泡头像、封面…）：默认形象就用脸部特写，小圆头像里也看得清 */
  function buddyImage(ctx) {
    const p = buddyPic(ctx);
    if (!p) return '';
    return p === BUDDY_DEFAULT ? BUDDY_FACE : p;
  }

  function buddySvg() {
    return `
      <svg class="buddy__svg" viewBox="0 0 200 214" role="img" aria-label="AI 分身">
        <!-- 书包带 + 灰 T 恤 -->
        <g class="buddy__body">
          <path class="buddy__shirt" d="M52 214 v-38 c0 -17 21 -27 48 -27 s48 10 48 27 v38 z"/>
          <path class="buddy__collar" d="M86 152 q14 13 28 0"/>
          <rect class="buddy__strap" x="69" y="150" width="15" height="64" rx="7.5"/>
          <rect class="buddy__strap" x="116" y="150" width="15" height="64" rx="7.5"/>
        </g>
        <!-- 头 -->
        <g class="buddy__head">
          <rect class="buddy__neck" x="89" y="124" width="22" height="30" rx="10"/>
          <ellipse class="buddy__ear" cx="58" cy="98" rx="7" ry="10"/>
          <ellipse class="buddy__ear" cx="142" cy="98" rx="7" ry="10"/>
          <path class="buddy__face" d="M58 92 C58 54 76 38 100 38 C124 38 142 54 142 92 C142 122 124 148 100 148 C76 148 58 122 58 92 Z"/>
          <ellipse class="buddy__blush" cx="70" cy="119" rx="10" ry="5.5"/>
          <ellipse class="buddy__blush" cx="130" cy="119" rx="10" ry="5.5"/>
          <path class="buddy__hair" d="M53 90 C50 50 74 30 100 30 C128 30 150 50 146 90 C142 76 138 68 132 63 C120 58 96 66 86 60 C74 65 60 74 53 90 Z"/>
          <path class="buddy__brow" d="M66 81 q14 -8 28 -2"/>
          <path class="buddy__brow" d="M106 79 q14 -6 28 2"/>
          <g class="buddy__eyes buddy__eyes--normal">
            <circle class="buddy__pupil" cx="80" cy="103" r="6"/>
            <circle class="buddy__pupil" cx="120" cy="103" r="6"/>
            <circle class="buddy__shine" cx="82" cy="100.5" r="2"/>
            <circle class="buddy__shine" cx="122" cy="100.5" r="2"/>
          </g>
          <g class="buddy__eyes buddy__eyes--happy">
            <path d="M71 105 q9 -13 18 0"/>
            <path d="M111 105 q9 -13 18 0"/>
          </g>
          <rect class="buddy__lid" x="67" y="88" width="26" height="26" rx="8"/>
          <rect class="buddy__lid" x="107" y="88" width="26" height="26" rx="8"/>
          <g class="buddy__glasses">
            <rect x="60" y="88" width="38" height="32" rx="10"/>
            <rect x="102" y="88" width="38" height="32" rx="10"/>
            <path d="M98 101 h4"/>
            <path d="M60 99 L51 95"/>
            <path d="M140 99 L149 95"/>
          </g>
          <path class="buddy__nose" d="M100 112 q4 6 -1 8"/>
          <g class="buddy__mouths">
            <path class="buddy__mouth buddy__mouth--closed" d="M92 126 q8 6 16 0"/>
            <path class="buddy__mouth buddy__mouth--smile" d="M86 122 Q100 143 114 122 Q100 130 86 122 Z"/>
            <g class="buddy__mouth buddy__mouth--open">
              <ellipse cx="100" cy="128" rx="9.5" ry="7.5"/>
              <ellipse class="buddy__tongue" cx="100" cy="131" rx="5" ry="2.8"/>
            </g>
          </g>
        </g>
        <path class="buddy__heart" d="M156 62 c-5 -9 -16 -6 -16 3 c0 7 9 12 16 19 c7 -7 16 -12 16 -19 c0 -9 -11 -12 -16 -3 z"/>
      </svg>`;
  }

  function buddyHtml(name, pic) {
    const p = pic === undefined ? BUDDY_DEFAULT : pic;
    const inner = p ? `<img class="buddy__pic" src="${esc(p)}" alt="${esc(name)} 的形象">` : '';
    return `
      <div class="card buddy-card">
        <div class="buddy is-idle mood-calm ${p ? 'has-pic' : 'no-pic'}" id="ai-buddy">
          <div class="buddy__stage">
            ${inner}
            ${p ? '' : buddySvg()}
            <span class="buddy__hearts" aria-hidden="true"><i>💗</i><i>💗</i></span>
            <div class="buddy__think" aria-hidden="true"><i></i><i></i><i></i></div>
          </div>
          <div class="buddy__side">
            <div class="buddy__name">
              <span class="buddy__live"></span>${esc(name)} 的分身
              <span class="buddy__status" id="buddy-status">在线</span>
            </div>
            <div class="buddy__bubble" id="buddy-bubble">我在呢，想说什么就说～</div>
          </div>
        </div>
      </div>`;
  }

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

  /** 当前登录的人是不是「分身代表的那个人」本身（他只能看，不能聊） */
  function isOwner(ctx) {
    const oi = ownerInfo(ctx);
    return !!(ctx.canEdit && ctx.me && ctx.me.key && ctx.me.key === oi.owner);
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
    // 分身说的话在左边，头像就用他的卡通形象（没配图时退回昵称头像）
    const avatar = mine ? ((ctx.me && ctx.me.avatar) || '') : (buddyImage(ctx) || oi.avatar);
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
          <b>还差几步才能开始聊天。</b><br>
          AI 分身需要一个「中间人」替你保管模型钥匙（不然会被别人偷走），
          所以它只在<b>云端模式</b>下能用。照着 <b>README 第八节</b> 做一遍就好：
          <ol style="margin:8px 0 0 18px;line-height:1.9">
            <li>Supabase → SQL Editor → 跑一次 <b>supabase/ai.sql</b>（想让分身一开口就像他，再跑一次 <b>supabase/ai-persona.sql</b>）</li>
            <li>Edge Functions → Secrets 里加钥匙：百炼用 <b>DASHSCOPE_API_KEY</b>，DeepSeek 用 <b>DEEPSEEK_API_KEY</b></li>
            <li>Edge Functions → 建一个叫 <b>ai-chat</b> 的函数，把我写好的代码粘进去</li>
            <li>在 <a href="#/settings">设置 → AI 分身</a> 里选「用哪家的模型」、写上人设，然后回到这一页</li>
          </ol>
        </div></div>
        ${buddyHtml(ownerInfo(ctx).name, buddyPic(ctx))}
        <p class="section__desc" style="text-align:center">上面这个形象是照着他的样子生成的，配置完他就会动起来跟你说话 💗</p>
      </section>`;
    }

    const oi = ownerInfo(ctx);
    const cfg = ctx.aiConfig || {};

    /* ---- 他本人打开：只看她和分身的聊天记录（只读） ---- */
    if (isOwner(ctx)) {
      const todayKey = dayKey(new Date());
      const today = S.msgs.filter((m) => dayKey(m.created_at) === todayKey).length;
      return `
      <section class="section">
        <div class="section__head">
          <h2 class="section__title">👀 ${esc(oi.herName)} 和你的 AI 分身聊了什么</h2>
          <p class="section__desc">她能聊，你只能看 · 这里是完整对话（共 ${S.msgs.length} 条${today ? '，今天 ' + today + ' 条' : ''}）</p>
          <div class="section__actions">
            <button class="btn btn--ghost btn--sm" data-ai="reload">🔄 刷新</button>
            <button class="btn btn--ghost btn--sm" data-ai="settings">⚙️ 改人设和记忆</button>
          </div>
        </div>

        <div class="banner banner--info"><span>🤫</span><div>
          这一页只有你能看到：<b>${esc(oi.herName)}</b> 在她的账号里跟你的分身说了什么，这里都会出现。
          想让她收到更像你的回答，就去 <a href="#/settings">设置 → AI 分身</a> 补人设和记忆。
        </div></div>
        ${cfg.enabled === false ? '<div class="banner banner--warn"><span>⏸️</span><div>分身现在被关掉了（设置 → AI 分身 → 总开关），她那边也聊不了。</div></div>' : ''}
        <div id="ai-err"></div>

        ${buddyHtml(oi.name, buddyPic(ctx))}

        <div class="card chat">
          <div class="chat__list" id="chat-list">${listHtml(ctx)}</div>
          <div class="chat__foot">
            <div class="chat__note">🔒 只读模式：消息只能由她在自己的账号里发出，你这边改不了也删不掉。</div>
          </div>
        </div>
      </section>`;
    }

    return `
    <section class="section">
      <div class="section__head">
        <h2 class="section__title">💬 和 ${esc(oi.name)} 的 AI 分身聊聊</h2>
        <p class="section__desc">${esc(oi.name)} 不在的时候，也可以跟他的分身说说话</p>
        <div class="section__actions">
          <button class="btn btn--ghost btn--sm" data-ai="settings">⚙️ 改人设和记忆</button>
          ${S.msgs.length ? '<button class="btn btn--ghost btn--sm" data-ai="clear">🧹 清空对话</button>' : ''}
        </div>
      </div>

      ${cfg.enabled === false ? '<div class="banner banner--warn"><span>⏸️</span><div>分身现在被关掉了（设置 → AI 分身 → 总开关）。</div></div>' : ''}
      <div id="ai-warn"></div>
      <div id="ai-err"></div>

      ${buddyHtml(oi.name, buddyPic(ctx))}

      <div class="card chat">
        <div class="chat__list" id="chat-list">${listHtml(ctx)}${typingHtml()}</div>
        <form class="chat__form" id="chat-form">
          <textarea class="input chat__input" id="chat-input" rows="1"
            placeholder="想说什么就说什么…（Enter 发送，Shift+Enter 换行）"></textarea>
          <button class="btn btn--primary chat__send" type="submit" id="chat-send">发送</button>
        </form>
        <div class="chat__foot">
          <div class="chat__chips">${CHIPS.map((c) => `<button class="chat__chip" data-ai-chip="${esc(c)}">${esc(c)}</button>`).join('')}</div>
          <div class="chat__note" id="chat-note">💡 这是 AI 分身，说得不像的地方，去「设置 → AI 分身」改人设和记忆就好；他本人在自己的账号里能看到这里的全部对话。</div>
        </div>
      </div>
    </section>`;
  }

  /* --------------------------------------------------------------- 画面刷新 */
  let listEl = null, inputEl = null, formEl = null, buddyEl = null, talkTimer = null;

  function lastAiMsg() {
    for (let i = S.msgs.length - 1; i >= 0; i--) if (S.msgs[i].role === 'assistant') return S.msgs[i];
    return null;
  }

  /* 卡通分身：呼吸、眨眼、歪头都在 CSS 里；这里只管「在想 / 在说 / 什么心情」 */
  /** 说完一句话，小人原地蹦一下（照片版才有） */
  function hopBuddy() {
    const img = buddyEl && buddyEl.querySelector('.buddy__pic');
    if (!img) return;
    img.classList.remove('is-hop');
    void img.offsetWidth;                       // 强制重排，动画才会重新播
    img.classList.add('is-hop');
    setTimeout(() => img.classList.remove('is-hop'), 760);
  }

  function paintBuddy(root, ctx) {
    if (!buddyEl || !document.body.contains(buddyEl)) buddyEl = (root || document).querySelector('#ai-buddy');
    const el = buddyEl;
    if (!el) return;
    const last = lastAiMsg();
    const now = Date.now();
    const wasThinking = !!S.sending;
    const talking = !S.sending && S.talkingUntil > now;
    el.classList.toggle('is-thinking', !!S.sending);
    el.classList.toggle('is-talking', talking);
    el.classList.toggle('is-idle', !S.sending && !talking);

    const mood = S.sending ? 'calm' : moodOf(last ? last.content : '');
    ['calm', 'love', 'happy', 'shy', 'soft'].forEach((m) => el.classList.toggle('mood-' + m, m === mood));

    // 从「正在想」变成「说话」的那一下：蹦一下，像真的在回应你
    if (wasThinking && !S.sending && talking) hopBuddy();

    const statusEl = el.querySelector('#buddy-status');
    if (statusEl) statusEl.textContent = S.sending ? '正在想…' : '在线';
    const bub = el.querySelector('#buddy-bubble');
    if (bub) {
      let text;
      if (S.sending) text = '让我想想怎么说…';
      else if (last) text = String(last.content || '').replace(/\s+/g, ' ').slice(0, 78);
      else text = '我在呢，想说什么就说～';
      if (bub.textContent !== text) bub.textContent = text;
    }

    if (talking && !talkTimer) {
      talkTimer = setTimeout(() => { talkTimer = null; paintBuddy(root, ctx); }, S.talkingUntil - now + 40);
    }
  }

  function paint(root, ctx) {
    root = root || document;
    paintBuddy(root, ctx);
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
        S.talkingUntil = Date.now() + 3600;
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
        S.talkingUntil = Date.now() + 3600;
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
    buddyEl = root.querySelector('#ai-buddy');

    paint(root, ctx);

    // 头像加载失败（地址过期 / 本地缓存清掉了）→ 自动降级成文字头像
    root.addEventListener('error', (e) => {
      const img = e.target;
      if (!img || img.tagName !== 'IMG' || !img.parentNode) return;
      if (img.classList && img.classList.contains('buddy__pic')) {
        const b = img.closest('#ai-buddy');          // 卡通形象没加载出来 → 退回手绘小人
        if (b) b.classList.add('pic-fail');
        return;
      }
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
        if (what === 'reload') {
          S.loaded = false; S.msgs = [];
          paint(root, ctx);
          await load(root, ctx);
          U.toast('已是最新 ✓', 'success');
          return;
        }
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

    // 先拿记录，再决定要不要自动问候（他本人的只读页面不触发问候）
    load(root, ctx).then(() => { if (!isOwner(ctx)) maybeGreet(root, ctx); });

    return () => {
      if (talkTimer) { clearTimeout(talkTimer); talkTimer = null; }
    };
  }

  return { render, mount, title: 'AI 分身', buddyHtml, buddySvg, moodOf, buddyPic, buddyImage };
})();