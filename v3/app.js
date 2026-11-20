const STAGE = document.getElementById("stage");
const KIT = document.getElementById("kit");
const TYPE = {
  start: ["стартовый I", "стартовых I"], near: ["ближний IV–V", "ближних IV–V"],
  far: ["дальний II–III", "дальних II–III"], center: ["центральный VI–VII", "центральных VI–VII"],
  sea: ["морской ближний IV–V", "морских ближних IV–V"], seacenter: ["морской центральный VI–VII", "морских центральных VI–VII"],
  under: ["подземный ближний IV–V", "подземных ближних IV–V"], undercenter: ["подземный центральный VI–VII", "подземных центральных VI–VII"]
};
const NEUT = {
  easy: [[1, 0, 0, 0], [2, 0, 0, 0], [1, 1, 0, 0], [2, 1, 0, 0], [2, 1, 1, 0], [2, 2, 1, 0], [0, 0, 0, 1]],
  normal: [[1, 0, 0, 0], [2, 0, 0, 0], [2, 1, 0, 0], [1, 2, 0, 0], [1, 2, 1, 0], [1, 2, 2, 0], [0, 0, 0, 2]],
  hard: [[2, 0, 0, 0], [3, 0, 0, 0], [1, 2, 0, 0], [0, 3, 0, 0], [0, 2, 2, 0], [0, 2, 3, 0], [0, 0, 1, 2]],
  impossible: [[3, 0, 0, 0], [2, 1, 0, 0], [0, 3, 0, 0], [0, 2, 1, 0], [0, 1, 3, 0], [0, 1, 4, 0], [0, 0, 2, 2]]
};
const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII"];
const TIER = [["бронзовый", "бронзовых"], ["серебряный", "серебряных"], ["золотой", "золотых"], ["лазурный", "лазурных"]];
const START_BONUS = {
  easy: "бросить 2 кубика ресурсов или взять 2 артефакта",
  normal: "бросить 2 кубика ресурсов и взять один результат или поиск (2) в артефактах",
  hard: "бросить 1 кубик ресурсов или взять 1 малый артефакт",
  impossible: "нет"
};
const DIFF_NAME = { easy: "Лёгкая", normal: "Нормальная", hard: "Тяжёлая", impossible: "Невозможная" };
const STRIPE = {
  core: "#c4a574", conflux: "#d0a05a", tower: "#7aa0b8", fortress: "#6e8f62",
  rampart: "#7d9a55", stronghold: "#b56a45", inferno: "#c45a3c", cove: "#3d8f93",
  field: "#a33b3b", naval: "#3d7ea8", sg: "#8d6bb5", sg2: "#b56b8a"
};
const MARK_WORD = { y: "есть", n: "нет", q: "по желанию" };

let D, MECH, DECK, MODE, BOX, GLOSS;
let boxesOpen = false;
let memoTab = "mech";
let placeChapter = "all";

function load(key, fallback) {
  try {
    const v = JSON.parse(localStorage.getItem(key));
    return v === null ? fallback : v;
  } catch (e) { return fallback; }
}
function save(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
}
function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
  });
}
function plain(html) {
  const d = document.createElement("div");
  d.innerHTML = html || "";
  return d.textContent || "";
}
function lift(html) {
  const d = document.createElement("div");
  d.innerHTML = html || "";
  const srcs = Array.prototype.map.call(d.querySelectorAll("img"), function (img) { return img.getAttribute("src"); });
  d.querySelectorAll("img").forEach(function (img) { img.remove(); });
  return { srcs: srcs, html: d.innerHTML.trim() };
}

function neutArmy(diff, level) {
  const row = NEUT[diff][level - 1];
  const parts = [];
  row.forEach(function (n, i) { if (n) parts.push(n + " " + TIER[i][n === 1 ? 0 : 1]); });
  return { text: parts.join(", "), count: row.reduce(function (a, b) { return a + b; }, 0) };
}
function people(n) {
  const a = n % 10, b = n % 100;
  if (a === 1 && b !== 11) return n + " игрок";
  if (a >= 2 && a <= 4 && (b < 10 || b > 20)) return n + " игрока";
  return n + " игроков";
}
function tile(code, box) {
  const page = D.pages[box][code];
  let out = '<a href="../pdf/' + D.guides[box] + "#page=" + page + '" target="_blank" rel="noopener">' + code + "</a>";
  const alias = (D.alias[box] || {})[code];
  if (alias) out += " <span class=\"kicker\">(в гиде подписан " + alias + ")</span>";
  return out;
}
function tiles(box, list) { return list.map(function (c) { return tile(c, box); }).join(", "); }
function tileNeed(type, n, have) {
  let text = n + " " + (n === 1 ? TYPE[type][0] : TYPE[type][1]) + ".";
  const pool = D.tiles[type];
  const core = pool[0][0] === "core" ? pool[0][1] : [];
  if (core.length && n <= core.length) return text + " В базе: " + tiles("core", core) + ".";
  const extra = pool.filter(function (p) { return p[0] !== "core" && have[p[0]]; });
  if (core.length) text += " В базе только " + core.length + ": " + tiles("core", core) + ". Ещё " + (n - core.length) + " — из дополнений: ";
  else text += " Есть в коробках: ";
  text += extra.length
    ? extra.map(function (p) { return BOX[p[0]] + " " + tiles(p[0], p[1]); }).join("; ") + "."
    : '<span class="warn">отмеченных коробок с такими тайлами нет</span>.';
  return text;
}
function owned() {
  const saved = load("homm3-owned", {});
  const set = {};
  D.boxes.forEach(function (b) { set[b[0]] = saved[b[0]] !== false; });
  return set;
}
function setOwned(id, on) {
  const all = load("homm3-owned", {});
  all[id] = on;
  save("homm3-owned", all);
}
function mods(id) { return load("homm3-mods", {})[id] || {}; }
function modOn(id, key) {
  const v = mods(id)[key];
  if (v === undefined) return !!(D.modules[key] && D.modules[key].on);
  return !!v;
}
function setMod(id, key, on) {
  const all = load("homm3-mods", {});
  all[id] = all[id] || {};
  all[id][key] = on;
  save("homm3-mods", all);
}
function selValue(mid, sid, fallback) {
  const all = load("homm3-selects", {});
  return all["sel-" + mid + "-" + sid] || fallback;
}
function facValue(mid, n, list) {
  const all = load("homm3-selects", {});
  const saved = all["fac-" + mid + "-" + n];
  if (saved && list.some(function (f) { return f[0] === saved; })) return saved;
  return list[Math.min(n - 1, list.length - 1)][0];
}
function saveSel(id, value) {
  const all = load("homm3-selects", {});
  all[id] = value;
  save("homm3-selects", all);
}
function filters() {
  return load("homm3-v3-filters", { mode: "all", box: "all", q: "", placeQ: "", memoQ: "", memoMode: "clash" });
}
function setFilters(patch) {
  save("homm3-v3-filters", Object.assign(filters(), patch));
}
function checkedPicks() {
  const saved = load("homm3-picks", {});
  return D.picks.filter(function (p) { return p.choose !== false && saved[p.id]; });
}
function togglePick(id) {
  const saved = load("homm3-picks", {});
  saved[id] = !saved[id];
  save("homm3-picks", saved);
}
function laidMap(id) { return load("homm3-laid", {})[id] || {}; }
function toggleLaid(id, key) {
  const all = load("homm3-laid", {});
  all[id] = all[id] || {};
  all[id][key] = !all[id][key];
  save("homm3-laid", all);
}

