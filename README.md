# 张张包和止咳药的日常 💗

给 Zzzw 和 Zzzky 的恋爱记录站：**相恋计时 + 纪念日倒数 + 照片墙 + 恋爱日记 + 悄悄话 + 心愿清单 + 主题设置**，
两个人各自登录后可以上传照片、把喜欢的照片放到首页、互相同步设置（Supabase 实时同步）。

- 纯静态网站（HTML + CSS + 原生 JS），**不需要安装任何东西、不需要编译**
- 没配置 Supabase 时：自动进入「本地预览模式」，数据存在自己浏览器里，随便试
- 配置了 Supabase 后：自动切换到「云端模式」，两人登录、上传照片、实时同步

---

## 一、文件都是干什么的

```
index.html                  网站入口（首页骨架）
CNAME                       自定义域名（zwandzky.me）
.nojekyll                   告诉 GitHub Pages 不要用 Jekyll 处理
README.md                   就是本文件（可以删，但留着方便以后查）

assets/css/style.css        全部样式（配色、卡片、照片墙…）
assets/js/config.js         ★ 你以后唯一需要改的文件：Supabase 地址、默认文案、配色预设
assets/js/util.js           小工具（弹窗、提示、日期计算、图片压缩…）
assets/js/idb.js            本地模式下存照片的 IndexedDB 封装
assets/js/backend.js        数据层：本地模式 / 云端模式自动切换（登录、照片、日记…都在这）
assets/js/theme.js          配色、深浅色、背景样式
assets/js/app.js            主控：路由、顶栏、页脚、音乐播放器、大图查看
assets/js/views/home.js     首页（计时器 / 倒数 / 里程碑 / 照片墙）
assets/js/views/gallery.js  相册（上传、筛选、设为首页、删除）
assets/js/views/diary.js    恋爱日记（时间轴）
assets/js/views/notes.js    悄悄话留言板
assets/js/views/wishes.js   心愿清单
assets/js/views/map.js      旅行轨迹（中国地图打卡，点省份看第一次去的时间 / 次数 / 照片）
assets/js/china-map.js      中国地图数据（34 个省轮廓，离线可用，不用连网）
assets/js/views/settings.js 设置（背景颜色、我们的信息、封面、音乐、密码…、AI 分身）
assets/js/views/ai.js       AI 分身聊天页（可选功能，按第八节配置后才会出现内容）

assets/img/buddy-pixar.jpg     分身形象：Q 版小人（默认用这张，会呼吸、会蹦、想你时冒爱心）
assets/img/buddy-pixar-face.jpg 同一张图的脸部特写（聊天气泡左边的圆头像用它）
assets/img/buddy-him.jpg       备选形象：照真人照片裁的那张
assets/img/buddy-him-old.jpg   备选形象：3D 童话
assets/img/buddy-him-2d.jpg    备选形象：二次元
assets/img/buddy-him-soft.jpg  备选形象：小清新
（想换成别的，直接在设置页「💬 AI 分身 → 分身形象」点一下，或上传自己的图）

supabase/schema.sql         云端建表脚本（只在 Supabase 后台用一次）
supabase/trips.sql          旅行轨迹建表脚本（用「🗺️ 旅行轨迹」就要跑一次，第三节第 2 步）
supabase/ai.sql             AI 分身建表脚本（可选，第八节第 1 步粘贴用）
supabase/ai-persona.sql     现成的人设 + 10 条记忆（可选，第八节第 5 步可一键导入）
supabase/functions/ai-chat/index.ts   AI 分身的服务端代码（第八节第 4 步粘贴用）
```

> ⚠️ 上传到 GitHub 时**要保持这个目录结构**（`assets` 文件夹要一起传上去），
> 否则页面会变成没有样式的白板。

---

## 二、第一步：把网站传上去（3 分钟）

### 方式 A：网页拖拽上传（推荐，最简单）

