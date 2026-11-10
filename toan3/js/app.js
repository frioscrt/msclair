import * as store from './storage.js';
import { TOPICS, GROUPS, makeQuestion, levelInfo, topicById } from './toan3.js';

const APP_VERSION = '1.1.0';
const ROUND_SIZE = 10;
const DAY = 86400000;
const BACKUP_EVERY_DAYS = 3;
const AVATARS = ['🐱', '🐶', '🐰', '🐼', '🦊', '🐯', '🐸', '🐵', '🦁', '🐨', '🐧', '🦄', '🐢', '🐬', '🦋', '🐝', '🐙', '🦖'];
const PRAISE = ['Đúng rồi!', 'Giỏi quá!', 'Chính xác!', 'Siêu ghê!', 'Tuyệt vời!', 'Quá đỉnh!'];
const CHEER = ['Cố lên nào!', 'Bình tĩnh tính nhé!', 'Bạn làm được mà!', 'Mình tin bạn đó!', 'Nghĩ kỹ rồi bấm nha!'];
// Đồ đội đầu của linh vật, mở dần theo cấp (cấp 1 chưa có gì)
const HATS = ['', '🎀', '🧢', '🎩', '👒', '🎓', '👑'];
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let state = null;
const ui = { screen: 'home', pid: null, s: null, modal: null, persisted: null };
const app = document.getElementById('app');

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const profile = () => state.profiles.find((p) => p.id === ui.pid);
const fmtDate = (t) => new Date(t).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
const fmtTime = (t) => new Date(t).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });

function defaultState() {
  return { version: 1, profiles: [], attempts: [], settings: { sound: true, lastBackupAt: 0, remindSnoozeUntil: 0 }, savedAt: 0 };
}

function persist() {
  state.savedAt = Date.now();
  return store.save(state).catch(() => toast('Không lưu được dữ liệu! Cô kiểm tra bộ nhớ iPad nhé.'));
}

function toast(text) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = text;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2800);
}

// ---------- Âm thanh nhỏ ----------
let actx = null;
function beep(kind) {
  if (!state.settings.sound) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    const notes = kind === 'ok' ? [660, 880] : kind === 'up' ? [523, 659, 784, 1047] : kind === 'tick' ? [990] : [330, 247];
    let t = actx.currentTime;
    for (const f of notes) {
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = kind === 'no' ? 'triangle' : 'sine';
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
      o.connect(g).connect(actx.destination);
      o.start(t); o.stop(t + 0.22);
      t += 0.12;
    }
  } catch (e) { /* không có âm thanh cũng được */ }
}

// ---------- Pháo giấy ----------
function confetti(n = 40) {
  if (reduceMotion) return;
  const colors = ['#ff8a3d', '#3d8bff', '#22b573', '#ffd166', '#ef5350', '#b06cff'];
  const box = document.createElement('div');
  box.className = 'confetti';
  for (let i = 0; i < n; i++) {
    const c = document.createElement('i');
    c.style.left = Math.random() * 100 + 'vw';
    c.style.background = colors[i % colors.length];
    c.style.animationDelay = Math.random() * 0.4 + 's';
    c.style.animationDuration = 1.2 + Math.random() * 1.2 + 's';
    c.style.setProperty('--x', (Math.random() * 160 - 80) + 'px');
    c.style.setProperty('--r', (Math.random() * 720 - 360) + 'deg');
    box.appendChild(c);
  }
  document.body.appendChild(box);
  setTimeout(() => box.remove(), 3000);
}

// ---------- Linh vật đi cùng bé ----------
// Linh vật là con vật bé đã chọn làm hình đại diện. Lên cấp thì to ra và có đồ đội đầu.
function buddy(p, mood, text, size = 'md') {
  const L = levelInfo(p.stars);
  const hat = HATS[Math.min(L.level, HATS.length) - 1];
  const grow = Math.min(L.level - 1, 9);
  return `<div class="buddy ${size}">
    <div class="pet ${mood} ${L.level >= 7 ? 'glow' : ''}" style="--g:${grow}">
      ${hat ? `<span class="hat">${hat}</span>` : ''}<span class="face">${p.avatar}</span>
    </div>
    ${text ? `<div class="bubble">${text}</div>` : ''}
  </div>`;
}

// ---------- Vẽ màn hình ----------
function render() {
  const views = { home: homeView, topics: topicsView, play: playView, result: resultView, teacher: teacherView };
  app.innerHTML = views[ui.screen]() + (ui.modal ? modalView() : '');
  fitEq();
  if (ui.s && ui.s.vis) ui.s.vis.fresh = false; // hình mới chỉ nảy lên một lần
}