function cond(c, ctx) {
  if (!c) return true;
  return c.split("&").every(function (part) {
    part = part.trim();
    const neg = part.charAt(0) === "!";
    if (neg) part = part.slice(1);
    const kv = part.split("=");
    const key = kv[0].trim();
    let ok;
    if (key === "have") ok = !!ctx.have[kv[1].trim()];
    else ok = kv[1].split(",").map(function (s) { return s.trim(); }).indexOf(ctx.sel[key]) !== -1;
    return neg ? !ok : ok;
  });
}
function count(expr, ctx) {
  const m = /^(\d*)n(?:\+(\d+))?$/.exec(expr);
  if (!m) return Number(expr);
  return (m[1] ? Number(m[1]) : 1) * ctx.n + (m[2] ? Number(m[2]) : 0);
}
function pool(arg, have) {
  const out = arg.split(";").map(function (entry) {
    const eq = entry.indexOf("=");
    const head = entry.slice(0, eq).split(":");
    const box = head[0];
    if (!have[box]) return null;
    return (head[1] || BOX[box]) + " " + tiles(box, entry.slice(eq + 1).split(","));
  }).filter(Boolean);
  return out.length ? out.join("; ") : '<span class="warn">пул пуст: нужных коробок нет дома</span>';
}
function neutWaves(arg, ctx) {
  const a = arg.split(":");
  const from = Number(a[0]), to = Number(a[1]), last = Number(a[2]), min = Number(a[3]), fill = a.slice(4).join(":");
  const waves = [];
  for (let lvl = from; lvl <= to; lvl++) {
    const army = neutArmy(ctx.diff, lvl);
    const r1 = lvl * 2 - 1, r2 = Math.min(lvl * 2, last);
    const rounds = r1 === r2 ? r1 + "-й раунд" : "раунды " + r1 + "–" + r2;
    waves.push(rounds + ", уровень " + ROMAN[lvl - 1] + ": " + army.text + (army.count < min ? " и " + fill : "") + ".");
  }
  return "<ul>" + waves.map(function (t) { return "<li>" + t + "</li>"; }).join("") + "</ul>";
}
function fill(text, ctx) {
  return String(text || "").replace(/\{(if [^{}:]+:[^{}]*|[a-z]+(?::[^{}]*)?)\}/g, function (all, body) {
    if (body.indexOf("if ") === 0) {
      const i = body.indexOf(":");
      return cond(body.slice(3, i), ctx) ? body.slice(i + 1) : "";
    }
    const i = body.indexOf(":");
    const name = i === -1 ? body : body.slice(0, i);
    const arg = i === -1 ? "" : body.slice(i + 1);
    switch (name) {
      case "need": { const p = arg.split(":"); return tileNeed(p[0], count(p[1], ctx), ctx.have); }
      case "pool": return pool(arg, ctx.have);
      case "sel": {
        const alts = arg.split("|");
        const sid = alts.shift();
        if (!alts.length) return ctx.label[sid] || "";
        let star = "";
        for (const alt of alts) {
          const eq = alt.indexOf("=");
          const v = alt.slice(0, eq);
          if (v === ctx.sel[sid]) return alt.slice(eq + 1);
          if (v === "*") star = alt.slice(eq + 1);
        }
        return star;
      }
      case "diff": return DIFF_NAME[ctx.diff];
      case "neut": return neutArmy(ctx.diff, Number(arg)).text;
      case "neuttable": {
        const parts = [];
        for (let lvl = 1; lvl <= 7; lvl++) parts.push(ROMAN[lvl - 1] + ": " + neutArmy(ctx.diff, lvl).text);
        return parts.join("; ");
      }
      case "neutwaves": return neutWaves(arg, ctx);
      case "bonus": return START_BONUS[ctx.diff];
      case "n": return String(ctx.n);
      case "people": return people(ctx.n);
      case "have": return ctx.have[arg] ? "" : ' <span class="warn">коробки нет дома</span>';
      case "map": return "«Карта»";
      default: return all;
    }
  });
}
function gloss(htmlText) {
  const seen = {};
  const parts = String(htmlText || "").split(/(<[^>]+>)/);
  let depth = 0;
  return parts.map(function (part) {
    if (part.charAt(0) === "<") return part;
    let text = part;
    GLOSS.forEach(function (g) {
      if (seen[g[1]]) return;
      g[0].lastIndex = 0;
      let m;
      while ((m = g[0].exec(text)) !== null) {
        const before = text.slice(0, m.index);
        const open = depth + (before.split("«").length - 1) - (before.split("»").length - 1);
        const end = m.index + m[0].length;
        if (open === 0 && text.slice(end, end + g[1].length + 3) === " (" + g[1] + ")") { seen[g[1]] = true; break; }
        if (open > 0 || text.slice(end, end + 2) === " (") continue;
        text = text.slice(0, end) + " (" + g[1] + ")" + text.slice(end);
        seen[g[1]] = true;
        break;
      }
    });
    depth += (part.split("«").length - 1) - (part.split("»").length - 1);
    return text;
  }).join("");
}
function context(cfg) {
  const have = owned();
  const ctx = { cfg: cfg, have: have, sel: {}, label: {} };
  cfg.selects.forEach(function (s) {
    const value = selValue(cfg.id, s.id, s.options[0][0]);
    ctx.sel[s.id] = value;
    const opt = s.options.filter(function (o) { return o[0] === value; })[0] || s.options[0];
    ctx.label[s.id] = opt[1];
  });
  ctx.n = ctx.sel.count ? Number(ctx.sel.count) : cfg.seats.length;
  ctx.diff = ctx.sel.diff || "normal";
  return ctx;
}
function visible(block, ctx) { return !block.if || cond(block.if, ctx); }
function itemHtml(item, ctx) {
  if (typeof item === "string") return fill(item, ctx);
  if (!visible(item, ctx)) return "";
  return fill(item.html, ctx);
}
function mechA(name, mode) {
  const info = MECH[name];
  if (!info) return esc(name);
  let out = '<a href="#memo/' + info.id + '">' + esc(name) + "</a>";
  if (info.modes && info.modes[mode]) out += ' <a href="#memo/' + info.id + '">≠</a>';
  return out;
}
function kitByMech(name) {
  return D.picks.filter(function (p) {
    return p.mech === name || (p.required || []).indexOf(name) !== -1;
  })[0] || null;
}
function kitButton(p) {
  if (!p) return "";
  return ' <button type="button" class="ghost" data-kit="' + p.id + '">Состав</button>';
}
function pickHits(m, p) {
  if (p.astro) return !(m.decks_opt && m.decks_opt.noAstro);
  const req = (m.required || []).map(function (r) { return r[0]; });
  if ((p.required || []).some(function (name) { return req.indexOf(name) !== -1; })) return true;
  if (p.module && (m.modules || []).indexOf(p.module) !== -1) {
    const mech = MECH[D.modules[p.module].mech];
    if (!mech || mech.marks[m.mode] !== "n") return true;
  }
  const decks = ((m.pull && m.pull.decks) || []).map(function (d) { return d.deck[0]; });
  if (p.deck && decks.indexOf(p.deck) !== -1) return true;
  if (p.deck === "d-elem" && m.decks_opt && m.decks_opt.elem) return true;
  return false;
}
function missionOk(m) {
  const f = filters();
  if (f.mode !== "all" && m.mode !== f.mode) return false;
  if (f.box !== "all" && m.box !== f.box) return false;
  if (f.q && m.label.toLowerCase().indexOf(f.q.toLowerCase()) === -1) return false;
  return checkedPicks().every(function (p) { return pickHits(m, p); });
}

