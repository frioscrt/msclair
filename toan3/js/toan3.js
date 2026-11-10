// Ngân hàng bài Toán 3 (bộ Kết nối tri thức) — sinh bài ngẫu nhiên.
// Mỗi câu hỏi là một object:
//   { topic, key, text?, eq?, fields?, choices?, answer, hint(given), explain }
//   - eq: phép tính có ô trống, vd ['47 : 3 = ', {f:'q'}, ' (dư ', {f:'r'}, ')']
//   - fields: các ô cần điền [{id, label, unit}]
//   - choices: các lựa chọn (bấm nút), answer là chỉ số lựa chọn đúng
//   - explain: { final, lines[], div? (bảng đặt tính), check? }
//   - vis: hình minh hoạ để bé tự chia đồ vật (chỉ khi thương có 1 chữ số)
//       { a, b, mode: 'share' (chia đều vào b hộp) | 'group' (mỗi hộp b cái), item, box, who? }

const R = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const shuffle = (arr) => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const NAMES = ['Nam', 'Mai', 'An', 'Lan', 'Minh', 'Hoa', 'Bình', 'Thảo', 'Khoa', 'Vy'];

// Đồ vật dùng cho hình minh hoạ phép chia không có lời văn
const ITEMS = ['🍎', '🍓', '🍬', '🍪', '🍊', '🍌', '⚽', '🌟', '🧁', '🍒'];
const shareVis = (a, b) => ({ a, b, mode: 'share', item: pick(ITEMS), box: 'đĩa' });

const divText = (a, b, q, r) => `${a} : ${b} = ${q}` + (r ? ` (dư ${r})` : '');

// ---------- Gợi ý khi làm sai lần đầu ----------

function hintQR(a, b, given, wordy) {
  const q = Number(given.q), r = Number(given.r);
  if (r >= b) {
    return wordy
      ? `Còn thừa ${r} thì vẫn chia thêm được nữa, vì ${r} không bé hơn ${b}. Thử lại nhé!`
      : `Số dư phải bé hơn số chia. Số chia là ${b}, mà số dư ${r} không bé hơn ${b}. Thử thương lớn hơn nhé!`;
  }
  if (q * b > a) return `${q} × ${b} = ${q * b}, lớn hơn ${a} rồi. Thử số bé hơn nhé!`;
  return `Thử kiểm tra: ${q} × ${b} + ${r} = ${q * b + r}, chưa bằng ${a}. Làm lại nhé!`;
}

function hintNum(a, b, given) {
  const n = Number(given.n);
  const p = n * b;
  if (p > a) return `Thử kiểm tra: ${n} × ${b} = ${p}, lớn hơn ${a}. Thử số bé hơn nhé!`;
  return `Thử kiểm tra: ${n} × ${b} = ${p}, bé hơn ${a}. Thử số lớn hơn nhé!`;
}

// ---------- Cách làm ----------

// Nhẩm theo bảng nhân (thương có 1 chữ số)
function bangSteps(a, b, q, r) {
  const lines = [
    `Nhẩm bảng nhân ${b}: ${b} × ${q} = ${b * q}` +
      (r ? `, còn ${b} × ${q + 1} = ${b * (q + 1)} thì lớn hơn ${a}.` : '.'),
    `Vậy thương là ${q}. Số dư: ${a} − ${b * q} = ${r}.`,
    r ? `Số dư ${r} bé hơn số chia ${b}. Đúng!` : `Số dư bằng 0, nên đây là phép chia hết.`,
  ];
  return lines;
}

// Đặt tính rồi tính: số có 2 chữ số chia số có 1 chữ số (thương có 2 chữ số)
function longDiv(a, b) {
  const t = Math.floor(a / 10), u = a % 10;
  const q1 = Math.floor(t / b), p1 = q1 * b, r1 = t - p1;
  const n = r1 * 10 + u, q2 = Math.floor(n / b), p2 = q2 * b, r2 = n - p2;
  const lines = [
    `${t} chia ${b} được ${q1}, viết ${q1}.`,
    `${q1} nhân ${b} bằng ${p1}; ${t} trừ ${p1} bằng ${r1}.`,
    `Hạ ${u}, được ${n}; ${n} chia ${b} được ${q2}, viết ${q2}.`,
    `${q2} nhân ${b} bằng ${p2}; ${n} trừ ${p2} bằng ${r2}.`,
  ];
  return { lines, div: { t, u, b, q: q1 * 10 + q2, p1, r1, n, p2, r2 } };
}