1. 电脑上打开你的仓库页面：`https://github.com/你的用户名/仓库名`
2. 点 **Add file（添加文件）→ Upload files（上传文件）**
3. 把 `index.html`、`README.md`、`CNAME`、`.nojekyll`、`assets` 文件夹、`supabase` 文件夹
   **一起拖进**页面中间的虚线框里
   - 拖文件夹可以整个拖，GitHub 会自动保留里面的结构
   - 如果 `.nojekyll` 拖不上去（系统隐藏了它），不影响使用，跳过即可
4. 下面 Commit changes 的说明随便写（例如 `第一次上传`），点绿色按钮 **Commit changes**
5. 等 1～2 分钟，打开 <https://zwandzky.me/> 就是新首页了 🎉
   - 如果还是旧页面，按 `Ctrl + F5` 强制刷新，或等 2 分钟再看

### 方式 B：GitHub Desktop

把仓库 Clone 到本地 → 把上面这些文件复制进仓库文件夹 → Commit → Push。

### 如果打开是 404 或白屏

在仓库 **Settings → Pages** 里确认：

- **Source**: `Deploy from a branch`
- **Branch**: `main`（或 `master`）+ 文件夹 `/ (root)` → Save
- **Custom domain**: `zwandzky.me` → Save（保存后等 DNS 检查通过，勾上 Enforce HTTPS）

---

## 三、第二步：注册 Supabase（两人登录 / 上传照片 / 同步）

> 免费版就够用：图片会在上传前自动压缩（长边 1800px），一张大约 300～500 KB，
> 免费额度大约能放两三千张。真的放满了再删旧照片就行。

### 1. 建项目

1. 打开 <https://supabase.com> → 右上角 **Start your project** → 用 GitHub 或邮箱注册/登录
2. **New project**：
   - Name：`love-site`
   - Database Password：随便设一个强密码，**记下来**（平时用不到）
   - Region：选 **Southeast Asia (Singapore)** 或 **Northeast Asia (Tokyo)**（离国内近、速度快）
   - Plan：Free
3. 点 **Create new project**，等 1～2 分钟初始化完成

### 2. 建表（复制粘贴即可）

1. 左侧栏点 **SQL Editor** → **New query**
2. 打开本项目里的 `supabase/schema.sql`，**全选复制**，粘贴进编辑器
3. 把里面的两个邮箱改成**你们俩注册 Supabase 用的真实邮箱**：
   ```sql
   insert into public.members (email, nickname) values
     ('你的邮箱@xx.com',    'Zzzw'),
     ('对象的邮箱@xx.com',  'Zzzky')
   on conflict (email) do update set nickname = excluded.nickname;
   ```
4. 点右下角 **Run**（或按 `Ctrl + Enter`），看到 Success 就成功了
5. **再跑一个旅行轨迹的脚本**：把 `supabase/trips.sql` 全选复制 → SQL Editor 里 **New query** → 粘贴 → **Run**
   （这个脚本负责「🗺️ 旅行轨迹」的地图打卡和照片的城市标签；跑完网站里才能打卡）
   > 用了 AI 分身的话，`supabase/ai.sql` 也是同样的跑法（见第八节第 1 步）。

> 这些脚本都可以重复运行，不会清空已有数据。以后想加功能，改完再 Run 一次。

### 3. 建两个账号

1. 左侧 **Authentication** → **Users** → 右上角 **Add user** → **Create new user**
2. 填**你自己的邮箱 + 一个密码**，**勾上 `Auto Confirm User`**（重要，不勾的话登录会失败）→ Create user
3. 再点一次 Add user，用**对象的邮箱 + 另一个密码**建第二个账号
4. 顺手把注册口子关掉：**Authentication → Sign In / Providers → Email**，
   关掉 **Allow new users to sign up**（这样别人就算知道地址也注册不进来）
   - 如果找不到这个开关：**Authentication → Settings** 里也有同名选项

### 4. 拿到密钥

