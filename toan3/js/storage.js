// Phần lưu trữ, tách riêng khỏi app.
// Hiện lưu trên chính máy (IndexedDB, kèm một bản phụ trong localStorage).
// Sau này muốn lưu online (Firebase, Google Drive) thì chỉ cần viết lại
// các hàm load() và save() trong file này, phần còn lại của app giữ nguyên.

const DB_NAME = 'toan3';
const STORE = 'kv';
const KEY = 'state';
const LS_KEY = 'toan3-state';
const LS_BEFORE_RESTORE = 'toan3-truoc-khi-khoi-phuc';

let dbPromise = null;
function openDB() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      if (!('indexedDB' in window)) return reject(new Error('Không có IndexedDB'));
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

async function idb(mode, fn) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(req ? req.result : undefined);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

function lsGet() {
  try { const t = localStorage.getItem(LS_KEY); return t ? JSON.parse(t) : null; } catch (e) { return null; }
}

// Đọc dữ liệu: lấy bản mới hơn giữa IndexedDB và bản phụ.
export async function load() {
  let a = null;
  try { a = await idb('readonly', (s) => s.get(KEY)); } catch (e) { a = null; }
  const b = lsGet();
  if (a && b) return (b.savedAt || 0) > (a.savedAt || 0) ? b : a;
  return a || b || null;
}

// Ghi lần lượt từng lần một để không bị chồng nhau.
let queue = Promise.resolve();
export function save(state) {
  const text = JSON.stringify(state);
  queue = queue.then(async () => {
    let ok = false;
    try { await idb('readwrite', (s) => s.put(JSON.parse(text), KEY)); ok = true; } catch (e) { /* thử bản phụ */ }
    try { localStorage.setItem(LS_KEY, text); ok = true; } catch (e) { /* đầy bộ nhớ phụ */ }
    if (!ok) throw new Error('Không lưu được');
  });
  return queue;
}

// Xin trình duyệt giữ dữ liệu, không tự xoá khi máy thiếu chỗ.
export async function requestPersist() {
  try {
    if (!navigator.storage || !navigator.storage.persist) return false;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch (e) { return false; }
}

// ---------- Sao lưu / khôi phục ra file ----------

export function makeBackup(state) {
  return JSON.stringify({ app: 'toan3', kind: 'sao-luu', exportedAt: Date.now(), data: state }, null, 1);
}

export function parseBackup(text) {
  let obj;
  try { obj = JSON.parse(text); } catch (e) { throw new Error('File này không đọc được.'); }
  if (!obj || obj.app !== 'toan3' || !obj.data || !Array.isArray(obj.data.profiles)) {
    throw new Error('Đây không phải file sao lưu của app Toán 3.');
  }
  return obj;
}

// Giữ lại một bản dữ liệu hiện tại trước khi khôi phục, phòng khi chọn nhầm file.
export function keepBeforeRestore(state) {
  try { localStorage.setItem(LS_BEFORE_RESTORE, JSON.stringify({ at: Date.now(), data: state })); } catch (e) { /* bỏ qua */ }
}

// Gửi file ra ngoài: iPad mở bảng Chia sẻ (chọn "Lưu vào Tệp"); máy khác thì tải về.
export async function shareFile(filename, text) {
  const blob = new Blob([text], { type: 'application/json' });
  try {
    const file = new File([blob], filename, { type: 'application/json' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: filename });
      return 'shared';
    }
  } catch (e) {
    if (e && e.name === 'AbortError') return 'cancel';
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return 'downloaded';
}