// Thu nhỏ chữ để cả phép tính nằm gọn trên một dòng (nhất là trên điện thoại).
function fitEq() {
  document.querySelectorAll('.eq').forEach((el) => {
    el.style.fontSize = '';
    let size = parseFloat(getComputedStyle(el).fontSize);
    for (let k = 0; k < 30 && el.scrollWidth > el.clientWidth + 1 && size > 14; k++) {
      size -= 2;
      el.style.fontSize = size + 'px';
    }
  });
}
window.addEventListener('resize', fitEq);

function levelBar(stars) {
  const L = levelInfo(stars);
  return `<div class="level"><span class="lv-icon">${L.icon}</span>
    <div class="lv-body"><div class="lv-title">Cấp ${L.level} · ${L.title}</div>
    <div class="bar"><i style="width:${L.pct}%"></i></div>
    <div class="lv-sub">⭐ ${stars} / ${L.to} để lên cấp ${L.level + 1}</div></div></div>`;
}

// --- Màn đầu: chọn bạn ---
function backupBanner() {
  const st = state.settings;
  const unsaved = state.attempts.filter((a) => a.t > st.lastBackupAt);
  if (!unsaved.length || Date.now() < st.remindSnoozeUntil) return '';
  const since = st.lastBackupAt || unsaved[0].t;
  const days = Math.floor((Date.now() - since) / DAY);
  if (days < BACKUP_EVERY_DAYS) return '';
  const msg = st.lastBackupAt ? `Đã ${days} ngày chưa sao lưu dữ liệu.` : 'Dữ liệu chưa được sao lưu lần nào.';
  return `<div class="banner"><span>💾 ${msg}</span>
    <button class="btn small" data-act="backup">Sao lưu ngay</button>
    <button class="btn small ghost" data-act="snooze">Nhắc sau</button></div>`;
}

function homeView() {
  const cards = state.profiles.map((p) => {
    const L = levelInfo(p.stars);
    return `<button class="card profile" data-act="pick" data-id="${p.id}">
      <span class="avatar">${p.avatar}</span><span class="pname">${esc(p.name)}</span>
      <span class="pmeta">${L.icon} Cấp ${L.level} · ⭐ ${p.stars}</span></button>`;
  }).join('');
  return `<div class="screen home">
    <header class="hero"><div class="hero-icon">➗</div><h1>Toán lớp 3</h1><p>Vừa chơi vừa học</p></header>
    ${backupBanner()}
    <h2 class="ask">${state.profiles.length ? 'Hôm nay ai học nào?' : 'Thêm bạn nhỏ đầu tiên nhé!'}</h2>
    <div class="profiles">${cards}
      <button class="card profile add" data-act="add-profile"><span class="avatar">➕</span><span class="pname">Thêm bạn</span></button>
    </div>
    <footer class="foot"><button class="btn ghost" data-act="teacher">⚙️ Dành cho cô</button></footer>
  </div>`;
}

// --- Chọn dạng bài ---
function topicStats(pid, topicId) {
  const list = state.attempts.filter((a) => a.pid === pid && a.topic === topicId);
  const ok = list.filter((a) => a.correct).length;
  return { n: list.length, pct: list.length ? Math.round((ok * 100) / list.length) : 0 };
}

function topicsView() {
  const p = profile();
  const groups = GROUPS.map((g) => {
    const cards = TOPICS.filter((t) => t.group === g.id).map((t) => {
      let meta = '';
      if (t.gen) {
        const s = topicStats(p.id, t.id);
        const medal = s.n >= 20 && s.pct >= 80 ? '<span class="medal">🏅</span>' : '';
        meta = s.n ? `Đã làm ${s.n} câu · đúng ${s.pct}%` : 'Chưa làm';
        meta = `<span class="tmeta">${meta}</span>${medal}`;
      } else {
        meta = '<span class="tmeta">Câu nào cũng khác dạng</span>';
      }
      return `<button class="card topic" data-act="start" data-id="${t.id}">
        <span class="tname">${t.name}</span><span class="tvidu">${t.vidu}</span>${meta}</button>`;
    }).join('');
    return `<section class="group"><h3>${g.name}</h3><div class="topics">${cards}</div></section>`;
  }).join('');
  return `<div class="screen topics-screen">
    <header class="top"><button class="btn ghost" data-act="home">← Đổi bạn</button>
      <div class="who"><span class="avatar sm">${p.avatar}</span> ${esc(p.name)}</div></header>
    <div class="buddy-row">${buddy(p, 'idle', `Chào ${esc(p.name)}! Hôm nay mình luyện dạng nào?`, 'lg')}${levelBar(p.stars)}</div>
    ${groups}
  </div>`;
}

