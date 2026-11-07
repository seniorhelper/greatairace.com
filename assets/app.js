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

  /* --- track drawing --- */
  var svg = document.getElementById("track-svg"), NS = "http://www.w3.org/2000/svg";
  var CX = 500, CY = 330, RX = 400, RY = 225, LANEW = 22, PORT = false, FS = 17;
  function geom() {
    PORT = svg.getBoundingClientRect().width < 640;
    if (PORT) { svg.setAttribute("viewBox", "0 0 600 860"); CX = 300; CY = 440; RX = 205; RY = 330; LANEW = 22; FS = 24; }
    else { svg.setAttribute("viewBox", "0 0 1000 640"); CX = 500; CY = 330; RX = 400; RY = 225; LANEW = 22; FS = 17; }
  }
  function el(tag, attrs, parent) { var n = document.createElementNS(NS, tag); for (var k in attrs) n.setAttribute(k, attrs[k]); if (parent) parent.appendChild(n); return n; }
  function css(v) { return getComputedStyle(document.documentElement).getPropertyValue(v).trim(); }
  function pt(p, lane) { // p: 0..1 progress clockwise from AGI line at top
    var a = -Math.PI / 2 + p * Math.PI * 2, off = (lane - 1.5) * LANEW;
    return { x: CX + (RX + off) * Math.cos(a), y: CY + (RY + off) * Math.sin(a), a: a };
  }
  var tokens = {}, layer, LIGHT = false;
  function drawTrack() {
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    geom(); var VW = PORT ? 600 : 1000, VH = PORT ? 860 : 640;
    var neon = css("--neon"), neon2 = css("--neon2"), light = document.documentElement.getAttribute("data-skin") === "light"; LIGHT = light;
    var defs = el("defs", {}, svg);
    var pat = el("pattern", { id: "grid", width: 40, height: 40, patternUnits: "userSpaceOnUse" }, defs);
    el("path", { d: "M40 0H0V40", fill: "none", stroke: neon, "stroke-opacity": light ? .18 : .16, "stroke-width": 1 }, pat);
    var f = el("filter", { id: "glow", x: "-30%", y: "-30%", width: "160%", height: "160%" }, defs);
    el("feGaussianBlur", { stdDeviation: 4, result: "b" }, f);
    var m = el("feMerge", {}, f); el("feMergeNode", { in: "b" }, m); el("feMergeNode", { in: "SourceGraphic" }, m);
    var rg = el("radialGradient", { id: "bank", cx: "50%", cy: "50%", r: "50%" }, defs);
    el("stop", { offset: "70%", "stop-color": neon, "stop-opacity": 0 }, rg);
    el("stop", { offset: "100%", "stop-color": neon, "stop-opacity": light ? .12 : .22 }, rg);
    el("rect", { width: VW, height: VH, fill: light ? "#f8fbff" : "#02050d" }, svg);
    el("rect", { width: VW, height: VH, fill: "url(#grid)" }, svg);
    // banked surface
    el("ellipse", { cx: CX, cy: CY, rx: RX + 3 * LANEW, ry: RY + 3 * LANEW, fill: "url(#bank)" }, svg);
    el("ellipse", { cx: CX, cy: CY, rx: RX + 2.5 * LANEW, ry: RY + 2.5 * LANEW, fill: "none", stroke: neon, "stroke-width": 4, filter: light ? null : "url(#glow)" }, svg);
    el("ellipse", { cx: CX, cy: CY, rx: RX - 2.5 * LANEW, ry: RY - 2.5 * LANEW, fill: light ? "#eef4fb" : "#030914", stroke: neon, "stroke-width": 3, filter: light ? null : "url(#glow)" }, svg);
    for (var i = -1; i <= 1; i++) el("ellipse", { cx: CX, cy: CY, rx: RX + i * LANEW + LANEW / 2 - LANEW / 2, ry: RY + i * LANEW, fill: "none", stroke: neon2, "stroke-opacity": .35, "stroke-width": 1.2, "stroke-dasharray": "10 12" }, svg);
    // exhibition lane (inside, dashed magenta)
    el("ellipse", { cx: CX, cy: CY, rx: RX - 3.6 * LANEW, ry: RY - 3.6 * LANEW, fill: "none", stroke: "#ff3df2", "stroke-opacity": .55, "stroke-width": 1.5, "stroke-dasharray": "3 7" }, svg);
    // holographic AI glyph
    var g = el("text", { x: CX, y: CY + 70, "text-anchor": "middle", "font-family": "Orbitron, Inter, sans-serif", "font-weight": 900, "font-size": PORT ? 170 : 210,
      fill: neon, "fill-opacity": light ? .08 : .07, stroke: neon, "stroke-opacity": light ? .55 : .5, "stroke-width": 2.5, filter: light ? null : "url(#glow)", "letter-spacing": 10 }, svg);
    g.textContent = "AI";
    var sub = el("text", { x: CX, y: CY + 108, "text-anchor": "middle", "font-family": "Inter, sans-serif", "font-weight": 700, "font-size": PORT ? 18 : 15, fill: light ? "#3b4b60" : "#a9c3d9", "letter-spacing": 4 }, svg);
    sub.textContent = "EXHIBITION LANE · INSIDE";
    // finish line AGI (checkered)
    var top = CY - RY, x0 = CX - 3, h = 5 * LANEW;
    for (var r = 0; r < 10; r++) for (var c = 0; c < 2; c++)
      el("rect", { x: x0 + c * 6 - 3, y: top - 2.5 * LANEW + r * h / 10, width: 6, height: h / 10, fill: (r + c) % 2 ? (light ? "#0d1526" : "#ffffff") : (light ? "#ffffff" : "#0d1526") }, svg);
    var agi = el("text", { x: CX, y: top - 2.5 * LANEW - 12, "text-anchor": "middle", "font-family": "Orbitron, Inter, sans-serif", "font-weight": 900, "font-size": 30, fill: neon, filter: light ? null : "url(#glow)", "letter-spacing": 6 }, svg);
    agi.textContent = "AGI";
    var fl = el("text", { x: CX + 14, y: top + 2.5 * LANEW + 20, "font-family": "Inter, sans-serif", "font-weight": 700, "font-size": PORT ? 16 : 12, fill: light ? "#3b4b60" : "#a9c3d9", "letter-spacing": 2 }, svg);
    fl.textContent = "START / FINISH →";
    layer = el("g", { id: "racers" }, svg);
    buildTokens();
  }
  function tokenFor(r, exhibition) {
    var g = el("g", { class: "racer", tabindex: 0, role: "button", "data-id": r.id, "aria-label": (exhibition ? "Exhibition: " : "") + r.short + " — open fact card" }, layer);
    var lum = function (h) { var n = parseInt(h.slice(1), 16); return .3 * (n >> 16) + .59 * ((n >> 8) & 255) + .11 * (n & 255); };
    el("circle", { class: "ring", r: 21, fill: "#0d1526", stroke: lum(r.emblem.c1) > 90 ? r.emblem.c1 : r.emblem.c2, "stroke-width": 3 }, g);
    var wrap = document.createElementNS(NS, "g");
    var tmp = new DOMParser().parseFromString(r.emblem.svg.replace(/cl-x/g, "cl-t-" + r.id).replace("<svg ", '<svg xmlns="' + NS + '" '), "image/svg+xml").documentElement;
    tmp.setAttribute("x", -17); tmp.setAttribute("y", -17); tmp.setAttribute("width", 34); tmp.setAttribute("height", 34);
    wrap.appendChild(document.importNode(tmp, true)); g.appendChild(wrap);
    var lbl = el("text", { class: "lbl", "text-anchor": "middle", "font-family": "Inter, sans-serif", "font-weight": 800, "font-size": FS, fill: LIGHT ? "#0d1526" : "#ffffff", stroke: LIGHT ? "#ffffff" : "#02050d", "stroke-width": 4, "paint-order": "stroke" }, g);
    lbl.textContent = r.short;
    var rk = el("text", { class: "rk", "text-anchor": "middle", "font-family": "Orbitron, Inter, sans-serif", "font-weight": 900, "font-size": 13, fill: "#02050d" }, g);
    el("circle", { class: "rkbg", r: 10, fill: exhibition ? "#ff3df2" : css("--neon"), stroke: "#02050d", "stroke-width": 1.5 }, g).parentNode.insertBefore(g.lastChild, rk);
    g.addEventListener("click", function () { openCard(r.id); });
    g.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openCard(r.id); } });
    return { g: g, lbl: lbl, rk: rk, p: tokens[r.id] ? tokens[r.id].p : 0, lane: 0, target: 0 };
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
      t.lane = i % 2 ? 0.4 : 2.6; // alternate outer / inner so neighbours never share a side
      t.rank = i + 1;
    });
  }
  function place() {
    Object.keys(tokens).forEach(function (id) {
      var t = tokens[id], q;
      if (id === exh.id) {
        var a = -Math.PI / 2 + t.p * Math.PI * 2, rx = RX - 3.6 * LANEW, ry = RY - 3.6 * LANEW;
        q = { x: CX + rx * Math.cos(a), y: CY + ry * Math.sin(a), a: a };
      } else q = pt(t.p, t.lane);
      t.g.setAttribute("transform", "translate(" + q.x.toFixed(1) + "," + q.y.toFixed(1) + ")");
      var out = -1; // labels always sit on the infield side so they never clip the frame
      var nx = Math.cos(q.a), ny = Math.sin(q.a);
      var dl = id === exh.id ? 30 : (t.lane > 2 ? 30 : 30 + 1.4 * LANEW), lx = nx * dl * out, ly = ny * dl * out + FS * 0.35;
      t.lbl.setAttribute("text-anchor", Math.abs(nx) < .35 ? "middle" : ((nx * out) > 0 ? "start" : "end"));
      if (Math.abs(nx) >= .35) lx += (nx * out > 0 ? -6 : 6);
      t.lbl.setAttribute("x", lx.toFixed(1)); t.lbl.setAttribute("y", ly.toFixed(1));
      t.rk.setAttribute("x", 16); t.rk.setAttribute("y", -11);
      t.rk.textContent = id === exh.id ? "X" : String(t.rank || "");
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
    var d = document.getElementById("track-desc"); if (d) d.textContent = "Racers placed around an oval by composite score. Current leader: " + lead.r.short + " at " + lead.c.toFixed(1) + ".";
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