function pagesHtml(m) {
  return m.pages.map(function (p) {
    const n = p.a === p.b ? String(p.a) : p.a + "–" + p.b;
    const href = p.a === p.b ? p.href + "#page=" + p.a : p.href + "#page=" + p.a;
    return '<a href="' + href + '" target="_blank" rel="noopener">' + esc(p.label) + ", стр. " + n + "</a>";
  }).join("");
}
function passport(m) {
  return '<header class="passport" style="--faction:' + (STRIPE[m.box] || "var(--accent)") + '">' +
    "<div><p class=\"kicker\">" + esc(MODE[m.mode]) + " · " + esc(m.players) + " · " + esc(BOX[m.box]) + "</p>" +
    "<h1>" + esc(m.label) + "</h1><p class=\"meta\">" + esc(m.bookName) + "</p></div>" +
    '<div class="pages">' + pagesHtml(m) + "</div></header>";
}
function settings(m, ctx) {
  const have = ctx.have;
  const allow = m.factions;
  const list = allow ? D.factions.filter(function (f) { return allow.indexOf(f[0]) !== -1; }) : D.factions;
  const sels = m.selects.map(function (s) {
    const value = ctx.sel[s.id];
    const opts = s.options.map(function (o) {
      return '<option value="' + esc(o[0]) + '"' + (o[0] === value ? " selected" : "") + ">" + esc(o[1]) + "</option>";
    }).join("");
    return '<label class="field">' + esc(s.label) + '<select data-sel="sel-' + m.id + "-" + s.id + '">' + opts + "</select></label>";
  }).join("");
  const seats = m.seats.map(function (seat, i) {
    const n = i + 1;
    if (n > ctx.n) return "";
    const value = facValue(m.id, n, list);
    const opts = list.map(function (f) {
      return '<option value="' + f[0] + '"' + (f[0] === value ? " selected" : "") + ">" + esc(f[1]) + "</option>";
    }).join("");
    return '<label class="field">' + esc(seat) + '<select data-sel="fac-' + m.id + "-" + n + '">' + opts + "</select></label>";
  }).join("");
  const boxes = boxesOpen ? '<div class="card"><h2>Какие коробки есть дома</h2><div class="filters">' +
    D.boxes.map(function (b) {
      return '<button type="button" class="tag" data-box="' + b[0] + '" aria-pressed="' + (have[b[0]] ? "true" : "false") + '">' + esc(b[1]) + "</button>";
    }).join("") + "</div></div>" : "";
  return boxes + '<section class="card"><h2>Настройки партии</h2><div class="row">' + sels + seats + "</div></section>";
}

