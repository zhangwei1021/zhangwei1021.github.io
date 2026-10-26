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
assets/js/views/settings.js 设置（背景颜色、我们的信息、封面、音乐、密码…）

supabase/schema.sql         云端建表脚本（只在 Supabase 后台用一次）
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

> 这个脚本可以重复运行，不会清空已有数据。以后想加功能，改完再 Run 一次。

### 3. 建两个账号

1. 左侧 **Authentication** → **Users** → 右上角 **Add user** → **Create new user**
2. 填**你自己的邮箱 + 一个密码**，**勾上 `Auto Confirm User`**（重要，不勾的话登录会失败）→ Create user
3. 再点一次 Add user，用**对象的邮箱 + 另一个密码**建第二个账号
4. 顺手把注册口子关掉：**Authentication → Sign In / Providers → Email**，
   关掉 **Allow new users to sign up**（这样别人就算知道地址也注册不进来）
   - 如果找不到这个开关：**Authentication → Settings** 里也有同名选项

### 4. 拿到密钥

1. 左下角 **Project Settings（齿轮）→ API**
2. 复制这两个值：
   - **Project URL**：形如 `https://abcdefgh.supabase.co`
   - **anon public**（`Project API keys` 里的 anon / public）：很长一串 `eyJ...`
   - ❗️**不要**复制 `service_role` 那一串（那是管理员钥匙，泄露了别人能删库；anon 是公开的、由安全规则保护，放网页里没问题）

### 5. 填进网站

打开 `assets/js/config.js`，改成：

```js
window.APP_CONFIG = {
  supabaseUrl: 'https://abcdefgh.supabase.co',   // ← 你的 Project URL
  supabaseAnonKey: 'eyJhbGciOi...',              // ← 你的 anon public key
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
| 改我们的信息 | 设置 → 我们的信息（标题、副标题、昵称、头像、纪念日、一句话签名） |
| 换背景音乐 | 设置 → 背景音乐 → 填音乐直链或上传音频文件 |
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
- 云端表结构（全部带 RLS）：`members`、`settings`、`photos`、`diary_entries`、`notes`、`wishes`、`events`、`pokes`

祝你们长长久久 💗