> **先记住这个名字对照，别被两个名字绕晕 —— 它们指的是同一个东西：**
>
> | 仪表盘里叫 | 代码/弹窗里叫 | 在哪 |
> | --- | --- | --- |
> | **Project URL** | `SUPABASE_URL` | `https://xxxx.supabase.co` |
> | **publishable key**（或旧的 anon / public） | `SUPABASE_ANON_KEY` | `sb_publishable_...`（或 `eyJ...`） |
>
> 所以：你在 Connect 弹窗里看到的 `SUPABASE_URL`，**就是**要找的 Project URL ✅

Supabase 改过好几版界面，**优先用方法 A**，找不到再往下看（三种方法拿到的都是同一样东西）：

**方法 A：项目页右上角的「Connect」按钮（最省事，一次拿到两样）**

1. 在 Supabase 项目页面**右上角**找绿色的 **Connect** 按钮，点开
2. 弹窗里选 **App Frameworks** 标签（默认就是它）
3. 里面直接写着 **Project URL** 和一把 **publishable key**（`sb_publishable_...` 开头），右边各有一个复制按钮
4. 把这两个值复制下来 —— 网站要的就是这两样

**方法 B：看地址栏（界面怎么改都不会失效）**

浏览器地址栏里是 `https://supabase.com/dashboard/project/abcdefgh`，
中间那串 `abcdefgh` 就是你的项目 ID，**Project URL = `https://abcdefgh.supabase.co`**。
（这个方法只拿到 URL，钥匙还要按方法 C 找。）

**方法 C：设置页里找**

1. 左下角 **Project Settings（齿轮图标）**
2. **钥匙** 在 **API Keys** 这一页（老界面叫 **API**，两个名字都找一下）：
   - 优先用 **Legacy API keys** 标签页里的 **anon / public**（很长一串 `eyJ...`）
   - 如果只有 **Publishable key**（`sb_publishable_...` 开头），用它也一样，我们的代码两种都认
   - ❗️**不要**复制 `service_role` 或 `secret` 那种管理员钥匙（泄露了别人能删库；anon / publishable 是公开的，由安全规则保护，放网页里没问题）
   - 想核对一下 URL：**Data API** 那一页也写着 Project URL（老界面叫 **API**），和方法 B 推出来的一样；找不到这一页不影响，用方法 A 就够了

> 找不到这些菜单？先看一眼左侧栏有没有 **Table Editor / SQL Editor**。
> 如果显示的是 **New project** 按钮，说明项目还没建好（建完要等 1~2 分钟 "Setting up project" 才能看到菜单）。

### 5. 填进网站

打开 `assets/js/config.js`，改成：

```js
window.APP_CONFIG = {
  supabaseUrl: 'https://abcdefgh.supabase.co',   // ← 你的 Project URL
  supabaseAnonKey: 'eyJhbGciOi...',              // ← anon public（或 sb_publishable_ 开头的）
  ...
};
```

保存后，**把 config.js 重新上传到 GitHub**（仓库里进 `assets/js/` → 点 config.js → 铅笔图标直接在线编辑也行，
改完 Commit changes），刷新网站。

### 6. 登录试试

- 网站右上角 → **登录** → 输入邮箱密码 → 然后选「你是哪一位？」（Zzzw / Zzzky）
  - 这个选择只影响「这条日记是谁写的」，在设置里可以随时改
- 登录后：顶栏会出现你们的头像，上传、编辑、设置按钮就都能用了
- 想退出：点右上角头像 → 退出登录

### 7. 检查一下照片桶

左侧 **Storage** 里应该能看到两个桶：`photos`（照片）和 `media`（背景图/头像/音乐）。
如果没看到，说明第 2 步的 SQL 没跑成功，把 `schema.sql` 再 Run 一次。

---

## 四、日常怎么用