function blockPieces(blocks, ctx) {
  const out = { ps: [], items: [], rounds: [], pieces: [], imgs: [] };
  (blocks || []).forEach(function (b) {
    if (!visible(b, ctx)) return;
    if (b.t === "p") {
      const lifted = lift(gloss(fill(b.html, ctx)));
      lifted.srcs.forEach(function (s) { out.imgs.push(s); });
      if (plain(lifted.html)) out.ps.push(lifted.html);
    } else if (b.t === "items") {
      b.items.forEach(function (it) {
        const html = gloss(itemHtml(it, ctx));
        if (!html) return;
        const lifted = lift(html);
        lifted.srcs.forEach(function (s) { out.imgs.push(s); });
        const text = plain(lifted.html);
        if (text) out.items.push({ html: lifted.html, token: /жетон/i.test(text) });
      });
    } else if (b.t === "round") {
      const items = (b.items || []).map(function (it) { return gloss(itemHtml(it, ctx)); }).filter(Boolean);
      out.rounds.push({ title: gloss(fill(b.title, ctx)), items: items });
    } else if (b.t === "piece") {
      out.pieces.push(b);
    }
  });
  return out;
}
function stepsHtml(items) {
  if (!items.length) return "";
  return '<ol class="steps">' + items.map(function (it) { return "<li><div>" + it.html + "</div></li>"; }).join("") + "</ol>";
}
function renderSection(s, ctx) {
  const b = blockPieces(s.blocks, ctx);
  if (s.kind === "map") return mapHtml(s, b);
  if (s.kind === "rules") return rulesHtml(s, b);
  if (s.kind === "victory") return victoryHtml(s, b);
  if (s.kind === "events") return eventsHtml(s, b);
  if (s.kind === "story") return storyHtml(s, b, ctx);
  return '<section class="card"><h2>' + esc(s.title) + "</h2>" + b.ps.map(function (p) { return "<p>" + p + "</p>"; }).join("") + stepsHtml(b.items) + "</section>";
}
function mapHtml(s, b) {
  const tiles = b.items.filter(function (it) { return !it.token; });
  const tokens = b.items.filter(function (it) { return it.token; });
  const notes = [];
  b.ps.forEach(function (p) {
    if (/жетон/i.test(plain(p))) tokens.push({ html: p });
    else notes.push(p);
  });
  const figs = b.imgs.map(function (src) { return '<div class="map-frame"><img src="' + esc(src) + '" alt="Схема карты"></div>'; }).join("");
  const col = function (title, list) {
    if (!list.length) return "";
    return "<div><h3>" + title + "</h3><ul>" + list.map(function (it) { return "<li>" + it.html + "</li>"; }).join("") + "</ul></div>";
  };
  return '<section class="card"><h2>' + esc(s.title) + "</h2>" + figs +
    notes.map(function (p) { return "<p>" + p + "</p>"; }).join("") +
    '<div class="groups">' + col("Тайлы", tiles) + col("Жетоны", tokens) + "</div></section>";
}
function rulesHtml(s, b) {
  const cards = b.items.map(function (it) {
    const text = plain(it.html);
    const cut = text.indexOf(". ");
    const title = cut > 20 && cut < 110 ? text.slice(0, cut) : text.slice(0, 90);
    const rest = text.length > title.length + 1;
    if (!rest) return '<article class="card"><p>' + it.html + "</p></article>";
    return '<details class="rule"><summary>' + esc(title) + '</summary><div class="prose">' + it.html + "</div></details>";
  }).join("");
  return "<section><h2>" + esc(s.title) + "</h2>" + b.ps.map(function (p) { return "<p>" + p + "</p>"; }).join("") + cards + "</section>";
}
function victoryHtml(s, b) {
  const win = [], lose = [], rest = [];
  b.ps.forEach(function (p) {
    const t = plain(p);
    if (t.indexOf("Победа") === 0) win.push(p);
    else if (t.indexOf("Поражение") === 0) lose.push(p);
    else rest.push(p);
  });
  let body = rest.map(function (p) { return "<p>" + p + "</p>"; }).join("") + stepsHtml(b.items);
  if (win.length || lose.length) {
    body += '<div class="outcomes"><article class="outcome win"><h3>Победа</h3>' + win.map(function (p) { return "<p>" + p + "</p>"; }).join("") +
      '</article><article class="outcome lose"><h3>Поражение</h3>' + lose.map(function (p) { return "<p>" + p + "</p>"; }).join("") + "</article></div>";
  }
  return "<section><h2>" + esc(s.title) + "</h2>" + body + "</section>";
}
function eventsHtml(s, b) {
  const rounds = b.rounds.map(function (r) {
    return '<div class="round"><h3>' + r.title + "</h3>" + (r.items.length ? "<ul>" + r.items.map(function (it) { return "<li>" + it + "</li>"; }).join("") + "</ul>" : "") + "</div>";
  }).join("");
  return "<section><h2>" + esc(s.title) + "</h2>" + b.ps.map(function (p) { return "<p>" + p + "</p>"; }).join("") +
    '<div class="timeline">' + rounds + "</div>" + stepsHtml(b.items) + "</section>";
}
function storyHtml(s, b, ctx) {
  const pieces = b.pieces.map(function (piece) {
    if (!visible(piece, ctx)) return "";
    const inner = blockPieces(piece.blocks, ctx);
    return '<details class="piece"><summary>' + piece.title + "</summary>" +
      (piece.when ? '<p class="when">Когда читать: ' + piece.when + "</p>" : "") +
      '<div class="prose">' + inner.ps.map(function (p) { return "<p>" + p + "</p>"; }).join("") + stepsHtml(inner.items) + "</div></details>";
  }).join("");
  return "<section><h2>" + esc(s.title) + "</h2>" + b.ps.map(function (p) { return "<p>" + p + "</p>"; }).join("") + pieces + "</section>";
}