const checkLine = (a, b, q, r) =>
  r ? `Thử lại: ${q} × ${b} + ${r} = ${a}.` : `Thử lại: ${q} × ${b} = ${a}.`;

// ---------- Kho số cho Bài 26 ----------

function pairs(filter) {
  const out = [];
  for (let b = 2; b <= 9; b++) for (let a = 10 * b; a <= 99; a++) if (filter(a, b)) out.push([a, b]);
  return out;
}
// Chia hết, chữ số hàng chục và hàng đơn vị đều chia hết (vd 48 : 4, 69 : 3)
const P_DE = pairs((a, b) => a % b === 0 && Math.floor(a / 10) % b === 0 && (a % 10) % b === 0);
// Chia hết, hàng chục chia còn dư (vd 72 : 3, 84 : 6)
const P_NHO = pairs((a, b) => a % b === 0 && Math.floor(a / 10) % b !== 0);
// Chia có dư (vd 47 : 3)
const P_DU = pairs((a, b) => a % b !== 0);

// Chọn số chia trước cho đều, rồi mới chọn số bị chia
function pickPair(list) {
  const bs = [...new Set(list.map((p) => p[1]))];
  const b = pick(bs);
  return pick(list.filter((p) => p[1] === b));
}

// ---------- Mẫu toán có lời văn ----------

const LV_DU = [
  { s: (a, b) => `Có ${a} quả cam, xếp vào mỗi đĩa ${b} quả. Xếp được nhiều nhất bao nhiêu đĩa và còn thừa mấy quả cam?`,
    f: [['Số đĩa', 'đĩa'], ['Còn thừa', 'quả cam']], vis: { mode: 'group', item: '🍊', box: 'đĩa' },
    ans: (q, r) => `Xếp được nhiều nhất ${q} đĩa, còn thừa ${r} quả cam.` },
  { s: (a, b) => `Cô có ${a} cái kẹo, chia đều cho ${b} bạn. Mỗi bạn được nhiều nhất mấy cái kẹo và còn thừa mấy cái kẹo?`,
    f: [['Mỗi bạn', 'cái kẹo'], ['Còn thừa', 'cái kẹo']], vis: { mode: 'share', item: '🍬', box: 'bạn', who: true },
    ans: (q, r) => `Mỗi bạn được nhiều nhất ${q} cái kẹo, còn thừa ${r} cái kẹo.` },
  { s: (a, b) => `Có ${a} bông hoa, cắm vào mỗi lọ ${b} bông. Cắm được nhiều nhất bao nhiêu lọ hoa và còn thừa mấy bông hoa?`,
    f: [['Số lọ', 'lọ'], ['Còn thừa', 'bông hoa']], vis: { mode: 'group', item: '🌸', box: 'lọ' },
    ans: (q, r) => `Cắm được nhiều nhất ${q} lọ hoa, còn thừa ${r} bông hoa.` },
  { s: (a, b) => `Có ${a} quả trứng, xếp vào mỗi khay ${b} quả. Xếp được nhiều nhất bao nhiêu khay và còn thừa mấy quả trứng?`,
    f: [['Số khay', 'khay'], ['Còn thừa', 'quả trứng']], vis: { mode: 'group', item: '🥚', box: 'khay' },
    ans: (q, r) => `Xếp được nhiều nhất ${q} khay, còn thừa ${r} quả trứng.` },
  { s: (a, b) => `Có ${a} m vải, mỗi bộ quần áo may hết ${b} m. May được nhiều nhất bao nhiêu bộ quần áo và còn thừa mấy mét vải?`,
    f: [['Số bộ', 'bộ'], ['Còn thừa', 'm vải']], maxB: 4,
    ans: (q, r) => `May được nhiều nhất ${q} bộ quần áo, còn thừa ${r} m vải.` },
];