| 想做的事 | 怎么做 |
| --- | --- |
| 上传照片 | 登录后 → 顶栏「相册」→ 把照片拖进虚线框（可一次拖多张）→ 填日期/标签/说明 |
| 把某张照片放到首页 | 相册里把鼠标移到照片上，点 **🏠**（再点一次 = 从首页移除）；**🖼️** = 设为首页顶部大图；**✏️** = 改描述/标签；**🗑️** = 删除 |
| 换首页大图 | 上面那个 🖼️，或者在 设置 → 首页展示 里选一张 |
| 改背景颜色 | 设置 → 配色：直接点色块（8 套预设），或自己调两个背景色 + 主色，还能上传背景图 |
| 换深浅色 / 背景样式 | 设置 → 纯色 / 渐变 / 背景图；顶栏也能一键切深浅色 |
| 写日记 | 顶栏「日记」→ 新增，选日期、心情、可挂一张照片 |
| 发悄悄话 | 顶栏「悄悄话」→ 写一句话，对方下次打开会看到未读高亮 |
| 记心愿 | 顶栏「心愿单」→ 添加，实现后打勾（会自动记下完成日期） |
| 戳对方一下 | 首页点 **💗 戳一戳**；对方下次打开首页，计时器下面就会看到「×× 今天想你了 N 次」 |
| 看往年今天 | 首页「🕰️ 去年的今天」会自动汇总这一天在往年留下的照片和日记（没有就提示你补一张） |
| 打卡去过的地方 | 顶栏「🗺️ 旅行轨迹」→ 右上 **＋ 打卡一座城市** → 选省份、填城市名、第一次去的时间、一共去过几次、想留一句话 |
| 看地图点亮 | 去过的省份会自动亮起来（去得越多颜色越深｜数字是去过的次数）；点省份或圆点 → 右边显示**第一次去的时间 / 一共几次 / 那个城市的照片 / 打卡记录**（可以改、可以删） |
| 给照片标上城市 | 相册上传时在「在哪个城市拍的」里选（会列出你打卡过的城市）→ 这张照片就会出现在地图里对应省份的下面 |
| 按城市找照片 | 相册上面那排筛选条会多出「📍 杭州」这样的城市按钮，点一下只看这个城市的照片 |
| 跟 AI 分身聊天 | 顶栏「💬 AI 分身」→ 像发微信一样打字（需要先按 **第八节** 配置好） |
| 看会动的分身 | AI 分身页左边那个小人、首页计时器左边那个、还有聊天气泡左边的圆头像，都是同一个人（用你那张 Q 版图做的）：平时轻轻呼吸、说话时一弹一弹，等回复时歪头想，想你的时候会冒爱心 |
| 教 AI 更像你 | 设置 → 最下面 **💬 AI 分身**：写人设、说话习惯，在「🧠 记忆清单」里加你们的小事 |
| 换分身形象 | 设置 → **💬 AI 分身 → 分身形象**：点「Q 版小人 / 照片版 / 3D 童话 / 二次元 / 小清新」任选一个，或点「自己的图」上传一张（点一下立刻生效，不用点保存） |
| 让 AI 主动问候 | 设置 → AI 分身 → 勾上「早上主动道早安 / 晚上主动道晚安」，TA 打开网站时会自动收到一句 |
| 只想让 TA 跟 AI 聊 | 设置 → AI 分身 → 「分身代表谁」选自己：**TA 打开是能聊天的页面，你打开是只读的「她和你的 AI 分身聊了什么」**（想两边都能聊，就把它当成共用的） |
| 改我们的信息 | 设置 → 我们的信息（标题、副标题、昵称、头像、纪念日、一句话签名） |
| 换背景音乐 | 设置 → 背景音乐 → 加一首（上传音频文件，或填一个音乐直链）→ 右下角播放器就能放 |
| 放好几首歌 | 设置 → 背景音乐 → **播放列表** 里可以一直 **＋ 添加一首**（也能上传 mp3），每首都能改名字/歌手、上移下移、删除 |
| 选播放方式 | 设置 → 背景音乐 → **播放方式**：顺序播放 / 列表循环（放完回到第一首）/ 单曲循环 / 随机播放；播放器上那个按钮点一下也能换 |
| 网站只让自己看 | 设置 → 「谁能浏览」选「只有登录后才能浏览」（没登录的人只能看到登录框） |
| 改密码 | 设置页最下面 → 填新密码 → 「修改我的密码」（或在 Supabase 后台 Users 里 Reset password） |
| 手机上像 App 一样用 | 手机浏览器打开网站 → 分享 → 「添加到主屏幕」 |