// --- Làm bài ---
function startSession(topicId) {
  ui.s = { topicId, i: 0, correct: 0, earned: 0, streak: 0, seen: new Set(), startLevel: levelInfo(profile().stars).level };
  nextQuestion();
  ui.screen = 'play';
  render();
}

function nextQuestion() {
  const s = ui.s;
  let q;
  for (let k = 0; k < 20; k++) { q = makeQuestion(s.topicId); if (!s.seen.has(q.key)) break; }
  s.seen.add(q.key);
  Object.assign(s, { q, given: {}, active: q.fields ? q.fields[0].id : null, tries: 0, phase: 'answer', msg: null, wrongChoices: [], bad: false, levelUp: null, bonus: 0,
    vis: { open: false, n: 0, fresh: false }, cheer: pick(CHEER) });
  (q.fields || []).forEach((f) => { s.given[f.id] = ''; });
}

function fieldBtn(id) {
  const s = ui.s;
  const v = s.given[id];
  const cls = ['field', s.active === id && s.phase === 'answer' ? 'on' : '', s.bad ? 'bad' : '', s.phase === 'correct' ? 'good' : ''].join(' ');
  return `<button class="${cls}" data-act="field" data-id="${id}">${v === '' ? '&nbsp;' : v}</button>`;
}

function questionBody(q) {
  let html = '';
  if (q.text) html += `<p class="qtext">${q.text}</p>`;
  if (q.eq) {
    // Phần "(dư …)" luôn đi liền một khối, không bị rớt dấu ngoặc xuống dòng.
    const part = (p) => (typeof p === 'string' ? `<span>${p.replace(/ /g, '&nbsp;')}</span>` : fieldBtn(p.f));
    const cut = q.eq.findIndex((p) => typeof p === 'string' && p.startsWith(' ('));
    const head = cut < 0 ? q.eq : q.eq.slice(0, cut), tail = cut < 0 ? [] : q.eq.slice(cut);
    html += '<div class="eq">' + head.map(part).join('') + (tail.length ? `<span class="nw">${tail.map(part).join('')}</span>` : '') + '</div>';
  } else if (q.fields) {
    html += '<div class="lfields">' + q.fields.map((f) =>
      `<div class="lrow"><span class="lbl">${f.label}:</span>${fieldBtn(f.id)}<span class="unit">${f.unit || ''}</span></div>`).join('') + '</div>';
  }
  if (q.vis) {
    const st = ui.s.vis;
    if (st.open) html += visPanel(q);
    else html += `<div class="vopen-row"><button class="btn vopen" data-act="vis-open">${q.vis.item} Dùng hình để chia</button></div>`;
  }
  return html;
}

// ---------- Hình minh hoạ: bé tự chia đồ vật ----------
function visPanel(q) {
  const v = q.vis, st = ui.s.vis;
  const { a, b, item } = v;
  const n = st.n, rem = a - n * b, share = v.mode === 'share';
  const done = rem < b;
  const it = (cls = '') => `<span class="vi ${cls}">${item}</span>`;
  const pile = rem ? Array.from({ length: rem }, () => it(done ? 'left' : '')).join('') : '<span class="muted">Hết rồi!</span>';
  let boxes = '';
  if (share) {
    boxes = Array.from({ length: b }, (_, i) => `<div class="vbox">${v.who ? `<span class="who">${['🧒', '👧', '👦'][i % 3]}</span>` : ''}
      <div class="vin">${Array.from({ length: n }, (_, k) => it(st.fresh && k === n - 1 ? 'new' : '')).join('')}</div>
      <span class="vcount">${n}</span></div>`).join('');
  } else {
    boxes = Array.from({ length: n }, (_, i) => `<div class="vbox ${st.fresh && i === n - 1 ? 'pop' : ''}">
      <div class="vin">${Array.from({ length: b }, () => it()).join('')}</div><span class="vcount">${v.box} ${i + 1}</span></div>`).join('')
      || `<div class="vempty">Chưa có ${v.box} nào</div>`;
  }
  let say;
  if (n === 0) say = share ? `Chia đều ${a} ${item} cho ${b} ${v.box}. Bấm nút để mỗi ${v.box} nhận 1 ${item}!` : `Có ${a} ${item}, mỗi ${v.box} ${b} ${item}. Bấm nút để xếp từng ${v.box}!`;
  else if (!done) say = share ? `Mỗi ${v.box} có ${n} ${item}. Còn ${rem} ${item}, chia tiếp nào!` : `Đã xếp ${n} ${v.box}. Còn ${rem} ${item}, xếp tiếp nào!`;
  else if (rem) say = share ? `Còn ${rem} ${item}, không đủ chia thêm cho ${b} ${v.box} nữa! Đó là số dư.` : `Còn ${rem} ${item}, không đủ xếp thêm 1 ${v.box} ${b} ${item}! Đó là số dư.`;
  else say = `Vừa hết, không còn thừa ${item} nào! Đây là phép chia hết.`;
  const stepLabel = share ? `Mỗi ${v.box} thêm 1 ${item}` : `Xếp 1 ${v.box}`;
  return `<div class="vis">
    <div class="vsay ${done ? 'done' : ''}">${say}</div>
    <div class="vpile-wrap"><div class="vlabel">Còn lại: <b>${rem}</b></div><div class="vpile">${pile}</div></div>
    <div class="vboxes">${boxes}</div>
    <div class="vbtns">
      <button class="btn" data-act="vis-step" ${done ? 'disabled' : ''}>${stepLabel}</button>
      ${done ? '' : '<button class="btn ghost" data-act="vis-all">Làm hết luôn</button>'}
      ${n ? '<button class="btn ghost" data-act="vis-reset">↺ Làm lại</button>' : ''}
    </div>
  </div>`;
}

