/* =========================================================================
 *  数据层：本地模式(localStorage + IndexedDB) / 云端模式(Supabase)
 *  两种模式对外暴露完全一样的 API，页面代码不用关心数据存在哪。
 * ========================================================================= */
window.DB = (function () {
  'use strict';
  const CFG = window.APP_CONFIG;
  const U = window.U;

  const LS = {
    settings: 'love.settings',
    photos: 'love.photos',
    diary: 'love.diary',
    notes: 'love.notes',
    wishes: 'love.wishes',
    events: 'love.events',
    pokes: 'love.pokes',
    identity: 'love.identity',
    aiConfig: 'love.ai.config',
    aiMemories: 'love.ai.memories',
    aiMessages: 'love.ai.messages',
    trips: 'love.trips',
    blessings: 'love.blessings'
  };
  const TABLES = ['settings', 'photos', 'diary_entries', 'notes', 'wishes', 'events', 'pokes', 'ai_messages', 'trips', 'blessings'];

  let sb = null;                 // supabase client
  let mode = 'local';
  let ready = null;
  let cdnFailed = false;
  const changeHandlers = new Set();
  const urlCache = new Map();    // 本地模式：path -> objectURL

  /* ------------------------------------------------------------------ 工具 */
  const lsGet = (k, dflt) => {
    try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : dflt; }
    catch (e) { return dflt; }
  };
  const lsSet = (k, v) => {
    try { localStorage.setItem(k, JSON.stringify(v)); return true; }
    catch (e) { U.toast('本地存储空间不足，请先接入 Supabase 云端模式', 'error'); return false; }
  };

  function deepMerge(base, patch) {
    const out = Object.assign({}, base);
    Object.keys(patch || {}).forEach((k) => {
      const pv = patch[k];
      const bv = base[k];
      if (pv && bv && typeof pv === 'object' && typeof bv === 'object' && !Array.isArray(pv) && !Array.isArray(bv)) {
        out[k] = Object.assign({}, bv, pv);
      } else if (pv !== undefined) {
        out[k] = pv;
      }
    });
    return out;
  }

  function emit(table) {
    changeHandlers.forEach((fn) => { try { fn(table); } catch (e) { console.warn(e); } });
  }

  /* -------------------------------------------------------------- 初始化 */
  function init() {
    if (ready) return ready;
    ready = (async () => {
      const hasCfg = !!(CFG.supabaseUrl && CFG.supabaseAnonKey &&
        /^https?:\/\//.test(CFG.supabaseUrl) && !/your-project|example\.com/.test(CFG.supabaseUrl));
      if (!hasCfg) { mode = 'local'; console.info('[DB] 本地模式：config.js 未填写 Supabase 配置'); return { mode }; }

      if (window.__SUPABASE_READY) await window.__SUPABASE_READY;
      if (!window.supabase || !window.supabase.createClient) {
        cdnFailed = true;
        mode = 'local';
        console.warn('[DB] Supabase SDK 加载失败，已回退本地模式');
        return { mode, cdnFailed };
      }
      sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      });
      mode = 'cloud';
      sb.auth.onAuthStateChange(() => emit('auth'));
      subscribeRealtime();
      return { mode };
    })();
    return ready;
  }

  function subscribeRealtime() {
    if (!sb || !sb.channel) return;
    let ch = sb.channel('love-site-sync');
    TABLES.forEach((t) => {
      ch = ch.on('postgres_changes', { event: '*', schema: 'public', table: t }, () => queueEmit(t));
    });
    ch.subscribe((status) => { if (status === 'CHANNEL_ERROR') console.warn('[DB] 实时通道异常'); });
  }
  const pending = new Set();
  const flushEmit = U.debounce(() => {
    const list = Array.from(pending); pending.clear();
    list.forEach((t) => emit(t));
  }, 350);
  function queueEmit(t) { pending.add(t); flushEmit(); }

  const isCloud = () => mode === 'cloud';
  const client = () => sb;
  const bucket = (kind) => (kind === 'photo' ? CFG.photoBucket || 'photos' : CFG.mediaBucket || 'media');
  const publicUrl = (b, path) =>
    sb.storage.from(b).getPublicUrl(path).data.publicUrl;

  /* ------------------------------------------------------------------ 认证 */
  const auth = {
    async getUser() {
      if (!isCloud()) return { id: 'local', email: 'local@browser', local: true };
      const { data } = await sb.auth.getUser();
      return data && data.user ? { id: data.user.id, email: data.user.email } : null;
    },
    async signIn(email, password) {
      const { data, error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw new Error(translateAuthError(error.message));
      return data.user;
    },
    async signOut() { if (isCloud()) await sb.auth.signOut(); },
    async updatePassword(password) {
      const { error } = await sb.auth.updateUser({ password });
      if (error) throw new Error(translateAuthError(error.message));
    },
    onAuth(cb) { changeHandlers.add((t) => { if (t === 'auth') cb(); }); }
  };

  function translateAuthError(msg) {
    const m = String(msg || '');
    if (/Invalid login credentials/i.test(m)) return '邮箱或密码不对，再试一次';
    if (/Email not confirmed/i.test(m)) return '邮箱还没验证：去 Supabase → Authentication → Users 里把该用户设为已确认';
    if (/rate limit|Too many/i.test(m)) return '尝试太频繁了，等一分钟再试';
    return m;
  }

  /* -------------------------------------------------------------- 当前身份 */
  const identity = {
    get() { return lsGet(LS.identity, null); },
    set(v) { lsSet(LS.identity, v); },
    clear() { localStorage.removeItem(LS.identity); }
  };

  async function me() {
    const s = await settings.get();
    const who = identity.get();
    if (who === 'A') return { key: 'A', name: s.nicknameA || '我', avatar: s.avatarA };
    if (who === 'B') return { key: 'B', name: s.nicknameB || 'TA', avatar: s.avatarB };
    const u = await auth.getUser();
    const name = u && u.email ? u.email.split('@')[0] : '我';
    return { key: null, name, avatar: '' };
  }

  /* ------------------------------------------------------------------ 设置 */
  const settings = {
    async get() {
      const dflt = JSON.parse(JSON.stringify(CFG.defaults));
      if (!isCloud()) return deepMerge(dflt, lsGet(LS.settings, {}));
      const { data, error } = await sb.from('settings').select('key,value');
      if (error) { console.warn(error); return dflt; }
      const obj = {};
      (data || []).forEach((r) => { obj[r.key] = r.value; });
      return deepMerge(dflt, obj);
    },
    async patch(patch) {
      if (!isCloud()) {
        lsSet(LS.settings, deepMerge(lsGet(LS.settings, {}), patch));
        emit('settings');
        return;
      }
      const rows = Object.keys(patch).map((k) => ({
        key: k, value: patch[k], updated_at: new Date().toISOString()
      }));
      const { error } = await sb.from('settings').upsert(rows, { onConflict: 'key' });
      if (error) throw new Error('设置保存失败：' + error.message);
      emit('settings');
    }
  };

  /* ------------------------------------------------------------------ 照片 */
  const photos = {
    async list() {
      if (!isCloud()) {
        const arr = lsGet(LS.photos, []);
        for (const p of arr) p.src = await localBlobUrl(p.path);
        return arr.sort(byNewest);
      }
      const { data, error } = await sb.from('photos').select('*').order('created_at', { ascending: false });
      if (error) throw new Error('读取照片失败：' + error.message);
      return (data || []).map((p) => (p.src = publicUrl(bucket('photo'), p.path), p));
    },

    /** 上传一张照片；file 为 File，meta = {caption, taken_at, tags, author, city, province} */
    async add(file, meta, onStep) {
      const m = Object.assign({ caption: '', taken_at: U.todayStr(), tags: [], author: '', city: '', province: '' }, meta || {});
      const { blob, width, height } = await U.compressImage(file);
      if (onStep) onStep('compressing');
      const ext = /png$/i.test(blob.type) ? 'png' : (/webp$/i.test(blob.type) ? 'webp' : 'jpg');
      const d = new Date();
      const path = `${d.getFullYear()}${U.pad(d.getMonth() + 1)}/${U.uid()}.${ext}`;

      if (!isCloud()) {
        await IDB.put('photo:' + path, blob);
        const row = {
          id: U.uid(), path, caption: m.caption, taken_at: m.taken_at,
          tags: m.tags || [], author: m.author, is_home: false, is_cover: false,
          city: m.city || '', province: m.province || '',
          width, height, created_at: new Date().toISOString()
        };
        const arr = lsGet(LS.photos, []);
        arr.push(row);
        if (!lsSet(LS.photos, arr)) return null;
        row.src = await localBlobUrl(path);
        emit('photos');
        return row;
      }

      if (onStep) onStep('uploading');
      const { error: upErr } = await sb.storage.from(bucket('photo')).upload(path, blob, {
        contentType: blob.type || 'image/jpeg', cacheControl: '31536000', upsert: false
      });
      if (upErr) throw new Error('上传失败：' + upErr.message);
      const row = {
        path, caption: m.caption, taken_at: m.taken_at || null,
        tags: m.tags || [], author: m.author, width, height,
        city: m.city || null, province: m.province || null
      };
      const { data, error } = await sb.from('photos').insert(row).select().single();
      if (error) throw new Error('保存记录失败：' + error.message);
      emit('photos');
      data.src = publicUrl(bucket('photo'), data.path);
      return data;
    },

    async patch(id, patch) {
      if (!isCloud()) {
        const arr = lsGet(LS.photos, []);
        const i = arr.findIndex((p) => p.id === id);
        if (i >= 0) { arr[i] = Object.assign(arr[i], patch); lsSet(LS.photos, arr); emit('photos'); }
        return;
      }
      const { error } = await sb.from('photos').update(patch).eq('id', id);
      if (error) throw new Error('保存失败：' + error.message);
      emit('photos');
    },

    async remove(photo) {
      if (!isCloud()) {
        await IDB.del('photo:' + photo.path);
        lsSet(LS.photos, lsGet(LS.photos, []).filter((p) => p.id !== photo.id));
        emit('photos');
        return;
      }
      await sb.storage.from(bucket('photo')).remove([photo.path]);
      const { error } = await sb.from('photos').delete().eq('id', photo.id);
      if (error) throw new Error('删除失败：' + error.message);
      emit('photos');
    },

    async allTags() {
      const list = await photos.list();
      const set = new Set();
      list.forEach((p) => (p.tags || []).forEach((t) => set.add(t)));
      return Array.from(set);
    }
  };

  function byNewest(a, b) {
    const ka = (a.taken_at || '') + '|' + (a.created_at || '');
    const kb = (b.taken_at || '') + '|' + (b.created_at || '');
    return kb.localeCompare(ka);
  }

  async function localBlobUrl(path) {
    if (urlCache.has(path)) return urlCache.get(path);
    try {
      const blob = await IDB.get('photo:' + path);
      if (!blob) return '';
      const url = URL.createObjectURL(blob);
      urlCache.set(path, url);
      return url;
    } catch (e) { return ''; }
  }

  /* ------------------------------------------------------------ 通用 CRUD */
  function makeCRUD(table, lsKey, orderBy) {
    return {
      async list() {
        if (!isCloud()) {
          return lsGet(LS[lsKey], []).slice().sort((a, b) => cmp(b, a, orderBy));
        }
        const { data, error } = await sb.from(table).select('*').order(orderBy, { ascending: false });
        if (error) throw new Error('读取失败：' + error.message);
        return data || [];
      },
      async add(row) {
        if (!isCloud()) {
          const rec = Object.assign({ id: U.uid(), created_at: new Date().toISOString() }, row);
          const arr = lsGet(LS[lsKey], []); arr.push(rec); lsSet(LS[lsKey], arr);
          emit(table); return rec;
        }
        const { data, error } = await sb.from(table).insert(row).select().single();
        if (error) throw new Error('保存失败：' + error.message);
        emit(table); return data;
      },
      async patch(id, patch) {
        if (!isCloud()) {
          const arr = lsGet(LS[lsKey], []);
          const i = arr.findIndex((r) => r.id === id);
          if (i >= 0) { arr[i] = Object.assign(arr[i], patch); lsSet(LS[lsKey], arr); emit(table); }
          return;
        }
        const { error } = await sb.from(table).update(patch).eq('id', id);
        if (error) throw new Error('保存失败：' + error.message);
        emit(table);
      },
      async remove(id) {
        if (!isCloud()) {
          lsSet(LS[lsKey], lsGet(LS[lsKey], []).filter((r) => r.id !== id));
          emit(table); return;
        }
        const { error } = await sb.from(table).delete().eq('id', id);
        if (error) throw new Error('删除失败：' + error.message);
        emit(table);
      }
    };
  }
  function cmp(a, b, field) {
    const va = a[field] || '', vb = b[field] || '';
    return String(va).localeCompare(String(vb));
  }

  const diary = makeCRUD('diary_entries', 'diary', 'entry_date');
  const wishes = makeCRUD('wishes', 'wishes', 'created_at');
  const events = makeCRUD('events', 'events', 'date');
  const notes = makeCRUD('notes', 'notes', 'created_at');

  /* ----------------------------------------------------------- 旅行轨迹 🗺️ */
  const trips = Object.assign(makeCRUD('trips', 'trips', 'first_date'), {
    /** 按省份归类：[{province, cities:[], times, first, last}] */
    group(rows) {
      const map = {};
      (rows || []).forEach((r) => {
        const pv = r.province || '';
        if (!pv) return;
        if (!map[pv]) map[pv] = { province: pv, cities: [], times: 0, first: '', last: '' };
        const g = map[pv];
        g.times += Number(r.times) || 1;
        if (r.city && g.cities.indexOf(r.city) < 0) g.cities.push(r.city);
        const d = r.first_date || r.last_date || '';
        if (d && (!g.first || d < g.first)) g.first = d;
        const dl = r.last_date || d;                    // 最近一次：优先用专门的 last_date
        if (dl && (!g.last || dl > g.last)) g.last = dl;
      });
      return Object.keys(map).map((k) => map[k]).sort((a, b) => String(b.first).localeCompare(String(a.first)));
    },
    /** 汇总：去过几个省 / 几个城市 / 一共几次 */
    summary(rows) {
      const pv = new Set();
      const ct = new Set();
      let times = 0;
      (rows || []).forEach((r) => {
        if (r.province) pv.add(r.province);
        if (r.city) ct.add((r.province || '') + '|' + r.city);
        times += Number(r.times) || 1;
      });
      return { provinces: pv.size, cities: ct.size, times: times };
    },
    /** 某个省/市下面挂着的照片 */
    photosOf(list, province, city) {
      return (list || []).filter((p) => {
        if (city && p.city === city) return true;
        if (!city && province && p.province === province) return true;
        return false;
      });
    },
    /** 已经打过卡的城市名（给上传照片时的候选） */
    cityNames(rows) {
      const set = new Set();
      (rows || []).forEach((r) => { if (r.city) set.add(r.city); });
      return Array.from(set);
    }
  });

  /* ------------------------------------------------------------ 戳一戳 💗 */
  const pokes = Object.assign(makeCRUD('pokes', 'pokes', 'created_at'), {
    /** 今天 0 点的时间戳 */
    _todayStart() {
      const d = new Date();
      return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    },
    /** 今天某人戳了几次（name 为昵称；不传则统计全部） */
    todayCount(name) {
      return pokes.list().then((arr) => {
        const t0 = pokes._todayStart();
        return arr.filter((r) => {
          if (!r.created_at || new Date(r.created_at).getTime() < t0) return false;
          if (name && r.author !== name) return false;
          return true;
        }).length;
      }).catch(() => 0);
    },
    /** 今天不是我戳的记录（也就是对方戳我的） */
    todayFromOthers(myName) {
      return pokes.list().then((arr) => {
        const t0 = pokes._todayStart();
        return arr.filter((r) => {
          if (!r.created_at || new Date(r.created_at).getTime() < t0) return false;
          return myName ? r.author !== myName : true;
        });
      }).catch(() => []);
    }
  });

  /* ------------------------------------------------- 祝福留言板（访客可写） */
  const BLESS_MAX = 300;
  const BLESS_NAME_MAX = 24;

  const blessings = Object.assign(makeCRUD('blessings', 'blessings', 'created_at'), {
    MAX: BLESS_MAX,
    NAME_MAX: BLESS_NAME_MAX,
    /** 最近 N 条（祝福按时间倒序，墙上最新的在上面） */
    async recent(limit) {
      const arr = await blessings.list();
      return arr.slice(0, limit || 200);
    },
    /** 访客也能调用：昵称留空 = 匿名 */
    async addBless(input) {
      const isAnon = !!input.is_anon || !String(input.name || '').trim();
      const name = isAnon ? '' : String(input.name).trim().slice(0, BLESS_NAME_MAX);
      const content = String(input.content || '').trim();
      if (content.length < 1) throw new Error('写点什么再送出去吧 💗');
      if (content.length > BLESS_MAX) throw new Error('太长了，最多 ' + BLESS_MAX + ' 个字');
      return blessings.add({
        name: name,
        content: content,
        is_anon: isAnon,
        ua: (navigator.userAgent || '').slice(0, 180)
      });
    }
  });

  /* ------------------------------------------------------- 媒体（音/图） */
  /* ------------------------------------------------------------ AI 分身 */
  const AI_DEFAULTS = {
    owner: 'A',
    provider: 'deepseek',
    persona: '',
    style_notes: '',
    model: 'deepseek-flash',
    daily_limit: 60,
    greet_morning: true,
    greet_night: true,
    enabled: true
  };

  /** 服务商信息（网页里只用来显示名字和推荐模型，钥匙永远在服务端） */
  const AI_PROVIDERS = [
    {
      id: 'deepseek', name: 'DeepSeek 官方',
      console: 'platform.deepseek.com',
      models: ['deepseek-flash', 'deepseek-v4-pro', 'deepseek-chat', 'deepseek-reasoner']
    },
    {
      id: 'bailian', name: '阿里云百炼',
      console: 'bailian.console.aliyun.com',
      models: ['qwen-plus', 'qwen-max', 'qwen-turbo', 'qwen-long', 'deepseek-v3', 'deepseek-r1']
    }
  ];

  function translateAiError(msg) {
    const m = String(msg || '');
    if (/Failed to send a request|Failed to fetch|not found|404|Edge Function/i.test(m)) {
      return '还联系不上 AI 分身：函数可能还没部署好（看 README 第八节），或者网络被挡住了。';
    }
    if (/JWT|401|Unauthorized/i.test(m)) return '登录状态过期了，重新登录一下再试～';
    return m || '出了点问题，再试一次吧～';
  }

  const ai = {
    defaults: AI_DEFAULTS,
    providers: AI_PROVIDERS,
    /** AI 分身只有云端模式能用（需要 Edge Function 转发，钥匙不能放网页里） */
    available() { return isCloud(); },

    config: {
      async get() {
        if (!isCloud()) return Object.assign({}, AI_DEFAULTS, lsGet(LS.aiConfig, {}));
        const { data, error } = await sb.from('ai_config').select('*').eq('id', 1).limit(1);
        if (error) { console.warn('[ai.config]', error.message); return Object.assign({}, AI_DEFAULTS); }
        return Object.assign({}, AI_DEFAULTS, (data && data[0]) || {});
      },
      async save(patch) {
        if (!isCloud()) {
          lsSet(LS.aiConfig, Object.assign(lsGet(LS.aiConfig, {}), patch));
          emit('ai_config');
          return;
        }
        const row = Object.assign({ id: 1 }, patch, { updated_at: new Date().toISOString() });
        const { error } = await sb.from('ai_config').upsert(row, { onConflict: 'id' });
        if (error) throw new Error('保存失败：' + error.message + (/(does not exist|schema cache)/i.test(error.message) ? '（是不是还没跑、或者需要重跑一次 supabase/ai.sql？）' : ''));
        emit('ai_config');
      }
    },

    memories: makeCRUD('ai_memories', 'aiMemories', 'created_at'),

    /** 最近的聊天记录（旧在前，方便直接铺到页面上） */
    async history(limit) {
      const n = limit || 60;
      if (!isCloud()) return lsGet(LS.aiMessages, []).slice(-n);
      const { data, error } = await sb.from('ai_messages').select('*')
        .order('created_at', { ascending: false }).limit(n);
      if (error) throw new Error('读取聊天记录失败：' + error.message);
      return (data || []).slice().reverse();
    },

    /** 发一句话给分身：走 Edge Function（钥匙在服务端，网页里没有） */
    async send(text, opts) {
      if (!isCloud()) throw new Error('AI 分身需要云端模式：先在 config.js 里填好 Supabase 配置');
      const body = Object.assign({ message: text }, opts || {});
      const { data, error } = await sb.functions.invoke('ai-chat', { body });
      if (error) {
        let msg = error.message || '请求失败';
        try {
          if (error.context && typeof error.context.json === 'function') {
            const j = await error.context.json();
            if (j && j.error) msg = j.error;
          }
        } catch (e) { /* 拿不到就用手里的信息 */ }
        throw new Error(translateAiError(msg));
      }
      if (data && data.error) throw new Error(data.error);
      return data || {};
    },

    async clear() {
      if (!isCloud()) { lsSet(LS.aiMessages, []); emit('ai_messages'); return; }
      const { error } = await sb.from('ai_messages').delete().gte('created_at', '1970-01-01T00:00:00Z');
      if (error) throw new Error('清空失败：' + error.message);
      emit('ai_messages');
    }
  };

  const media = {
    /**
     * @param {File} file
     * @param {'bg'|'avatar'|'music'} kind
     * @returns {Promise<string>} 可直接放进 <img src> / <audio src> 的地址
     */
    async upload(file, kind) {
      if (kind === 'music' && !isCloud()) {
        throw new Error('本地模式不支持上传音乐文件，请填入一个 mp3 直链，或先接入 Supabase');
      }
      const isAudio = /^audio\//.test(file.type);
      let blob = file, width = 0, height = 0;
      if (!isAudio) {
        const r = await U.compressImage(file, kind === 'avatar' ? { maxDim: 320, quality: 0.85 } : { maxDim: 1920, quality: 0.75 });
        blob = r.blob; width = r.width; height = r.height;
      }
      if (!isCloud()) {
        if (blob.size > 2.5 * 1024 * 1024) throw new Error('本地模式图片不能超过 2.5MB，建议接入 Supabase');
        return await U.readAsDataURL(blob);
      }
      const ext = (file.name.split('.').pop() || (isAudio ? 'mp3' : 'jpg')).toLowerCase();
      const path = `${kind}/${Date.now()}-${U.uid().slice(0, 8)}.${ext}`;
      const { error } = await sb.storage.from(bucket('media')).upload(path, blob, {
        contentType: blob.type || file.type, upsert: false, cacheControl: '31536000'
      });
      if (error) throw new Error('上传失败：' + error.message);
      return publicUrl(bucket('media'), path);
    }
  };

  /* --------------------------------------------------------------- 导出 */
  return {
    init, isCloud, client, auth, identity, me, settings, photos, diary, wishes, events, notes, pokes, trips, blessings, media, ai,
    on(fn) { changeHandlers.add(fn); },
    emit(table) { emit(table); },
    get cdnFailed() { return cdnFailed; },
    get mode() { return mode; },
    /** 换设备时把云端设置整个拿一遍 */
    reload() { return settings.get(); }
  };
})();