function requiredHtml(m) {
  const seen = {};
  const cards = m.required.map(function (row) {
    const kit = kitByMech(row[0]);
    const btn = kit && !seen[kit.id] ? (seen[kit.id] = true, kitButton(kit)) : "";
    return '<article class="card"><h3>' + mechA(row[0], m.mode) + btn + "</h3>" + (row[1] ? "<p>" + gloss(fill(row[1], context(m))) + "</p>" : "") + "</article>";
  }).join("");
  return "<section><h2>Обязательные механики</h2>" + cards + "</section>";
}
function switches(m, have) {
  const mods = m.modules.filter(function (key) {
    const mod = D.modules[key];
    const mech = MECH[mod.mech];
    return mech && mech.marks[m.mode] !== "n";
  }).map(function (key) {
    const mod = D.modules[key];
    const has = mod.boxes.some(function (b) { return have[b]; });
    const on = has && modOn(m.id, key);
    const kit = kitByMech(mod.mech);
    return '<div class="switch"><button type="button" role="switch" aria-checked="' + (on ? "true" : "false") + '" data-mod="' + key + '"' + (has ? "" : " disabled") + "></button><div><div class=\"name\">" +
      mechA(mod.mech, m.mode) + " " + mod.boxes.map(function (b) { return '<span class="pill">' + esc(BOX[b]) + "</span>"; }).join(" ") +
      (kit ? kitButton(kit) : "") + "</div>" + (has ? "" : '<p class="warn">коробки нет дома</p>') + "</div></div>";
  }).join("");
  const rules = Object.keys(MECH).filter(function (name) {
    const mech = MECH[name];
    return (mech.section === "variants" || mech.section === "addrules") && mech.marks[m.mode] !== "n" && !m.exclude[name];
  }).map(function (name) {
    const on = modOn(m.id, "r:" + name);
    return '<div class="switch"><button type="button" role="switch" aria-checked="' + (on ? "true" : "false") + '" data-mod="r:' + esc(name) + '"></button><div class="name">' + mechA(name, m.mode) + "</div></div>";
  }).join("");
  const excluded = Object.keys(m.exclude).map(function (name) { return esc(name) + " — " + esc(m.exclude[name]); });
  return '<section class="card"><h2>Включить в эту партию</h2><p class="kicker">Переключатель добавляет механику в расклад. Это не фильтр списка.</p>' +
    mods + (rules ? "<h3>Дополнительные правила</h3>" + rules : "") +
    (excluded.length ? '<p class="kicker">Не предлагаются: ' + excluded.join("; ") + ".</p>" : "") + "</section>";
}
function baseDecks(have, opt) {
  const list = [["d-hero"], ["d-faction"], ["d-stat"], ["d-skill"], ["d-spell"], ["d-art"], ["d-neut"]];
  if (!opt.noAstro) list.push(["d-astro"]);
  if (opt.elem && have.conflux) list.push(["d-elem", opt.elem]);
  return list;
}
function deckLine(item, have) {
  const id = item[0];
  const d = DECK[id];
  if (!d) return esc(id);
  const src = (d.sources || []).filter(function (s) {
    const bid = Object.keys(BOX).filter(function (k) { return BOX[k] === s; })[0];
    return !bid || have[bid];
  });
  let out = "<b>" + esc(d.name) + "</b> — " + d.rule;
  if (item[1]) out += " " + item[1];
  if (src.length) out += ' <span class="kicker">Из коробок: ' + src.map(esc).join(", ") + ".</span>";
  return out;
}
function pullGroups(m, ctx) {
  const have = ctx.have;
  const pl = m.pull;
  function rows(list) {
    const out = [];
    (list || []).forEach(function (it) {
      if (typeof it !== "string") {
        if (!cond(it.if, ctx)) return;
        it = it.text;
      }
      if (it === "{packs}") {
        packRows(m, ctx).forEach(function (x) { out.push(x); });
        return;
      }
      const t = gloss(fill(it, ctx));
      if (t) out.push(t);
    });
    return out;
  }
  const decks = baseDecks(have, m.decks_opt || {}).concat((pl.decks || []).filter(function (d) { return cond(d.if, ctx); }).map(function (d) {
    return [d.deck[0], fill(d.deck[1], ctx)];
  }));
  const mods = [];
  const rules = [];
  const skip = rows(pl.skip);
  m.modules.forEach(function (key) {
    const mod = D.modules[key];
    if (!mod.boxes.some(function (b) { return have[b]; })) return;
    if (MECH[mod.mech].marks[m.mode] === "n") return;
    if (!modOn(m.id, key)) {
      if (mod.off) skip.push(mod.off);
      return;
    }
    mods.push(mechA(mod.mech, m.mode) + ": " + mod.take);
    (mod.decks || []).forEach(function (id) {
      if (!decks.some(function (x) { return x[0] === id; })) decks.push([id]);
    });
  });
  Object.keys(MECH).forEach(function (name) {
    const mech = MECH[name];
    if ((mech.section === "variants" || mech.section === "addrules") && mech.marks[m.mode] !== "n" && !m.exclude[name] && modOn(m.id, "r:" + name)) {
      rules.push(mechA(name, m.mode));
    }
  });
  const tokens = rows(pl.tokens);
  if (modOn(m.id, "morale") && have.field) skip.push("Жетоны морали: играют картами.");
  else tokens.push("Жетоны морали из базы, плюс и минус.");
  return [
    ["Тайлы", rows(pl.tiles)],
    ["Жетоны и кубики", tokens],
    ["Игроки", rows(pl.players)],
    ["Противник", rows(pl.enemy)],
    ["Колоды", decks.map(function (d) { return deckLine(d, have); })],
    ["Выбранные модули", mods],
    ["Дополнительные правила", rules],
    ["Не класть", skip]
  ];
}
function packRows(m, ctx) {
  const list = m.factions ? D.factions.filter(function (f) { return m.factions.indexOf(f[0]) !== -1; }) : D.factions;
  const out = [];
  m.seats.forEach(function (seat, i) {
    const n = i + 1;
    if (n > ctx.n) return;
    const id = facValue(m.id, n, list);
    const f = D.factions.filter(function (x) { return x[0] === id; })[0];
    const who = m.seats.length === 1 ? "Ваша фракция" : "Игрок " + n;
    out.push(who + " — " + f[1] + " (" + BOX[f[2]] + "): доска города, 7 карт отрядов, карты героя, миниатюра героя, кубики фракции." +
      (ctx.have[f[2]] ? "" : ' <span class="warn">коробки нет дома</span>'));
  });
  return out;
}
function layoutHtml(m, ctx) {
  const marks = laidMap(m.id);
  const groups = pullGroups(m, ctx).map(function (pair) {
    if (!pair[1].length) return "";
    const items = pair[1].map(function (html, i) {
      const key = pair[0] + ":" + i;
      return '<label class="check"><input type="checkbox" data-laid="' + esc(key) + '"' + (marks[key] ? " checked" : "") + "><span>" + html + "</span></label>";
    }).join("");
    return "<h3>" + esc(pair[0]) + "</h3>" + items;
  }).join("");
  return '<section class="card"><h2>Что выложить</h2><p class="kicker">Отметка помнится для этой партии в этом браузере.</p><div class="checks">' + groups + "</div></section>";
}