function visStep() {
  const s = ui.s, v = s.q.vis;
  if (v.a - s.vis.n * v.b < v.b) return false;
  s.vis.n++; s.vis.fresh = true;
  beep('tick');
  return true;
}

let visTimer = null;
function visAll() {
  clearInterval(visTimer);
  const s0 = ui.s;
  visTimer = setInterval(() => {
    if (ui.s !== s0 || ui.screen !== 'play' || !visStep()) { clearInterval(visTimer); return; }
    render();
  }, reduceMotion ? 60 : 380);
}

function divTable(d) {
  // Đặt tính kiểu sách Việt Nam: số bị chia bên trái, số chia bên phải, thương dưới số chia.
  const two = (n) => { const s = String(n); return s.length === 2 ? [s[0], s[1]] : ['', s]; };
  const p2 = two(d.p2);
  const rows = [
    [d.t, d.u, d.b, 'head'],
    [d.p1, '', d.q, 'quot'],
    [d.r1 ? d.r1 : '', d.u, '', ''],
    [p2[0], p2[1], '', ''],
    ['', d.r2, '', ''],
  ];
  return `<table class="dt">${rows.map((r) => `<tr><td>${r[0]}</td><td>${r[1]}</td><td class="dr ${r[3]}">${r[2]}</td></tr>`).join('')}</table>`;
}

function explainPanel(q) {
  const e = q.explain;
  return `<div class="explain">
    <div class="ex-title">Cùng xem cách làm nhé 👀</div>
    <div class="ex-final">${e.final}</div>
    <div class="ex-body">
      ${e.div ? divTable(e.div) : ''}
      <div class="ex-steps"><div class="ex-sub">${e.title}</div>
        <ol>${e.lines.map((l) => `<li>${l}</li>`).join('')}</ol>
        ${e.check ? `<div class="ex-check">✔ ${e.check}</div>` : ''}</div>
    </div>
    <button class="btn big go" data-act="next">Câu tiếp →</button>
  </div>`;
}

function sidePanel() {
  const s = ui.s, q = s.q;
  if (s.phase === 'correct') {
    const extra = s.tries === 1
      ? `<div class="plus">+${1 + s.bonus} ⭐</div>${s.bonus ? `<div class="streak-msg">🔥 ${s.streak} câu đúng liền! Thưởng thêm 1 ⭐</div>` : ''}`
      : '<div class="streak-msg">Lần sau cố đúng ngay từ lần đầu nhé!</div>';
    const up = s.levelUp ? `<div class="levelup">🎉 Lên cấp ${s.levelUp.level}: ${s.levelUp.icon} ${s.levelUp.title}</div>` : '';
    return `<div class="good-panel"><div class="praise">${s.praise}</div>${extra}${up}
      <button class="btn big go" data-act="next">Câu tiếp →</button></div>`;
  }
  if (s.phase === 'explain') return explainPanel(q);
  const msg = s.msg ? `<div class="msg ${s.msg.type}">${s.msg.type === 'hint' ? '<b>Chưa đúng, thử lại nhé!</b><br>' : ''}${s.msg.text}</div>` : '';
  if (q.choices) {
    return `${msg}<div class="choices ${q.choices.length > 2 ? 'four' : ''}">${q.choices.map((c, i) =>
      `<button class="btn choice" data-act="choose" data-i="${i}" ${s.wrongChoices.includes(i) ? 'disabled' : ''}>${c}</button>`).join('')}</div>`;
  }
  const keys = ['7', '8', '9', '4', '5', '6', '1', '2', '3', 'del', '0', 'ok'];
  const pad = keys.map((k) => {
    if (k === 'del') return '<button class="key del" data-act="key" data-k="del">⌫</button>';
    if (k === 'ok') return '<button class="key ok" data-act="check">Kiểm tra</button>';
    return `<button class="key" data-act="key" data-k="${k}">${k}</button>`;
  }).join('');
  return `${msg}<div class="pad">${pad}</div>`;
}

