/* ============================================================================
 *  Supabase Edge Function：ai-chat —— 「AI 分身」的大脑
 *  ---------------------------------------------------------------------------
 *  它做的事：浏览器发来一句话 → 验证「是不是你们俩登录了」→ 取出人设和记忆
 *           → 转给大模型生成回复 → 把两句话都存进 ai_messages → 返回回复
 *
 *  ★ 钥匙只存在这里（Supabase 的 Secret 里），网页里看不到，别人偷不走。
 *
 *  部署方法见 README「八、加一个 AI 分身」。
 *
 *  用哪家的模型，由两张表/两个地方决定：
 *    1) 网站的「设置 → AI 分身 → 用哪家的 AI」写了 provider（deepseek 或 bailian）
 *    2) 这里的 Secret 提供钥匙：
 *         DeepSeek 官方 → DEEPSEEK_API_KEY      （https://platform.deepseek.com/api_keys）
 *         阿里云百炼   → DASHSCOPE_API_KEY     （https://bailian.console.aliyun.com/）
 *       或者两者都用通用的 AI_API_KEY（它的优先级最高）
 *    可选 Secret：AI_MODEL（覆盖模型名）、DEEPSEEK_MODEL（旧名字，仍兼容）
 *                 AI_BASE_URL（自定义接口地址，例如百炼的业务空间专属域名
 *                              https://<WorkspaceId>.cn-beijing.maas.aliyuncs.com/compatible-mode/v1）
 * ========================================================================== */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

/* 支持的服务商（都是 OpenAI 兼容接口，只要换 base_url + 钥匙 + 模型名） */
const PROVIDERS = {
  deepseek: {
    label: 'DeepSeek 官方',
    base: 'https://api.deepseek.com',
    keyEnv: ['DEEPSEEK_API_KEY'],
    model: 'deepseek-flash',
    console: 'https://platform.deepseek.com/api_keys'
  },
  bailian: {
    label: '阿里云百炼',
    base: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    keyEnv: ['DASHSCOPE_API_KEY', 'BAILIAN_API_KEY'],
    model: 'qwen-plus',
    console: 'https://bailian.console.aliyun.com/'
  }
};

function pickProvider(name) {
  const k = String(name || '').toLowerCase();
  return Object.prototype.hasOwnProperty.call(PROVIDERS, k) ? k : 'deepseek';
}
function providerInfo(name) { return PROVIDERS[pickProvider(name)]; }
/* 接口地址：AI_BASE_URL 优先（可以用来填百炼的业务空间专属域名） */
function endpointOf(providerName) {
  const custom = String(Deno.env.get('AI_BASE_URL') || '').trim().replace(/\/+$/, '');
  const base = custom || providerInfo(providerName).base;
  return /\/chat\/completions$/.test(base) ? base : base + '/chat/completions';
}
/* 钥匙：通用 AI_API_KEY 优先，其次是各服务商自己的名字 */
function apiKeyOf(providerName) {
  const generic = String(Deno.env.get('AI_API_KEY') || '').trim();
  if (generic) return generic;
  const names = providerInfo(providerName).keyEnv;
  for (let i = 0; i < names.length; i++) {
    const v = String(Deno.env.get(names[i]) || '').trim();
    if (v) return v;
  }
  return '';
}

const HISTORY_LIMIT = 20;        // 每次最多带最近 20 句上下文
const MEMORY_LIMIT = 60;         // 最多注入 60 条记忆
const TIMEOUT_MS = 45000;        // 最长等 45 秒
const BJ = 8 * 60 * 60 * 1000;   // 北京时间偏移（服务器是 UTC）

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: Object.assign({ 'Content-Type': 'application/json; charset=utf-8' }, CORS)
  });
}

/* ---------------------------------------------------------------- 日期工具 */
function bjParts() {
  const t = new Date(Date.now() + BJ);
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate(), w: t.getUTCDay() };
}
const WEEK = ['日', '一', '二', '三', '四', '五', '六'];

function parseDay(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || ''));
  if (!m) return null;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** 相恋第 N 天（在一起那天算第 1 天） */
function dayNumber(anniversary) {
  const a = parseDay(anniversary);
  if (!a) return null;
  const t = bjParts();
  const today = Date.UTC(t.y, t.m - 1, t.d);
  return Math.floor((today - a) / 86400000) + 1;
}