const LV_HET = [
  { s: (a, b) => `Có ${a} học sinh xếp đều thành ${b} hàng. Hỏi mỗi hàng có bao nhiêu học sinh?`,
    label: 'Mỗi hàng', unit: 'học sinh', loigiai: 'Mỗi hàng có số học sinh là:' },
  { s: (a, b) => `Một sợi dây dài ${a} m được cắt thành ${b} đoạn dài bằng nhau. Hỏi mỗi đoạn dài bao nhiêu mét?`,
    label: 'Mỗi đoạn', unit: 'm', loigiai: 'Mỗi đoạn dây dài số mét là:' },
  { s: (a, b) => `Có ${a} quyển vở chia đều cho ${b} bạn. Hỏi mỗi bạn được bao nhiêu quyển vở?`,
    label: 'Mỗi bạn', unit: 'quyển vở', loigiai: 'Mỗi bạn được số quyển vở là:' },
  { s: (a, b) => `Có ${a} l nước mắm rót đều vào ${b} can. Hỏi mỗi can có bao nhiêu lít nước mắm?`,
    label: 'Mỗi can', unit: 'l', loigiai: 'Mỗi can có số lít nước mắm là:' },
  { s: (a, b) => `Có ${a} cái bánh, xếp vào mỗi hộp ${b} cái. Hỏi xếp được bao nhiêu hộp bánh?`,
    label: 'Số hộp', unit: 'hộp', loigiai: 'Xếp được số hộp bánh là:' },
  { s: (a, b) => `Có ${a} cây giống, trồng đều thành ${b} hàng. Hỏi mỗi hàng có bao nhiêu cây?`,
    label: 'Mỗi hàng', unit: 'cây', loigiai: 'Mỗi hàng có số cây là:' },
];

// ---------- Câu hỏi dạng chia có dư (dùng chung) ----------

function qrQuestion(topic, a, b) {
  const q = Math.floor(a / b), r = a % b;
  const two = q >= 10;
  const ld = two ? longDiv(a, b) : null;
  return {
    topic, key: `${a}:${b}`, short: `${a} : ${b}`,
    eq: [`${a} : ${b} = `, { f: 'q' }, ' (dư ', { f: 'r' }, ')'],
    fields: [{ id: 'q', label: 'Thương' }, { id: 'r', label: 'Số dư' }],
    answer: { q, r },
    vis: two ? null : shareVis(a, b),
    hint: (g) => hintQR(a, b, g, false),
    explain: {
      final: divText(a, b, q, r),
      title: two ? 'Đặt tính rồi tính' : 'Cách nhẩm',
      lines: two ? ld.lines : bangSteps(a, b, q, r),
      div: two ? ld.div : null,
      check: checkLine(a, b, q, r),
    },
  };
}

function numQuestion(topic, a, b) {
  const q = a / b;
  const ld = longDiv(a, b);
  return {
    topic, key: `${a}:${b}`, short: `${a} : ${b}`,
    eq: [`${a} : ${b} = `, { f: 'n' }],
    fields: [{ id: 'n', label: 'Thương' }],
    answer: { n: q },
    hint: (g) => hintNum(a, b, g),
    explain: {
      final: divText(a, b, q, 0), title: 'Đặt tính rồi tính',
      lines: ld.lines, div: ld.div, check: checkLine(a, b, q, 0),
    },
  };
}

function lvDuQuestion(topic, a, b) {
  const q = Math.floor(a / b), r = a % b;
  const t = pick(LV_DU.filter((x) => !x.maxB || b <= x.maxB));
  const two = q >= 10;
  const ld = two ? longDiv(a, b) : null;
  return {
    topic, key: `lv${a}:${b}`, short: `Lời văn: ${a} : ${b}`,
    text: t.s(a, b),
    fields: [{ id: 'q', label: t.f[0][0], unit: t.f[0][1] }, { id: 'r', label: t.f[1][0], unit: t.f[1][1] }],
    answer: { q, r },
    vis: !two && t.vis ? { a, b, ...t.vis } : null,
    hint: (g) => hintQR(a, b, g, true),
    explain: {
      final: t.ans(q, r),
      title: 'Cách làm',
      lines: [`Ta làm phép chia: ${divText(a, b, q, r)}.`, ...(two ? ld.lines : []), t.ans(q, r)],
      div: two ? ld.div : null,
      check: checkLine(a, b, q, r),
    },
  };
}

function lvHetQuestion(topic, a, b) {
  const q = a / b;
  const t = pick(LV_HET);
  const ld = longDiv(a, b);
  return {
    topic, key: `lv${a}:${b}`, short: `Lời văn: ${a} : ${b}`,
    text: t.s(a, b),
    fields: [{ id: 'n', label: t.label, unit: t.unit }],
    answer: { n: q },
    hint: (g) => hintNum(a, b, g),
    explain: {
      final: `Đáp số: ${q} ${t.unit}.`,
      title: 'Bài giải',
      lines: [t.loigiai, `${a} : ${b} = ${q} (${t.unit})`, `Đáp số: ${q} ${t.unit}.`],
      div: ld.div,
      check: checkLine(a, b, q, 0),
    },
  };
}