function buddyPlay(p) {
  const s = ui.s;
  if (s.phase === 'correct') {
    const t = s.levelUp ? 'Mình lớn lên rồi nè! ✨' : s.tries > 1 ? 'Đúng rồi! Giỏi lắm!' : s.bonus ? `${s.streak} câu đúng liền, nóng quá! 🔥` : pick(['Hoan hô! 🎉', 'Yeah! 🙌', 'Bạn giỏi ghê!', 'Tuyệt cú mèo!']);
    return buddy(p, s.levelUp ? 'dance' : 'happy', t);
  }
  if (s.phase === 'explain') return buddy(p, 'think', 'Không sao, mình cùng xem cách làm nha!');
  if (s.msg && s.msg.type === 'hint') return buddy(p, 'sad', 'Chưa đúng rồi, thử lại nhé! 💪');
  return buddy(p, 'idle', s.cheer);
}

function playView() {
  const s = ui.s, p = profile();
  const t = topicById(s.q.topic);
  const g = GROUPS.find((x) => x.id === t.group);
  return `<div class="screen play-screen">
    <header class="top play-top">
      <button class="btn ghost round" data-act="quit" aria-label="Dừng">✕</button>
      <div class="prog"><div class="prog-text">Câu ${s.i + 1}/${ROUND_SIZE}</div><div class="bar"><i style="width:${(s.i * 100) / ROUND_SIZE}%"></i></div></div>
      <div class="chips"><span class="chip">🔥 ${s.streak}</span><span class="chip">⭐ ${p.stars}</span></div>
    </header>
    <main class="play ${s.phase === 'explain' ? 'explaining' : ''}">
      <section class="qcard">
        <div class="tag">${g.name.split('.')[0]} · ${t.name}</div>
        ${questionBody(s.q)}
      </section>
      <section class="side">${buddyPlay(p)}${sidePanel()}</section>
    </main>
  </div>`;
}

function givenText(q, given, choiceIdx) {
  if (q.choices) return q.choices[choiceIdx];
  return q.fields.map((f) => given[f.id]).join(' | ');
}
function answerText(q) {
  if (q.choices) return q.choices[q.answer];
  return q.fields.map((f) => q.answer[f.id]).join(' | ');
}

function record(correct, given) {
  const s = ui.s, q = s.q;
  state.attempts.push({ pid: ui.pid, topic: q.topic, short: q.short, correct, given, answer: answerText(q), t: Date.now() });
  persist();
}

function check(choiceIdx) {
  const s = ui.s, q = s.q, p = profile();
  if (s.phase !== 'answer') return;
  let ok;
  if (q.choices) {
    ok = choiceIdx === q.answer;
  } else {
    const empty = q.fields.find((f) => s.given[f.id] === '');
    if (empty) { s.active = empty.id; s.msg = { type: 'warn', text: 'Điền đủ các ô nhé!' }; render(); return; }
    ok = q.fields.every((f) => Number(s.given[f.id]) === q.answer[f.id]);
  }
  s.tries++;
  const given = givenText(q, s.given, choiceIdx);
  if (ok) {
    s.phase = 'correct'; s.msg = null; s.bad = false; s.praise = pick(PRAISE);
    if (s.tries === 1) {
      s.correct++; s.streak++;
      s.bonus = s.streak % 5 === 0 ? 1 : 0;
      const before = levelInfo(p.stars).level;
      p.stars += 1 + s.bonus; s.earned += 1 + s.bonus;
      p.bestStreak = Math.max(p.bestStreak || 0, s.streak);
      const after = levelInfo(p.stars);
      if (after.level > before) s.levelUp = after;
    }
    record(s.tries === 1, given);
    beep(s.levelUp ? 'up' : 'ok');
    confetti(s.levelUp ? 120 : s.bonus ? 70 : 30);
  } else {
    beep('no');
    s.streak = 0;
    const twoChoices = q.choices && q.choices.length <= 2;
    if (s.tries === 1 && !twoChoices) {
      s.msg = { type: 'hint', text: q.hint(q.choices ? choiceIdx : s.given) };
      if (q.choices) s.wrongChoices.push(choiceIdx); else s.bad = true;
    } else {
      s.phase = 'explain'; s.msg = null; s.bad = false;
      if (q.vis) s.vis = { open: true, n: Math.floor(q.vis.a / q.vis.b), fresh: false };
      record(false, given);
    }
  }
  render();
}

