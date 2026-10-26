/* =========================================================================
 *  主题引擎：把「设置」里的颜色/背景/圆角实时写进 CSS 变量
 * ========================================================================= */
window.Theme = (function () {
  'use strict';
  const CFG = window.APP_CONFIG || {};
  const root = document.documentElement;
  let mq = null;

  function defaults() {
    return JSON.parse(JSON.stringify((CFG.defaults && CFG.defaults.theme) || {}));
  }

  function normalize(t) {
    const d = defaults();
    const o = Object.assign({}, d, t || {});
    // 兼容旧字段名
    if (o.bg1 === undefined) o.bg1 = d.bg1;
    if (o.bg2 === undefined) o.bg2 = d.bg2;
    if (o.accent === undefined) o.accent = d.accent;
    o.mode = o.mode || 'light';
    o.bgStyle = o.bgStyle || 'gradient';
    o.radius = Number(o.radius);
    if (!isFinite(o.radius)) o.radius = 20;
    o.wallCols = Math.min(5, Math.max(2, Number(o.wallCols) || 3));
    return o;
  }

  function isDark(mode) {
    if (mode === 'dark') return true;
    if (mode === 'light') return false;
    return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  }

  /** 找预设（按 id） */
  function preset(id) {
    return (CFG.presets || []).find((p) => p.id === id) || null;
  }

  /** 把主题应用到页面 */
  function apply(theme) {
    const t = normalize(theme);
    root.style.setProperty('--c-bg1', t.bg1);
    root.style.setProperty('--c-bg2', t.bg2);
    root.style.setProperty('--c-accent', t.accent);
    root.style.setProperty('--radius', t.radius + 'px');
    root.style.setProperty('--wall-cols', String(t.wallCols));
    root.setAttribute('data-mode', isDark(t.mode) ? 'dark' : 'light');
    root.setAttribute('data-bg', t.bgStyle);
    root.style.setProperty('--bg-image', t.bgStyle === 'image' && t.bgImage ? `url("${t.bgImage}")` : 'none');

    // 手机上照片墙最多 2 列
    root.style.setProperty('--wall-cols-sm', String(Math.min(2, t.wallCols)));

    // 跟随系统
    if (mq) { mq.removeEventListener('change', onSysChange); mq = null; }
    if (t.mode === 'auto' && window.matchMedia) {
      mq = window.matchMedia('(prefers-color-scheme: dark)');
      mq.addEventListener('change', onSysChange);
      window.__themeCache = t;
    }
    window.__themeCache = t;
    return t;
  }
  function onSysChange() { if (window.__themeCache) apply(window.__themeCache); }

  function current() { return window.__themeCache || normalize(null); }

  /** 本地预览（未登录时也能换颜色，只存在这台设备上） */
  function previewGet() {
    try { const v = localStorage.getItem('love.theme.preview'); return v ? JSON.parse(v) : null; }
    catch (e) { return null; }
  }
  function previewSet(t) {
    try { localStorage.setItem('love.theme.preview', JSON.stringify(t)); } catch (e) { /* 忽略 */ }
  }

  /** 保存主题（合并写入 settings 表的 theme 字段；local=只存本机） */
  async function save(patch, opts) {
    const next = normalize(Object.assign({}, current(), patch || {}));
    apply(next);
    if (opts && opts.local) { previewSet(next); return next; }
    try { await window.DB.settings.patch({ theme: next }); }
    catch (e) { if (window.U) window.U.toast('主题保存失败：' + e.message, 'error'); }
    return next;
  }

  /** 选一个预设 → 直接套用三色 */
  async function usePreset(id, extra) {
    const p = preset(id);
    if (!p) return current();
    return save(Object.assign({ preset: p.id, bg1: p.bg1, bg2: p.bg2, accent: p.accent }, extra || {}));
  }

  return { apply, save, usePreset, current, normalize, preset, presets: () => CFG.presets || [], previewGet, previewSet };
})();