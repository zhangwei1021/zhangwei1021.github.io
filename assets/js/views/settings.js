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

  /* ---------------- 播放列表（可以有好多首歌） ---------------- */
  let PL = [];                       // 当前编辑中的列表（保存时写回 settings.playlist）

  function playlistOf(s) {
    const list = ((s && s.playlist) || []).filter((t) => t && t.url);
    if (list.length) return list.map((t) => ({ url: t.url, title: t.title || '', artist: t.artist || '', cover: t.cover || '' }));
    const m = (s && s.music) || {};
    return m.url ? [{ url: m.url, title: m.title || '', artist: m.artist || '', cover: m.cover || '' }] : [];
  }

  function playlistHtml(pl) {
    if (!pl.length) {
      return '<div class="pl__empty">还没有歌 · 点下面的「添加一首」或「上传 mp3」，就能有好几首轮着放了</div>';
    }
    return pl.map((t, i) => `
      <div class="pl__row">
        <span class="pl__ico">${i === 0 ? '▶' : '♪'}</span>
        <div class="pl__main">
          <div class="pl__title">${esc(t.title || '未命名')}</div>
          <div class="pl__sub">${esc(t.artist ? t.artist + ' · ' : '')}${esc(String(t.url || '').slice(0, 60))}</div>
        </div>
        <button type="button" class="pl__btn" data-mus="top" data-i="${i}" title="放到第一位">⇧</button>
        <button type="button" class="pl__btn" data-mus="edit" data-i="${i}" title="改歌名 / 歌手">✏️</button>
        <button type="button" class="pl__btn" data-mus="del" data-i="${i}" title="删掉这首">🗑️</button>
      </div>`).join('');
  }

  /** 列表变了就只重画列表，别把整页重画（不然刚填的表单会丢） */
  function paintPl(root) {
    const box = root.querySelector('#pl-list');
    if (box) box.innerHTML = playlistHtml(PL);
  }

  function musFields(t) {
    return [
      { name: 'title', label: '歌名', type: 'text', value: (t && t.title) || '', placeholder: '例如：小情歌' },
      { name: 'artist', label: '歌手（可不填）', type: 'text', value: (t && t.artist) || '' },
      { name: 'url', label: '音乐地址（mp3 直链）', type: 'text', value: (t && t.url) || '', placeholder: 'https://.../song.mp3', required: true, hint: '也可以先点「上传 mp3」把文件传上来' }
    ];
  }

  function render(ctx) {
    const s = ctx.s || {};
    const t = window.Theme.normalize(s.theme);
    const m = Object.assign({}, (CFG.defaults || {}).music, s.music || {});
    const mode = ['loop', 'order', 'random', 'one'].indexOf(m.mode) >= 0 ? m.mode : 'loop';
    const pl = playlistOf(s);
    PL = pl.slice();
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
            <label class="field"><span class="field__label">播放方式</span>
              <select class="input" name="musicMode">
                <option value="loop" ${mode === 'loop' ? 'selected' : ''}>🔁 列表循环（放完回到第一首）</option>
                <option value="order" ${mode === 'order' ? 'selected' : ''}>➡️ 顺序播放（放完就停）</option>
                <option value="random" ${mode === 'random' ? 'selected' : ''}>🔀 随机播放</option>
                <option value="one" ${mode === 'one' ? 'selected' : ''}>🔂 单曲循环</option>
              </select></label>
            <label class="field"><span class="field__label">音量：<b data-vol-val>${Math.round((m.volume || 0.6) * 100)}</b>%</span>
              <input type="range" min="0" max="1" step="0.05" name="musicVolume" value="${m.volume || 0.6}" style="accent-color:var(--accent)"></label>
          </div>

          <div class="field__label" style="margin-top:12px">播放列表（可以有好多首，右下角小唱片点 ⏮ ⏭ 换歌）</div>
          <div class="pl" id="pl-list">${playlistHtml(pl)}</div>

          <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:10px">
            <button type="button" class="btn btn--ghost btn--sm" data-mus="add">＋ 添加一首（填网址）</button>
            <button type="button" class="btn btn--ghost btn--sm" data-mus="up-file">🎧 上传 mp3</button>
            <label class="check"><input type="checkbox" name="musicAutoplay" ${m.autoplay ? 'checked' : ''}> 打开网站自动播放</label>
            <span class="field__hint">自动播放常被手机浏览器拦截，建议让 TA 点一下右下角的小唱片</span>
          </div>
          <input type="file" accept="audio/*" id="mus-file" hidden>
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

      ${aiSection(ctx)}
    </section>`;
  }

  /* ---------------------------------------------------- AI 分身设置区 */
  function memRow(m) {
    return `<div class="mem">
      <div class="mem__main">
        <div class="mem__title">${esc(m.title || m.kind || '记忆')}${m.happened_on ? `<span class="mem__date">${esc(m.happened_on)}</span>` : ''}</div>
        ${m.content ? `<div class="mem__text">${esc(m.content)}</div>` : ''}
      </div>
      <div class="mem__tools">
        <button class="btn btn--ghost btn--sm" type="button" data-mem-edit="${esc(m.id)}">改</button>
        <button class="btn btn--ghost btn--sm" type="button" data-mem-del="${esc(m.id)}">删</button>
      </div>
    </div>`;
  }

  function aiSection(ctx) {
    const cloud = window.DB.isCloud();
    const c = Object.assign({}, window.DB.ai.defaults, ctx.aiConfig || {});
    const A = (ctx.settings && ctx.settings.nicknameA) || '我';
    const B = (ctx.settings && ctx.settings.nicknameB) || 'TA';
    const provs = (window.DB.ai && window.DB.ai.providers) || [{ id: 'deepseek', name: 'DeepSeek 官方', console: 'platform.deepseek.com', models: ['deepseek-flash'] }];
    const curProv = provs.filter((p) => p.id === c.provider)[0] || provs[0];
    const mems = (ctx.aiMemories || []).slice()
      .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
    const kinds = ['第一次', '称呼', '习惯', '纪念日', '家人朋友', '其他'];
    const curBuddy = (ctx.settings && ctx.settings.buddyImage) || 'assets/img/buddy-him.jpg';

    return `
      <div class="card card--pad set-sec" style="margin-top:22px">
        <h3 class="set-sec__title">💬 AI 分身</h3>
        <p class="field__hint" style="margin:-4px 0 12px">
          做一个「AI 版的 ${esc(A)}」，让 ${esc(B)} 打开 <b>AI 分身</b> 那一页就能跟他说说话。
          人设写得越像你，它就越像你；把你们的小事加进下面的「记忆」，它就照着这些回答，不会乱编。
        </p>
        ${cloud ? '' : `<div class="banner banner--info" style="margin-bottom:14px"><span>🛠️</span>
          <div>现在是<b>本地模式</b>：人设和记忆可以在这里先写好，但要真的能聊天，得先照
          <b>README 第八节</b>接上 Supabase（跑 ai.sql、配好模型钥匙、部署 ai-chat 函数）。</div></div>`}

        <form id="ai-form" autocomplete="off">
          <div class="set-grid">
            <label class="field"><span class="field__label">这个分身代表谁</span>
              <select class="input" name="aiOwner">
                <option value="A" ${c.owner === 'A' ? 'selected' : ''}>${esc(A)}（昵称 A）</option>
                <option value="B" ${c.owner === 'B' ? 'selected' : ''}>${esc(B)}（昵称 B）</option>
              </select></label>
            <label class="field"><span class="field__label">用哪家的模型</span>
              <select class="input" name="aiProvider" data-ai-provider>
                ${provs.map((p) => `<option value="${esc(p.id)}" ${p.id === curProv.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}
              </select>
              <span class="field__hint" data-ai-console>钥匙在 ${esc(curProv.console)} 创建，存进 Supabase 的 Secrets（README 第八节）</span></label>
            <label class="field"><span class="field__label">用哪个模型</span>
              <input class="input" name="aiModel" list="ai-model-list" value="${esc(c.model || curProv.models[0])}" placeholder="${esc(curProv.models[0])}">
              <datalist id="ai-model-list">${curProv.models.map((m) => `<option value="${esc(m)}"></option>`).join('')}</datalist>
              <span class="field__hint">下拉里是常用的几个，也可以自己手写模型名</span></label>
            <label class="field"><span class="field__label">每天最多聊几句（保护你的余额）</span>
              <input class="input" type="number" min="0" max="500" name="aiLimit" value="${Number(c.daily_limit) || 60}"></label>
          </div>

          <label class="field"><span class="field__label">人设：我是谁、我怎么说话</span>
            <textarea class="input" name="aiPersona" rows="6" placeholder="我是她的男朋友，说话像平时发微信那样，轻松、口语化，偶尔开个玩笑。她累的时候先心疼她，不要讲大道理。">${esc(c.persona || '')}</textarea></label>

          <label class="field"><span class="field__label">说话习惯：口头禅、怎么称呼她、不要说的话</span>
            <textarea class="input" name="aiStyle" rows="4" placeholder="口头禅：乖乖、好家伙&#10;怎么称呼她：宝贝、张张包&#10;不要说的话：别用「亲爱的用户」「作为 AI」这种腔调">${esc(c.style_notes || '')}</textarea></label>

          <div class="field">
            <span class="field__label">分身形象（聊天页顶上那个小人）</span>
            <div class="buddy-picks">
              <button type="button" class="buddy-pick ${curBuddy === 'assets/img/buddy-him.jpg' ? 'is-active' : ''}" data-buddy="assets/img/buddy-him.jpg" title="3D 童话">
                <img src="assets/img/buddy-him.jpg" alt="3D 童话"><span class="buddy-pick__name">3D 童话</span></button>
              <button type="button" class="buddy-pick ${curBuddy === 'assets/img/buddy-him-2d.jpg' ? 'is-active' : ''}" data-buddy="assets/img/buddy-him-2d.jpg" title="二次元">
                <img src="assets/img/buddy-him-2d.jpg" alt="二次元"><span class="buddy-pick__name">二次元</span></button>
              <button type="button" class="buddy-pick ${curBuddy === 'assets/img/buddy-him-soft.jpg' ? 'is-active' : ''}" data-buddy="assets/img/buddy-him-soft.jpg" title="小清新">
                <img src="assets/img/buddy-him-soft.jpg" alt="小清新"><span class="buddy-pick__name">小清新</span></button>
              <button type="button" class="buddy-pick ${curBuddy === 'svg' ? 'is-active' : ''}" data-buddy="svg" title="手绘小人">
                <span class="buddy-pick__svg">🧑‍🎨</span><span class="buddy-pick__name">手绘小人</span></button>
              <button type="button" class="buddy-pick" data-buddy-up title="用你自己的图片">
                <span class="buddy-pick__svg">＋</span><span class="buddy-pick__name">自己的图</span></button>
            </div>
            <span class="field__hint">点一下就换（会立刻保存，不用再点下面的保存按钮）</span>
          </div>

          <div style="display:flex;gap:16px;flex-wrap:wrap;margin:4px 0 12px">
            <label class="check"><input type="checkbox" name="aiEnabled" ${c.enabled !== false ? 'checked' : ''}> 开启 AI 分身</label>
            <label class="check"><input type="checkbox" name="aiMorning" ${c.greet_morning !== false ? 'checked' : ''}> 早上主动道早安</label>
            <label class="check"><input type="checkbox" name="aiNight" ${c.greet_night !== false ? 'checked' : ''}> 晚上主动道晚安</label>
          </div>

          <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center">
            <button class="btn btn--primary" type="submit">💾 保存分身设置</button>
            <button class="btn btn--ghost" type="button" data-ai-test>🔌 测试连接</button>
            <a class="btn btn--ghost" href="#/ai">去聊天看看 →</a>
            <span class="field__hint" id="ai-hint"></span>
          </div>
        </form>

        <div style="margin-top:22px;border-top:1px dashed var(--line);padding-top:16px">
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:10px">
            <b style="font-size:15px">🧠 记忆清单</b>
            <span class="field__hint">${mems.length} 条 · 分身只照着这些说，不会自己编</span>
            <button class="btn btn--ghost btn--sm" type="button" data-mem-new style="margin-left:auto">＋ 添加记忆</button>
          </div>
          ${mems.length
            ? `<div class="mem-list">${mems.map(memRow).join('')}</div>`
            : `<div class="field__hint">还没有记忆。建议先加几条，比如「她不吃香菜」「我们第一次见面在图书馆」「她生气的时候要先哄」。</div>`}
        </div>
      </div>`;
  }

  function readAi(form) {
    const c = form.elements;
    const prov = c.aiProvider ? c.aiProvider.value : 'deepseek';
    const def = ((window.DB.ai && window.DB.ai.providers) || []).filter((p) => p.id === prov)[0];
    const model = c.aiModel ? String(c.aiModel.value || '').trim() : '';
    return {
      owner: c.aiOwner ? c.aiOwner.value : 'A',
      provider: prov,
      model: model || (def ? def.models[0] : 'deepseek-flash'),
      daily_limit: Number(c.aiLimit ? c.aiLimit.value : 60) || 60,
      persona: c.aiPersona ? String(c.aiPersona.value || '').trim() : '',
      style_notes: c.aiStyle ? String(c.aiStyle.value || '').trim() : '',
      enabled: !!(c.aiEnabled && c.aiEnabled.checked),
      greet_morning: !!(c.aiMorning && c.aiMorning.checked),
      greet_night: !!(c.aiNight && c.aiNight.checked)
    };
  }

  /** 换服务商时：更新提示文字 + 把模型下拉换成这家的常用模型（当前模型不在列表里就换成第一家第一个） */
  function syncProviderPick(root) {
    const sel = root.querySelector('[data-ai-provider]');
    if (!sel) return;
    const provs = (window.DB.ai && window.DB.ai.providers) || [];
    const p = provs.filter((x) => x.id === sel.value)[0] || provs[0];
    if (!p) return;
    const hint = root.querySelector('[data-ai-console]');
    if (hint) hint.textContent = '钥匙在 ' + p.console + ' 创建，存进 Supabase 的 Secrets（README 第八节）';
    const list = root.querySelector('#ai-model-list');
    if (list) list.innerHTML = p.models.map((m) => `<option value="${esc(m)}"></option>`).join('');
    const input = root.querySelector('[name="aiModel"]');
    if (input) {
      input.placeholder = p.models[0];
      if (p.models.indexOf(input.value) < 0) input.value = p.models[0];
    }
  }

  async function saveAi(form) {
    const patch = readAi(form);
    await window.DB.ai.config.save(patch);
    if (window.App && window.App.state) {
      window.App.state.aiConfig = Object.assign({}, window.App.state.aiConfig || {}, patch);
    }
    return patch;
  }

  function memFields(m) {
    return [
      { name: 'title', label: '一句话标题', value: (m && m.title) || '', placeholder: '她不吃香菜', required: true },
      { name: 'kind', label: '分类', type: 'select', value: (m && m.kind) || '习惯',
        options: ['第一次', '称呼', '习惯', '纪念日', '家人朋友', '其他'].map((k) => ({ value: k, label: k })) },
      { name: 'content', label: '具体内容', type: 'textarea', rows: 3,
        value: (m && m.content) || '', placeholder: '点菜的时候记得说不要香菜' },
      { name: 'happened_on', label: '发生日期（可以空着）', type: 'date', value: (m && m.happened_on) || '' }
    ];
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
        url: (PL[0] && PL[0].url) || '',
        title: (PL[0] && PL[0].title) || '',
        artist: (PL[0] && PL[0].artist) || '',
        autoplay: !!(form.elements.musicAutoplay && form.elements.musicAutoplay.checked),
        volume: Number(v('musicVolume')),
        mode: v('musicMode') || 'loop',
        cover: (themeNow.cover !== undefined ? themeNow.cover : ((CFG.defaults.music || {}).cover || ''))
      },
      playlist: PL.map((t) => ({ url: t.url, title: t.title || '', artist: t.artist || '', cover: t.cover || '' }))
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
              PL.push({ url: url, title: f.name.replace(/\.[^.]+$/, ''), artist: '', cover: '' });
              paintPl(root);
              U.toast('加进播放列表了，记得点保存', 'success');
              up.textContent = '🎧 上传 mp3'; up.disabled = false;
              return;
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

    /* --------------------------------------------------- AI 分身设置区 */
    const aiForm = root.querySelector('#ai-form');
    if (aiForm) {
      const aiHint = (msg, ok) => {
        const el = root.querySelector('#ai-hint');
        if (el) { el.textContent = msg; el.style.color = ok === false ? 'var(--danger, #d33)' : ''; }
      };
      const memById = (id) => (ctx.aiMemories || []).find((m) => String(m.id) === String(id));

      const provPick = root.querySelector('[data-ai-provider]');
      if (provPick) provPick.addEventListener('change', () => syncProviderPick(root));

      aiForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = aiForm.querySelector('button[type="submit"]');
        btn.disabled = true; btn.textContent = '保存中…';
        try {
          await saveAi(aiForm);
          aiHint('已保存 ✓ 去上面「去聊天看看」试试', true);
          U.toast('分身设置已保存 💗', 'success');
        } catch (err) { aiHint(err.message, false); U.toast(err.message, 'error'); }
        btn.disabled = false; btn.textContent = '💾 保存分身设置';
      });

      root.addEventListener('click', async (e) => {
        const bp = e.target.closest('[data-buddy]');
        if (bp) {
          const v = bp.getAttribute('data-buddy');
          try {
            await window.DB.settings.patch({ buddyImage: v });
            if (window.App && window.App.state && window.App.state.s) window.App.state.s.buddyImage = v;
            root.querySelectorAll('[data-buddy]').forEach((b) => b.classList.toggle('is-active', b === bp));
            U.toast('分身形象换好了 💗', 'success');
          } catch (err) { U.toast(err.message, 'error'); }
          return;
        }

        const bup = e.target.closest('[data-buddy-up]');
        if (bup) {
          const inp = document.createElement('input');
          inp.type = 'file'; inp.accept = 'image/*';
          inp.onchange = async () => {
            const f = inp.files && inp.files[0];
            if (!f) return;
            try {
              U.toast('形象上传中…');
              const url = await window.DB.media.upload(f, 'avatar');
              await window.DB.settings.patch({ buddyImage: url });
              if (window.App && window.App.state && window.App.state.s) window.App.state.s.buddyImage = url;
              U.toast('换好啦，去「AI 分身」页看看 💗', 'success');
            } catch (err) { U.toast(err.message, 'error'); }
          };
          inp.click();
          return;
        }

        const testBtn = e.target.closest('[data-ai-test]');
        if (testBtn) {
          testBtn.disabled = true;
          aiHint('正在测试…');
          try {
            await saveAi(aiForm);
            const r = await window.DB.ai.send('', { mode: 'ping' });
            aiHint('✅ 通了！' + (r.providerName ? r.providerName + ' · ' : '') + '模型 ' + r.model
              + '，今天已经聊了 ' + r.messagesToday + ' 句'
              + (r.enabled === false ? '（不过总开关现在是关着的）' : ''), true);
          } catch (err) { aiHint('❌ ' + err.message, false); }
          testBtn.disabled = false;
          return;
        }

        if (e.target.closest('[data-mem-new]')) {
          const r = await U.formBox('加一条记忆', memFields(null), { okText: '添加' });
          if (!r) return;
          try {
            await saveAi(aiForm);
            await window.DB.ai.memories.add({ kind: r.kind, title: r.title, content: r.content, happened_on: r.happened_on || null });
            U.toast('记下了 💗', 'success');
            window.App.refresh();
          } catch (err) { U.toast(err.message, 'error'); }
          return;
        }

        const ed = e.target.closest('[data-mem-edit]');
        if (ed) {
          const m = memById(ed.getAttribute('data-mem-edit'));
          if (!m) return;
          const r = await U.formBox('改这条记忆', memFields(m), { okText: '保存' });
          if (!r) return;
          try {
            await saveAi(aiForm);
            await window.DB.ai.memories.patch(m.id, { kind: r.kind, title: r.title, content: r.content, happened_on: r.happened_on || null });
            U.toast('改好了', 'success');
            window.App.refresh();
          } catch (err) { U.toast(err.message, 'error'); }
          return;
        }

        const del = e.target.closest('[data-mem-del]');
        if (del) {
          const m = memById(del.getAttribute('data-mem-del'));
          if (!m) return;
          if (!(await U.confirmBox('删掉这条记忆？', { title: '删除', danger: true }))) return;
          try {
            await window.DB.ai.memories.remove(m.id);
            U.toast('删掉了', 'success');
            window.App.refresh();
          } catch (err) { U.toast(err.message, 'error'); }
        }
      });
    }

    /* --------------------------------------------------- 播放列表 */
    root.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-mus]');
      if (!b) return;
      const what = b.getAttribute('data-mus');
      const i = Number(b.getAttribute('data-i') || 0);

      if (what === 'add') {
        const r = await U.formBox('添加一首歌', musFields(null), { okText: '加进列表' });
        if (!r || !r.url) return;
        PL.push({ url: String(r.url).trim(), title: String(r.title || '').trim(), artist: String(r.artist || '').trim(), cover: '' });
        paintPl(root);
        U.toast('加进去了，记得点「保存设置」', 'success');
        return;
      }

      if (what === 'up-file') {
        const inp = root.querySelector('#mus-file');
        if (!inp) return;
        inp.onchange = async () => {
          const f = inp.files && inp.files[0];
          if (!f) return;
          try {
            U.toast('上传中…');
            const url = await window.DB.media.upload(f, 'music');
            PL.push({ url: url, title: f.name.replace(/\.[^.]+$/, ''), artist: '', cover: '' });
            paintPl(root);
            U.toast('加进播放列表了，记得点「保存设置」', 'success');
          } catch (err) { U.toast(err.message, 'error'); }
          inp.value = '';
        };
        inp.click();
        return;
      }

      if (what === 'edit') {
        if (!PL[i]) return;
        const r = await U.formBox('改这首歌', musFields(PL[i]), { okText: '保存' });
        if (!r || !r.url) return;
        PL[i] = { url: String(r.url).trim(), title: String(r.title || '').trim(), artist: String(r.artist || '').trim(), cover: PL[i].cover || '' };
        paintPl(root);
        return;
      }

      if (what === 'del') {
        if (!PL[i]) return;
        if (!(await U.confirmBox('把《' + (PL[i].title || '未命名') + '》从播放列表里删掉？', { title: '移出列表', okText: '删掉', danger: true }))) return;
        PL.splice(i, 1);
        paintPl(root);
        U.toast('移出去了，记得点「保存设置」', 'success');
        return;
      }

      if (what === 'top') {
        if (!PL[i] || i === 0) return;
        const one = PL.splice(i, 1)[0];
        PL.unshift(one);
        paintPl(root);
      }
    });

    preview(form);
  }

  return { render, mount, title: '设置' };
})();