function leadHtml(m, ctx) {
  if (!m.lead || !m.lead.length) return "";
  const b = blockPieces(m.lead, ctx);
  return '<section class="card"><h2>О миссии</h2>' + b.ps.map(function (p) { return "<p>" + p + "</p>"; }).join("") + stepsHtml(b.items) + "</section>";
}
function missionDoc(m) {
  const ctx = context(m);
  const sections = (m.sections || []).map(function (s) { return renderSection(s, ctx); }).join("");
  return '<article style="--faction:' + (STRIPE[m.box] || "var(--accent)") + '">' + passport(m) + settings(m, ctx) + leadHtml(m, ctx) + sections +
    requiredHtml(m) + switches(m, ctx.have) + layoutHtml(m, ctx) + "</article>";
}
function partyHtml() {
  const f = filters();
  const list = D.missions.filter(missionOk);
  let id = arg || load("homm3-mission", "");
  if (!list.some(function (m) { return m.id === id; })) id = list.length ? list[0].id : "";
  const picks = D.picks.filter(function (p) { return p.choose !== false; });
  const saved = load("homm3-picks", {});
  const left = '<div class="list"><div class="row">' +
    '<label class="field">Режим<select data-filter="mode">' + '<option value="all">Все</option>' + D.modes.map(function (mm) {
      return '<option value="' + mm[0] + '"' + (f.mode === mm[0] ? " selected" : "") + ">" + esc(mm[1]) + "</option>";
    }).join("") + "</select></label>" +
    '<label class="field">Дополнение<select data-filter="box">' + '<option value="all">Все</option>' + D.boxes.map(function (b) {
      return '<option value="' + b[0] + '"' + (f.box === b[0] ? " selected" : "") + ">" + esc(b[1]) + "</option>";
    }).join("") + "</select></label>" +
    '<label class="field">Поиск<input type="search" data-filter="q" value="' + esc(f.q) + '"></label></div>' +
    '<div class="filters">' + picks.map(function (p) {
      return '<button type="button" class="tag" data-pick="' + p.id + '" aria-pressed="' + (saved[p.id] ? "true" : "false") + '">' + esc(p.name) + "</button>";
    }).join("") + "</div><p class=\"kicker\">" + list.length + " сценариев</p>" +
    list.map(function (m) {
      return '<button type="button" class="mission' + (m.id === id ? " on" : "") + '" data-mission="' + m.id + '" style="--stripe:' + (STRIPE[m.box] || "var(--accent)") + '"><b>' +
        esc(m.label) + "</b><span>" + esc(MODE[m.mode]) + " · " + esc(BOX[m.box]) + "</span></button>";
    }).join("") + "</div>";
  const doc = id ? missionDoc(D.missions.filter(function (m) { return m.id === id; })[0]) : "<p>Для этого выбора миссий нет.</p>";
  if (id) save("homm3-mission", id);
  return '<div class="party">' + left + "<div>" + doc + "</div></div>";
}