function goNext() {
  const s = ui.s;
  if (!s || (s.phase !== 'correct' && s.phase !== 'explain')) return;
  s.i++;
  if (s.i >= ROUND_SIZE) {
    ui.screen = 'result'; render();
    if (s.correct >= 7) { confetti(120); beep('up'); }
    return;
  }
  nextQuestion();
  render();
}

// --- Kết quả lượt ---
function resultView() {
  const s = ui.s, p = profile();
  const L = levelInfo(p.stars);
  const up = L.level > s.startLevel ? `<div class="levelup big">🎉 Lên cấp ${L.level}: ${L.icon} ${L.title}</div>` : '';
  const face = s.correct >= 9 ? '🏆' : s.correct >= 7 ? '🥳' : s.correct >= 5 ? '😊' : '💪';
  return `<div class="screen result">
    <div class="res-face">${buddy(p, s.correct >= 5 ? 'dance' : 'happy', s.correct >= 9 ? `${face} Quá xuất sắc!` : s.correct >= 7 ? `${face} Giỏi lắm!` : s.correct >= 5 ? `${face} Khá lắm!` : `${face} Lượt sau sẽ tốt hơn!`, 'lg')}</div>
    <h2>Xong lượt rồi!</h2>
    <p class="res-score">Đúng ngay lần đầu <b>${s.correct}/${ROUND_SIZE}</b> câu</p>
    <p class="res-stars">+${s.earned} ⭐</p>
    ${up}
    ${levelBar(p.stars)}
    <div class="res-btns">
      <button class="btn big go" data-act="start" data-id="${s.topicId}">Làm tiếp dạng này</button>
      <button class="btn big ghost" data-act="topics">Chọn dạng khác</button>
    </div>
  </div>`;
}

// --- Dành cho cô ---
function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

function teacherView() {
  const st = state.settings;
  const last = st.lastBackupAt ? `Lần sao lưu gần nhất: ${fmtTime(st.lastBackupAt)}.` : 'Chưa sao lưu lần nào.';
  const unsaved = state.attempts.filter((a) => a.t > st.lastBackupAt).length;
  const kids = state.profiles.map((p) => {
    const mine = state.attempts.filter((a) => a.pid === p.id);
    const ok = mine.filter((a) => a.correct).length;
    const rows = TOPICS.filter((t) => t.gen).map((t) => {
      const s = topicStats(p.id, t.id);
      if (!s.n) return '';
      const g = GROUPS.find((x) => x.id === t.group).name.split('.')[0];
      return `<tr><td>${g} · ${t.name}</td><td>${s.n}</td><td class="${s.pct >= 80 ? 'hi' : s.pct < 50 ? 'lo' : ''}">${s.pct}%</td></tr>`;
    }).join('');
    const wrong = mine.filter((a) => !a.correct).slice(-5).reverse().map((a) =>
      `<li><b>${esc(a.short)}</b> — bé trả lời: ${esc(a.given)}; đúng là: ${esc(a.answer)} <span class="muted">(${fmtTime(a.t)})</span></li>`).join('');
    return `<div class="kid">
      <div class="kid-head"><span class="avatar sm">${p.avatar}</span><b>${esc(p.name)}</b>
        <span class="muted">⭐ ${p.stars} · ${mine.length} câu · đúng ngay ${mine.length ? Math.round((ok * 100) / mine.length) : 0}%</span>
        <button class="btn small ghost" data-act="edit-profile" data-id="${p.id}">Sửa</button></div>
      ${rows ? `<table class="stats"><tr><th>Dạng bài</th><th>Số câu</th><th>Đúng ngay</th></tr>${rows}</table>` : '<p class="muted">Chưa làm bài nào.</p>'}
      ${wrong ? `<div class="wrong"><div class="ex-sub">5 câu sai gần nhất</div><ul>${wrong}</ul></div>` : ''}
    </div>`;
  }).join('') || '<p class="muted">Chưa có bạn nào.</p>';

  const persistText = ui.persisted === true ? '✅ iPad đã đồng ý giữ dữ liệu của app.' :
    ui.persisted === false ? '⚠️ iPad chưa đồng ý giữ dữ liệu. Thêm app ra Màn hình chính rồi mở từ đó sẽ an toàn hơn.' : '';
  return `<div class="screen teacher">
    <header class="top"><button class="btn ghost" data-act="home">← Về màn đầu</button><h2>Dành cho cô</h2></header>

    <section class="panel"><h3>💾 Sao lưu dữ liệu</h3>
      <p>${last} ${unsaved ? `Có ${unsaved} câu mới chưa sao lưu.` : ''}</p>
      <p class="muted">Dữ liệu chỉ nằm trên iPad này. Cô bấm "Sao lưu ra file" rồi chọn "Lưu vào Tệp" (nên lưu vào iCloud Drive). Khi đổi máy hay lỡ mất dữ liệu, bấm "Khôi phục từ file" và chọn lại file đó.</p>
      <div class="row"><button class="btn" data-act="backup">Sao lưu ra file</button>
        <label class="btn ghost">Khôi phục từ file<input type="file" accept=".json,application/json" data-act="restore" hidden></label></div>
    </section>

    <section class="panel"><h3>👧 Các bạn nhỏ</h3>${kids}
      <div class="row"><button class="btn ghost" data-act="add-profile">➕ Thêm bạn</button></div></section>

    <section class="panel"><h3>⚙️ Cài đặt</h3>
      <label class="switch"><input type="checkbox" data-act="sound" ${st.sound ? 'checked' : ''}> Âm thanh khi đúng / sai</label></section>

    <section class="panel"><h3>📲 Dùng như app trên iPad</h3>
      ${isStandalone() ? '<p>✅ Cô đang mở app từ Màn hình chính. Tốt rồi!</p>' : `<ol>
        <li>Mở trang này bằng <b>Safari</b>.</li>
        <li>Bấm nút <b>Chia sẻ</b> (hình vuông có mũi tên chỉ lên, ở góc trên bên phải).</li>
        <li>Chọn <b>Thêm vào MH chính</b>, rồi bấm <b>Thêm</b>.</li>
        <li>Từ nay mở app bằng biểu tượng mới trên Màn hình chính. Mở từ đó thì Safari không tự xoá dữ liệu, và dùng được cả khi không có mạng.</li></ol>`}
      <p class="muted">${persistText}</p></section>

    <p class="muted center">Toán lớp 3 · phiên bản ${APP_VERSION}</p>
  </div>`;
}