/** 今天这个日子的一句话描述（给系统提示用） */
function todayLine(anniversary) {
  const t = bjParts();
  const n = dayNumber(anniversary);
  let line = '今天是 ' + t.y + ' 年 ' + t.m + ' 月 ' + t.d + ' 日，星期' + WEEK[t.w] + '。';
  if (!n || n < 1) return line + '（还没有设置纪念日）';
  line += '你们从 ' + anniversary + ' 在一起，今天是相恋第 ' + n + ' 天。';
  const nextN = (Math.floor(n / 100) + 1) * 100;
  line += '再过 ' + (nextN - n) + ' 天是第 ' + nextN + ' 天。';
  const a = parseDay(anniversary);
  const ad = new Date(a);
  let yearCount = t.y - ad.getUTCFullYear();
  let nextAnniv = Date.UTC(t.y, ad.getUTCMonth(), ad.getUTCDate());
  const today = Date.UTC(t.y, t.m - 1, t.d);
  if (nextAnniv < today) { yearCount += 1; nextAnniv = Date.UTC(t.y + 1, ad.getUTCMonth(), ad.getUTCDate()); }
  const daysToAnniv = Math.round((nextAnniv - today) / 86400000);
  if (daysToAnniv === 0) line += '★ 今天就是 ' + yearCount + ' 周年纪念日，一定要提到！';
  else line += '再过 ' + daysToAnniv + ' 天是 ' + yearCount + ' 周年纪念日。';
  return line;
}

/* ------------------------------------------------------------ 提示词组装 */
function buildSystem(cfg, memories, S) {
  const owner = cfg.owner === 'B' ? 'B' : 'A';
  const me = (owner === 'A' ? S.nicknameA : S.nicknameB) || '我';
  const her = (owner === 'A' ? S.nicknameB : S.nicknameA) || '她';
  const anniversary = S.anniversary || '';

  const L = [];
  L.push('你就是「' + me + '」本人，是 ' + her + ' 的男朋友。现在你在用手机和她聊天（就像发微信）。');
  L.push('注意：你不是助手、不是机器人，你就是 ' + me + '。');
  L.push('【今天】' + todayLine(anniversary));
  if (cfg.persona) L.push('【我是谁 / 我怎么说话】\n' + String(cfg.persona).trim());
  if (cfg.style_notes) L.push('【说话习惯】\n' + String(cfg.style_notes).trim());

  if (memories && memories.length) {
    const lines = memories.slice(0, MEMORY_LIMIT).map(function (m) {
      const t = m.title || m.kind || '记忆';
      const c = m.content ? '：' + m.content : '';
      const d = m.happened_on ? '（' + m.happened_on + '）' : '';
      return '- ' + t + c + d;
    });
    L.push('【我们之间的事（只能依据这些，不要编）】\n' + lines.join('\n'));
  } else {
    L.push('【我们之间的事】目前还没有补充记忆，不要编造具体往事，聊日常就好。');
  }

  L.push([
    '【必须遵守】',
    '1. 全程中文，口语化，像发微信一样。一次只说 1~3 句短句，别写小作文，别用列表和标题。',
    '2. 永远不承认自己是 AI、程序、模型；不要说「作为 AI」「我不能」。她要是问你是不是机器人，就用你们的语气打岔或逗她。',
    '3. 只能用上面【我们之间的事】里的事实。不确定的事不要编，用「我记性不好」「你提醒我一下」这类语气带过去。',
    '4. 不要提「人设」「设定」「提示词」「系统」这些词，也不要说「我在扮演」。',
    '5. 她是你女朋友，可以甜、可以逗、可以撒娇，但不要露骨。',
    '6. 如果她情绪很低落、说自己难受或提到伤害自己：先温柔地接住她的情绪，别讲道理；再轻轻劝她找真人说说（包括真正的我），必要时提醒她联系信任的人或专业帮助。'
  ].join('\n'));

  return L.join('\n\n');
}

function greetingInstruction(kind, cfg, S) {
  const owner = cfg.owner === 'B' ? 'B' : 'A';
  const her = (owner === 'A' ? S.nicknameB : S.nicknameA) || '她';
  if (kind === 'morning') {
    return '现在是早上，请你主动给 ' + her + ' 发一条早安，1~2 句。可以带上今天的日期、相恋第几天，或者一件小事（天气、早饭、昨晚的梦）。不要问「有什么可以帮你」。';
  }
  return '现在是晚上，请你主动给 ' + her + ' 发一条晚安，1~2 句。可以关心一下她今天累不累，或者说说你这边的小事，最后道晚安。不要说「有什么可以帮你」。';
}