// ---------- Các dạng bài ----------

function genB25Tinh(topic) {
  const b = R(2, 9), q = R(1, 9);
  const r = Math.random() < 0.15 ? 0 : R(1, b - 1);
  return qrQuestion(topic, b * q + r, b);
}

function genB25HetDu(topic) {
  const b = R(2, 9), q = R(2, 9);
  const het = Math.random() < 0.5;
  const r = het ? 0 : R(1, b - 1);
  const a = b * q + r;
  return {
    topic, key: `hd${a}:${b}`, short: `${a} : ${b} chia hết hay có dư?`,
    text: `Phép chia ${a} : ${b} là phép chia hết hay phép chia có dư?`,
    choices: ['Chia hết', 'Chia có dư'],
    answer: het ? 0 : 1,
    vis: shareVis(a, b),
    hint: () => '',
    explain: {
      final: divText(a, b, q, r),
      title: 'Cách nhẩm',
      lines: [...bangSteps(a, b, q, r).slice(0, 2), het ? 'Số dư là 0, nên đây là phép chia hết.' : `Số dư là ${r}, nên đây là phép chia có dư.`],
      check: checkLine(a, b, q, r),
    },
  };
}

function genB25SoDu(topic) {
  const v = R(1, 3);
  if (v === 1) {
    const b = R(3, 9);
    const good = R(1, b - 1);
    const bad = shuffle([b, b + 1, b + 2, b + 3, b + 4]).slice(0, 3);
    const opts = shuffle([good, ...bad]);
    return {
      topic, key: `sd1-${b}-${good}`, short: `Chia cho ${b}, số dư có thể là?`,
      text: `Trong phép chia cho ${b}, số dư có thể là số nào?`,
      choices: opts.map(String),
      answer: opts.indexOf(good),
      hint: (i) => `Số dư phải bé hơn số chia. ${opts[i]} không bé hơn ${b}. Chọn lại nhé!`,
      explain: {
        final: `Số dư có thể là ${good}.`, title: 'Nhớ nhé',
        lines: ['Trong phép chia có dư, số dư luôn bé hơn số chia.', `Số chia là ${b}, nên số dư chỉ có thể là 1, 2, …, ${b - 1}.`, `Trong các số đã cho, chỉ có ${good} bé hơn ${b}.`],
      },
    };
  }
  if (v === 2) {
    const b = R(2, 9);
    return {
      topic, key: `sd2-${b}`, short: `Số dư lớn nhất khi chia cho ${b}`,
      text: `Trong phép chia cho ${b}, số dư lớn nhất có thể là bao nhiêu?`,
      fields: [{ id: 'n', label: 'Số dư lớn nhất' }],
      answer: { n: b - 1 },
      hint: (g) => Number(g.n) >= b
        ? `Số dư phải bé hơn số chia (${b}). Thử số bé hơn nhé!`
        : `Còn số nào lớn hơn ${g.n} mà vẫn bé hơn ${b} không?`,
      explain: {
        final: `Số dư lớn nhất là ${b - 1}.`, title: 'Nhớ nhé',
        lines: ['Số dư luôn bé hơn số chia.', `Số chia là ${b}, số lớn nhất bé hơn ${b} là ${b - 1}.`],
      },
    };
  }
  // v3: bạn làm đúng hay sai?
  const b = R(3, 9), q = R(2, 9), r = R(1, b - 1), a = b * q + r;
  const wrong = Math.random() < 0.6;
  const shownQ = wrong ? q - 1 : q, shownR = wrong ? r + b : r;
  const name = pick(NAMES);
  return {
    topic, key: `sd3-${a}-${b}-${wrong}`, short: `${name}: ${a} : ${b} = ${shownQ} (dư ${shownR})`,
    text: `Bạn ${name} tính: ${a} : ${b} = ${shownQ} (dư ${shownR}). Bạn ${name} làm đúng hay sai?`,
    choices: ['Đúng', 'Sai'],
    answer: wrong ? 1 : 0,
    vis: shareVis(a, b),
    hint: () => '',
    explain: {
      final: divText(a, b, q, r), title: wrong ? `Bạn ${name} làm sai` : `Bạn ${name} làm đúng`,
      lines: wrong
        ? [`Số dư ${shownR} không bé hơn số chia ${b}, nên còn chia thêm được.`, `Làm đúng: ${divText(a, b, q, r)}.`]
        : [`Số dư ${r} bé hơn số chia ${b}.`, `${q} × ${b} + ${r} = ${a}, nên bạn ${name} làm đúng.`],
    },
  };
}

