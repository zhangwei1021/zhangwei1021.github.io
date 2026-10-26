/* =========================================================================
 *  极简 IndexedDB 封装 —— 本地模式下用来存照片二进制（localStorage 只有 5MB）
 * ========================================================================= */
window.IDB = (function () {
  'use strict';
  const DB_NAME = 'love-site';
  const STORE = 'files';
  let dbPromise = null;

  function open() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((res, rej) => {
      if (!window.indexedDB) return rej(new Error('浏览器不支持 IndexedDB'));
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      };
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
    return dbPromise;
  }

  async function tx(mode, fn) {
    const db = await open();
    return new Promise((res, rej) => {
      const t = db.transaction(STORE, mode);
      const store = t.objectStore(STORE);
      let out;
      try { out = fn(store); } catch (e) { rej(e); return; }
      t.oncomplete = () => res(out && out.result !== undefined ? out.result : out);
      t.onerror = () => rej(t.error);
      t.onabort = () => rej(t.error);
    });
  }

  const put = (key, val) => tx('readwrite', (s) => s.put(val, key));
  const get = (key) => tx('readonly', (s) => s.get(key));
  const del = (key) => tx('readwrite', (s) => s.delete(key));
  const keys = () => tx('readonly', (s) => s.getAllKeys());
  const clear = () => tx('readwrite', (s) => s.clear());

  return { put, get, del, keys, clear };
})();