/* ------------------------------------------------------------ 大模型调用 */
function mapDeepseekError(statusCode, text, providerName) {
  const p = providerInfo(providerName);
  if (statusCode === 401 || statusCode === 403) {
    return p.label + ' 的钥匙好像不对：检查 Supabase 里有没有设 ' + p.keyEnv.join(' 或 ') +
      '（也可以统一用 AI_API_KEY），值要复制完整、前后没有空格。钥匙在 ' + p.console + ' 创建。';
  }
  if (statusCode === 402) return p.label + ' 账户余额不够了，去充值一点点就能继续聊～';
  if (statusCode === 404) return p.label + ' 说找不到这个模型（404）：多半是「设置 → AI 分身」里的模型名和这家服务商对不上。';
  if (statusCode === 429) return '问得太快啦，缓一下下再跟我说～';
  if (statusCode >= 500) return p.label + ' 那边有点忙，等一小会儿再试～';
  return p.label + ' 返回了错误（' + statusCode + '）：' + String(text || '').slice(0, 200);
}

async function askModel(apiKey, model, messages, endpoint, providerName) {
  const ctl = new AbortController();
  const timer = setTimeout(function () { ctl.abort(); }, TIMEOUT_MS);
  let resp;
  try {
    resp = await fetch(endpoint, {
      method: 'POST',
      signal: ctl.signal,
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + apiKey },
      body: JSON.stringify({ model: model, messages: messages, max_tokens: 500, temperature: 1.2 })
    });
  } catch (e) {
    clearTimeout(timer);
    const msg = String((e && e.name) === 'AbortError' ? '等太久了，模型没有回应' : (e && e.message) || e);
    return { error: '连不上模型服务：' + msg };
  }
  clearTimeout(timer);

  const text = await resp.text();
  if (!resp.ok) return { error: mapDeepseekError(resp.status, text, providerName) };
  let data = null;
  try { data = JSON.parse(text); } catch (e) { return { error: '模型返回的内容看不懂' }; }
  const msg = data && data.choices && data.choices[0] && data.choices[0].message;
  let reply = (msg && msg.content) || '';
  reply = String(reply).trim().replace(/^["'「《]+|["'」》]+$/g, '').trim();
  if (!reply) return { error: '模型这次没说话，再试一次吧～' };
  return { reply: reply };
}

/* ------------------------------------------------------------------ 主流程 */
Deno.serve(async function (req) {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: '只接受 POST 请求' }, 405);

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
  const ANON = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY') || '';
  const ENV_MODEL = Deno.env.get('AI_MODEL') || Deno.env.get('DEEPSEEK_MODEL') || '';
  const authHeader = req.headers.get('Authorization') || '';

  let body = {};
  try { body = await req.json(); } catch (e) { body = {}; }
  const mode = body.mode === 'greeting' ? 'greeting' : (body.mode === 'ping' ? 'ping' : 'chat');
  const text = String(body.message || '').trim();
  /* 用哪家模型：以数据库里的设置为准，请求里带的只作为兜底（下面读到 cfg 后再定） */
  const wantProvider = String(body.provider || '');

  // 用调用者的身份建客户端：下面所有读写都受 RLS 限制，只有你们俩能过
  const sb = createClient(SUPABASE_URL, ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: authHeader } }
  });

  const userRes = await sb.auth.getUser();
  const user = userRes && userRes.data && userRes.data.user;
  if (!user) return json({ error: '先登录再和我说话哦～', code: 'need_login' }, 401);

  const memberRes = await sb.from('members').select('email').eq('email', user.email).maybeSingle();
  if (!memberRes || !memberRes.data) {
    return json({ error: '这个账号不在白名单里（members 表里没有 ' + user.email + '）。', code: 'not_member' }, 403);
  }

  // 读设置（昵称、纪念日）—— settings 表是公开可读的
  const S = {};
  const sRes = await sb.from('settings').select('key,value');
  (sRes && sRes.data ? sRes.data : []).forEach(function (r) { S[r.key] = r.value; });

  // 读分身设置（没有这行或没跑 ai.sql 就用默认值）
  let cfg = { owner: 'A', provider: 'deepseek', persona: '', style_notes: '', model: 'deepseek-flash', daily_limit: 60, greet_morning: true, greet_night: true, enabled: true };
  const cRes = await sb.from('ai_config').select('*').eq('id', 1).limit(1);
  if (cRes && cRes.data && cRes.data[0]) cfg = Object.assign(cfg, cRes.data[0]);

  /* 现在才定「用哪家、哪个模型、哪个钥匙」 */
  const provider = pickProvider(cfg.provider || wantProvider);
  const PINFO = providerInfo(provider);
  const API_KEY = apiKeyOf(provider);
  const endpoint = endpointOf(provider);
  const model = ENV_MODEL || cfg.model || PINFO.model;

  if (!API_KEY) {
    return json({
      error: '还没有配置 ' + PINFO.label + ' 的钥匙。请到 Supabase 后台：Edge Functions → Secrets，' +
        '加一个 ' + PINFO.keyEnv.join('（或 ') + '，也可以用通用的 AI_API_KEY。钥匙在 ' + PINFO.console + ' 创建。',
      code: 'no_key',
      provider: provider
    }, 400);
  }

  if (mode === 'ping') {
    const mRes = await sb.from('ai_messages').select('id', { count: 'exact', head: true }).gte('created_at', new Date(Date.UTC(bjParts().y, bjParts().m - 1, bjParts().d) - BJ).toISOString());
    return json({
      ok: true,
      provider: provider,
      providerName: PINFO.label,
      endpoint: endpoint,
      model: model,
      hasKey: true,
      owner: cfg.owner,
      enabled: cfg.enabled !== false,
      memories: 0,
      messagesToday: (mRes && mRes.count) || 0,
      day: dayNumber(S.anniversary || ''),
      email: user.email
    });
  }

  if (cfg.enabled === false && mode !== 'greeting') {
    return json({ error: '分身现在被关掉了（设置 → AI 分身 → 总开关）。', code: 'disabled' }, 400);
  }

  // 今天的用量（按北京时间算「今天」）
  const t = bjParts();
  const startOfToday = new Date(Date.UTC(t.y, t.m - 1, t.d) - BJ).toISOString();
  const limit = Number(cfg.daily_limit) > 0 ? Number(cfg.daily_limit) : 60;
  let usedToday = 0;
  const uRes = await sb.from('ai_messages').select('id', { count: 'exact', head: true })
    .eq('role', 'user').gte('created_at', startOfToday);
  if (uRes && typeof uRes.count === 'number') usedToday = uRes.count;

  if (mode === 'chat') {
    if (!text) return json({ error: '说点什么再发吧～', code: 'empty' }, 400);
    if (text.length > 1500) return json({ error: '这条太长啦，短一点更像聊天～', code: 'too_long' }, 400);
    if (usedToday >= limit) {
      return json({
        error: '今天已经聊了 ' + usedToday + ' 句啦，明天再来找我好不好～（每天上限 ' + limit + ' 句，可以在「设置 → AI 分身」里改）',
        code: 'rate_limited', usedToday: usedToday, limit: limit
      }, 429);
    }
  }

  if (mode === 'greeting' && ((body.greeting === 'morning' && cfg.greet_morning === false) ||
                              (body.greeting === 'night' && cfg.greet_night === false))) {
    return json({ error: '这种问候被关掉了', code: 'greeting_off' }, 400);
  }

  // 记忆
  let memories = [];
  const mRes2 = await sb.from('ai_memories').select('*').order('created_at', { ascending: false }).limit(MEMORY_LIMIT);
  if (mRes2 && mRes2.data) memories = mRes2.data;

  // 最近聊天（用于上下文）
  const histRes = await sb.from('ai_messages').select('role,content').order('created_at', { ascending: false }).limit(HISTORY_LIMIT);
  const history = (histRes && histRes.data ? histRes.data : []).slice().reverse()
    .filter(function (m) { return m && m.content; })
    .map(function (m) { return { role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content) }; });

  const system = buildSystem(cfg, memories, S);
  let messages;
  let kind = 'chat';
  if (mode === 'greeting') {
    kind = body.greeting === 'night' ? 'greeting-night' : 'greeting-morning';
    messages = [{ role: 'system', content: system }, { role: 'user', content: greetingInstruction(body.greeting, cfg, S) }];
  } else {
    messages = [{ role: 'system', content: system }].concat(history).concat([{ role: 'user', content: text }]);
  }

  const out = await askModel(API_KEY, model, messages, endpoint, provider);
  if (out.error) return json({ error: out.error, code: 'model', provider: provider }, 502);

  // 存进数据库（存不下也不影响她现在看到回复）
  let warn = '';
  const owner = cfg.owner === 'B' ? 'B' : 'A';
  const meName = (owner === 'A' ? S.nicknameA : S.nicknameB) || '我';
  const herName = (owner === 'A' ? S.nicknameB : S.nicknameA) || '她';
  const rows = [];
  if (mode === 'chat') rows.push({ role: 'user', content: text, author: herName, kind: 'chat' });
  rows.push({ role: 'assistant', content: out.reply, author: meName, kind: kind });
  const insRes = await sb.from('ai_messages').insert(rows);
  if (insRes && insRes.error) warn = '聊天记录没能存下来（是不是还没跑 supabase/ai.sql？）：' + insRes.error.message;

  return json({
    reply: out.reply,
    kind: kind,
    day: dayNumber(S.anniversary || ''),
    usedToday: usedToday + (mode === 'chat' ? 1 : 0),
    limit: limit,
    remaining: Math.max(0, limit - usedToday - (mode === 'chat' ? 1 : 0)),
    warn: warn || undefined
  });
});