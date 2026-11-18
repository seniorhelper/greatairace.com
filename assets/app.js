/* Great AI Race — flat mode */
(function () {
  "use strict";
  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  };
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- nav + skins ---------- */
  var mb = document.querySelector(".menu-btn"), nav = document.getElementById("site-nav");
  if (mb && nav) {
    mb.addEventListener("click", function () {
      var open = mb.getAttribute("aria-expanded") === "true";
      mb.setAttribute("aria-expanded", String(!open));
      nav.classList.toggle("open", !open);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && nav.classList.contains("open")) { mb.setAttribute("aria-expanded", "false"); nav.classList.remove("open"); mb.focus(); }
    });
  }
  function setSkin(s) {
    document.documentElement.setAttribute("data-skin", s);
    store.set("gar-skin", s);
    document.querySelectorAll("[data-skin-btn]").forEach(function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-skin-btn") === s)); });
    if (window.__garRedraw) window.__garRedraw();
  }
  document.querySelectorAll("[data-skin-btn]").forEach(function (b) {
    b.addEventListener("click", function () { setSkin(b.getAttribute("data-skin-btn")); });
  });
  setSkin(document.documentElement.getAttribute("data-skin") || "tron");

  /* ---------- forms: validate here, then /lead-send.js posts to the lead server ---------- */
  var loadedAt = Date.now(), human = false;
  ["keydown", "pointerdown", "touchstart"].forEach(function (ev) { document.addEventListener(ev, function () { human = true; }, { passive: true, capture: true }); });
  document.querySelectorAll("form[data-lead]").forEach(function (f) {
    f.addEventListener("submit", function (e) {
      var msg = f.querySelector(".form-msg"), email = f.querySelector("input[type=email]");
      var say = function (t) { if (msg) msg.textContent = t; };
      if (!human || Date.now() - loadedAt < 2500) { e.preventDefault(); say("One moment, then try again."); return; }
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.value)) { e.preventDefault(); say("Please enter a valid email."); if (email) email.focus(); return; }
      var req = f.querySelectorAll("[required]");
      for (var i = 0; i < req.length; i++) if (!String(req[i].value).trim()) { e.preventDefault(); say("Please fill in every field."); req[i].focus(); return; }
      say("Sending…");
    });
  });

  /* ---------- race page ---------- */
  var dataEl = document.getElementById("race-data");
  if (!dataEl) return;
  var race = JSON.parse(dataEl.textContent);
  var LANES = race.meta.lanes.map(function (l) { return l.key; });
  var LABEL = {}; race.meta.lanes.forEach(function (l) { LABEL[l.key] = l.label; });
  var weights = Object.assign({}, race.meta.default_weights);
  try { var sw = JSON.parse(store.get("gar-weights") || "null"); if (sw) LANES.forEach(function (k) { if (typeof sw[k] === "number") weights[k] = sw[k]; }); } catch (e) {}
  var byId = {}; race.racers.forEach(function (r) { byId[r.id] = r; });
  var exh = race.exhibition[0]; byId[exh.id] = exh;

  function composite(r) {
    var t = 0, s = 0;
    LANES.forEach(function (k) { t += weights[k]; s += r.scoring.lanes[k] * weights[k]; });
    return t ? s / t : 0;
  }
  function standings() {
    return race.racers.map(function (r) { return { r: r, c: composite(r) }; }).sort(function (a, b) { return b.c - a.c; });
  }

  /* --- track: a tall winding neon circuit that runs down the page in switchback rows (hairpins, a tunnel,
     a splash zone) and returns up a raised skyway that crosses over every row to the AGI line.
     Racer position = arc-length fraction p along ONE closed centre-line (0 = AGI line, 1 = a full lap),
     so composite score -> distance maps 1:1. The road is drawn once on #track-svg; racers move on #racer-svg. --- */
  var svg = document.getElementById("track-svg"), rsvg = document.getElementById("racer-svg"), NS = "http://www.w3.org/2000/svg";
  var LANEW = 22, TW = 72, PORT = false, FS = 18, CR = 22, VW = 1000, VH = 1600;
  var ZONE = {}, PATH = null, LABELS = {};
  function buildPath() {
    var pts = [], mk = {};
    var W = VW, H = VH, rows = PORT ? 10 : 8, m = PORT ? 18 : 26;
    var yTop = PORT ? 92 : 86, y1 = PORT ? 250 : 228, yN = H - (PORT ? 250 : 210), yB = H - (PORT ? 86 : 70);
    var s = (yN - y1) / (rows - 1), r = s / 2, xL = m + TW / 2 + r, xR = W - m - TW / 2 - r, cx = W / 2;
    var rT = Math.min(70, (y1 - yTop) / 2), rb = Math.min(70, (yB - yN) / 2);
    function add(x, y) { var L = pts[pts.length - 1]; if (!L || Math.hypot(L.x - x, L.y - y) > 0.5) pts.push({ x: x, y: y }); }
    function line(x0, y0, x1, y1_, n) { for (var i = 0; i <= n; i++) add(x0 + (x1 - x0) * i / n, y0 + (y1_ - y0) * i / n); }
    function arc(ax, ay, rr, a0, a1, n) { for (var i = 0; i <= n; i++) { var a = a0 + (a1 - a0) * i / n; add(ax + rr * Math.cos(a), ay + rr * Math.sin(a)); } }
    function mark(k) { mk[k] = pts.length - 1; }
    var HP = Math.PI / 2;
    // top straight (AGI line at its start) -> first hairpin down
    var rt1 = (y1 - yTop) / 2;
    line(cx, yTop, xR, yTop, 30); arc(xR, yTop + rt1, rt1, -HP, HP, 26);
    // switchback rows
    for (var i = 0; i < rows; i++) {
      var y = y1 + i * s, left = i % 2 === 0;
      mark("row" + i);
      if (left) line(xR, y, xL, y, 60); else line(xL, y, xR, y, 60);
      mark("row" + i + "e");
      if (i < rows - 1) { if (left) arc(xL, y + r, r, -HP, -3 * HP, 28); else arc(xR, y + r, r, -HP, HP, 28); }
    }
    // rows end on the right (even row count) -> hairpin down to the bottom straight
    var rbt = (yB - yN) / 2;
    arc(xR, yN + rbt, rbt, -HP, HP, 24);
    mark("bottom"); line(xR, yB, cx + rb, yB, 30); arc(cx + rb, yB - rb, rb, HP, Math.PI, 16);
    // the skyway: a gentle S that rises over every row, back to the top straight
    mark("sky0");
    var y0s = yB - rb, y1s = yTop + rT, A = PORT ? 70 : 120, n = 160;
    for (i = 1; i <= n; i++) { var t = i / n, e = Math.sin(Math.PI * t); add(cx - A * Math.sin(2 * Math.PI * t) * e * e, y0s + (y1s - y0s) * t); }
    mark("sky1");
    arc(cx + rT, yTop + rT, rT, Math.PI, 3 * HP, 16);
    var tot = 0; pts[0].s = 0;
    for (i = 1; i <= pts.length; i++) { var a = pts[i - 1], b = pts[i % pts.length]; tot += Math.hypot(b.x - a.x, b.y - a.y); if (i < pts.length) pts[i].s = tot; }
    PATH = { pts: pts, len: tot, sky: pts.slice(mk.sky0, mk.sky1 + 1) };
    var f = function (k) { return pts[mk[k]].s / tot; }, lerp = function (a, b, t) { return a + (b - a) * t; };
    var tr = PORT ? 3 : 2, sr = PORT ? 6 : 5;
    ZONE = {
      tunnel: [lerp(f("row" + tr), f("row" + tr + "e"), .06), lerp(f("row" + tr), f("row" + tr + "e"), .3)],
      splash: [lerp(f("row" + sr), f("row" + sr + "e"), .68), lerp(f("row" + sr), f("row" + sr + "e"), .95)],
      elev: [f("sky0") - .004, f("sky1") + .004],
      climb: [f("sky0"), lerp(f("sky0"), f("sky1"), .12)],
      drop: [lerp(f("sky0"), f("sky1"), .88), f("sky1")]
    };
  }
  function atP(p) { // arc fraction -> {x, y, a (tangent angle)}
    var pts = PATH.pts, N = pts.length, s = (((p % 1) + 1) % 1) * PATH.len, lo = 0, hi = N - 1;
    while (lo < hi) { var m = (lo + hi + 1) >> 1; if (pts[m].s <= s) lo = m; else hi = m - 1; }
    var A = pts[lo], B = pts[(lo + 1) % N], segL = (lo + 1 < N ? B.s : PATH.len) - A.s, f = segL ? (s - A.s) / segL : 0;
    return { x: A.x + (B.x - A.x) * f, y: A.y + (B.y - A.y) * f, a: Math.atan2(B.y - A.y, B.x - A.x), p: p };
  }
  function pt(p, lane) { var q = atP(p), off = (lane - 1.5) * LANEW; q.x += -Math.sin(q.a) * off; q.y += Math.cos(q.a) * off; return q; }
  function underSky(q, p) { // a racer on a row that passes beneath the raised skyway
    if (inZone(p, ZONE.elev)) return false;
    var S = PATH.sky, lim = TW / 2 + 4;
    for (var i = 0; i < S.length; i += 2) if (Math.abs(S[i].y - q.y) < lim && Math.abs(S[i].x - q.x) < lim) return true;
    return false;
  }
  function inZone(p, z) { p = ((p % 1) + 1) % 1; return p >= z[0] && p <= z[1]; }
  function seg(p0, p1) { var L = PATH.len; return PATH.pts.filter(function (q) { return q.s >= p0 * L && q.s <= p1 * L; }); }
  function dOf(a, close) { return a.map(function (q, i) { return (i ? "L" : "M") + q.x.toFixed(1) + " " + q.y.toFixed(1); }).join("") + (close ? "Z" : ""); }
  function geom() {
    PORT = svg.getBoundingClientRect().width < 760;
    VW = PORT ? 600 : 1000; VH = PORT ? 2000 : 1600; FS = PORT ? 25 : 18; CR = PORT ? 27 : 22; TW = PORT ? 64 : 72; LANEW = PORT ? 19 : 22;
    svg.setAttribute("viewBox", "0 0 " + VW + " " + VH); rsvg.setAttribute("viewBox", "0 0 " + VW + " " + VH);
    buildPath();
  }
  function el(tag, attrs, parent) { var n = document.createElementNS(NS, tag); for (var k in attrs) n.setAttribute(k, attrs[k]); if (parent) parent.appendChild(n); return n; }
  function css(v) { return getComputedStyle(document.documentElement).getPropertyValue(v).trim(); }
  var tokens = {}, layer, LIGHT = false;
  function drawTrack() {
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    while (rsvg.firstChild) rsvg.removeChild(rsvg.firstChild);
    geom();
    var neon = css("--neon"), neon2 = css("--neon2"), light = document.documentElement.getAttribute("data-skin") === "light"; LIGHT = light;
    var road = light ? "#eef4fb" : "#030914", water = light ? "#0a9ad9" : "#3ad7ff", pink = "#ff3df2", tick = light ? "#3b4b60" : "#a9c3d9";
    var gl = light ? null : "url(#glow)";
    var defs = el("defs", {}, svg);
    var pat = el("pattern", { id: "grid", width: 40, height: 40, patternUnits: "userSpaceOnUse" }, defs);
    el("path", { d: "M40 0H0V40", fill: "none", stroke: neon, "stroke-opacity": light ? .18 : .14, "stroke-width": 1 }, pat);
    var f = el("filter", { id: "glow", x: "-30%", y: "-30%", width: "160%", height: "160%" }, defs);
    el("feGaussianBlur", { stdDeviation: 4, result: "b" }, f);
    var m = el("feMerge", {}, f); el("feMergeNode", { in: "b" }, m); el("feMergeNode", { in: "SourceGraphic" }, m);
    var fb = el("filter", { id: "soft", x: "-20%", y: "-20%", width: "140%", height: "140%" }, defs); el("feGaussianBlur", { stdDeviation: 6 }, fb);
    el("rect", { width: VW, height: VH, fill: light ? "#f8fbff" : "#02050d" }, svg);
    el("rect", { width: VW, height: VH, fill: "url(#grid)" }, svg);
    function roadTube(pts, close, raised) { // glow, neon kerbs, dark surface, dashed centre line
      var d = dOf(pts, close), L = { fill: "none", "stroke-linejoin": "round", "stroke-linecap": "butt" };
      if (raised) el("path", Object.assign({ d: d, stroke: "#000", "stroke-opacity": light ? .25 : .7, "stroke-width": TW + 10, transform: "translate(8,14)", filter: "url(#soft)" }, L), svg);
      else if (!light) el("path", Object.assign({ d: d, stroke: neon, "stroke-opacity": .14, "stroke-width": TW + 18, filter: "url(#soft)" }, L), svg);
      el("path", Object.assign({ d: d, stroke: raised ? pink : neon, "stroke-width": TW + 6, filter: gl }, L), svg);
      el("path", Object.assign({ d: d, stroke: road, "stroke-width": TW }, L), svg);
      el("path", Object.assign({ d: d, stroke: raised ? pink : neon2, "stroke-opacity": .45, "stroke-width": 1.6, "stroke-dasharray": "12 14" }, L), svg);
    }
    roadTube(PATH.pts, true, false);                        // the whole circuit
    function chev(z, col, rev) {
      var n = 6;
      for (var i = 0; i < n; i++) {
        var q = atP(z[0] + (z[1] - z[0]) * (i + .5) / n);
        el("path", { d: "M-8 -10L6 0L-8 10", fill: "none", stroke: col, "stroke-width": 4.5, "stroke-linecap": "round", "stroke-linejoin": "round", opacity: (.55 + .45 * (rev ? 1 - i / n : i / n)).toFixed(2),
          transform: "translate(" + q.x.toFixed(1) + "," + q.y.toFixed(1) + ") rotate(" + (q.a * 180 / Math.PI).toFixed(1) + ")", filter: gl }, svg);
      }
    }
    // splash zone: water band, moving ripples, droplets
    var sd = dOf(seg(ZONE.splash[0], ZONE.splash[1]), false);
    el("path", { d: sd, fill: "none", stroke: water, "stroke-opacity": .38, "stroke-width": TW - 8 }, svg);
    el("path", { d: sd, fill: "none", stroke: water, "stroke-opacity": .9, "stroke-width": 3, "stroke-dasharray": "14 18", "class": "wave", filter: gl, transform: "translate(0,-14)" }, svg);
    el("path", { d: sd, fill: "none", stroke: "#fff", "stroke-opacity": .7, "stroke-width": 2, "stroke-dasharray": "6 22", "class": "wave w2", transform: "translate(0,12)" }, svg);
    for (var i = 0; i < 9; i++) {
      var dq = pt(ZONE.splash[0] + (ZONE.splash[1] - ZONE.splash[0]) * (i + .5) / 9, 1.5 + (i % 3 - 1) * 1.1);
      el("circle", { cx: dq.x.toFixed(1), cy: dq.y.toFixed(1), r: 4 + (i % 3), fill: "none", stroke: "#fff", "stroke-width": 2, "class": "drop", style: "animation-delay:" + (i * .25) + "s" }, svg);
    }
    // tunnel: roof + arched portals
    var tn = seg(ZONE.tunnel[0], ZONE.tunnel[1]);
    el("path", { d: dOf(tn, false), fill: "none", stroke: light ? "#c9d7e8" : "#010309", "stroke-opacity": .94, "stroke-width": TW + 14, "stroke-linecap": "butt" }, svg);
    el("path", { d: dOf(tn.filter(function (_, k) { return k % 2 === 0; }), false), fill: "none", stroke: neon, "stroke-opacity": .4, "stroke-width": 2, "stroke-dasharray": "2 10" }, svg);
    [ZONE.tunnel[0], ZONE.tunnel[1]].forEach(function (p, k) {
      var q = atP(p);
      el("path", { d: "M0 " + (-TW / 2 - 6) + " Q" + (k ? -22 : 22) + " 0 0 " + (TW / 2 + 6), fill: "none", stroke: neon, "stroke-width": 6, "stroke-linecap": "round", filter: gl,
        transform: "translate(" + q.x.toFixed(1) + "," + q.y.toFixed(1) + ") rotate(" + (q.a * 180 / Math.PI).toFixed(1) + ")" }, svg);
    });
    roadTube(seg(ZONE.elev[0], ZONE.elev[1]), false, true); // the skyway sits above every row it crosses
    chev(ZONE.climb, neon2, false); chev(ZONE.drop, pink, true);
    // score ticks: composite 10..90 marked along the outer kerb so the track reads as a gauge
    for (var c = 10; c <= 90; c += 10) {
      var tq = pt(c / 100, 1.5 + (TW / 2 + 14) / LANEW), tq2 = pt(c / 100, 1.5 + (TW / 2 - 2) / LANEW), tq3 = pt(c / 100, 1.5 + (TW / 2 + 4) / LANEW);
      el("line", { x1: tq2.x.toFixed(1), y1: tq2.y.toFixed(1), x2: tq3.x.toFixed(1), y2: tq3.y.toFixed(1), stroke: tick, "stroke-width": 3 }, svg);
      var tt = el("text", { x: Math.max(16, Math.min(VW - 16, tq.x)).toFixed(1), y: (tq.y + 5).toFixed(1), "text-anchor": "middle", "font-family": "Orbitron, Inter, sans-serif", "font-weight": 800, "font-size": PORT ? 18 : 13, fill: tick }, svg);
      tt.textContent = c;
    }
    // zone labels sit just off the road beside each feature
    function zl(txt, p, side, col) {
      var q = pt(p, 1.5 + side * (TW / 2 + (PORT ? 30 : 24)) / LANEW);
      var t = el("text", { x: Math.max(70, Math.min(VW - 70, q.x)).toFixed(1), y: (q.y + 6).toFixed(1), "text-anchor": "middle", "font-family": "Orbitron, Inter, sans-serif", "font-weight": 800, "font-size": PORT ? 19 : 15, fill: col, "letter-spacing": 3, filter: gl }, svg);
      t.textContent = txt;
    }
    zl("TUNNEL", (ZONE.tunnel[0] + ZONE.tunnel[1]) / 2, -1, neon);
    zl("SPLASH ZONE", (ZONE.splash[0] + ZONE.splash[1]) / 2, -1, water);
    zl("SKYWAY ▲", ZONE.climb[0] + .004, -1, neon2);
    zl("DROP ▼", ZONE.drop[0] - .004, 1, pink);
    // AGI finish line (checkered, across the road) + start banner
    var fq = atP(0), rws = 12, rh = (TW + 8) / rws;
    var gx = el("g", { transform: "translate(" + fq.x.toFixed(1) + "," + fq.y.toFixed(1) + ") rotate(" + (fq.a * 180 / Math.PI).toFixed(1) + ")" }, svg);
    for (var r = 0; r < rws; r++) for (var cc = 0; cc < 2; cc++)
      el("rect", { x: cc * 7 - 7, y: -(TW + 8) / 2 + r * rh, width: 7, height: rh, fill: (r + cc) % 2 ? (light ? "#0d1526" : "#ffffff") : (light ? "#ffffff" : "#0d1526") }, gx);
    var agi = el("text", { x: fq.x - (PORT ? 22 : 26), y: fq.y - TW / 2 - (PORT ? 16 : 12), "text-anchor": "end", "font-family": "Orbitron, Inter, sans-serif", "font-weight": 900, "font-size": PORT ? 34 : 32, fill: neon, filter: gl, "letter-spacing": 6 }, svg);
    agi.textContent = "AGI";
    layer = el("g", { id: "racers" }, rsvg);
    buildTokens();
  }
  function tokenFor(r, exhibition) {
    var g = el("g", { class: "racer", tabindex: 0, role: "button", "data-id": r.id, "aria-label": (exhibition ? "Exhibition: " : "") + r.short + " — open fact card" }, layer);
    var lum = function (h) { var n = parseInt(h.slice(1), 16); return .3 * (n >> 16) + .59 * ((n >> 8) & 255) + .11 * (n & 255); };
    var inner = el("g", { class: "inner" }, g);
    el("circle", { class: "hit", r: CR + 12, fill: "transparent" }, inner); // larger tap target
    el("circle", { class: "ring", r: CR, fill: "#0d1526", stroke: lum(r.emblem.c1) > 90 ? r.emblem.c1 : r.emblem.c2, "stroke-width": 3 }, inner);
    var wrap = document.createElementNS(NS, "g");
    var tmp = new DOMParser().parseFromString(r.emblem.svg.replace(/cl-x/g, "cl-t-" + r.id).replace("<svg ", '<svg xmlns="' + NS + '" '), "image/svg+xml").documentElement;
    var es = CR * 1.6; tmp.setAttribute("x", -es / 2); tmp.setAttribute("y", -es / 2); tmp.setAttribute("width", es); tmp.setAttribute("height", es);
    wrap.appendChild(document.importNode(tmp, true)); inner.appendChild(wrap);
    var lbl = el("text", { class: "lbl", "text-anchor": "middle", "font-family": "Inter, sans-serif", "font-weight": 800, "font-size": FS, fill: LIGHT ? "#0d1526" : "#ffffff", stroke: LIGHT ? "#ffffff" : "#02050d", "stroke-width": 5, "paint-order": "stroke" }, g);
    lbl.textContent = exhibition ? r.short + " · exhibition" : r.short;
    el("circle", { class: "rkbg", r: PORT ? 13 : 11, fill: exhibition ? "#ff3df2" : css("--neon"), stroke: "#02050d", "stroke-width": 1.5 }, g);
    var rk = el("text", { class: "rk", "text-anchor": "middle", "font-family": "Orbitron, Inter, sans-serif", "font-weight": 900, "font-size": PORT ? 16 : 13, fill: "#02050d" }, g);
    var go = function () { if (exhibition) wiggle(g, function () { openCard(r.id); }); else openCard(r.id); };
    g.addEventListener("click", go);
    g.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } });
    return { g: g, lbl: lbl, rk: rk, p: tokens[r.id] ? tokens[r.id].p : 0, lane: 0, target: 0 };
  }
  // delight: Big AI Brain wiggles and glows when clicked, then its fact card opens
  function wiggle(g, then) {
    g.classList.remove("wiggle", "glow"); void g.getBoundingClientRect();
    g.classList.add("glow");
    if (reduce) { setTimeout(function () { g.classList.remove("glow"); }, 900); then(); return; } // no motion: static glow only
    g.classList.add("wiggle");
    setTimeout(function () { g.classList.remove("wiggle"); then(); }, 750);
    setTimeout(function () { g.classList.remove("glow"); }, 1600);
  }
  var EXP = 0.012; // Big AI Brain: just off the start line, dead last
  function buildTokens() {
    var prev = tokens; tokens = {};
    race.racers.forEach(function (r) { tokens[r.id] = tokenFor(r, false); if (prev[r.id]) tokens[r.id].p = prev[r.id].p; });
    tokens[exh.id] = tokenFor(exh, true); tokens[exh.id].p = EXP;
    assign(); place();
  }
  function assign() {
    standings().forEach(function (s, i) {
      var t = tokens[s.r.id];
      t.target = Math.max(0.03, Math.min(0.97, s.c / 100)); // composite as share of a lap toward AGI
      t.lane = i % 2 ? 0.45 : 2.55; // alternate sides so neighbours never share a side
      t.rank = i + 1;
    });
  }
  function place() {
    Object.keys(tokens).forEach(function (id) {
      var t = tokens[id], ex = id === exh.id;
      var q = pt(t.p, ex ? 1.5 : t.lane);
      t.g.setAttribute("transform", "translate(" + q.x.toFixed(1) + "," + q.y.toFixed(1) + ")");
      var dim = inZone(t.p, ZONE.tunnel) || underSky(q, t.p) ? ".45" : "1"; // chips dim inside the tunnel and under the skyway; labels stay readable
      t.g.querySelector(".inner").setAttribute("opacity", dim);
      var sgn = ex ? -1 : (t.lane > 1.5 ? 1 : -1); // label sits on the same side of the road as its chip
      var nx = -Math.sin(q.a) * sgn, ny = Math.cos(q.a) * sgn, dl = CR + 14;
      var lx = nx * dl, ly = ny * dl + FS * 0.35, anc = Math.abs(nx) < .35 ? "middle" : (nx > 0 ? "start" : "end");
      if (anc !== "middle") lx += nx > 0 ? -6 : 6;
      var w = String(t.lbl.textContent).length * FS * .6, ax = q.x + lx;
      if (anc === "end" && ax - w < 6) { anc = "start"; ax = q.x + CR + 6; } else if (anc === "start" && ax + w > VW - 6) { anc = "end"; ax = q.x - CR - 6; }
      if (anc === "start") ax = Math.min(ax, VW - 6 - w); else if (anc === "end") ax = Math.max(ax, 6 + w); else ax = Math.max(6 + w / 2, Math.min(VW - 6 - w / 2, ax));
      lx = ax - q.x;
      t.lbl.setAttribute("text-anchor", anc);
      t.lbl.setAttribute("x", lx.toFixed(1)); t.lbl.setAttribute("y", ly.toFixed(1));
      var bx = CR * .78, by = -CR * .72;
      t.rk.setAttribute("x", bx); t.rk.setAttribute("y", by + (PORT ? 5.5 : 4.5));
      t.rk.textContent = ex ? "X" : String(t.rank || "");
      var bg = t.g.querySelector(".rkbg"); bg.setAttribute("cx", bx); bg.setAttribute("cy", by);
      t.x = q.x; t.y = q.y; t.ly0 = ly;
    });
    declutter();
  }
  // push overlapping labels apart vertically, then draw a short leader line when a label moved
  function declutter() {
    var L = Object.keys(tokens).map(function (id) {
      var t = tokens[id], bb; try { bb = t.lbl.getBBox(); } catch (e) { return null; }
      return { t: t, x0: t.x + bb.x, x1: t.x + bb.x + bb.width, y: t.y + t.ly0, h: bb.height + 2, dy: 0 };
    }).filter(Boolean);
    for (var pass = 0; pass < 30; pass++) {
      var moved = false;
      L.sort(function (a, b) { return (a.y + a.dy) - (b.y + b.dy); });
      for (var i = 0; i < L.length; i++) for (var j = i + 1; j < L.length; j++) {
        var A = L[i], B = L[j];
        if (A.x1 < B.x0 - 4 || B.x1 < A.x0 - 4) continue;
        var gap = (B.y + B.dy) - (A.y + A.dy);
        if (gap < A.h) { var push = (A.h - gap) / 2 + .5; A.dy -= push; B.dy += push; moved = true; }
      }
      L.forEach(function (A) {
        Object.keys(tokens).forEach(function (id) {
          var t = tokens[id]; if (t === A.t) return;
          if (t.x + CR < A.x0 || t.x - CR > A.x1) return;
          var ly = A.y + A.dy - A.h * .35, d = ly - t.y;
          if (Math.abs(d) < CR + A.h * .5) { A.dy += (d >= 0 ? 1 : -1) * 2; moved = true; }
        });
      });
      if (!moved) break;
    }
    L.forEach(function (A) {
      A.t.lbl.setAttribute("y", (A.t.ly0 + A.dy).toFixed(1));
      var ln = A.t.g.querySelector(".lead");
      if (!ln) { ln = document.createElementNS(NS, "line"); ln.setAttribute("class", "lead"); ln.setAttribute("stroke", LIGHT ? "#0d1526" : "#ffffff"); ln.setAttribute("stroke-opacity", ".5"); ln.setAttribute("stroke-width", "1.2"); A.t.g.insertBefore(ln, A.t.g.firstChild); }
      if (Math.abs(A.dy) > 6) {
        ln.setAttribute("x1", 0); ln.setAttribute("y1", 0); ln.setAttribute("x2", A.t.lbl.getAttribute("x")); ln.setAttribute("y2", (A.t.ly0 + A.dy - FS * .35).toFixed(1));
        ln.style.display = "";
      } else ln.style.display = "none";
    });
  }
  var anim = null;
  function run(fromStart) {
    if (anim) cancelAnimationFrame(anim);
    assign();
    var ids = race.racers.map(function (r) { return r.id; });
    var from = {}; ids.forEach(function (id) { from[id] = fromStart ? 0 : tokens[id].p; });
    if (reduce) { ids.forEach(function (id) { tokens[id].p = tokens[id].target; }); place(); svg.setAttribute("data-done", "1"); return; }
    var t0 = null, dur = fromStart ? 4200 : 1000, stagger = 70;
    function step(ts) {
      if (!t0) t0 = ts;
      ids.forEach(function (id, i) {
        var kk = Math.min(1, Math.max(0, (ts - t0 - (fromStart ? i * stagger : 0)) / dur));
        var ee = kk < .5 ? 4 * kk * kk * kk : 1 - Math.pow(-2 * kk + 2, 3) / 2; // ease in-out: rolls off the line, glides in
        tokens[id].p = from[id] + (tokens[id].target - from[id]) * ee;
      });
      place();
      if (ts - t0 < dur + (fromStart ? ids.length * stagger : 0)) anim = requestAnimationFrame(step); else { anim = null; svg.setAttribute("data-done", "1"); }
    }
    svg.removeAttribute("data-done");
    anim = requestAnimationFrame(step);
  }
  window.__garRedraw = function () { if (svg) { drawTrack(); place(); } };
  var lastPort = null;
  window.addEventListener("resize", function () { var p = svg.getBoundingClientRect().width < 760; if (p !== lastPort) { lastPort = p; window.__garRedraw(); } });
  drawTrack(); lastPort = PORT;

  /* --- key list re-rank --- */
  var keyList = document.getElementById("key-list");
  function renderKey() {
    var rows = {}; keyList.querySelectorAll(".key-row").forEach(function (li) { rows[li.getAttribute("data-id")] = li; });
    standings().forEach(function (s, i) {
      var li = rows[s.r.id]; li.querySelector(".key-rank").textContent = i + 1;
      li.querySelector(".key-comp b").textContent = s.c.toFixed(1);
      keyList.appendChild(li);
    });
    var lead = standings()[0];
    var d = document.getElementById("track-desc"); if (d) d.textContent = "Racers placed along a winding neon circuit by composite score. Current leader: " + lead.r.short + " at " + lead.c.toFixed(1) + ".";
  }
  /* --- sliders --- */
  var sliders = document.querySelectorAll("[data-weight]");
  function syncSliders() { sliders.forEach(function (s) { var k = s.getAttribute("data-weight"); s.value = weights[k]; s.nextElementSibling.textContent = weights[k]; }); }
  sliders.forEach(function (s) {
    s.addEventListener("input", function () {
      weights[s.getAttribute("data-weight")] = +s.value; s.nextElementSibling.textContent = s.value;
      store.set("gar-weights", JSON.stringify(weights)); renderKey(); run(false);
    });
  });
  var reset = document.getElementById("w-reset");
  if (reset) reset.addEventListener("click", function () { weights = Object.assign({}, race.meta.default_weights); store.set("gar-weights", JSON.stringify(weights)); syncSliders(); renderKey(); run(false); });
  syncSliders(); renderKey();

  /* --- watch / replay --- */
  document.querySelectorAll("[data-watch]").forEach(function (b) {
    b.addEventListener("click", function (e) {
      e.preventDefault();
      document.getElementById("track").scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
      run(true);
    });
  });
  // start once the track is on screen
  if ("IntersectionObserver" in window) {
    var started = false;
    new IntersectionObserver(function (en, ob) { if (!started && en[0].isIntersecting) { started = true; run(true); ob.disconnect(); } }, { threshold: 0, rootMargin: "0px 0px -12% 0px" }).observe(svg);
  } else run(true);

  /* --- fact card dialog --- */
  var dlg = document.getElementById("card"), body = dlg.querySelector(".dlg-body");
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  var MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  function fdate(d) { if (!d) return "undated"; var p = String(d).split("-"); if (p.length === 3) return MON[+p[1] - 1] + " " + (+p[2]) + ", " + p[0]; if (p.length === 2) return MON[+p[1] - 1] + " " + p[0]; return d; }
  function usd(v) { var u = v >= 1e12 ? ["T", 1e12] : v >= 1e9 ? ["B", 1e9] : ["M", 1e6]; var n = v / u[1]; return "$" + (n < 10 ? +n.toFixed(2) : n < 100 ? +n.toFixed(1) : Math.round(n)) + u[0]; }
  function fval(key, v) {
    if (v === null || v === undefined) return null;
    if (typeof v === "boolean") return v ? "Yes" : "No";
    if (typeof v === "object") { if (v.rank) return "#" + v.rank + " — " + v.model + (v.score ? " (" + v.score + ")" : ""); if (v.score !== undefined) return v.score + " — " + v.model; }
    if (typeof v === "number") { if (/_usd$/.test(key)) return usd(v); if (/_pct$/.test(key)) return v + "%"; }
    return String(v);
  }
  function host(u) { return u.replace(/^https?:\/\/(www\.)?/, "").split("/")[0]; }
  function fact(label, f, key) {
    f = f || {}; var v = fval(key, f.value);
    return '<div class="fact"><dt>' + esc(label) + '</dt><dd><p class="fv">' + (v === null ? '<span class="nd">Not disclosed</span>' : esc(v)) + '</p><p class="fs">' +
      (f.source ? '<a class="src" href="' + esc(f.source) + '" rel="nofollow noopener" target="_blank">Source: ' + esc(host(f.source)) + '</a> <span class="when">· ' + fdate(f.date) + "</span>" : '<span class="when">No source URL on file</span>') +
      "</p>" + (f.note && v === null ? '<p class="fn">' + esc(f.note) + "</p>" : "") + "</dd></div>";
  }
  var lastFocus = null;
  function openCard(id) {
    var r = byId[id]; lastFocus = document.activeElement;
    var tmp = r.emblem.svg.replace(/cl-x/g, "cl-d-" + id);
    var h = '<div class="dlg-head">' + tmp + '<div><p class="eyebrow dark" style="margin:0">' + (r.exhibition ? "Exhibition / Home-grown lane" : "Racer #" + (standings().findIndex(function (s) { return s.r.id === id; }) + 1) + " · your weights") +
      '</p><h2 id="card-name">' + esc(r.short) + '</h2></div><button type="button" class="btn btn-ghost dlg-x" aria-label="Close">✕</button></div>';
    if (r.exhibition) {
      h += '<dl class="facts">' +
        '<div class="fact"><dt>What it is</dt><dd><p class="fv">A from-scratch, crowd-fed AI with no outside LLM.</p><p class="fs"><a class="src" href="https://bigaibrain.com" rel="noopener" target="_blank">Source: bigaibrain.com</a> <span class="when">· ' + fdate(race.meta.as_of) + "</span></p></dd></div>" +
        '<div class="fact"><dt>Ranked?</dt><dd><p class="fv">No. Exhibition lane only, shown dead last.</p></dd></div></dl>' +
        '<div class="dlg-actions"><a class="btn btn-solid" style="background:var(--acc-ink);border-color:var(--acc-ink);color:#fff" href="https://bigaibrain.com" rel="noopener">Feed it to move it up</a><a class="btn btn-ghost" href="/racers/big-ai-brain/">Full fact card</a></div>';
    } else {
      var lb = '<div class="lbs big" style="margin:12px 0">' + LANES.map(function (k) {
        var s = r.scoring.lanes[k], d = r.scoring.detail[k].disclosed;
        return '<div class="lb"><span class="lb-l">' + LABEL[k] + '</span><span class="lb-t"><span class="lb-f lane-' + k + '" style="width:' + Math.round(s) + '%"></span></span><span class="lb-v">' + (d ? Math.round(s) : "ND") + "</span></div>";
      }).join("") + "</div>";
      h += '<p style="margin:.6em 0 0">Composite with your weights: <b>' + composite(r).toFixed(1) + "</b></p>" + lb + '<dl class="facts">' +
        fact("Valuation / market cap", r.money.valuation_usd, "valuation_usd") + fact("Annualized revenue", r.money.annualized_revenue_usd, "annualized_revenue_usd") +
        fact("Active users", r.reach.active_users, "active_users") + fact("Web traffic share", r.reach.similarweb_web_share_pct, "similarweb_web_share_pct") +
        fact("AA Intelligence Index v5", r.brains.aa_intelligence_index, "aa") + fact("Text Arena rank", r.brains.arena_text_rank, "arena") +
        fact("Compute", r.muscle.compute, "compute") + fact("Releases, last 6 months", r.momentum.major_releases_last_6mo, "rel") +
        fact("Latest open model", r.openness.latest_open_model, "lom") + "</dl>" +
        '<div class="dlg-actions"><a class="btn btn-solid" style="background:var(--acc-ink);border-color:var(--acc-ink);color:#fff" href="/racers/' + r.slug + '/">Full fact card &amp; notes</a></div>';
    }
    body.innerHTML = h;
    body.querySelector(".dlg-head .emblem").setAttribute("width", 56); body.querySelector(".dlg-head .emblem").setAttribute("height", 56);
    body.querySelector(".dlg-x").addEventListener("click", function () { dlg.close(); });
    if (dlg.showModal) dlg.showModal(); else dlg.setAttribute("open", "");
    body.querySelector(".dlg-x").focus();
  }
  dlg.addEventListener("click", function (e) { if (e.target === dlg) dlg.close(); });
  dlg.addEventListener("close", function () { if (lastFocus && lastFocus.focus) lastFocus.focus(); });
  document.querySelectorAll("[data-open]").forEach(function (b) { b.addEventListener("click", function () { openCard(b.getAttribute("data-open")); }); });
})();
