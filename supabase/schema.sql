-- ============================================================================
--  「张张包和止咳药的日常」 Supabase 初始化脚本
--  用法：Supabase 控制台 → 左侧 SQL Editor → New query → 全部粘贴 → Run
--  可以重复运行，不会重复建表 / 不会清空数据。
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. 成员白名单：只有这两个邮箱能读写全部数据
--    ⚠️ 把下面的邮箱改成你们俩注册 Supabase 账号时用的邮箱！
-- ---------------------------------------------------------------------------
create table if not exists public.members (
  email      text primary key,
  nickname   text,
  created_at timestamptz not null default now()
);

insert into public.members (email, nickname) values
  ('you@example.com',    'Zzzw'),
  ('partner@example.com','Zzzky')
on conflict (email) do update set nickname = excluded.nickname;

-- 判断当前登录用户是否在白名单里（所有写操作都靠它把关）
create or replace function public.is_member()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.members m
    where lower(m.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

revoke all on function public.is_member() from public;
grant execute on function public.is_member() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. 数据表
-- ---------------------------------------------------------------------------

-- 2.1 站点设置（一行一个设置项，key/value 形式，方便随时加字段）
create table if not exists public.settings (
  key        text primary key,
  value      jsonb not null default 'null'::jsonb,
  updated_at timestamptz not null default now()
);

-- 2.2 照片
create table if not exists public.photos (
  id         uuid primary key default gen_random_uuid(),
  path       text not null,                       -- Storage 里的路径
  caption    text not null default '',
  taken_at   date,
  tags       text[] not null default '{}',
  author     text not null default '',
  is_home    boolean not null default false,      -- 是否展示在首页照片墙
  is_cover   boolean not null default false,      -- 是否作为首页大图
  width      int,
  height     int,
  created_at timestamptz not null default now()
);
create index if not exists photos_created_idx on public.photos (created_at desc);

-- 2.3 恋爱日记 / 时间轴
create table if not exists public.diary_entries (
  id         uuid primary key default gen_random_uuid(),
  entry_date date not null default current_date,
  title      text not null default '',
  content    text not null default '',
  mood       text not null default '',
  photo_id   uuid references public.photos (id) on delete set null,
  author     text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists diary_date_idx on public.diary_entries (entry_date desc);

-- 2.4 悄悄话留言板（默认仅两人可见）
create table if not exists public.notes (
  id         uuid primary key default gen_random_uuid(),
  content    text not null,
  author     text not null default '',
  is_read    boolean not null default false,
  created_at timestamptz not null default now()
);

-- 2.5 心愿清单
create table if not exists public.wishes (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  description text not null default '',
  done        boolean not null default false,
  done_at     date,
  author      text not null default '',
  created_at  timestamptz not null default now()
);

-- 2.6 自定义纪念日（生日、第一次见面…… 默认每年重复）
create table if not exists public.events (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  date       date not null,
  yearly     boolean not null default true,
  emoji      text not null default '💗',
  created_at timestamptz not null default now()
);

-- 2.7 「戳一戳」：想 TA 了就点一下，对方打开网站会看到今天被想了几次
create table if not exists public.pokes (
  id         uuid primary key default gen_random_uuid(),
  author     text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists pokes_created_idx on public.pokes (created_at desc);

-- ---------------------------------------------------------------------------
-- 3. 行级安全策略（RLS）
--    读：设置 / 照片 / 纪念日 = 公开（首页访客也能看到照片墙）
--        日记 / 心愿 / 悄悄话 / 戳一戳 = 仅你们两人
--    写：一律仅两人
--    想让「日记」「心愿」也公开？见文件末尾的「可选：改回公开」。
-- ---------------------------------------------------------------------------
alter table public.members        enable row level security;
alter table public.settings       enable row level security;
alter table public.photos         enable row level security;
alter table public.diary_entries  enable row level security;
alter table public.notes          enable row level security;
alter table public.wishes         enable row level security;
alter table public.events         enable row level security;
alter table public.pokes          enable row level security;

do $$
declare
  t text;
  tables text[] := array['settings','photos','events'];
begin
  foreach t in array tables loop
    execute format('drop policy if exists %I on public.%I', t || '_read', t);
    execute format('drop policy if exists %I on public.%I', t || '_write', t);
    execute format('create policy %I on public.%I for select using (true)', t || '_read', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.is_member()) with check (public.is_member())',
      t || '_write', t);
  end loop;
end $$;

-- 日记 / 心愿 / 悄悄话 / 戳一戳：仅你们两人可读写
do $$
declare
  t text;
  tables text[] := array['diary_entries','wishes','notes','pokes'];
begin
  foreach t in array tables loop
    execute format('drop policy if exists %I on public.%I', t || '_read', t);
    execute format('drop policy if exists %I on public.%I', t || '_write', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using (public.is_member())',
      t || '_read', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.is_member()) with check (public.is_member())',
      t || '_write', t);
  end loop;
end $$;

-- 成员表本身只允许两人查看
drop policy if exists members_read on public.members;
create policy members_read on public.members for select to authenticated using (public.is_member());

-- ---------------------------------------------------------------------------
-- 4. Storage 存储桶：photos（照片）、media（背景图 / 头像 / 音乐）
--    公开读，仅两人可上传 / 覆盖 / 删除
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public) values ('photos', 'photos', true)
  on conflict (id) do update set public = true;