// --- Hộp sửa hồ sơ ---
function modalView() {
  const m = ui.modal;
  return `<div class="modal-bg"><div class="modal">
    <h3>${m.id ? 'Sửa thông tin' : 'Thêm bạn mới'}</h3>
    <label class="lbl">Tên</label>
    <input class="name-input" id="pname" maxlength="20" value="${esc(m.name)}" placeholder="Nhập tên…" autocomplete="off">
    <label class="lbl">Chọn hình</label>
    <div class="avatars">${AVATARS.map((a) => `<button class="av ${a === m.avatar ? 'on' : ''}" data-act="avatar" data-a="${a}">${a}</button>`).join('')}</div>
    <div class="row end">
      ${m.id ? '<button class="btn danger ghost" data-act="delete-profile">Xoá bạn này</button>' : ''}
      <span class="grow"></span>
      <button class="btn ghost" data-act="close-modal">Huỷ</button>
      <button class="btn go" data-act="save-profile">Lưu</button>
    </div></div></div>`;
}

// ---------- Sao lưu / khôi phục ----------
async function doBackup() {
  const d = new Date();
  const name = `toan3-sao-luu-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}.json`;
  const at = Date.now();
  const res = await store.shareFile(name, store.makeBackup(state));
  if (res === 'cancel') { toast('Chưa sao lưu (cô đã huỷ).'); return; }
  state.settings.lastBackupAt = at;
  await persist();
  toast('Đã xuất file sao lưu. Nhớ lưu vào Tệp nhé!');
  render();
}

async function doRestore(file) {
  if (!file) return;
  let obj;
  try { obj = store.parseBackup(await file.text()); } catch (e) { alert(e.message); return; }
  const d = obj.data;
  const ok = confirm(`Khôi phục sẽ THAY toàn bộ dữ liệu hiện tại bằng dữ liệu trong file:\n\n` +
    `• Sao lưu lúc: ${fmtTime(obj.exportedAt)}\n• ${d.profiles.length} bạn, ${d.attempts.length} câu đã làm\n\n` +
    `Dữ liệu hiện tại (${state.profiles.length} bạn, ${state.attempts.length} câu) sẽ bị thay. Cô có chắc không?`);
  if (!ok) return;
  store.keepBeforeRestore(state);
  state = normalize(d);
  state.settings.lastBackupAt = Date.now();
  await persist();
  ui.pid = null;
  toast('Đã khôi phục xong.');
  render();
}

function normalize(s) {
  const base = defaultState();
  return { ...base, ...s, settings: { ...base.settings, ...(s.settings || {}) }, profiles: s.profiles || [], attempts: s.attempts || [] };
}

