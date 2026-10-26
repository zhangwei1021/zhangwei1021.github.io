/* =========================================================================
 *  站点配置 —— 你只需要改这个文件
 * =========================================================================
 *  1) 云端模式：把 Supabase 的 Project URL 和 anon public key（新界面叫 publishable key）填到下面。
 *     两处都填好之后，网站会自动从「本地模式」切换到「云端模式」，
 *     实现两个人登录、照片云端存储、设置同步。
 *
 *  2) 本地模式（默认）：两处留空即可。数据只存在当前浏览器里，
 *     照片放在 IndexedDB，换设备/换浏览器看不到。
 * ========================================================================= */

window.APP_CONFIG = {
  // ↓↓↓ 从 Supabase 项目页右上角「Connect」弹窗复制（详见 README.md 第三节）↓↓↓
  supabaseUrl: 'https://hyshywpvzskathajihqo.supabase.co',
  supabaseAnonKey: 'sb_publishable_B8vjYL2lg_12Vutxz0h8QA_fzauMD4k',
  // ↑↑↑ 例：'https://abcdefghijk.supabase.co' 和 'sb_publishable_...'
  //     老界面的 anon public 是 'eyJhbGciOi...' 开头，两种我都认 ↑↑↑

  // 公开读取的 Storage bucket（schema.sql 会自动创建）
  photoBucket: 'photos',
  mediaBucket: 'media',

  // 首次打开网站时的默认内容，登录后在「设置」里改，改完会覆盖这里
  defaults: {
    title: '张张包和止咳药的日常',
    subtitle: 'Zzzw ❤ Zzzky',
    anniversary: '2019-04-10',   // 在一起的纪念日
    nicknameA: 'Zzzw',
    nicknameB: 'Zzzky',
    avatarA: '',
    avatarB: '',
    tagline: '把每一个平凡的日子，都过成值得收藏的样子。',
    visibility: 'public',        // public = 访客也能看 | private = 必须先登录

    // 外观
    theme: {
      mode: 'light',             // light | dark | auto
      preset: 'sakura',
      bgStyle: 'gradient',       // solid | gradient | image
      bg1: '#fff1f5',
      bg2: '#ffe1ec',
      accent: '#ff6f91',
      bgImage: '',
      radius: 20
    },

    // 背景音乐
    music: {
      url: '',                   // mp3 直链或上传后的地址
      title: '',
      artist: '',
      cover: '',
      autoplay: false,
      volume: 0.6
    },

    // 首页展示
    homePhotoIds: [],            // 手动指定上首页的照片 id（留空则自动取最新 9 张）
    coverPhotoId: ''             // 首页顶部大图
  },

  // 外观预设，设置页里可直接点选
  presets: [
    { id: 'sakura',  name: '樱花粉', bg1: '#fff1f5', bg2: '#ffe1ec', accent: '#ff6f91' },
    { id: 'cream',   name: '奶油白', bg1: '#fffaf3', bg2: '#f6ecdd', accent: '#e08a4f' },
    { id: 'mist',    name: '雾霾蓝', bg1: '#f2f6fb', bg2: '#e0e9f5', accent: '#5b8def' },
    { id: 'mint',    name: '薄荷绿', bg1: '#f1faf6', bg2: '#dcf2e8', accent: '#3fb98a' },
    { id: 'sunset',  name: '晚霞橘', bg1: '#fff5f0', bg2: '#ffe3d3', accent: '#ff7a45' },
    { id: 'violet',  name: '暮光紫', bg1: '#f7f3ff', bg2: '#e8ddff', accent: '#8b5cf6' },
    { id: 'night',   name: '暗夜紫', bg1: '#241b2f', bg2: '#3a2a44', accent: '#c084fc' },
    { id: 'ink',     name: '水墨灰', bg1: '#f6f6f7', bg2: '#e6e7ea', accent: '#4b5563' }
  ]
};