首页还会自动显示：
- **相恋第 N 天** + 实时走动的计时器（天/时/分/秒）
- **纪念日倒数**：下一个周年、距离 520 天、1000 天、1314 天…
- **里程碑进度条**：已经走过哪些节点、下一个还差多少天
- **🕰️ 去年的今天**：往年这一天拍的照片、写的日记（最多显示几年前，没有记录时可以一键补）
- **💗 戳一戳**：想对方了就点一下，对方打开首页会看到今天被想了几次

---

## 五、常见问题

**Q：登录提示「Invalid login credentials」？**
账号没建成功或密码错了。去 Supabase **Authentication → Users** 看有没有这两个邮箱；
没有就重新 Add user，一定要勾 **Auto Confirm User**。

**Q：登录后还是不能上传？**
大概率是 `members` 白名单里的邮箱和登录邮箱不一致（大小写、多空格都不行）。
去 **SQL Editor** 里执行
`select * from public.members;` 看一眼，
不对就 `insert into public.members(email, nickname) values ('真实邮箱','Zzzw');`。

**Q：照片上传失败？**
先看 Storage 里有没有 `photos` 桶，再确认 SQL 脚本第 4 段（bucket + 策略）跑过。

**Q：旅行轨迹打卡报错 / 地图点不亮？**
`supabase/trips.sql` 还没跑。去 SQL Editor 把它整份粘进去 Run 一次；跑完再打卡，省份就会亮。
（报错里出现 `relation "public.trips" does not exist` 就是这个问题。）

**Q：背景音乐不响？**
两种常见原因：①手机/浏览器不允许自动播放，点一下右下角播放器的 ▶ 就行；
②填的音乐地址不是**直链**（要以 `.mp3` / `.m4a` 这类结尾，网盘分享链接不行）—— 最稳的办法是在设置里**上传音频文件**。
播放器上还能切「顺序 / 列表循环 / 单曲循环 / 随机」；列表里有好几首时，右侧会显示 `1/3` 这样的第几首。

**Q：两个人看到的数据不一样？**
一方没登录（本地模式的数据不会上传），或者一方还没刷新。云端模式是实时的，
对方做出修改后这边一般 1 秒内自动更新；不行就刷新页面。

**Q：想删除照片/日记？**
登录状态下，鼠标移到卡片上会出现 🗑 删除按钮（删除前会二次确认）。

**Q：日记、心愿单、悄悄话会被别人看到吗？**
不会。默认**日记 / 心愿单 / 悄悄话 / 戳一戳都只有你们俩登录后才能看**（`supabase/schema.sql` 里已经这么设了）。
对外公开的只有三样：站点设置、照片墙、纪念日（这样访客不登录也能看到你们的照片墙）。
如果以后想让访客也能翻日记，把 `supabase/schema.sql` 最后「6. 可选：把日记 / 心愿改回公开」那段取消注释，再 Run 一次就行。

**Q：国内打开慢？**
GitHub Pages 在国内时快时慢。以后如果嫌慢，可以把整个项目搬到 Vercel / Cloudflare Pages
（也是免费、支持自定义域名），代码一行都不用改。

**Q：数据安全吗？**
- anon key 放在网页里是**正常且安全**的，真正的保护来自 `schema.sql` 里的 RLS 规则：
  只有白名单邮箱能改数据，其他人只能看公开内容（悄悄话连看都看不到）。
