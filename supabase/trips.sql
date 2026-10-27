-- ============================================================================
--  旅行轨迹 🗺️  ——  打卡记录表 + 照片的城市标签
--
--  怎么用：Supabase 控制台 → 左边 SQL Editor → New query
--          → 把这个文件的内容全部复制粘贴进去 → Run
--          （需要先跑过 schema.sql；这个文件可以重复运行，不会重复建表）
--
--  跑完你会看到两行预览：一行是打卡记录数，一行是带城市标签的照片数。
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. 打卡记录表：一座城市一条记录
-- ---------------------------------------------------------------------------
create table if not exists public.trips (
  id          uuid primary key default gen_random_uuid(),
  province    text not null default '',      -- 省 / 直辖市 / 自治区
  city        text not null default '',      -- 城市名
  first_date  date,                          -- 第一次去
  last_date   date,                          -- 最近一次去
  times       int  not null default 1,       -- 一共去过几次
  note        text not null default '',      -- 那天的回忆
  author      text not null default '',      -- 谁记的
  created_at  timestamptz not null default now()
);

-- 兼容以前建过的旧版本（列不全时补齐）
alter table public.trips add column if not exists province   text not null default '';
alter table public.trips add column if not exists city       text not null default '';
alter table public.trips add column if not exists first_date date;
alter table public.trips add column if not exists last_date  date;
alter table public.trips add column if not exists times      int  not null default 1;
alter table public.trips add column if not exists note       text not null default '';
alter table public.trips add column if not exists author     text not null default '';
alter table public.trips add column if not exists created_at timestamptz not null default now();

create index if not exists trips_first_date_idx on public.trips (first_date desc);
create index if not exists trips_province_idx   on public.trips (province);

-- ---------------------------------------------------------------------------
-- 2. 照片加上「城市 / 省份」标签（上传照片时填的城市名会存在这里）
-- ---------------------------------------------------------------------------
alter table public.photos add column if not exists city     text;
alter table public.photos add column if not exists province text;

-- ---------------------------------------------------------------------------
-- 3. 安全规则：所有人都能看地图，只有你们两个人能改
-- ---------------------------------------------------------------------------
alter table public.trips enable row level security;

drop policy if exists trips_read on public.trips;
create policy trips_read on public.trips
  for select using (true);

drop policy if exists trips_write on public.trips;
create policy trips_write on public.trips
  for all to authenticated
  using (public.is_member())
  with check (public.is_member());

-- ---------------------------------------------------------------------------
-- 4. 实时同步：一个人在手机上打了卡，另一个人那边地图立刻亮
-- ---------------------------------------------------------------------------
do $$
begin
  alter publication supabase_realtime add table public.trips;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

alter table public.trips replica identity full;

-- ---------------------------------------------------------------------------
-- 5. 看一眼结果
-- ---------------------------------------------------------------------------
select count(*) as "打卡记录条数" from public.trips;
select count(*) as "带城市标签的照片" from public.photos where city is not null and city <> '';