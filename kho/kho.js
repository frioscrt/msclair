/* Kho game · phần dùng chung cho mọi game.
   Đọc bộ câu hỏi trong thư mục kho/bo/ và đổi sang dạng game cần.
   Định dạng bộ câu hỏi: xem kho/DINH-DANG.md. */
(function () {
  "use strict";
  const BASE = new URL("bo/", (document.currentScript && document.currentScript.src) || location.href).href;
  const CACHE_KEY = "kho-bo-v1:";

  const shuffle = (arr) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const keep = (k, v) => { try { localStorage.setItem(CACHE_KEY + k, JSON.stringify(v)); } catch (e) {} };
  const kept = (k) => { try { return JSON.parse(localStorage.getItem(CACHE_KEY + k)); } catch (e) { return null; } };

  // Lấy file mới nhất; mất mạng thì dùng bản đã cất trên máy này
  async function getJSON(name) {
    try {
      const res = await fetch(BASE + name + "?t=" + Date.now(), { cache: "no-store" });
      if (!res.ok) throw new Error(res.status);
      const data = await res.json();
      keep(name, data);
      return data;
    } catch (e) {
      const old = kept(name);
      if (old) return old;
      throw e;
    }
  }

  // Danh sách bộ. Mặc định chỉ bộ đã duyệt; { all: true } lấy cả bộ chờ duyệt.
  async function list(opts) {
    const idx = await getJSON("index.json");
    const sets = (idx && idx.sets) || [];
    return opts && opts.all ? sets : sets.filter((s) => s.status === "approved");
  }
  const load = (id) => getJSON(id + ".json");

  const imgURL = (src) => /^(https?:|data:)/.test(src) ? src : BASE + src;
  const words = (lang) => lang === "vi"
    ? { t: "Đúng", f: "Sai", match: (x) => `“${x}” ghép với…` }
    : { t: "True", f: "False", match: (x) => `Which one goes with “${x}”?` };

  /* Đổi cả bộ thành câu trắc nghiệm (dạng mọi game đều chơi được).
     Trả về [{ text, options, answer, explain, figure }]. Câu nào không đổi được thì bỏ. */
  function toMC(set) {
    const W = words(set.lang), out = [];
    const qs = (set.questions || []).filter((q) => q && q.type);
    const fillAnswers = [...new Set(qs.filter((q) => q.type === "fill").map((q) => String(q.a)))];
    const fig = (q) => q.img ? `<img src="${esc(imgURL(q.img))}" alt="">` : "";
    const add = (q, text, right, wrongs, why) => {
      const wr = [...new Set(wrongs.map(String))].filter((w) => w && w !== String(right)).slice(0, 4);
      if (!text || right === undefined || right === "" || !wr.length) return;
      const options = shuffle([String(right), ...wr]);
      out.push({ text, options, answer: options.indexOf(String(right)), explain: why ? `${right}. ${why}` : String(right), figure: fig(q) });
    };
    for (const q of qs) {
      if (q.type === "mc") add(q, q.q, q.a, q.w || [], q.explain);
      else if (q.type === "tf") {
        const options = [W.t, W.f], answer = q.a ? 0 : 1;
        if (q.q) out.push({ text: q.q, options, answer, explain: options[answer] + (q.explain ? ". " + q.explain : ""), figure: fig(q), fixed: true });
      } else if (q.type === "fill") {
        const pool = q.w && q.w.length ? q.w : shuffle(fillAnswers.filter((a) => a !== String(q.a))).slice(0, 3);
        add(q, q.q, q.a, pool, q.explain);
      } else if (q.type === "match") {
        const pairs = (q.pairs || []).filter((p) => p && p.length >= 2);
        if (pairs.length < 3) continue;
        for (const [left, right] of pairs) {
          const others = shuffle(pairs.filter((p) => p[1] !== right).map((p) => p[1])).slice(0, 3);
          add(q, W.match(left), right, others, q.explain);
        }
      }
    }
    return out;
  }

  // Bộ bài để rút lần lượt: hết thì xào lại
  function deck(set) {
    const all = toMC(set);
    let pile = [];
    return {
      size: all.length,
      next() {
        if (!all.length) return null;
        if (!pile.length) pile = shuffle(all);
        const q = pile.pop();
        if (q.fixed) return Object.assign({}, q);
        const right = q.options[q.answer], options = shuffle(q.options);
        return Object.assign({}, q, { options, answer: options.indexOf(right) });
      },
    };
  }

  window.KHO = { BASE, list, load, toMC, deck, imgURL, esc };
})();
