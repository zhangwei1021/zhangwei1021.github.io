-- ============================================================
--  祝福留言板（可选模块 · 可重复运行）
--  作用：让**没有账号的访客**也能在网站上给你们的恋爱留一句祝福
--  用法：Supabase → SQL Editor → New query → 粘贴本文件 → Run
--        （应看到 Success. No rows returned）
--  注意：本文件依赖 schema.sql 里的 public.is_member() 函数，
--        所以请先跑过 schema.sql 再跑这个。
--  想清空所有祝福：把最后一行 delete 的注释去掉再跑一次。
-- ============================================================

-- 1) 祝福表
create table if not exists public.blessings (
  id          uuid primary key default gen_random_uuid(),
  name        text not null default '',          -- 昵称；匿名为空
  content     text not null default '',          -- 祝福内容
  is_anon     boolean not null default true,     -- 是否匿名
  ua          text not null default '',          -- 浏览器标识（只做排查，不展示）
  created_at  timestamptz not null default now()
);

-- 兼容旧版本：缺列就补
alter table public.blessings add column if not exists name       text not null default '';
alter table public.blessings add column if not exists content    text not null default '';
alter table public.blessings add column if not exists is_anon    boolean not null default true;
alter table public.blessings add column if not exists ua         text not null default '';
alter table public.blessings add column if not exists created_at timestamptz not null default now();

create index if not exists blessings_created_idx on public.blessings (created_at desc);

-- 2) 安全规则
--    所有人都能看（祝福墙本来就该公开）；
--    任何人都能写（包括没登录的访客），但内容长度有硬限制，防止塞垃圾；
--    只有你们两个人能删。
alter table public.blessings enable row level security;

drop policy if exists blessings_read  on public.blessings;
drop policy if exists blessings_write on public.blessings;
drop policy if exists blessings_del   on public.blessings;

create policy blessings_read
  on public.blessings for select
  using (true);

create policy blessings_write
  on public.blessings for insert
  to anon, authenticated
  with check (
    char_length(btrim(content)) between 1 and 300
    and char_length(btrim(name)) <= 24
    and is_anon in (true, false)
  );

create policy blessings_del
  on public.blessings for delete
  to authenticated
  using (public.is_member());

-- 3) 实时推送（你们打开着页面时，新祝福会自己冒出来）
do $$
begin
  begin
    alter publication supabase_realtime add table public.blessings;
  exception
    when duplicate_object then null;
    when undefined_object then null;
  end;
end $$;

alter table public.blessings replica identity full;

-- 4) 看一眼结果
select count(*) as 祝福条数 from public.blessings;
select name, content, is_anon, created_at
from public.blessings
order by created_at desc
limit 20;

-- 想清空所有祝福（谨慎）：去掉下面这行的注释再运行
-- delete from public.blessings;