- 千万别把 `service_role` key 填进 `config.js`。
- 建议偶尔在 Supabase **Database → Backups** 看一眼，或定期把重要照片在电脑上留一份。

---

## 六、以后想自己改点什么

| 想改 | 去哪 |
| --- | --- |
| 默认标题/昵称/纪念日/子标题 | `assets/js/config.js` → `defaults`（⚠️ 网站上改过的设置会覆盖这里的默认值，想生效可先在设置里恢复默认） |
| 配色预设（8 套色板） | `assets/js/config.js` → `presets` |
| 纪念日里程碑数字（100/365/520/1314…） | `assets/js/views/home.js` 顶部的 `DAY_MARKS` |
| 心情选项 | `assets/js/views/diary.js` 顶部的 `MOODS` |
| 字体、圆角、间距 | `assets/css/style.css` 顶部的 `:root` 变量 |

改完记得重新上传对应文件（GitHub 在线编辑也支持）。

---

## 七、技术说明（给自己看的）

- 无构建、无依赖安装；Supabase SDK 从 CDN 加载，加载失败会自动降级成本地模式
- 数据层 `assets/js/backend.js` 对外暴露统一接口（`DB.settings / photos / diary / notes / wishes / events / pokes`），
  本地模式用 `localStorage + IndexedDB`，云端模式用 Supabase PostgREST + Storage + Realtime
- 本地模式的数据**只在自己这台浏览器**里；配置 Supabase 后不会自动迁移历史数据（重新上传即可）
- 上传的照片会用 Canvas 先在浏览器里压缩（长边 ≤1800px），省流量、省空间
- 云端表结构（全部带 RLS）：`members`、`settings`、`photos`、`diary_entries`、`notes`、`wishes`、`events`、`pokes`、`trips`
  （旅行打卡，另有 `photos.city` / `photos.province` 两个字段记城市），
  AI 分身另加 `ai_config`、`ai_memories`、`ai_messages`（见第八节）
- 旅行地图**不连网**：34 个省的轮廓已经提前算好存在 `assets/js/china-map.js` 里（等距圆柱投影 + 抽稀，
  约 145 KB），所以断网、CDN 抽风都能正常点亮
- 背景音乐是**浏览器自己放**的：多首播放列表 + 顺序/列表循环/单曲循环/随机四种模式都由 `app.js` 的播放器管；
  手机浏览器默认不允许自动播放，需要用户点一下播放器（这是浏览器的规矩，不是 bug）
- AI 分身（可选）：网页里**不存**任何模型的钥匙。钥匙放在 Supabase 的 secret 里，由 Edge Function
  `ai-chat`（`supabase/functions/ai-chat/index.ts`）代网站去调用大模型 —— 别人翻网页源码也拿不到你的 key；
  支持 DeepSeek 官方与阿里云百炼两家（都是 OpenAI 兼容接口，换 base_url + 钥匙 + 模型名即可）；
  聊天记录存 `ai_messages`，RLS 保护，只有你们两个人能读

## 八、想加「AI 分身」？（可选：让 TA 能跟「AI 版的你」聊天）

这一步**是可选的**。不做的话网站一切照常，只是点开「💬 AI 分身」会看到一张安装说明卡片。
做好了以后：TA 打开顶栏的「💬 AI 分身」，就能像发微信一样跟一个「AI 版的你」聊天；
早上或晚上第一次打开，它还会主动说一句早安/晚安。

> 它不是把你的聊天记录拿去训练模型，而是「让通用的 AI 照着你的**人设 + 记忆**说话」——
> 你说它该怎么说话、你们有哪些小事，它就照这些回答，不会自己乱编。

总共 4 件事，全程在网页上点，**不用装任何软件**：

| 要准备的东西 | 在哪 | 花多久 |
| --- | --- | --- |
| **模型钥匙**（AI 的大脑，两家选一家） | DeepSeek 官方 platform.deepseek.com，或 阿里云百炼 bailian.console.aliyun.com | 3 分钟 |
| 跑一次 `supabase/ai.sql` | Supabase → SQL Editor | 1 分钟 |
| 把钥匙存进 Supabase secret | Supabase → Edge Functions → Secrets | 1 分钟 |
| 部署 `ai-chat` 函数 | Supabase → Edge Functions | 3 分钟 |

