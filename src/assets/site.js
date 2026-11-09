/* Поведение страниц: перенесено из прототипа. Разметку строит сборка (lib/render.js). */
(() => {
  const $ = s => document.querySelector(s);
  const main = $("#main");
  const mobile = () => matchMedia("(max-width:600px)").matches;

  /* ---------- значок «new»: считается в браузере, поэтому исчезает сам, без пересборки ---------- */
  const NEW_DAYS = 61;
  document.querySelectorAll(".new[data-pub]").forEach(n => { n.hidden = (Date.now() - new Date(n.dataset.pub)) / 864e5 > NEW_DAYS; });
  const yearEl = $("#year"); if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ---------- почта: собирается только в браузере ---------- */
  document.querySelectorAll("a[data-m]").forEach(a => {
    const v = [...atob(a.dataset.m)].reverse().join("");
    a.textContent = v; a.href = "mailto:" + v; a.target = "_blank"; a.rel = "noopener";
  });

  /* ---------- меню ---------- */
  $("#tree").addEventListener("click", e => {
    const b = e.target.closest("button.tw:not(.empty)"); if (!b) return;
    const ul = b.closest(".row").nextElementSibling; if (!ul) return;
    ul.hidden = !ul.hidden; b.classList.toggle("open", !ul.hidden);
  });
  function highlight(id){
    $("#tree").querySelectorAll("a[data-text]").forEach(a => a.classList.toggle("cur", a.dataset.text === id));
  }
  if (location.pathname === "/" && location.hash === "#contact-block") $("#tree [data-contact]")?.classList.add("cur");

  /* ---------- хлебные крошки ---------- */
  function fitCrumbs(){
    const c = document.getElementById("crumbs"); if (!c) return;
    const items = [...c.querySelectorAll(".ci")], more = c.querySelector(".more"), menu = more.querySelector(".menu");
    items.forEach(i => { i.hidden = false; const s = i.querySelector(".s"); if (s) s.style.display = ""; }); more.hidden = true; c.classList.remove("open");
    const a11y = $("#a11y").getBoundingClientRect(), cr = c.getBoundingClientRect(), mainW = main.getBoundingClientRect().width;
    const avail = Math.min(mainW, mobile() ? Infinity : a11y.left - 20 - cr.left);
    c.style.maxWidth = avail + "px";
    let k = 0;
    c.classList.add("measure");
    while (c.scrollWidth > avail + 1 && k < items.length - 1){ items[k].hidden = true; more.hidden = false; k++; }
    c.classList.remove("measure");
    menu.innerHTML = items.slice(0, k).map(i => i.querySelector("a,.lbl").outerHTML).join("");
    if (k) items[k].querySelector(".s").style.display = "none";
  }
  document.addEventListener("click", e => {
    const b = e.target.closest(".crumbs .more > button");
    const c = document.getElementById("crumbs");
    if (b){ e.stopPropagation(); c.classList.toggle("open"); return; }
    if (c && !e.target.closest(".crumbs .menu")) c.classList.remove("open");
  });

  /* ---------- подвал с подписью ---------- */
  const bar = $("#metabar");
  function placeBar(){
    const m = main.getBoundingClientRect();
    bar.style.left = m.left + "px"; bar.style.width = m.width + "px";
  }
  function setBar(article){
    const show = article && article.dataset.kind !== "play";
    bar.innerHTML = show ? article.querySelector(".pmeta").innerHTML : "";
    document.body.classList.toggle("has-bar", !!show);
    placeBar();
  }
  bar.addEventListener("click", () => bar.classList.toggle("open"));

  /* ---------- лента: слежение за прокруткой и переходы внутри неё ---------- */
  const isFeed = "feedpage" in document.body.dataset;
  const pieces = () => [...document.querySelectorAll(".feed article.piece")];
  let active = null;
  function activate(a){
    if (a === active) return;
    active = a; highlight(a.dataset.id); setBar(a);
    if (a.dataset.url !== location.pathname) history.replaceState(null, "", a.dataset.url);
    document.title = a.dataset.title;
  }
  function spy(){
    if (!isFeed || holdSpy) return;
    const list = pieces(); if (!list.length) return;
    const ph = $(".phead");
    const line = Math.max(innerHeight * 0.35, (ph ? ph.getBoundingClientRect().bottom : 0) + 40);
    let cur = list[0];
    for (const a of list) if (a.getBoundingClientRect().top <= line) cur = a;
    // на самой ленте без прокрутки адрес остаётся адресом ленты
    if (active === null && scrollY === 0 && !feedEl()?.dataset.target){ active = cur; highlight(cur.dataset.id); setBar(cur); return; }
    activate(cur);
  }
  const feedEl = () => $(".feed");
  let holdSpy = false, ticking = false;
  addEventListener("scroll", () => { if (!ticking){ ticking = true; requestAnimationFrame(() => { ticking = false; spy(); }); } }, { passive: true });

  function goTo(a, smooth){
    holdSpy = true;
    a.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "start" });
    active = null; activate(a);
    const release = () => { holdSpy = false; };
    if (smooth) { addEventListener("scrollend", release, { once: true }); setTimeout(release, 1500); } else requestAnimationFrame(release);
  }
  // страница текста: подгружаем всю ленту и останавливаемся на нём
  async function loadFeed(){
    const f = feedEl();
    if (!f || !f.dataset.feed) return;
    const a0 = pieces()[0]; if (a0) { active = a0; highlight(a0.dataset.id); setBar(a0); }
    try {
      const r = await fetch(f.dataset.feed); if (!r.ok) return;
      const doc = new DOMParser().parseFromString(await r.text(), "text/html");
      const full = doc.querySelector(".feed"); if (!full) return;
      f.innerHTML = full.innerHTML;
      const a = document.getElementById("t-" + f.dataset.target);
      if (a){
        goTo(a, false);
        // шрифты и размер окна могут сдвинуть текст: выравниваем, пока читатель не начал листать сам
        let touched = false;
        const stop = () => { touched = true; };
        for (const ev of ["wheel", "touchstart", "keydown", "pointerdown"]) addEventListener(ev, stop, { once: true, passive: true });
        const align = () => { if (!touched) goTo(a, false); };
        document.fonts?.ready.then(align);
        addEventListener("resize", align);
        setTimeout(() => { touched = true; removeEventListener("resize", align); }, 3000);
      }
    } catch (e) { /* без сети остаётся один текст */ }
  }
  // клик по тексту из той же ленты -- плавная прокрутка; адрес меняется, страница не перезагружается
  document.addEventListener("click", e => {
    const l = e.target.closest('a[href^="/"]');
    if (!l || !isFeed || e.metaKey || e.ctrlKey || e.shiftKey) return;
    const a = pieces().find(p => p.dataset.url === l.getAttribute("href")); if (!a) return;
    e.preventDefault();
    history.pushState(null, "", a.dataset.url);
    goTo(a, true);
    if (mobile()) setCollapsed(true);
  });
  addEventListener("popstate", () => {
    const a = pieces().find(p => p.dataset.url === location.pathname);
    if (a) goTo(a, false); else if (isFeed) location.reload();
  });

  /* ---------- алфавит ---------- */
  document.addEventListener("click", e => {
    const a = e.target.closest(".letters a[data-l]");
    if (a) document.getElementById("l-" + a.dataset.l)?.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  /* ---------- облако тегов / по алфавиту ---------- */
  document.addEventListener("click", e => {
    const v = e.target.closest(".views a[data-v]"); if (!v) return;
    document.querySelectorAll(".views a[data-v]").forEach(a => a.classList.toggle("on", a === v));
    document.querySelectorAll("[data-view]").forEach(el => { el.hidden = el.dataset.view !== v.dataset.v; });
    setPh(); scrollTo(0, 0);
  });

  /* ---------- пьесы ---------- */
  document.addEventListener("click", e => {
    const b = e.target.closest(".fold[data-p]"); if (!b) return;
    const p = document.getElementById(b.dataset.p);
    p.hidden = !p.hidden; b.classList.toggle("open", !p.hidden);
  });

  /* ---------- плеер ---------- */
  const PLAY = `<svg viewBox="0 0 12 12" width="11" height="11" aria-hidden="true"><path d="M3 1.5v9l7.5-4.5z" fill="currentColor"/></svg>`;
  const PAUSE = `<svg viewBox="0 0 12 12" width="11" height="11" aria-hidden="true"><path d="M2.5 1.5h2.6v9H2.5zM6.9 1.5h2.6v9H6.9z" fill="currentColor"/></svg>`;
  const mmss = x => isFinite(x) ? Math.floor(x / 60) + ":" + String(Math.floor(x % 60)).padStart(2, "0") : "0:00";
  let current = null;   // одновременно играет только одна запись
  function startAudio(a){ if (current && current !== a) current.pause(); a.play().catch(() => {}); current = a; }
  document.addEventListener("click", e => {
    const p = e.target.closest(".player"); if (!p) return;
    if (!p._a){
      const a = new Audio(p.dataset.src); a.preload = "metadata"; p._a = a;
      const fill = p.querySelector(".wv.fill"), tm = p.querySelector(".tm"), pp = p.querySelector(".pp");
      a.addEventListener("timeupdate", () => { fill.style.clipPath = `inset(0 ${100 - (a.currentTime / a.duration * 100 || 0)}% 0 0)`; tm.textContent = mmss(a.currentTime) + " / " + mmss(a.duration); });
      a.addEventListener("loadedmetadata", () => { tm.textContent = "0:00 / " + mmss(a.duration); });
      a.addEventListener("play", () => { pp.innerHTML = PAUSE; pp.setAttribute("aria-label", "Пауза"); p.classList.add("on"); });
      a.addEventListener("pause", () => { pp.innerHTML = PLAY; pp.setAttribute("aria-label", "Слушать"); p.classList.remove("on"); });
      a.addEventListener("ended", () => { a.currentTime = 0; fill.style.clipPath = "inset(0 100% 0 0)"; });
    }
    const a = p._a;
    if (e.target.closest(".wave")){
      const r = p.querySelector(".wave").getBoundingClientRect();
      const go = () => { a.currentTime = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * a.duration; startAudio(a); };
      a.duration ? go() : a.addEventListener("loadedmetadata", go, { once: true });
      return;
    }
    if (e.target.closest(".pp")) a.paused ? startAudio(a) : a.pause();
  });
  // подсветить место, куда пришли по значку ▶
  if (location.hash.length > 1){
    const t = document.getElementById(location.hash.slice(1));
    if (t && t.matches(".srec")){ t.classList.add("flash"); setTimeout(() => t.classList.remove("flash"), 1600); }
  }

  /* ---------- Log: дежурные записи за месяцы без обновлений ---------- */
  const logfeed = $("#logfeed");
  if (logfeed){
    const MONTHS = ["Январь","Февраль","Март","Апрель","Май","Июнь","Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"];
    const quiet = JSON.parse(logfeed.dataset.quiet);
    const secs = [...logfeed.children];
    const mon = s => { const [y, m] = s.dataset.date.split("-").map(Number); return y * 12 + m - 1; };
    if (secs.length && quiet.length){
      const has = new Set(secs.map(mon)), now = new Date();
      const first = Math.min(...secs.map(mon)), last = now.getFullYear() * 12 + now.getMonth();
      for (let m = first + 1; m < last; m++){
        if (has.has(m)) continue;
        const s = document.createElement("section");
        s.className = "logent quiet"; s.dataset.date = `${Math.floor(m / 12)}-${m % 12 + 1}-1`;
        const h = document.createElement("h2"); h.className = "subhead"; h.textContent = MONTHS[m % 12] + " " + Math.floor(m / 12);
        const p = document.createElement("p"); p.className = "lnote"; p.textContent = quiet[m % quiet.length];
        s.append(h, p);
        const next = [...logfeed.children].find(x => mon(x) < m);
        logfeed.insertBefore(s, next || null);
      }
    }
  }

  /* ---------- настройки чтения ---------- */
  const A11Y = { s: "1", f: "", c: "" };
  try { Object.assign(A11Y, JSON.parse(localStorage.getItem("a11y") || "{}")); } catch (e) {}
  function applyA11y(){
    document.documentElement.style.setProperty("--s", A11Y.s);
    document.body.classList.remove("f-sans", "f-easy", "hc");
    if (A11Y.f) document.body.classList.add(A11Y.f);
    if (A11Y.c) document.body.classList.add(A11Y.c);
    $("#a11y").querySelectorAll(".opt").forEach(o => {
      const on = ("s" in o.dataset && o.dataset.s === A11Y.s) || ("f" in o.dataset && o.dataset.f === A11Y.f) || ("c" in o.dataset && o.dataset.c === A11Y.c);
      o.classList.toggle("on", on);
    });
    try { localStorage.setItem("a11y", JSON.stringify(A11Y)); } catch (e) {}
    setTimeout(() => { placeBar(); fitCrumbs(); fitHome(); setPh(); }, 50);
  }
  $("#a11y > button").onclick = e => { e.stopPropagation(); $("#a11y").classList.toggle("open"); };
  $("#a11y .pane").onclick = e => {
    e.stopPropagation();
    const o = e.target.closest(".opt"); if (!o) return;
    for (const k of ["s", "f", "c"]) if (k in o.dataset) A11Y[k] = o.dataset[k];
    applyA11y();
  };
  document.addEventListener("click", () => $("#a11y").classList.remove("open"));

  /* ---------- закреплённые заголовок и главная ---------- */
  function setPh(){
    const ph = $(".phead");
    document.documentElement.style.setProperty("--ph", ph ? (ph.offsetHeight - 28) + "px" : "0px");
  }
  addEventListener("resize", setPh);
  function fitHome(){
    const d = document.getElementById("dscroll");
    document.body.classList.remove("home-fixed");
    if (!d || mobile()){ if (d) d.style.maxHeight = ""; return; }
    document.body.classList.add("home-fixed"); scrollTo(0, 0);
    const h = innerHeight - d.getBoundingClientRect().top - 16;
    if (h < 160){ document.body.classList.remove("home-fixed"); d.style.maxHeight = ""; }
    else d.style.maxHeight = h + "px";
  }
  addEventListener("resize", fitHome);

  /* ---------- случайный текст на главной ---------- */
  async function randomText(){
    const d = document.getElementById("dscroll"); if (!d) return;
    try {
      const pool = JSON.parse(d.dataset.pool);
      const url = pool[Math.floor(Math.random() * pool.length)];
      const r = await fetch(url); if (!r.ok) return;
      const art = new DOMParser().parseFromString(await r.text(), "text/html").querySelector("article.piece"); if (!art) return;
      const h2 = art.querySelector("h2"); h2.querySelector(".snd")?.remove();
      const meta = art.querySelector(".pmeta").innerHTML;
      h2.remove(); art.querySelector(".pmeta").remove();
      const h3 = document.createElement("h3"), a = document.createElement("a");
      a.href = url; a.textContent = h2.textContent; h3.append(a);
      const m = document.createElement("div"); m.className = "meta"; m.innerHTML = meta;
      d.replaceChildren(h3, ...art.childNodes, m);
    } catch (e) { /* остаётся текст из сборки */ }
    finally { d.classList.add("ready"); }
  }

  /* ---------- свёрнутое оглавление ---------- */
  function setCollapsed(v){
    document.body.classList.toggle("collapsed", v);
    try { localStorage.setItem("sideCollapsed", v ? "1" : "0"); } catch (e) {}
    setTimeout(() => { placeBar(); fitCrumbs(); }, 280);
  }
  $("#hideSide").onclick = () => setCollapsed(false || true);
  $("#showSide").onclick = () => setCollapsed(false);
  addEventListener("resize", () => { placeBar(); fitCrumbs(); });

  /* ---------- поиск (Pagefind) ---------- */
  $("#search").addEventListener("click", e => { if (!e.target.closest("button")) $("#q").focus(); });
  $("#search").addEventListener("submit", e => { if (!$("#q").value.trim()) e.preventDefault(); });
  const resultsEl = document.getElementById("results");

  // как в прототипе: фразы в кавычках ищутся целиком, слова -- по основе и по началу
  const norm = s => s.toLowerCase().replace(/ё/g, "е");
  const ENDINGS = ["иями","ями","ами","ией","ием","иях","ого","его","ому","ему","ыми","ими","ой","ей","ом","ем","ам","ям","ах","ях","ую","юю","ая","яя","ое","ее","ые","ие","ый","ий","ов","ев","ию","ья","ье","ьи","ью","а","я","о","е","ы","и","у","ю","ь","й"];
  const stem = w => { for (const x of ENDINGS) if (w.length - x.length >= 3 && w.endsWith(x)) return w.slice(0, -x.length); return w; };
  const toks = s => norm(s).split(/[^a-zа-я0-9-]+/).filter(Boolean);
  function parseQuery(q){
    return { phrases: [...q.matchAll(/"([^"]+)"|«([^»]+)»/g)].map(m => norm(m[1] || m[2])),
             words: toks(q.replace(/"[^"]*"|«[^»]*»/g, " ")).map(stem) };
  }
  const lineHit = (l, pq) => pq.phrases.some(p => norm(l).includes(p)) || pq.words.some(w => toks(l).some(k => k.startsWith(w)));
  const matchesAll = (text, pq) => pq.phrases.every(p => norm(text).includes(p)) && pq.words.every(w => toks(text).some(k => k.startsWith(w)));

  async function runSearch(q){
    $("#q").value = q;
    const esc = s => s.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    const stat = $("#sstat");
    const show = (head, list = "") => { stat.textContent = head; stat.hidden = !head; resultsEl.innerHTML = list; setPh(); };
    if (!q.trim()){ show("", `<p class="muted">Введите слово или строку в поле поиска.</p>`); return; }
    show(`«${q}» -- ищу…`);
    let found = [];
    try {
      const pagefind = await import("/pagefind/pagefind.js");
      const pq = parseQuery(q);
      const plain = q.replace(/["«»]/g, " ");
      const res = await pagefind.search(plain);
      const data = await Promise.all(res.results.slice(0, 50).map(r => r.data()));
      // проверяем каждую найденную страницу по правилам прототипа и берём строку с совпадением
      for (const d of data){
        const html = await (await fetch(d.url)).text();
        const art = new DOMParser().parseFromString(html, "text/html").querySelector("article.piece");
        if (!art) continue;
        const lines = [...art.querySelectorAll(".ln, p:not(.rights):not(:has(.file))")].map(x => x.textContent.trim()).filter(Boolean);
        const meta = [...art.querySelectorAll(".pmeta div")].map(x => x.textContent.trim());
        const title = d.meta.title || "";
        if (!matchesAll([title, ...lines, ...meta].join("\n"), pq)) continue;
        found.push({ url: d.url, title, hit: lines.find(l => lineHit(l, pq)) || meta.find(l => lineHit(l, pq)) || "" });
      }
    } catch (e) {
      show("", `<p class="muted">Поиск сейчас не работает. Попробуйте обновить страницу.</p>`); return;
    }
    // порядок как в прототипе -- порядок сайта (по оглавлению)
    const order = [...document.querySelectorAll("#tree a[data-text]")].map(a => a.getAttribute("href"));
    found.sort((a, b) => order.indexOf(a.url) - order.indexOf(b.url));
    show(`«${q}» -- ${found.length ? "найдено: " + found.length : "ничего не найдено"}`,
      `<ul class="list results">` + found.map(f => `<li><a href="${esc(f.url)}">${esc(f.title)}</a>${f.hit ? `<span class="hit">${esc(f.hit)}</span>` : ""}</li>`).join("") + `</ul>`);
  }
  if (resultsEl) runSearch(new URLSearchParams(location.search).get("q") || "");

  /* ---------- Escape: шаг назад, но только внутри сайта ---------- */
  document.addEventListener("keydown", e => {
    if (e.key !== "Escape") return;
    if ($("#a11y").classList.contains("open")){ $("#a11y").classList.remove("open"); return; }
    if (document.activeElement === $("#q")){ $("#q").blur(); return; }
    let inside = false;
    try { inside = new URL(document.referrer).origin === location.origin; } catch (err) {}
    if (inside) history.back();
  });

  /* ---------- старт ---------- */
  applyA11y();
  setPh();
  fitHome();
  fitCrumbs();
  randomText();
  if (isFeed){
    if (feedEl()?.dataset.feed) loadFeed(); else spy();
  }
})();