function marksHtml(marks, mode, modes) {
  return '<div class="marks">' + D.modes.map(function (mm) {
    const k = marks[mm[0]] || "n";
    const diff = modes && modes[mm[0]] ? " diff" : "";
    const on = mm[0] === mode ? " on" : "";
    return '<span class="mark ' + k + diff + on + '">' + esc(mm[1]) + " " + (k === "y" ? "✓" : k === "n" ? "✗" : "✓?") + "</span>";
  }).join("") + "</div>";
}
function memoHtml() {
  const f = filters();
  const mode = f.memoMode || "clash";
  const q = (f.memoQ || "").toLowerCase();
  const tabs = '<div class="filters"><button type="button" class="tag" data-tab="mech" aria-pressed="' + (memoTab === "mech" ? "true" : "false") + '">Механики</button>' +
    '<button type="button" class="tag" data-tab="deck" aria-pressed="' + (memoTab === "deck" ? "true" : "false") + '">Колоды</button></div>';
  const tools = '<div class="row"><label class="field">Режим<select data-filter="memoMode">' + D.modes.map(function (mm) {
    return '<option value="' + mm[0] + '"' + (mode === mm[0] ? " selected" : "") + ">" + esc(mm[1]) + "</option>";
  }).join("") + '</select></label><label class="field">Поиск<input type="search" data-filter="memoQ" value="' + esc(f.memoQ || "") + '"></label></div>';
  if (memoTab === "deck") {
    const cards = D.decks.filter(function (d) { return !q || d.name.toLowerCase().indexOf(q) !== -1; }).map(function (d) {
      const on = arg === d.id;
      return '<article class="card" id="' + d.id + '"><h2>' + esc(d.name) + "</h2>" + marksHtml(d.marks, mode, {}) +
        "<p>" + d.rule + "</p>" + (on ? '<div class="prose">' + d.about + "</div>" : '<p class="kicker"><a href="#memo/' + d.id + '">Состав колоды</a></p>') +
        '<p><a href="' + D.pdf + "#page=" + d.page + '" target="_blank" rel="noopener">Свод, стр. ' + d.page + "</a></p></article>";
    }).join("");
    return "<h1>Колоды</h1>" + tabs + tools + cards;
  }
  const cards = D.mechs.filter(function (m) { return !q || m.name.toLowerCase().indexOf(q) !== -1; }).map(function (m) {
    const note = m.modes && m.modes[mode];
    const open = arg === m.id;
    const text = plain(m.base);
    const short = text.length > 220 ? text.slice(0, 220) + "…" : m.base;
    return '<article class="card" id="' + m.id + '"><h2>' + esc(m.name) + "</h2><p>" +
      (Array.isArray(m.exp) ? m.exp : [m.exp]).map(function (e) { return '<span class="pill">' + esc(e) + "</span>"; }).join(" ") +
      "</p>" + marksHtml(m.marks, mode, m.modes) + "<p>" + (open ? m.base : short) + "</p>" +
      (note ? '<p><b>≠ ' + esc(MODE[mode]) + ".</b> " + note.text + "</p>" : "") +
      (open ? "" : '<p class="kicker"><a href="#memo/' + m.id + '">Полный текст</a></p>') +
      '<p><a href="' + D.pdf + "#page=" + m.page + '" target="_blank" rel="noopener">Свод, стр. ' + m.page + "</a></p></article>";
  }).join("");
  return "<h1>Памятка</h1><p class=\"lede\">Одна механика — одна карточка. Отметки показывают, есть ли она в выбранном режиме. Знак ≠ значит, что в этом режиме правило другое.</p>" + tabs + tools + cards;
}
function placesHtml() {
  const f = filters();
  const q = (f.placeQ || "").toLowerCase();
  const chips = '<div class="filters"><button type="button" class="tag" data-chapter="all" aria-pressed="' + (placeChapter === "all" ? "true" : "false") + '">Все</button>' +
    D.locations.map(function (c) {
      return '<button type="button" class="tag" data-chapter="' + c.id + '" aria-pressed="' + (placeChapter === c.id ? "true" : "false") + '">' + esc(c.title) + "</button>";
    }).join("") + '</div><label class="field">Поиск<input type="search" data-filter="placeQ" value="' + esc(f.placeQ || "") + '"></label>';
  const cards = [];
  D.locations.forEach(function (c) {
    if (placeChapter !== "all" && c.id !== placeChapter) return;
    c.places.forEach(function (p) {
      const blob = plain(p.name + " " + p.effect).toLowerCase();
      if (q && blob.indexOf(q) === -1) return;
      cards.push('<article class="card"><p class="kind">' + esc(p.kind || c.title) + "</p><h2>" + p.name + "</h2><p>" + p.effect + "</p><p>" + p.links + "</p></article>");
    });
  });
  return "<h1>Локации</h1><p class=\"lede\">Имя, тип поля и эффект. Ссылка открывает страницу книги, где напечатан жетон.</p>" + chips + '<div class="loc-grid">' + cards.join("") + "</div>";
}
function styleHtml() {
  return '<div class="samples"><h1>Кабинет</h1><p class="lede">Общий стиль: тёмный стол, латунный акцент, заголовки Palatino, кнопки и списки Segoe. Светлая тема — та же раскладка.</p>' +
    '<header class="passport" style="--faction:#3d8f93"><div><p class="kicker">Альянс · 4 игрока · Причал</p><h1>Strait of Storms</h1><p class="meta">Книга миссий Причала</p></div><div class="pages"><a href="#style">Сценарий, стр. 7–8</a></div></header>' +
    '<section class="card"><h2>Шаг подготовки</h2><ol class="steps"><li><div>14 золота, 4 стройматериала, 1 драгоценность.</div></li><li><div>Бронзовое жилище и гильдия магов.</div></li></ol></section>' +
    '<details class="rule" open><summary>Ресурсы союзнику только в свой ход</summary><div class="prose">Обычное правило альянса разрешает это в ход любого из двоих. Здесь — нет.</div></details>' +
    '<div class="outcomes"><article class="outcome win"><h3>Победа</h3><p>Удержать вражеский город два раунда.</p></article><article class="outcome lose"><h3>Поражение</h3><p>Оба главных героя союза разбиты.</p></article></div>' +
    '<div class="switch"><button type="button" role="switch" aria-checked="true"></button><div class="name">Включить в эту партию</div></div>' +
    '<div class="filters"><button type="button" class="tag" aria-pressed="true">Фильтр списка</button><button type="button" class="tag" aria-pressed="false">Ещё механика</button></div>' +
    '<div class="timeline"><div class="round"><h3>1-й раунд</h3><p>Прочитайте кусок, когда до него дойдёт партия.</p></div></div>' +
    '<details class="piece"><summary>Перемирие на десять тысяч лет</summary><p class="when">Когда читать: в 1-м раунде.</p></details>' +
    '<article class="card"><p class="kind">Одноразовое</p><h2>Заброшенный корабль</h2><p>Поиск в колоде артефактов.</p></article></div>';
}
function startHtml() {
  return '<h1>Подготовка к партии</h1><p class="lede">Выберите сценарий, соберите на стол колоды и жетоны и откройте нужное место в правилах.</p><div class="home-grid">' +
    '<a href="#party"><h2>Партия</h2><p>Сценарий, что включено и что выложить.</p></a>' +
    '<a href="#memo"><h2>Памятка</h2><p>Механика и то, чем режим от неё отличается.</p></a>' +
    '<a href="#places"><h2>Локации</h2><p>Поле карты: тип, эффект, страница книги.</p></a></div>' +
    '<p class="kicker">Неофициальная подготовка. Русский свод — из <a href="https://github.com/Heegu-sama/Homm3BG">Heegu-sama/Homm3BG</a>. <a href="#sources">Источники и лицензия</a>.</p>';
}
function sourcesHtml() {
  return '<h1>Источники</h1><section class="card"><p>Страницы готовят партию в настольной игре «Герои Меча и Магии III» издательства Archon Studio. Это не официальное издание Archon и не издание Ubisoft.</p>' +
    "<h2>Русский свод правил</h2><p>Файл <a href=\"../Heroes3_Russian_Rules_Rewrite_2_0_1.pdf\">Heroes3_Russian_Rules_Rewrite_2_0_1.pdf</a> — русский свод 2.0.1 от 19 сентября 2026. Он взят без правок из репозитория <a href=\"https://github.com/Heegu-sama/Homm3BG\">Heegu-sama/Homm3BG</a>.</p>" +
    "<p>Памятка на этих страницах — сокращение того же свода. Лицензия свода и этой переработки — <a href=\"https://creativecommons.org/licenses/by-nc-sa/4.0/deed.ru\">CC BY-NC-SA 4.0</a>.</p>" +
    "<h2>Официальные книги и картинки</h2><p>Книги миссий, гиды и схемы — материалы Archon Studio. «Герои Меча и Магии» — товарный знак Ubisoft Entertainment. На эти файлы лицензия свода не распространяется.</p>" +
    "<p>Рассказы миссий на страницах переведены с английских книг миссий. Это не перевод из репозитория свода.</p></section>";
}

