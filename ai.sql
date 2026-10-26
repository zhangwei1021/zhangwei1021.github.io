-- ============================================================================
--  AI 分身  ·  追加脚本
--  ---------------------------------------------------------------------------
--  用途：在你**已经跑过 schema.sql** 的站点上，补上「AI 分身」需要的三张表。
--  怎么用：Supabase 后台 → 左边 SQL Editor → New query → 把本文件全部粘进去 → Run。
--  可以重复运行，不会删掉已有数据（重复跑只会把缺的东西补上）。
--  想改成「只有两个人能用」的东西，都在这个文件里，别的表不用动。
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. 分身设置（只有一行，代表「这个分身是谁、怎么说话」）
-- ----------------------------------------------------------------------------
create table if not exists public.ai_config (
  id            smallint primary key default 1,
  owner         text    default 'A',                 -- 分身代表谁：'A' 或 'B'（对应设置页里的昵称A / 昵称B）
  provider      text    default 'deepseek',          -- 用哪家的模型：'deepseek'（DeepSeek 官方）或 'bailian'（阿里云百炼）
  persona       text    default '',                  -- 人设：他是谁、怎么说话
  style_notes   text    default '',                  -- 说话风格备注：口头禅、怎么称呼她、不要说的话
  model         text    default 'deepseek-flash',    -- 用哪个模型（DeepSeek 官方：deepseek-flash 便宜快 / deepseek-v4-pro 更聪明；百炼：qwen-plus / qwen-max / deepseek-v3）
  daily_limit   int     default 60,                  -- 她每天最多能聊几句（保护你的余额）
  greet_morning boolean default true,                -- 打开网站时自动道早安
  greet_night   boolean default true,                -- 晚上打开时自动道晚安
  enabled       boolean default true,                -- 总开关
  updated_at    timestamptz default now(),
  constraint ai_config_single_row check (id = 1)
);

-- 如果之前跑过旧版本，把缺的列补上（已存在就跳过）
alter table public.ai_config add column if not exists owner         text    default 'A';
alter table public.ai_config add column if not exists provider      text    default 'deepseek';
alter table public.ai_config add column if not exists persona       text    default '';
alter table public.ai_config add column if not exists style_notes   text    default '';
alter table public.ai_config add column if not exists model         text    default 'deepseek-flash';
alter table public.ai_config add column if not exists daily_limit   int     default 60;
alter table public.ai_config add column if not exists greet_morning boolean default true;
alter table public.ai_config add column if not exists greet_night   boolean default true;
alter table public.ai_config add column if not exists enabled       boolean default true;
alter table public.ai_config add column if not exists updated_at    timestamptz default now();


-- ----------------------------------------------------------------------------
-- 2. 记忆清单（分身的「你们的事」：第一次见面、她爱吃什么、口头禅…）
-- ----------------------------------------------------------------------------
create table if not exists public.ai_memories (
  id          uuid primary key default gen_random_uuid(),
  kind        text default '其他',      -- 分类：第一次 / 称呼 / 习惯 / 纪念日 / 家人朋友 / 其他
  title       text not null default '', -- 一句话标题，比如「她不吃香菜」
  content     text not null default '', -- 具体内容
  happened_on date,                     -- 可选：发生日期
  created_at  timestamptz default now()
);


-- ----------------------------------------------------------------------------
-- 3. 聊天记录（她和分身的对话，你们俩都能看到）
-- ----------------------------------------------------------------------------
create table if not exists public.ai_messages (
  id         uuid primary key default gen_random_uuid(),
  role       text not null default 'user' check (role in ('user', 'assistant')),
  content    text not null default '',
  author     text default '',           -- 谁说的：她的昵称 / 分身的名字
  kind       text default 'chat',       -- chat = 聊天，greeting = 自动的早晚问候
  created_at timestamptz default now()
);
create index if not exists ai_messages_created_idx on public.ai_messages (created_at desc);


-- ----------------------------------------------------------------------------
-- 4. 权限：三张表都「只有你们两个登录后能用」
--    （外人哪怕知道网址、拿到公钥，也读不到、写不进）
-- ----------------------------------------------------------------------------
alter table public.ai_config   enable row level security;
alter table public.ai_memories enable row level security;
alter table public.ai_messages enable row level security;

drop policy if exists "ai_config_member_all"   on public.ai_config;
drop policy if exists "ai_memories_member_all" on public.ai_memories;
drop policy if exists "ai_messages_member_all" on public.ai_messages;

create policy "ai_config_member_all" on public.ai_config
  for all to authenticated using (public.is_member()) with check (public.is_member());

create policy "ai_memories_member_all" on public.ai_memories
  for all to authenticated using (public.is_member()) with check (public.is_member());

create policy "ai_messages_member_all" on public.ai_messages
  for all to authenticated using (public.is_member()) with check (public.is_member());


-- ----------------------------------------------------------------------------
-- 5. 实时同步：她发一句，你这边网页上马上能看到
-- ----------------------------------------------------------------------------
do $$
begin
  alter publication supabase_realtime add table public.ai_messages;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

alter table public.ai_messages replica identity full;


-- ----------------------------------------------------------------------------
-- 6. 先塞一行默认设置进去（你已经改过就不会被覆盖）
--    ★ 想改人设，最方便的是直接在网站「设置 → AI 分身」里改，不用动 SQL
-- ----------------------------------------------------------------------------
insert into public.ai_config (id, owner, persona, style_notes, model, daily_limit, greet_morning, greet_night, enabled)
values (
  1,
  'A',
  E'我是她的男朋友，正在用平时的语气和她聊微信。\n说话轻松、口语化，短句为主，偶尔开个玩笑或者撒个娇。\n她开心的时候陪她一起乐；她累、难过的时候先心疼她，不要讲大道理。\n（这段是示例，改成你自己的说话方式，分身就会更像你）',
  E'口头禅：写几个你常说的词，比如「好家伙」「就这？」「乖乖」\n怎么称呼她：写你平时怎么叫她\n不要说的话：别用「亲爱的用户」「作为 AI」这种客套腔',
  'deepseek-flash',
  60,
  true,
  true,
  true
)
on conflict (id) do nothing;