### 第 1 步：建表
Supabase → 左边 **SQL Editor** → **New query** → 把 `supabase/ai.sql` 全部内容粘进去 → **Run**。
**应该看到**：`Success. No rows returned`。（这个文件可以重复跑，不会弄坏已有数据。）
> 之前跑过旧版的话，**再跑一次**就好——新版多了「用哪家模型」这一列。

### 第 2 步：拿一把模型钥匙（两家选一家，都行）

| 选哪家 | 去哪拿 | 钥匙长什么样 | 推荐模型 |
| --- | --- | --- | --- |
| **A. DeepSeek 官方** | https://platform.deepseek.com/ → API keys | `sk-` 开头 | `deepseek-flash`（快、便宜） |
| **B. 阿里云百炼** | https://bailian.console.aliyun.com/ → 右上角头像 → **API-KEY** → 创建 | `sk-` 开头（比 DeepSeek 的长） | `qwen-plus`（够用、便宜），想更聪明用 `qwen-max` |

**两家都怎么选：**
- 只想快点跑通、没注册过任何一家 → 选 **A. DeepSeek 官方**（注册最简单，充 ¥10 能用很久）。
- 已经在用阿里云百炼（比如你手上有百炼的 key、或者账户里有额度）→ 选 **B. 阿里云百炼**，不用再注册一家。
- 两个都想要也行：两把钥匙都存进 Supabase（不同名字），网站「设置 → AI 分身 → 用哪家的模型」里随时切换。

> ⚠️ 百炼的钥匙是**分地域**的：北京地域的 key 只能配北京地域的地址。默认的
> `dashscope.aliyuncs.com` 就是北京，直接用即可；如果你用的是新加坡等地，需要在 Supabase 里
> 额外加一个 secret `AI_BASE_URL`（看下面第 3 步的说明）。
> 另外百炼里要**先在「模型广场」开通**你要用的模型（qwen 系列默认开通，DeepSeek 系列需要手动开通）。

### 第 3 步：把钥匙存进 Supabase
Supabase → 左边 **Edge Functions** → 上方 **Secrets** → **Add new secret**，名字按你选的那家填：

| 你选的是 | Name 填 | Value 填 |
| --- | --- | --- |
| A. DeepSeek 官方 | `DEEPSEEK_API_KEY` | 刚复制的 `sk-...` |
| B. 阿里云百炼 | `DASHSCOPE_API_KEY` | 刚复制的 `sk-...` |
| 两家都想用 / 懒得记 | `AI_API_KEY` | 任意一家的 key（这个名字优先级最高） |

**应该看到**：列表里出现你刚加的那一行（只能看到名字，看不到内容，这是正常的）。

可选的额外 secret（不填也能跑）：
- `AI_MODEL`：强制指定模型名，比如 `qwen-plus`（会盖掉网站上选的）
- `AI_BASE_URL`：自定义接口地址，例如百炼的业务空间专属域名
  `https://<你的WorkspaceId>.cn-beijing.maas.aliyuncs.com/compatible-mode/v1`

### 第 4 步：部署 ai-chat 函数
1. Supabase → 左边 **Edge Functions** → **Deploy a new function**
2. 选 **Via Editor**（在网页里直接粘代码，不需要命令行）
3. **Function name** 填 `ai-chat`（一字不差）
4. 把 `supabase/functions/ai-chat/index.ts` 的内容整个粘进编辑器（**把里面自带的示例代码全部替换掉**）
5. 点 **Deploy function**，等 10~30 秒
**应该看到**：函数列表里出现 `ai-chat`，状态是绿色的 **ACTIVE**，点开还有 **Test** 按钮。
以后如果你改了这个文件，重新粘一次 → 点 **Deploy updates** 即可。

