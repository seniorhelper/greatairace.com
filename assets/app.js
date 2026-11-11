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

  /* ---------- alert forms (FormSubmit) ---------- */
  var loadedAt = Date.now(), human = false;
  ["keydown", "pointerdown"].forEach(function (ev) { document.addEventListener(ev, function () { human = true; }, { passive: true, capture: true }); });
  document.querySelectorAll("form[data-alert]").forEach(function (f) {
    f.addEventListener("submit", function (e) {
      e.preventDefault();
      var msg = f.querySelector(".form-msg"), email = f.querySelector("input[type=email]"), hp = f.querySelector("input[name=_honey]");
      var say = function (t) { msg.textContent = t; };
      if (hp && hp.value) { say("Thanks!"); return; }
      if (!human || Date.now() - loadedAt < 3000) { say("One moment, then try again."); return; }
      if (!email.value || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.value)) { say("Please enter a valid email."); email.focus(); return; }
      var to = ["info", "eyetoad.com"].join("@");
      var action = "https://formsubmit.co/ajax/" + to;
      var btn = f.querySelector("button[type=submit]"); btn.disabled = true; say("Sending…");
      fetch(action, {
        method: "POST", headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({ email: email.value, _subject: "Great AI Race alert signup", _template: "table", _captcha: "false", source: location.pathname })
      }).then(function (r) { return r.ok ? r.json() : Promise.reject(); })
        .then(function () { say("You're on the list. We'll ping you when the lead changes."); f.reset(); })
        .catch(function () { say("Something went wrong. Please try again in a minute."); })
        .then(function () { btn.disabled = false; });
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

  /* --- track drawing: an original winding circuit (hairpins, over/under crossing, climb + drop, tunnel, splash zone) ---
     Racer position = arc-length fraction p (0 = AGI line, 1 = one full lap) along ONE closed centre-line, so
     score -> distance still maps 1:1. Waypoints are in a 1000x640 design space; portrait phones rotate it 90deg. */
  var svg = document.getElementById("track-svg"), NS = "http://www.w3.org/2000/svg";
  var LANEW = 22, TW = 72, PORT = false, FS = 17, VW = 1000, VH = 640;
  var WP = [[470,95],[640,80],[820,85],[925,140],[940,225],[870,285],[740,300],[600,345],[470,285],[330,335],[200,300],
    [100,320],[60,420],[110,515],[240,565],[390,545],[520,585],[650,550],[790,575],[910,540],[935,460],[890,420],[775,345],
    [650,240],[520,175],[380,215],[250,170],[170,115],[260,60],[370,85]];
  var ZONE = { tunnel: [11.3, 12.9], splash: [15.2, 17.3], elev: [20.6, 24.8], climb: [20.7, 22.0], drop: [23.2, 24.7] };
  var PATH = null;
  function T(x, y) { return PORT ? { x: (640 - y) * .86 + 25, y: x * .86 } : { x: x, y: y }; }
  function buildPath() {
    var n = WP.length, P = WP.map(function (w) { return T(w[0], w[1]); }), pts = [], S = 24, i, k;
    function cr(a, b, c, d, t) { return .5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t); }
    for (i = 0; i < n; i++) {
      var p0 = P[(i + n - 1) % n], p1 = P[i], p2 = P[(i + 1) % n], p3 = P[(i + 2) % n];
      for (k = 0; k < S; k++) { var t = k / S; pts.push({ x: cr(p0.x, p1.x, p2.x, p3.x, t), y: cr(p0.y, p1.y, p2.y, p3.y, t), u: i + t }); }
    }
    var s = 0; pts[0].s = 0;
    for (i = 1; i <= pts.length; i++) { var a = pts[i - 1], b = pts[i % pts.length]; s += Math.hypot(b.x - a.x, b.y - a.y); if (i < pts.length) pts[i].s = s; }
    PATH = { pts: pts, len: s };
  }
  function atP(p) { // arc fraction -> {x,y,a (tangent angle),u (waypoint index, fractional)}
    var pts = PATH.pts, N = pts.length, s = (((p % 1) + 1) % 1) * PATH.len, lo = 0, hi = N - 1;
    while (lo < hi) { var m = (lo + hi + 1) >> 1; if (pts[m].s <= s) lo = m; else hi = m - 1; }
    var A = pts[lo], B = pts[(lo + 1) % N], segL = (lo + 1 < N ? B.s : PATH.len) - A.s, f = segL ? (s - A.s) / segL : 0;
    var Bu = lo + 1 < N ? B.u : WP.length;
    return { x: A.x + (B.x - A.x) * f, y: A.y + (B.y - A.y) * f, a: Math.atan2(B.y - A.y, B.x - A.x), u: A.u + (Bu - A.u) * f };
  }
  function pt(p, lane) { var q = atP(p), off = (lane - 1.5) * LANEW; q.x += -Math.sin(q.a) * off; q.y += Math.cos(q.a) * off; return q; }
  function uToP(u) {
    var pts = PATH.pts, lo = 0, hi = pts.length - 1;
    while (lo < hi) { var m = (lo + hi + 1) >> 1; if (pts[m].u <= u) lo = m; else hi = m - 1; }
    var A = pts[lo], B = pts[lo + 1], f = B ? (u - A.u) / (B.u - A.u) : 0, s = B ? A.s + (B.s - A.s) * f : A.s;
    return s / PATH.len;
  }
  function inTunnel(u) { return u >= ZONE.tunnel[0] && u <= ZONE.tunnel[1]; }
  function seg(u0, u1) { return PATH.pts.filter(function (q) { return q.u >= u0 && q.u <= u1; }); }
  function dOf(a, close) { return a.map(function (q, i) { return (i ? "L" : "M") + q.x.toFixed(1) + " " + q.y.toFixed(1); }).join("") + (close ? "Z" : ""); }
  function geom() {
    PORT = svg.getBoundingClientRect().width < 640;
    VW = PORT ? 600 : 1000; VH = PORT ? 860 : 640; FS = PORT ? 24 : 17;
    svg.setAttribute("viewBox", "0 0 " + VW + " " + VH);
    buildPath();
  }
  function el(tag, attrs, parent) { var n = document.createElementNS(NS, tag); for (var k in attrs) n.setAttribute(k, attrs[k]); if (parent) parent.appendChild(n); return n; }
  function css(v) { return getComputedStyle(document.documentElement).getPropertyValue(v).trim(); }
  var tokens = {}, layer, LIGHT = false;
  function drawTrack() {
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    geom();
    var neon = css("--neon"), neon2 = css("--neon2"), light = document.documentElement.getAttribute("data-skin") === "light"; LIGHT = light;
    var road = light ? "#eef4fb" : "#030914", ink = light ? "#3b4b60" : "#a9c3d9", water = light ? "#0a9ad9" : "#3ad7ff", pink = "#ff3df2";
    var gl = light ? null : "url(#glow)", sc = PORT ? .86 : 1;
    var defs = el("defs", {}, svg);
    var pat = el("pattern", { id: "grid", width: 40, height: 40, patternUnits: "userSpaceOnUse" }, defs);
    el("path", { d: "M40 0H0V40", fill: "none", stroke: neon, "stroke-opacity": light ? .18 : .16, "stroke-width": 1 }, pat);
    var f = el("filter", { id: "glow", x: "-30%", y: "-30%", width: "160%", height: "160%" }, defs);
    el("feGaussianBlur", { stdDeviation: 4, result: "b" }, f);
    var m = el("feMerge", {}, f); el("feMergeNode", { in: "b" }, m); el("feMergeNode", { in: "SourceGraphic" }, m);
    var fb = el("filter", { id: "soft", x: "-20%", y: "-20%", width: "140%", height: "140%" }, defs); el("feGaussianBlur", { stdDeviation: 5 }, fb);
    el("rect", { width: VW, height: VH, fill: light ? "#f8fbff" : "#02050d" }, svg);
    el("rect", { width: VW, height: VH, fill: "url(#grid)" }, svg);
    // infield watermark
    var wm = T(370, 470), g = el("text", { x: wm.x, y: wm.y, "text-anchor": "middle", "font-family": "Orbitron, Inter, sans-serif", "font-weight": 900, "font-size": PORT ? 100 : 130,
      fill: neon, "fill-opacity": light ? .08 : .07, stroke: neon, "stroke-opacity": light ? .5 : .45, "stroke-width": 2, "letter-spacing": 8 }, svg);
    g.textContent = "AI";
    function roadTube(pts, close, shadow) { // soft glow, neon kerbs, dark surface, dashed centre line
      var d = dOf(pts, close), L = { fill: "none", "stroke-linejoin": "round", "stroke-linecap": "butt" };
      if (shadow) el("path", Object.assign({ d: d, stroke: "#000", "stroke-opacity": light ? .22 : .6, "stroke-width": TW + 6, transform: "translate(" + 5 * sc + "," + 9 * sc + ")", filter: "url(#soft)" }, L), svg);
      else if (!light) el("path", Object.assign({ d: d, stroke: neon, "stroke-opacity": .16, "stroke-width": TW + 16, filter: "url(#soft)" }, L), svg);
      el("path", Object.assign({ d: d, stroke: neon, "stroke-width": TW + 6, filter: gl }, L), svg);
      el("path", Object.assign({ d: d, stroke: road, "stroke-width": TW }, L), svg);
      el("path", Object.assign({ d: d, stroke: neon2, "stroke-opacity": .4, "stroke-width": 1.4, "stroke-dasharray": "10 12" }, L), svg);
    }
    roadTube(PATH.pts, true, false);                           // the whole circuit
    roadTube(seg(ZONE.elev[0], ZONE.elev[1]), false, true);    // climb -> bridge -> drop sit above the rest (draws over the crossing)
    function chev(z, col, rev) {
      var n = 5, p0 = uToP(z[0]), p1 = uToP(z[1]);
      for (var i = 0; i < n; i++) {
        var q = atP(p0 + (p1 - p0) * (i + .5) / n);
        el("path", { d: "M-7 -9L5 0L-7 9", fill: "none", stroke: col, "stroke-width": 4, "stroke-linecap": "round", "stroke-linejoin": "round", opacity: (.55 + .45 * (rev ? 1 - i / n : i / n)).toFixed(2),
          transform: "translate(" + q.x.toFixed(1) + "," + q.y.toFixed(1) + ") rotate(" + (q.a * 180 / Math.PI).toFixed(1) + ")", filter: gl }, svg);
      }
    }
    chev(ZONE.climb, neon2, false); chev(ZONE.drop, pink, true);
    // splash zone: water band, moving ripples, droplets
    var sd = dOf(seg(ZONE.splash[0], ZONE.splash[1]), false);
    el("path", { d: sd, fill: "none", stroke: water, "stroke-opacity": .38, "stroke-width": TW - 8 }, svg);
    el("path", { d: sd, fill: "none", stroke: water, "stroke-opacity": .9, "stroke-width": 3, "stroke-dasharray": "14 18", "class": "wave", filter: gl, transform: "translate(0,-14)" }, svg);
    el("path", { d: sd, fill: "none", stroke: "#fff", "stroke-opacity": .7, "stroke-width": 2, "stroke-dasharray": "6 22", "class": "wave w2", transform: "translate(0,12)" }, svg);
    var sp0 = uToP(ZONE.splash[0]), sp1 = uToP(ZONE.splash[1]);
    for (var i = 0; i < 9; i++) {
      var dq = pt(sp0 + (sp1 - sp0) * (i + .5) / 9, 1.5 + (i % 3 - 1) * 1.1);
      el("circle", { cx: dq.x.toFixed(1), cy: dq.y.toFixed(1), r: 4 + (i % 3), fill: "none", stroke: "#fff", "stroke-width": 2, "class": "drop", style: "animation-delay:" + (i * .25) + "s" }, svg);
    }
    // tunnel: roof + arched portals
    var tn = seg(ZONE.tunnel[0], ZONE.tunnel[1]);
    el("path", { d: dOf(tn, false), fill: "none", stroke: light ? "#c9d7e8" : "#010309", "stroke-opacity": .94, "stroke-width": TW + 14, "stroke-linecap": "butt" }, svg);
    el("path", { d: dOf(tn.filter(function (_, k) { return k % 2 === 0; }), false), fill: "none", stroke: neon, "stroke-opacity": .4, "stroke-width": 2, "stroke-dasharray": "2 10" }, svg);
    [ZONE.tunnel[0], ZONE.tunnel[1]].forEach(function (u, k) {
      var q = atP(uToP(u));
      el("path", { d: "M0 " + (-TW / 2 - 6) + " Q" + (k ? -22 : 22) + " 0 0 " + (TW / 2 + 6), fill: "none", stroke: neon, "stroke-width": 6, "stroke-linecap": "round", filter: gl,
        transform: "translate(" + q.x.toFixed(1) + "," + q.y.toFixed(1) + ") rotate(" + (q.a * 180 / Math.PI).toFixed(1) + ")" }, svg);
    });
    // zone labels
    function zl(txt, x, y, col) {
      var c = T(x, y), t = el("text", { x: c.x, y: c.y, "text-anchor": "middle", "font-family": "Orbitron, Inter, sans-serif", "font-weight": 800, "font-size": PORT ? 17 : 14, fill: col, "letter-spacing": 3, filter: gl }, svg);
      t.textContent = txt;
    }
    zl("TUNNEL", 172, 385, neon); zl("SPLASH ZONE", 520, 522, water); zl("CLIMB ▲", 812, 472, neon2); zl("DROP ▼", 420, 150, pink);
    // AGI finish line (checkered, across the road)
    var fq = atP(0), rows = 12, rh = (TW + 8) / rows;
    var gx = el("g", { transform: "translate(" + fq.x.toFixed(1) + "," + fq.y.toFixed(1) + ") rotate(" + (fq.a * 180 / Math.PI).toFixed(1) + ")" }, svg);
    for (var r = 0; r < rows; r++) for (var c = 0; c < 2; c++)
      el("rect", { x: c * 6 - 6, y: -(TW + 8) / 2 + r * rh, width: 6, height: rh, fill: (r + c) % 2 ? (light ? "#0d1526" : "#ffffff") : (light ? "#ffffff" : "#0d1526") }, gx);
    var ag = T(470, 38), agi = el("text", { x: ag.x, y: ag.y, "text-anchor": "middle", "font-family": "Orbitron, Inter, sans-serif", "font-weight": 900, "font-size": 30, fill: neon, filter: gl, "letter-spacing": 6 }, svg);
    agi.textContent = "AGI";
    layer = el("g", { id: "racers" }, svg);
    buildTokens();
  }
  function tokenFor(r, exhibition) {
    var g = el("g", { class: "racer", tabindex: 0, role: "button", "data-id": r.id, "aria-label": (exhibition ? "Exhibition: " : "") + r.short + " — open fact card" }, layer);
    var lum = function (h) { var n = parseInt(h.slice(1), 16); return .3 * (n >> 16) + .59 * ((n >> 8) & 255) + .11 * (n & 255); };
    var inner = el("g", { class: "inner" }, g);
    el("circle", { class: "ring", r: 21, fill: "#0d1526", stroke: lum(r.emblem.c1) > 90 ? r.emblem.c1 : r.emblem.c2, "stroke-width": 3 }, inner);
    var wrap = document.createElementNS(NS, "g");
    var tmp = new DOMParser().parseFromString(r.emblem.svg.replace(/cl-x/g, "cl-t-" + r.id).replace("<svg ", '<svg xmlns="' + NS + '" '), "image/svg+xml").documentElement;
    tmp.setAttribute("x", -17); tmp.setAttribute("y", -17); tmp.setAttribute("width", 34); tmp.setAttribute("height", 34);
    wrap.appendChild(document.importNode(tmp, true)); inner.appendChild(wrap);
    var lbl = el("text", { class: "lbl", "text-anchor": "middle", "font-family": "Inter, sans-serif", "font-weight": 800, "font-size": FS, fill: LIGHT ? "#0d1526" : "#ffffff", stroke: LIGHT ? "#ffffff" : "#02050d", "stroke-width": 4, "paint-order": "stroke" }, g);
    lbl.textContent = r.short;
    var rk = el("text", { class: "rk", "text-anchor": "middle", "font-family": "Orbitron, Inter, sans-serif", "font-weight": 900, "font-size": 13, fill: "#02050d" }, g);
    el("circle", { class: "rkbg", r: 10, fill: exhibition ? "#ff3df2" : css("--neon"), stroke: "#02050d", "stroke-width": 1.5 }, g).parentNode.insertBefore(g.lastChild, rk);
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
  function buildTokens() {
    var prev = tokens; tokens = {};
    race.racers.forEach(function (r) { tokens[r.id] = tokenFor(r, false); if (prev[r.id]) tokens[r.id].p = prev[r.id].p; });
    tokens[exh.id] = tokenFor(exh, true); tokens[exh.id].p = -0.035;
    assign(); place();
  }
  function assign() {
    standings().forEach(function (s, i) {
      var t = tokens[s.r.id];
      t.target = Math.max(0.02, Math.min(0.97, s.c / 100)); // composite as share of a lap toward AGI
      t.lane = i % 2 ? 0.4 : 2.6; // alternate sides so neighbours never share a side
      t.rank = i + 1;
    });
  }
  function place() {
    Object.keys(tokens).forEach(function (id) {
      var t = tokens[id], ex = id === exh.id;
      var q = pt(t.p, ex ? 1.5 : t.lane);
      t.g.setAttribute("transform", "translate(" + q.x.toFixed(1) + "," + q.y.toFixed(1) + ")");
      t.g.setAttribute("opacity", inTunnel(q.u) ? ".4" : "1"); // racers dim while inside the tunnel
      var sgn = ex ? -1 : (t.lane > 1.5 ? 1 : -1); // label sits on the same side of the road as its chip
      var nx = -Math.sin(q.a) * sgn, ny = Math.cos(q.a) * sgn, dl = 32;
      var lx = nx * dl, ly = ny * dl + FS * 0.35, anc = Math.abs(nx) < .35 ? "middle" : (nx > 0 ? "start" : "end");
      if (anc !== "middle") lx += nx > 0 ? -6 : 6;
      var w = String(t.lbl.textContent).length * FS * .62, ax = q.x + lx;
      if (anc === "end" && ax - w < 6) { anc = "start"; ax = q.x + 26; } else if (anc === "start" && ax + w > VW - 6) { anc = "end"; ax = q.x - 26; } // flip to the roomy side
      if (anc === "start") ax = Math.min(ax, VW - 6 - w); else if (anc === "end") ax = Math.max(ax, 6 + w); else ax = Math.max(6 + w / 2, Math.min(VW - 6 - w / 2, ax));
      lx = ax - q.x;
      t.lbl.setAttribute("text-anchor", anc);
      t.lbl.setAttribute("x", lx.toFixed(1)); t.lbl.setAttribute("y", ly.toFixed(1));
      t.rk.setAttribute("x", 16); t.rk.setAttribute("y", -11);
      t.rk.textContent = ex ? "X" : String(t.rank || "");
      var bg = t.g.querySelector(".rkbg"); bg.setAttribute("cx", 16); bg.setAttribute("cy", -15.5);
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
      // keep labels clear of the racer chips
      L.forEach(function (A) {
        Object.keys(tokens).forEach(function (id) {
          var t = tokens[id]; if (t === A.t) return;
          if (t.x + 22 < A.x0 || t.x - 22 > A.x1) return;
          var ly = A.y + A.dy - A.h * .35, d = ly - t.y;
          if (Math.abs(d) < 22 + A.h * .5) { A.dy += (d >= 0 ? 1 : -1) * 2; moved = true; }
        });
      });
      if (!moved) break;
    }
    L.forEach(function (A) {
      A.t.lbl.setAttribute("y", (A.t.ly0 + A.dy).toFixed(1));
      var ln = A.t.g.querySelector(".lead");
      if (!ln) { ln = document.createElementNS(NS, "line"); ln.setAttribute("class", "lead"); ln.setAttribute("stroke", LIGHT ? "#0d1526" : "#ffffff"); ln.setAttribute("stroke-opacity", ".45"); ln.setAttribute("stroke-width", "1"); A.t.g.insertBefore(ln, A.t.g.firstChild); }
      if (Math.abs(A.dy) > 6) {
        var lx = +A.t.lbl.getAttribute("x"), anc = A.t.lbl.getAttribute("text-anchor");
        ln.setAttribute("x1", 0); ln.setAttribute("y1", 0); ln.setAttribute("x2", lx); ln.setAttribute("y2", (A.t.ly0 + A.dy - FS * .35).toFixed(1));
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
    if (reduce) { ids.forEach(function (id) { tokens[id].p = tokens[id].target; }); place(); return; }
    var t0 = null, dur = fromStart ? 3200 : 900;
    function step(ts) {
      if (!t0) t0 = ts;
      var k = Math.min(1, (ts - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      ids.forEach(function (id, i) {
        var kk = fromStart ? Math.min(1, Math.max(0, (ts - t0 - i * 40) / dur)) : k;
        var ee = 1 - Math.pow(1 - kk, 3);
        tokens[id].p = from[id] + (tokens[id].target - from[id]) * (fromStart ? ee : e);
      });
      place();
      if (k < 1 || fromStart && ts - t0 < dur + ids.length * 40) anim = requestAnimationFrame(step); else { anim = null; svg.setAttribute("data-done", "1"); }
    }
    svg.removeAttribute("data-done");
    anim = requestAnimationFrame(step);
  }
  window.__garRedraw = function () { if (svg) { drawTrack(); place(); } };
  var lastPort = null; window.addEventListener("resize", function () { var p = svg.getBoundingClientRect().width < 640; if (p !== lastPort) { lastPort = p; window.__garRedraw(); } });
  drawTrack();

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
    new IntersectionObserver(function (en, ob) { if (!started && en[0].isIntersecting) { started = true; run(true); ob.disconnect(); } }, { threshold: .25 }).observe(svg);
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
