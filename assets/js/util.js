/* =========================================================================
 *  通用工具：日期、DOM、提示、图片压缩
 * ========================================================================= */
window.U = (function () {
  'use strict';

  /* ---------- DOM ---------- */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  /* ---------- 字符串 ---------- */
  const ESC_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ESC_MAP[c]);
  const nl2br = (s) => esc(s).replace(/\n/g, '<br>');
  const uid = () =>
    (window.crypto && crypto.randomUUID)
      ? crypto.randomUUID()
      : 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);

  /* ---------- 函数 ---------- */
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const debounce = (fn, ms = 300) => {
    let t;
    return function (...a) { clearTimeout(t); t = setTimeout(() => fn.apply(this, a), ms); };
  };
  const pad = (n) => String(n).padStart(2, '0');
  const clamp = (n, a, b) => Math.min(b, Math.max(a, n));

  /* ---------- 日期 ---------- */
  // 'YYYY-MM-DD' → 本地时间当天 00:00（避免 UTC 偏移导致差一天）
  function parseDate(s) {
    if (!s) return null;
    if (s instanceof Date) return s;
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s));
    if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
    const d = new Date(s);
    return isNaN(d) ? null : d;
  }
  const startOfDay = (d = new Date()) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dayDiff = (a, b) => Math.round((startOfDay(a) - startOfDay(b)) / 86400000);
  const todayStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };
  const WEEK = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

  function fmtDate(s, opt) {
    const d = parseDate(s);
    if (!d) return '';
    const o = opt || {};
    let out = o.short ? `${d.getMonth() + 1}月${d.getDate()}日`
                      : `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
    if (o.week) out += ' ' + WEEK[d.getDay()];
    return out;
  }

  function relTime(ts) {
    const d = ts instanceof Date ? ts : new Date(ts);
    if (isNaN(d)) return '';
    const diff = Date.now() - d.getTime();
    if (diff < 60e3) return '刚刚';
    if (diff < 3600e3) return Math.floor(diff / 60e3) + ' 分钟前';
    if (diff < 86400e3) return Math.floor(diff / 3600e3) + ' 小时前';
    if (diff < 172800e3) return '昨天 ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
    if (diff < 7 * 86400e3) return Math.floor(diff / 86400e3) + ' 天前';
    return fmtDate(d);
  }

  // 距离某天的毫秒数拆成 天/时/分/秒
  function breakdown(ms) {
    ms = Math.max(0, ms);
    const s = Math.floor(ms / 1000);
    return {
      d: Math.floor(s / 86400),
      h: Math.floor((s % 86400) / 3600),
      m: Math.floor((s % 3600) / 60),
      s: s % 60
    };
  }

  // 下一个「每年重复」的日期（生日、纪念日）
  function nextYearly(dateStr) {
    const d = parseDate(dateStr);
    if (!d) return null;
    const now = startOfDay();
    let next = new Date(now.getFullYear(), d.getMonth(), d.getDate());
    if (dayDiff(next, now) < 0) next = new Date(now.getFullYear() + 1, d.getMonth(), d.getDate());
    return next;
  }

  /* ---------- 文件 ---------- */
  function fileSize(n) {
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(0) + ' KB';
    return (n / 1024 / 1024).toFixed(1) + ' MB';
  }

  function readAsDataURL(file) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result);
      r.onerror = () => rej(r.error);
      r.readAsDataURL(file);
    });
  }

  /**
   * 上传前压缩：等比缩到 maxDim 以内并转 JPEG，手机上动辄 5MB 的原图能压到 200KB 左右。
   * @returns {Promise<{blob: Blob, width: number, height: number}>}
   */
  async function compressImage(file, opt) {
    const o = Object.assign({ maxDim: 1800, quality: 0.82 }, opt || {});
    if (!/^image\//.test(file.type) || /gif|svg/i.test(file.type)) {
      return { blob: file, width: 0, height: 0 };  // GIF/SVG 不处理，保动画/矢量
    }
    let bitmap;
    try {
      bitmap = await createImageBitmap(file);
    } catch (e) {
      return { blob: file, width: 0, height: 0 };
    }
    const scale = Math.min(1, o.maxDim / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, 0, 0, w, h);
    if (bitmap.close) bitmap.close();
    const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', o.quality));
    if (!blob || blob.size >= file.size) return { blob: file, width: bitmap.width || 0, height: bitmap.height || 0 };
    return { blob, width: w, height: h };
  }

  /* ---------- 交互反馈 ---------- */
  let toastTimer = null;
  function toast(msg, type) {
    const wrap = $('#toast-wrap');
    if (!wrap) return;
    const el = document.createElement('div');
    el.className = 'toast toast--' + (type || 'info');
    el.innerHTML = esc(msg);
    wrap.appendChild(el);
    requestAnimationFrame(() => el.classList.add('is-in'));
    setTimeout(() => {
      el.classList.remove('is-in');
      setTimeout(() => el.remove(), 260);
    }, 2600);
  }

  /** 确认弹窗，返回 Promise<boolean> */
  function confirmBox(message, opt) {
    const o = Object.assign({ title: '确认操作', okText: '确定', danger: true }, opt || {});
    return new Promise((resolve) => {
      const wrap = $('#modal-wrap');
      wrap.hidden = false;
      wrap.innerHTML = `
        <div class="modal-mask" data-close></div>
        <div class="modal" role="dialog" aria-modal="true">
          <h3 class="modal__title">${esc(o.title)}</h3>
          <p class="modal__text">${nl2br(message)}</p>
          <div class="modal__actions">
            <button class="btn btn--ghost" data-close>取消</button>
            <button class="btn ${o.danger ? 'btn--danger' : 'btn--primary'}" data-ok>${esc(o.okText)}</button>
          </div>
        </div>`;
      const close = (val) => {
        wrap.hidden = true;
        wrap.innerHTML = '';
        document.removeEventListener('keydown', onKey);
        resolve(val);
      };
      const onKey = (e) => { if (e.key === 'Escape') close(false); };
      document.addEventListener('keydown', onKey);
      wrap.querySelectorAll('[data-close]').forEach((n) => n.onclick = () => close(false));
      wrap.querySelector('[data-ok]').onclick = () => close(true);
      wrap.querySelector('[data-ok]').focus();
    });
  }

  /** 弹出表单弹窗，fields: [{name,label,type,value,placeholder,required,options,hint}] */
  function formBox(title, fields, opt) {
    const o = Object.assign({ okText: '保存' }, opt || {});
    return new Promise((resolve) => {
      const wrap = $('#modal-wrap');
      const rows = fields.map((f) => {
        const val = f.value == null ? '' : f.value;
        let input;
        if (f.type === 'textarea') {
          input = `<textarea class="input" name="${esc(f.name)}" rows="${f.rows || 3}" placeholder="${esc(f.placeholder || '')}">${esc(val)}</textarea>`;
        } else if (f.type === 'select') {
          input = `<select class="input" name="${esc(f.name)}">` +
            (f.options || []).map((op) =>
              `<option value="${esc(op.value)}"${String(op.value) === String(val) ? ' selected' : ''}>${esc(op.label)}</option>`).join('') +
            `</select>`;
        } else if (f.type === 'checkbox') {
          input = `<label class="check"><input type="checkbox" name="${esc(f.name)}"${val ? ' checked' : ''}><span>${esc(f.checkLabel || '')}</span></label>`;
        } else {
          input = `<input class="input" type="${esc(f.type || 'text')}" name="${esc(f.name)}" value="${esc(val)}" placeholder="${esc(f.placeholder || '')}">`;
        }
        return `<label class="field"><span class="field__label">${esc(f.label)}${f.required ? ' <i>*</i>' : ''}</span>${input}${f.hint ? `<span class="field__hint">${esc(f.hint)}</span>` : ''}</label>`;
      }).join('');
      wrap.hidden = false;
      wrap.innerHTML = `
        <div class="modal-mask" data-close></div>
        <div class="modal modal--form" role="dialog" aria-modal="true">
          <h3 class="modal__title">${esc(title)}</h3>
          <form class="modal__form">${rows}</form>
          <div class="modal__actions">
            <button class="btn btn--ghost" data-close>取消</button>
            <button class="btn btn--primary" data-ok>${esc(o.okText)}</button>
          </div>
        </div>`;
      const form = wrap.querySelector('form');
      const close = (val) => {
        wrap.hidden = true; wrap.innerHTML = '';
        document.removeEventListener('keydown', onKey);
        resolve(val);
      };
      const onKey = (e) => { if (e.key === 'Escape') close(null); };
      document.addEventListener('keydown', onKey);
      wrap.querySelectorAll('[data-close]').forEach((n) => n.onclick = () => close(null));
      wrap.querySelector('[data-ok]').onclick = () => {
        const data = {};
        fields.forEach((f) => {
          const el = form.elements[f.name];
          if (!el) return;
          data[f.name] = f.type === 'checkbox' ? el.checked : el.value.trim();
        });
        for (const f of fields) {
          if (f.required && !data[f.name]) { toast('请填写「' + f.label + '」', 'warn'); el0(form, f.name); return; }
        }
        close(data);
      };
      const el0 = (fm, name) => { const e = fm.elements[name]; if (e && e.focus) e.focus(); };
      const first = form.querySelector('input,textarea,select');
      if (first) first.focus();
    });
  }

  /** 统一处理「未登录」提示 */
  function needLogin() {
    toast('请先登录再操作', 'warn');
    location.hash = '#/login';
  }

  /** 私密页面在未登录时显示的「需要登录」卡片（按钮由 app.js 统一接管） */
  function lockCard(icon, title, desc) {
    return `<section class="section"><div class="empty card card--pad">
      <div class="empty__icon">${esc(icon)}</div>
      <div class="empty__title">${esc(title)}</div>
      <div class="empty__desc">${esc(desc)}</div>
      <button class="btn btn--primary" data-act="login">🔑 登录后查看</button>
    </div></section>`;
  }

  return {
    $, $$, esc, nl2br, uid, sleep, debounce, pad, clamp,
    parseDate, startOfDay, dayDiff, todayStr, fmtDate, relTime, breakdown, nextYearly,
    fileSize, readAsDataURL, compressImage,
    toast, confirmBox, formBox, needLogin, lockCard
  };
})();