### 第 5 步：回网站写人设（最花心思、也最值得的一步）

> 🚀 **想省事就先一键导入**：`supabase/ai-persona.sql` 里已经写好了一份现成的人设 ——
> 照着 Zzzw 平时说话的口吻（宝宝/宝贝、短句、每天的早安午安晚安、想她的时候会撒娇），
> 外加 10 条记忆（纪念日、她的网课、情侣羽绒服、化妆品、被老师骂了……）。
> 在 SQL Editor 里**整段粘贴 → Run** 就全填好了，之后在这个设置页里慢慢改就行。

登录网站 → **设置** → 拉到最下面 **💬 AI 分身**：
- 「这个分身代表谁」选你自己（比如 Zzzw）
- **「用哪家的模型」**选你第 2 步选的那家（DeepSeek 官方 / 阿里云百炼），右边「用哪个模型」填或选模型名
  （DeepSeek 官方：`deepseek-flash`；百炼：`qwen-plus`）
- **人设**：你平时怎么说话、怎么称呼她、她在意什么、她累的时候你一般怎么说
- **说话习惯**：口头禅、不要出现的腔调（比如别用「亲爱的用户」这种）
- **🧠 记忆清单**：点「＋ 添加记忆」，一条一条加你们的小事——她不吃什么、第一次见面在哪、
  她的生日、她生气时该怎么办、你们常去的店……（加得越多，它越像你）
- 点 **💾 保存分身设置**，再点 **🔌 测试连接**
**应该看到**：`✅ 通了！DeepSeek 官方 · 模型 deepseek-flash，今天已经聊了 0 句`
（或 `阿里云百炼 · 模型 qwen-plus`）。然后让 TA 打开「💬 AI 分身」就能聊了 🎉

### 出问题看这里
| 现象 | 原因 / 怎么办 |
| --- | --- |
| 测试连接报「还联系不上 AI 分身」 | 第 4 步没成功：Edge Functions 里要有 `ai-chat` 且是绿色 ACTIVE，名字必须一模一样 |
| 报「relation "public.ai_config" does not exist」 | 第 1 步没跑：回去跑一遍 `supabase/ai.sql` |
| 报「column "provider" does not exist」 | 旧的 ai.sql 跑过、新版没跑：再粘一次 `supabase/ai.sql` 跑一遍即可 |
| 报「钥匙不对 / 401」 | ① secret 名字对不上你选的那家（DeepSeek 官方要 `DEEPSEEK_API_KEY`，百炼要 `DASHSCOPE_API_KEY`）；② 值前后有空格；③ 百炼的 key 是分地域的，跨地域会报 `invalid_api_key` |
| 报「找不到这个模型 / 404」 | 「用哪个模型」的模型名和这家服务商对不上：DeepSeek 官方填 `deepseek-flash`，百炼填 `qwen-plus`；百炼里还要先在模型广场**开通**该模型 |
| 报「余额不足 / 402」 | 那家账户没钱了，去充值 |
| 报「今天聊得有点多 / 429」 | 到每天上限了（设置页可改，默认 60 句；AI 主动问候不占额度） |
| 想让它更聪明 | DeepSeek 官方换 `deepseek-v4-pro`，百炼换 `qwen-max`（都贵一些） |
| 聊天记录在哪 | Supabase 的 `ai_messages` 表里，只有你们两个人能看（RLS 保护） |
| 不想用了 | 设置里取消勾选「开启 AI 分身」；或在 Supabase 里删掉 `ai-chat` 函数 |

> 💡 想让 AI 更像你：把你们的聊天记录导出成 txt（QQ 消息记录导出 / 微信复制粘贴都行，
> 300~1000 条就够），**先把地址、身份证、银行卡这类内容删掉**，再发给我，我帮你把它提炼成
> 人设和「记忆清单」，你过目后再填进设置页。

---

祝你们长长久久 💗