function genB25LoiVan(topic) {
  const b = R(2, 9), q = R(2, 9), r = R(1, b - 1);
  return lvDuQuestion(topic, b * q + r, b);
}

function genB26De(topic) { const [a, b] = pickPair(P_DE); return numQuestion(topic, a, b); }
function genB26Nho(topic) { const [a, b] = pickPair(P_NHO); return numQuestion(topic, a, b); }
function genB26Du(topic) { const [a, b] = pickPair(P_DU); return qrQuestion(topic, a, b); }
function genB26LoiVan(topic) {
  if (Math.random() < 0.3) { const [a, b] = pickPair(P_DU); return lvDuQuestion(topic, a, b); }
  const [a, b] = pickPair(Math.random() < 0.5 ? P_DE : P_NHO);
  return lvHetQuestion(topic, a, b);
}

// ---------- Danh sách dạng bài ----------

export const GROUPS = [
  { id: 'b25', name: 'Bài 25. Phép chia hết, phép chia có dư' },
  { id: 'b26', name: 'Bài 26. Chia số có hai chữ số cho số có một chữ số' },
  { id: 'on', name: 'Ôn tập' },
];

export const TOPICS = [
  { id: 'b25-tinh', group: 'b25', name: 'Tính chia có dư', vidu: '17 : 5 = 3 (dư 2)', gen: genB25Tinh },
  { id: 'b25-hetdu', group: 'b25', name: 'Chia hết hay có dư?', vidu: '18 : 3 → chia hết', gen: genB25HetDu },
  { id: 'b25-sodu', group: 'b25', name: 'Số dư bé hơn số chia', vidu: 'Chia cho 4, số dư có thể là…', gen: genB25SoDu },
  { id: 'b25-loivan', group: 'b25', name: 'Toán có lời văn', vidu: 'Xếp 23 quả cam vào đĩa…', gen: genB25LoiVan },
  { id: 'b26-de', group: 'b26', name: 'Chia hết (dễ)', vidu: '48 : 4 = 12', gen: genB26De },
  { id: 'b26-nho', group: 'b26', name: 'Chia hết (khó hơn)', vidu: '72 : 3 = 24', gen: genB26Nho },
  { id: 'b26-du', group: 'b26', name: 'Chia có dư', vidu: '47 : 3 = 15 (dư 2)', gen: genB26Du },
  { id: 'b26-loivan', group: 'b26', name: 'Toán có lời văn', vidu: '84 bạn xếp thành 4 hàng…', gen: genB26LoiVan },
  { id: 'on-tap', group: 'on', name: 'Trộn tất cả', vidu: 'Mỗi câu một dạng', gen: null },
];

export const topicById = (id) => TOPICS.find((t) => t.id === id);

export function makeQuestion(topicId) {
  let t = topicById(topicId);
  if (!t.gen) t = pick(TOPICS.filter((x) => x.gen));
  return t.gen(t.id);
}

// ---------- Cấp độ ----------

const LEVELS = [
  ['🌰', 'Hạt giống'], ['🌱', 'Mầm xanh'], ['🌿', 'Cây non'], ['🪴', 'Cây con'], ['🌳', 'Cây lớn'],
  ['🌸', 'Cây ra hoa'], ['🍎', 'Cây trĩu quả'], ['🏡', 'Khu vườn nhỏ'], ['🌲', 'Khu rừng xanh'], ['⭐', 'Siêu sao Toán'],
];
// Số sao cần để lên cấp L: 0, 10, 25, 45, 70, 100, 135, …
const need = (L) => (5 * (L - 1) * (L + 2)) / 2;

export function levelInfo(stars) {
  let L = 1;
  while (stars >= need(L + 1)) L++;
  const [icon, title] = LEVELS[Math.min(L, LEVELS.length) - 1];
  const from = need(L), to = need(L + 1);
  return { level: L, icon, title, from, to, pct: Math.round(((stars - from) * 100) / (to - from)) };
}