// ---------- Bấm nút ----------
function readModalName() {
  const inp = document.getElementById('pname');
  if (inp && ui.modal) ui.modal.name = inp.value;
}

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el || el.tagName === 'INPUT') return;
  const act = el.dataset.act;
  const s = ui.s;
  switch (act) {
    case 'pick': ui.pid = el.dataset.id; ui.screen = 'topics'; break;
    case 'home': ui.screen = 'home'; ui.s = null; break;
    case 'topics': ui.screen = 'topics'; ui.s = null; break;
    case 'teacher': ui.screen = 'teacher'; break;
    case 'start': startSession(el.dataset.id); return;
    case 'quit':
      if (s.i === 0 && s.tries === 0 && s.phase === 'answer') { ui.screen = 'topics'; ui.s = null; break; }
      if (!confirm('Dừng lượt này? Các câu đã làm vẫn được lưu.')) return;
      ui.screen = 'topics'; ui.s = null; break;
    case 'field': if (s.phase === 'answer') s.active = el.dataset.id; break;
    case 'key': pressKey(el.dataset.k); return;
    case 'check': check(); return;
    case 'choose': check(Number(el.dataset.i)); return;
    case 'next': clearInterval(visTimer); goNext(); return;
    case 'vis-open': s.vis.open = true; break;
    case 'vis-step': if (!visStep()) return; break;
    case 'vis-all': visAll(); return;
    case 'vis-reset': clearInterval(visTimer); s.vis.n = 0; s.vis.fresh = false; break;
    case 'add-profile': ui.modal = { id: null, name: '', avatar: AVATARS[state.profiles.length % AVATARS.length] }; break;
    case 'edit-profile': { const p = state.profiles.find((x) => x.id === el.dataset.id); ui.modal = { id: p.id, name: p.name, avatar: p.avatar }; break; }
    case 'avatar': readModalName(); ui.modal.avatar = el.dataset.a; break;
    case 'close-modal': ui.modal = null; break;
    case 'save-profile': {
      readModalName();
      const m = ui.modal, name = m.name.trim();
      if (!name) { toast('Nhập tên trước nhé!'); return; }
      if (m.id) Object.assign(state.profiles.find((x) => x.id === m.id), { name, avatar: m.avatar });
      else state.profiles.push({ id: 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name, avatar: m.avatar, stars: 0, bestStreak: 0, createdAt: Date.now() });
      ui.modal = null; persist(); break;
    }
    case 'delete-profile': {
      const p = state.profiles.find((x) => x.id === ui.modal.id);
      if (!confirm(`Xoá ${p.name} và toàn bộ lịch sử làm bài của bạn ấy?\nKhông lấy lại được, trừ khi cô có file sao lưu.`)) return;
      state.profiles = state.profiles.filter((x) => x.id !== p.id);
      state.attempts = state.attempts.filter((a) => a.pid !== p.id);
      ui.modal = null; persist(); break;
    }
    case 'backup': doBackup(); return;
    case 'snooze': state.settings.remindSnoozeUntil = Date.now() + DAY; persist(); break;
    default: return;
  }
  render();
});

document.addEventListener('change', (e) => {
  const act = e.target.dataset.act;
  if (act === 'restore') { doRestore(e.target.files[0]); e.target.value = ''; }
  if (act === 'sound') { state.settings.sound = e.target.checked; persist(); }
});

function pressKey(k) {
  const s = ui.s;
  if (!s || s.phase !== 'answer' || !s.active) return;
  let v = s.given[s.active];
  if (k === 'del') v = v.slice(0, -1);
  else if (v.length < 3) v = v === '0' ? k : v + k;
  s.given[s.active] = v;
  s.bad = false;
  if (s.msg && s.msg.type === 'warn') s.msg = null;
  render();
}

// Bàn phím thật (khi dùng máy tính)
document.addEventListener('keydown', (e) => {
  if (ui.screen !== 'play' || ui.modal) return;
  const s = ui.s;
  if (/^[0-9]$/.test(e.key)) pressKey(e.key);
  else if (e.key === 'Backspace') pressKey('del');
  else if (e.key === 'Enter') { if (s.phase === 'answer' && !s.q.choices) check(); else goNext(); }
  else if (e.key === 'Tab' && s.q.fields && s.phase === 'answer') {
    e.preventDefault();
    const ids = s.q.fields.map((f) => f.id);
    s.active = ids[(ids.indexOf(s.active) + 1) % ids.length];
    render();
  }
});

// ---------- Khởi động ----------
async function init() {
  const saved = await store.load();
  state = normalize(saved || defaultState());
  render();
  store.requestPersist().then((v) => { ui.persisted = v; if (ui.screen === 'teacher') render(); });
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
}
init();