insert into storage.buckets (id, name, public) values ('media',  'media',  true)
  on conflict (id) do update set public = true;

drop policy if exists storage_public_read   on storage.objects;
drop policy if exists storage_member_insert on storage.objects;
drop policy if exists storage_member_update on storage.objects;
drop policy if exists storage_member_delete on storage.objects;

create policy storage_public_read on storage.objects
  for select using (bucket_id in ('photos', 'media'));

create policy storage_member_insert on storage.objects
  for insert to authenticated
  with check (bucket_id in ('photos', 'media') and public.is_member());

create policy storage_member_update on storage.objects
  for update to authenticated
  using (bucket_id in ('photos', 'media') and public.is_member());

create policy storage_member_delete on storage.objects
  for delete to authenticated
  using (bucket_id in ('photos', 'media') and public.is_member());

-- ---------------------------------------------------------------------------
-- 5. 实时同步：两人各自打开网站时，一方改动另一方立刻看到
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
  tables text[] := array['settings','photos','diary_entries','notes','wishes','events','pokes'];
begin
  foreach t in array tables loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
                     when undefined_object then null;
    end;
    execute format('alter table public.%I replica identity full', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 6. 可选：把「日记」「心愿清单」改回公开
--    （现在的默认是仅你们两人可见；如果你希望访客不登录也能翻日记，就把下面
--      整段取消注释，重新 Run 一次。）
-- ---------------------------------------------------------------------------
-- drop policy if exists diary_entries_read on public.diary_entries;
-- create policy diary_entries_read on public.diary_entries for select using (true);
-- drop policy if exists wishes_read on public.wishes;
-- create policy wishes_read on public.wishes for select using (true);

-- ---------------------------------------------------------------------------
-- 7. 可选：AI 分身（女朋友可以和一个「AI 版的你」聊天）
--    建表脚本单独放在同一个文件夹的 ai.sql 里，跑完本文件后如果想用这个功能，
--    再把 ai.sql 整个粘进 SQL Editor 跑一次即可。不需要这个功能就跳过。
-- ---------------------------------------------------------------------------

-- ============================================================================
--  完成！接着去 Authentication → Users 建两个账号（记得勾 Auto Confirm User），
--  并在 Authentication → Sign In / Providers 里关掉「Allow new users to sign up」。
--  （想开 AI 分身：再把 supabase/ai.sql 跑一次，然后照 README 第八节部署函数。）
-- ============================================================================