function render() {
  const raw = (location.hash || "#style").slice(1);
  const bits = raw.split("/");
  const name = bits[0] || "style";
  arg = bits.slice(1).join("/") ? decodeURIComponent(bits.slice(1).join("/")) : "";
  if (name === "memo" && arg) memoTab = arg.charAt(0) === "d" ? "deck" : "mech";
  document.querySelectorAll(".rail button.nav").forEach(function (b) { b.classList.toggle("on", b.getAttribute("data-go") === name); });
  const views = { style: styleHtml, start: startHtml, party: partyHtml, memo: memoHtml, places: placesHtml, sources: sourcesHtml };
  STAGE.innerHTML = (views[name] || styleHtml)();
  if (arg && (name === "memo")) {
    const el = document.getElementById(arg);
    if (el) el.scrollIntoView({ block: "start" });
  }
  hideKit();
}
function hideKit() { KIT.hidden = true; }
function showKit(btn) {
  const p = D.picks.filter(function (x) { return x.id === btn.getAttribute("data-kit"); })[0];
  if (!p) return;
  const pages = (p.pages || []).map(function (n) {
    return '<a href="' + D.pdf + "#page=" + n + '" target="_blank" rel="noopener">стр. ' + n + "</a>";
  }).join(", ");
  KIT.innerHTML = "<h2>" + esc(p.name) + "</h2>" + (p.tokens ? "<p>" + esc(p.tokens) + "</p>" : "") +
    (p.cards ? "<p>" + esc(p.cards) + "</p>" : "") + (pages ? "<p>Свод: " + pages + "</p>" : "");
  KIT.hidden = false;
  const r = btn.getBoundingClientRect();
  const width = Math.min(416, window.innerWidth - 16);
  KIT.style.width = width + "px";
  let left = r.left;
  if (left + width > window.innerWidth - 8) left = window.innerWidth - width - 8;
  let top = r.bottom + 6;
  KIT.style.left = Math.max(8, left) + "px";
  KIT.style.top = top + "px";
  if (KIT.getBoundingClientRect().bottom > window.innerHeight - 8) KIT.style.top = Math.max(8, r.top - KIT.offsetHeight - 6) + "px";
}

document.body.addEventListener("click", function (ev) {
  const go = ev.target.closest("[data-go]");
  if (go) { location.hash = go.getAttribute("data-go"); return; }
  const mission = ev.target.closest("[data-mission]");
  if (mission) { location.hash = "party/" + mission.getAttribute("data-mission"); return; }
  const pick = ev.target.closest("[data-pick]");
  if (pick) { togglePick(pick.getAttribute("data-pick")); render(); return; }
  const box = ev.target.closest("[data-box]");
  if (box) { setOwned(box.getAttribute("data-box"), box.getAttribute("aria-pressed") !== "true"); render(); return; }
  const tab = ev.target.closest("[data-tab]");
  if (tab) { memoTab = tab.getAttribute("data-tab"); render(); return; }
  const chapter = ev.target.closest("[data-chapter]");
  if (chapter) { placeChapter = chapter.getAttribute("data-chapter"); render(); return; }
  const sw = ev.target.closest("[role='switch'][data-mod]");
  if (sw && !sw.disabled) {
    const id = load("homm3-mission", "");
    setMod(id, sw.getAttribute("data-mod"), sw.getAttribute("aria-checked") !== "true");
    render();
    return;
  }
  const kit = ev.target.closest("[data-kit]");
  if (kit) {
    if (!KIT.hidden && KIT.dataset.for === kit.getAttribute("data-kit")) { hideKit(); return; }
    KIT.dataset.for = kit.getAttribute("data-kit");
    showKit(kit);
    return;
  }
  if (!ev.target.closest("#kit")) hideKit();
});
document.body.addEventListener("change", function (ev) {
  const t = ev.target;
  if (t.getAttribute("data-filter")) {
    setFilters({ [t.getAttribute("data-filter")]: t.value });
    render();
    return;
  }
  if (t.getAttribute("data-sel")) {
    saveSel(t.getAttribute("data-sel"), t.value);
    render();
    return;
  }
  if (t.getAttribute("data-laid")) {
    const id = (location.hash.match(/^#party\/([^/]+)/) || [])[1] || load("homm3-mission", "");
    toggleLaid(decodeURIComponent(id), t.getAttribute("data-laid"));
  }
});
document.body.addEventListener("input", function (ev) {
  const t = ev.target;
  if (t.getAttribute("data-filter") === "q" || t.getAttribute("data-filter") === "memoQ" || t.getAttribute("data-filter") === "placeQ") {
    setFilters({ [t.getAttribute("data-filter")]: t.value });
    const pos = t.selectionStart;
    render();
    const again = STAGE.querySelector('[data-filter="' + t.getAttribute("data-filter") + '"]');
    if (again) { again.focus(); if (pos != null) again.setSelectionRange(pos, pos); }
  }
});
document.getElementById("theme").addEventListener("click", function () {
  const next = document.body.getAttribute("data-theme") === "dark" ? "light" : "dark";
  document.body.setAttribute("data-theme", next);
  this.textContent = next === "dark" ? "Светлая тема" : "Тёмная тема";
  try { localStorage.setItem("homm3-mechanics-theme", next); } catch (e) {}
});
document.getElementById("boxes-btn").addEventListener("click", function () {
  boxesOpen = !boxesOpen;
  if ((location.hash || "#style").indexOf("#party") !== 0) location.hash = "party";
  else render();
});
window.addEventListener("hashchange", render);
document.addEventListener("keydown", function (ev) { if (ev.key === "Escape") hideKit(); });

fetch("data.json").then(function (r) { return r.json(); }).then(function (data) {
  D = data;
  MECH = {};
  D.mechs.forEach(function (m) { MECH[m.name] = m; });
  DECK = {};
  D.decks.forEach(function (d) { DECK[d.id] = d; });
  MODE = {};
  D.modes.forEach(function (m) { MODE[m[0]] = m[1]; });
  BOX = {};
  D.boxes.forEach(function (b) { BOX[b[0]] = b[1]; });
  GLOSS = D.gloss.map(function (g) { return [new RegExp(g[0], "g"), g[1]]; });
  let theme = "dark";
  try { theme = localStorage.getItem("homm3-mechanics-theme") || "dark"; } catch (e) {}
  document.body.setAttribute("data-theme", theme === "light" ? "light" : "dark");
  document.getElementById("theme").textContent = theme === "light" ? "Тёмная тема" : "Светлая тема";
  if (!location.hash) location.hash = "style";
  render();
}).catch(function () {
  STAGE.innerHTML = "<p>Не удалось открыть data.json. Запустите start.ps1 и откройте http://127.0.0.1:8770/v3/</p>";
});
