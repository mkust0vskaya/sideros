// Страницы сайта: та же разметка, что в прототипе (prototype/index.html), но со статическими адресами.
import fs from "node:fs";
import path from "node:path";
import { ICONS } from "./icons.js";

export const SITE_URL = "https://sideros.morphemes.space";

const readJson = (dir, name) => JSON.parse(fs.readFileSync(path.join(dir, name + ".json"), "utf8"));

export function loadSite(dir) {
  const texts = {};
  for (const f of fs.readdirSync(path.join(dir, "texts")).filter(f => f.endsWith(".json")).sort())
    Object.assign(texts, readJson(dir, "texts/" + f.replace(/\.json$/, "")));
  const { books, publications } = readJson(dir, "books");
  const { playPubs, productions } = readJson(dir, "theatre");
  const log = readJson(dir, "log");
  return { home: readJson(dir, "home"), sections: readJson(dir, "sections"), books, publications, playPubs, productions,
    log: log.entries, logQuiet: log.quiet, audio: readJson(dir, "sound"), texts };
}

/* ---------- вспомогательное ---------- */
const esc = s => String(s).replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
const attr = s => esc(s).replace(/"/g, "&quot;");
// курсив, жирный и изменённый кегль из документа сохраняются (разметку пишет scripts/gdoc-poems.mjs)
const escI = s => esc(s).replace(/&lt;(\/?)([ib])&gt;/g, "<$1$2>")
  .replace(/&lt;span style="font-size:([\d.]+)em"&gt;/g, '<span style="font-size:$1em">').replace(/&lt;\/span&gt;/g, "</span>");
const noTags = s => s.replace(/<\/?(?:[ib]|span)[^>]*>/g, "");
const CHEV = `<svg class="chev" viewBox="0 0 12 12" aria-hidden="true"><path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const STAR = "* * *";
const firstLine = t => noTags(t.body).split("\n")[0].replace(/^\|/, "").replace(/[.,;:—–-]+\s*$/, "") + "…";
const menuTitle = t => t.title || firstLine(t);
const listTitle = t => t.title || "«" + firstLine(t) + "»";
const yearIn = t => (t.date.match(/\d{4}(?:[–-]\d{4})?/) || [t.date])[0];
const norm = s => s.toLowerCase().replace(/ё/g, "е");
const key = s => norm(s).replace(/[«»"„“.,;:!?…—–-]/g, " ").replace(/\s+/g, " ").trim();
const TR = { а:"a",б:"b",в:"v",г:"g",д:"d",е:"e",ё:"e",ж:"zh",з:"z",и:"i",й:"y",к:"k",л:"l",м:"m",н:"n",о:"o",п:"p",р:"r",с:"s",т:"t",у:"u",ф:"f",х:"kh",ц:"ts",ч:"ch",ш:"sh",щ:"shch",ъ:"",ы:"y",ь:"",э:"e",ю:"yu",я:"ya" };
const slug = s => [...s.toLowerCase()].map(c => TR[c] ?? c).join("").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export function buildPages(S) {
  /* ---------- адреса ---------- */
  const subSlug = (s, u) => u.id.startsWith(s.id + "-") ? u.id.slice(s.id.length + 1) : u.id;
  const uSec = s => `/${s.id}/`;
  const uSub = (s, u) => `/${s.id}/${subSlug(s, u)}/`;
  function findText(id) {
    for (const s of S.sections) {
      if ((s.texts || []).includes(id)) return { sec: s, sub: null };
      for (const u of s.subs) if (u.texts.includes(id)) return { sec: s, sub: u };
    }
    return null;
  }
  const uText = id => { const { sec, sub } = findText(id); return (sub ? uSub(sec, sub) : uSec(sec)) + id + "/"; };
  const allTags = () => {
    const m = {};
    for (const [id, t] of Object.entries(S.texts)) for (const g of t.tags) (m[g] ||= []).push(id);
    return m;
  };
  const uTag = t => `/tags/${slug(t)}/`;
  const uBook = b => `/knigi/${b.id}/`;
  const uShow = p => `/teatr/${p.id}/`;
  const uAlbum = al => `/zvuk/pesni/${al.id}/`;
  const CONTACT = "/#contact-block";
  // порядок текстов в документах сохраняется, а тексты вне разделов на сайт не попадают
  const placed = Object.keys(S.texts).filter(findText);

  /* ---------- меню ---------- */
  function tree(cur) {
    const ctx = S.texts[cur] ? findText(cur) : null;
    const c = id => id === cur ? ' class="cur"' : "";
    const hid = v => v ? "" : " hidden";
    const textLi = id => `<li><div class="row"><span class="tw empty"></span><a href="${uText(id)}" data-text="${id}"${c(id)}>${S.texts[id].published ? `<span class="new" data-pub="${S.texts[id].published}" hidden>new</span>` : ""}${esc(menuTitle(S.texts[id]))}</a></div></li>`;
    let h = `<a href="/" class="home-link${cur === "home" ? " cur" : ""}">Главная</a><ul>`;
    for (const s of S.sections) {
      const kids = s.subs.length || (s.texts || []).length;
      h += `<li class="grp"><div class="row"><button class="tw${kids ? " open" : " empty"}" aria-label="Свернуть или развернуть">${kids ? CHEV : ""}</button><a href="${uSec(s)}"${c(s.id)}>${s.title}</a></div><ul>`;
      for (const u of s.subs) {
        const uo = cur === u.id || (ctx && ctx.sub && ctx.sub.id === u.id);
        h += `<li><div class="row"><button class="tw${uo ? " open" : ""}" aria-label="Свернуть или развернуть">${CHEV}</button><a href="${uSub(s, u)}"${c(u.id)}>${u.title}</a></div><ul${hid(uo)}>` + u.texts.map(textLi).join("") + `</ul></li>`;
      }
      h += (s.texts || []).map(textLi).join("") + `</ul></li>`;
    }
    const onS = cur === "zvuk" || cur === "zvuk-pesni";
    h += `<li class="grp sound"><div class="row"><button class="tw open" aria-label="Свернуть или развернуть">${CHEV}</button><a href="/zvuk/"${onS ? ' class="cur"' : ""}>Звук</a></div>` +
      `<ul><li><div class="row"><span class="tw empty"></span><a href="/zvuk/"${c("zvuk")}>Чтение</a></div></li>` +
      `<li><div class="row"><span class="tw empty"></span><a href="/zvuk/pesni/"${c("zvuk-pesni")}>Песни</a></div></li></ul></li>`;
    h += `</ul><hr class="sep"><div class="side-extra">
    <div><a href="/log/"${c("log")}>Log</a></div>
    <div><a href="/tags/"${c("tags")}>Облако тегов</a></div>
    <div><a href="/alfavit/"${c("index")}>Стихи по алфавиту</a></div>
    <div><a href="/knigi/"${c("books")}>Книги и публикации</a></div>
    <div><a href="/teatr/"${c("theatre")}>Театр</a></div>
    <div><a href="${CONTACT}" data-contact>Связаться с автором</a></div></div>
    <div class="copy">© ${esc(S.home.name)}, <span id="year">${new Date().getFullYear()}</span></div>`;
    return h;
  }

  /* ---------- общие части страниц ---------- */
  function crumbs(items) {
    const all = [["Главная", "/"], ...items];
    const parts = all.map(([l, h], i) => `<span class="ci${i === all.length - 1 ? " last" : ""}">${i ? '<span class="s">/</span>' : ""}${h ? `<a href="${h}">${esc(l)}</a>` : `<span class="lbl">${esc(l)}</span>`}</span>`);
    return `<div class="crumbs" id="crumbs"><span class="more" hidden><button type="button" aria-label="Показать начало пути">…</button><span class="s">/</span><span class="menu"></span></span>${parts.join("")}</div>`;
  }
  const phead = (title, under = "") => `<div class="phead"><h1>${esc(title)}</h1>${under}</div>`;
  const ORN = `<div class="orn" aria-hidden="true">~*~</div><div class="tail"></div>`;

  /* ---------- подпись ---------- */
  function metaItems(t) {
    const book = t.book && t.book.match(/^(.*?)(?: \((\d{4})\))?$/);
    return [
      t.date + (t.place ? ", " + t.place : ""),
      t.cycle && (t.cycle.includes("«") ? t.cycle[0].toUpperCase() + t.cycle.slice(1) : `Цикл «${t.cycle}»`),
      book && `Книга «${book[1]}»` + (book[2] ? `, ${book[2]}` : ""),
    ].filter(Boolean);
  }
  function metaHtml(t) {
    return metaItems(t).map(v => {
      if (t.book && v.startsWith("Книга «")) {
        const name = t.book.replace(/ \(\d{4}\)$/, "");
        const b = S.books.find(b => key(b.title) === key(name));
        if (b) return `<div>Книга <a class="ml" href="${uBook(b)}">«${esc(name)}»</a>${esc(v.slice(("Книга «" + name + "»").length))}</div>`;
      }
      return `<div>${esc(v)}</div>`;
    }).join("");
  }

  /* ---------- тексты ---------- */
  function body(t) {
    if (t.kind === "poem") {
      let h = "";
      for (const st of t.body.split(/\n\s*\n/)) {
        const lines = st.split("\n");
        if (lines.length === 1 && lines[0].startsWith("### ")) { h += `<h3 class="sub">${esc(lines[0].slice(4))}</h3>`; continue; }
        let buf = [];
        const flush = () => { if (buf.length) h += `<div class="poem">${buf.join("")}</div>`; buf = []; };
        for (const l of lines) {
          if (l.trim() === "*") { flush(); h += `<div class="star1">*</div>`; continue; }
          buf.push(l.startsWith("|") ? `<span class="ln ind">${escI(l.slice(1))}</span>` : `<span class="ln">${escI(l)}</span>`);
        }
        flush();
      }
      return h;
    }
    return t.body.split(/\n\s*\n/).map(p => `<p>${escI(p)}</p>`).join("");
  }
  const docTitle = title => title + " -- " + S.home.name;
  function piece(id) {
    const t = S.texts[id];
    let h = `<article class="piece" id="t-${id}" data-id="${id}" data-url="${uText(id)}" data-title="${attr(docTitle(menuTitle(t)))}">` +
      (t.title ? `<h2>${esc(t.title)}${soundLink(id)}</h2>` : `<h2 class="star">${STAR}${soundLink(id)}</h2>`) + body(t);
    if (t.file) h += `<p><a class="file" href="/files/${attr(t.file)}">↓ Скачать PDF (${esc(t.file)})</a></p>`;
    return h + `<div class="pmeta">${metaHtml(t)}</div></article>`;
  }

  /* ---------- звук ---------- */
  const A = S.audio;
  const PLAY = `<svg viewBox="0 0 12 12" width="11" height="11" aria-hidden="true"><path d="M3 1.5v9l7.5-4.5z" fill="currentColor"/></svg>`;
  const WAVE_N = 64;
  const waveBars = peaks => peaks.map(v => `<i style="height:${Math.max(8, Math.round(v * 100))}%"></i>`).join("");
  const flat = waveBars(Array.from({ length: WAVE_N }, () => 0.12));
  const audioUrl = f => "/" + f.replace(/^\//, "");
  const playerRow = file => `<div class="player" data-src="${attr(audioUrl(file))}">
      <button class="pp" aria-label="Слушать">${PLAY}</button>
      <div class="wave"><div class="wv base">${flat}</div><div class="wv fill">${flat}</div></div>
      <span class="tm">0:00</span></div>`;
  const audioInfo = a => [a.year, a.performer, a.note].filter(Boolean).map(esc).join(" · ");
  const hasCover = id => A.covers.some(c => c.text === id);
  const albumOf = id => A.albums.find(al => al.tracks.some(t => t.text === id));
  const hasSong = id => hasCover(id) || !!albumOf(id);
  const uSong = id => hasCover(id) ? `/zvuk/pesni/#p-${id}` : `${uAlbum(albumOf(id))}#t-al-${id}`;
  function soundTarget(id) {
    if (A.readings.some(r => r.text === id)) return `/zvuk/#s-${id}`;
    return hasSong(id) ? uSong(id) : null;
  }
  const SOUND_ICON = `<svg viewBox="0 0 12 12" width="9" height="9" aria-hidden="true"><path d="M3.5 2v8l6.5-4z" fill="currentColor"/></svg>`;
  function soundLink(id) {
    const tg = soundTarget(id);
    return tg ? `<a class="snd" href="${tg}" title="Слушать" aria-label="Слушать">${SOUND_ICON}</a>` : "";
  }
  const soundHead = view => crumbs([["Звук"]]) + phead("Звук", `<p class="subtitle sections soundviews"><a href="/zvuk/" class="${view === "read" ? "on" : ""}">Чтение</a><a href="/zvuk/pesni/" class="${view === "songs" ? "on" : ""}">Песни</a></p>`);
  const byTitle = (a, b) => menuTitle(S.texts[a]).localeCompare(menuTitle(S.texts[b]), "ru");
  const songCount = id => A.covers.filter(c => c.text === id).length + (albumOf(id) ? 1 : 0);
  function recAction(r) {
    if (r.link) return `<a class="ract" href="${attr(r.link)}" target="_blank" rel="noopener">${esc(r.linkLabel || "Об исполнителе")} ↗</a>`;
    if (r.download) return `<a class="ract" href="${attr(audioUrl(r.file))}" download>↓ скачать</a>`;
    return "";
  }
  function card(id, info, file, o = {}) {
    return `<div class="srec${o.first ? " first" : ""}"${o.anchor ? ` id="${o.anchor}"` : ""}>` +
      `<div class="stitle">${o.num ? `<span class="num">${o.num}.</span> ` : ""}<a href="${uText(id)}">${esc(menuTitle(S.texts[id]))}</a></div>` +
      (info ? `<div class="ainfo">${info}</div>` : "") +
      `<div class="prow">${playerRow(file)}${o.action || ""}</div>` + (o.after || "") + `</div>`;
  }
  function pageSound(view) {
    let h = soundHead(view);
    if (view === "read") {
      const ids = [...new Set(A.readings.map(r => r.text))].sort(byTitle);
      h += ids.map(id => {
        const recs = A.readings.filter(r => r.text === id);
        return recs.map((r, i) => card(id, audioInfo(r), r.file, { action: recAction(r), first: i === 0, anchor: i === 0 ? "s-" + id : null,
          after: (i === recs.length - 1 && hasSong(id)) ? `<p class="also">На этот текст есть ${songCount(id) > 1 ? "песни" : "песня"}: <a class="ml" href="${uSong(id)}">перейти</a></p>` : "" })).join("");
      }).join("");
    } else {
      if (A.albums.length) h += `<h2 class="subhead">${A.albums.length > 1 ? "Альбомы" : "Альбом"}</h2><ul class="pubs">` +
        A.albums.map(al => `<li><a href="${uAlbum(al)}">${esc(al.title)}</a><div class="m">${al.lines.map(v => `<div>${esc(v)}</div>`).join("")}</div></li>`).join("") + `</ul>`;
      const ids = [...new Set(A.covers.map(c => c.text))].sort(byTitle);
      if (ids.length) h += `<h2 class="subhead">Песни</h2>` + ids.map(id =>
        A.covers.filter(c => c.text === id).map((c, i) => card(id, audioInfo(c), c.file, { first: i === 0, anchor: i === 0 ? "p-" + id : null, action: recAction(c) })).join("")).join("");
    }
    return h + `<div class="tail"></div>`;
  }
  const pageAlbum = al => crumbs([["Звук", "/zvuk/"], ["Песни", "/zvuk/pesni/"], [al.title]]) + phead(al.title) +
    `<div class="bookmeta">${al.lines.map(v => `<div>${esc(v)}</div>`).join("")}</div>` +
    (al.url ? `<p><a class="ml" href="${attr(al.url)}" target="_blank" rel="noopener">${esc(al.urlLabel || "Слушать на внешнем сайте")}</a><span class="ext"> ↗</span></p>` : "") +
    `<div class="tracks">` + al.tracks.map((t, i) => card(t.text, "", t.file, { num: i + 1, anchor: "t-al-" + t.text, action: recAction(t) })).join("") + `</div><div class="tail"></div>`;

  /* ---------- книги, публикации, театр ---------- */
  function findByTitle(name) {
    const k = key(name);
    return placed.find(id => { const t = S.texts[id]; return (t.title && key(t.title) === k) || key(noTags(t.body).split("\n")[0].replace(/^\|/, "")) === k; });
  }
  const pubMeta = p => (p.status ? [p.status] : [...(p.lines || []), p.date && (p.date + (p.place ? ", " + p.place : ""))]).filter(Boolean).map(v => `<div>${esc(v)}</div>`).join("");
  const pubItem = p => `<li>${p.url ? `<a href="${attr(p.url)}" target="_blank" rel="noopener">${esc(p.title)}</a><span class="ext">↗</span>` : `<span class="pt">${esc(p.title)}</span>`}<div class="m">${pubMeta(p)}</div></li>`;
  function bookContents(b) {
    if (b.contents) return b.contents;
    return placed.filter(id => { const t = S.texts[id]; return t.book && key(t.book.replace(/ \(\d{4}\)$/, "")) === key(b.title); }).map(id => S.texts[id].title || firstLine(S.texts[id]));
  }
  const yearOf = p => parseInt((p.year || "").match(/\d{4}/)?.[0] || "0", 10);
  function showMeta(p, withPlay = true) {
    const play = p.play ? findByTitle(p.play) : null;
    return [
      p.note && `<div>${esc(p.note)}</div>`,
      withPlay && p.play && `<div>Пьеса ${play ? `<a class="ml" href="${uText(play)}">«${esc(p.play)}»</a>` : `«${esc(p.play)}»`}</div>`,
      `<div>${esc([p.year, p.place, p.theatre].filter(Boolean).join(", "))}</div>`,
      p.director && `<div>Режиссёр ${esc(p.director)}</div>`,
    ].filter(Boolean).join("");
  }
  const prodItem = (p, withPlay = true) => (p.url
    ? `<li><a href="${attr(p.url)}" target="_blank" rel="noopener">${esc(p.title)}</a><span class="ext">↗</span>`
    : p.about ? `<li><a href="${uShow(p)}">${esc(p.title)}</a>` : `<li><span class="pt">${esc(p.title)}</span>`) + `<div class="m">${showMeta(p, withPlay)}</div></li>`;

  /* ---------- пьесы ---------- */
  const info = text => `<span class="info" tabindex="0">?<span class="tip">${esc(text)}</span></span>`;
  const LEAF = `<svg width="13" height="13" viewBox="0 0 16 16" aria-hidden="true"><path d="M14 2C7 2 2.5 5.5 2.5 10.5c0 1.2.3 2.3.8 3.3C5 9.5 8 7 11 6 8.5 7.5 6 10 4.5 13.5c1 .5 2 .5 3 .5C12 14 14 9 14 2z" fill="currentColor"/></svg>`;
  const ACTS = ["", "Одно действие", "Два действия", "Три действия", "Четыре действия", "Пять действий"];
  const VERSION_NOTES = { "vegan version": "Версия для детского театра: без нецензурной лексики." };
  function castLine(c) {
    const part = (m, f) => [m && m + " М", f && f + " Ж"].filter(Boolean).join(", ");
    return [(c.am || c.af) && "Взрослые: " + part(c.am, c.af), (c.km || c.kf) && "дети: " + part(c.km, c.kf)].filter(Boolean).join("; ");
  }
  const playMeta = t => [ACTS[t.acts] || t.acts + " действий", castLine(t.cast), t.date].filter(Boolean).map(v => `<div>${esc(v)}</div>`).join("");
  const fileLinks = files => files.map(f => `<li><a href="/files/${attr(f.url)}">Скачать ${esc(f.label)}</a></li>`).join("");
  const RIGHTS = `<p class="rights">По вопросам постановки -- <a class="ml" href="${CONTACT}">связаться с автором</a></p>`;
  const pageDrama = sec => crumbs([[sec.title]]) + phead(sec.title) + `<ul class="plays">` + (sec.texts || []).map(id => {
    const t = S.texts[id];
    const prods = S.productions.filter(p => p.play && findByTitle(p.play) === id).sort((a, b) => yearOf(b) - yearOf(a));
    return `<li><h2>${esc(t.title)}</h2>
      <div class="folds">
        <button class="fold" data-p="ann-${id}">${CHEV}<span>Аннотация</span></button>
        ${prods.length ? `<button class="fold" data-p="prod-${id}">${CHEV}<span>Постановки</span></button>` : ""}
      </div>
      <div class="panel" id="ann-${id}" hidden><div class="m">${playMeta(t)}</div>${t.annotation ? `<p class="annot">${esc(t.annotation)}</p>` : ""}</div>
      ${prods.length ? `<div class="panel" id="prod-${id}" hidden><ul class="pubs">${prods.map(p => prodItem(p, false)).join("")}</ul></div>` : ""}
      <ul class="acts"><li><a href="${uText(id)}">Читать в браузере</a></li>${fileLinks(t.files || [])}</ul>` + RIGHTS +
      (t.versions || []).map(v => `<div class="ver">${v.vegan ? LEAF : ""}<span>${esc(v.name)}</span>${VERSION_NOTES[v.name] ? info(VERSION_NOTES[v.name]) : ""}</div>
        <ul class="acts">${fileLinks(v.files || [])}</ul>`).join("") + `</li>`;
  }).join("") + `</ul>`;
  function pagePlay(sec, id) {
    const t = S.texts[id];
    return crumbs([[sec.title, uSec(sec)], [t.title]]) +
      `<article class="piece" id="t-${id}" data-id="${id}" data-kind="play" data-url="${uText(id)}" data-title="${attr(docTitle(t.title))}"><h1>${esc(t.title)}</h1><div class="playmeta">${playMeta(t)}</div>${body(t)}` +
      `<ul class="acts" style="margin-top:2em">${fileLinks(t.files || [])}</ul>${RIGHTS}</article>` + ORN;
  }

  /* ---------- алфавит и теги ---------- */
  const lettersBar = (groups, attrs = "") => `<p class="letters"${attrs}>${groups.map(([l]) => `<a data-l="${l}">${l}</a>`).join("")}</p>`;
  const grouped = (list, first) => {
    const groups = [];
    for (const it of list) { const l = first(it).toUpperCase(); if (!groups.length || groups.at(-1)[0] !== l) groups.push([l, []]); groups.at(-1)[1].push(it); }
    return groups;
  };
  function pageIndex() {
    const items = placed.filter(id => S.texts[id].kind === "poem").map(id => [listTitle(S.texts[id]).replace(/^«/, ""), id, S.texts[id]]).sort((a, b) => a[0].localeCompare(b[0], "ru"));
    const groups = grouped(items, it => it[0][0]);
    return crumbs([["Стихи по алфавиту"]]) + phead("Стихи по алфавиту", lettersBar(groups)) +
      groups.map(([l, list]) => `<h2 class="lt" id="l-${l}">${l}</h2><ul class="list abcl">` +
        list.map(([, id, t]) => `<li><a href="${uText(id)}">${esc(listTitle(t))}</a><span class="y">${yearIn(t)}</span></li>`).join("") + `</ul>`).join("");
  }
  function pageTags() {
    const m = allTags(), max = Math.max(1, ...Object.values(m).map(a => a.length));
    const sorted = Object.keys(m).sort((a, b) => a.localeCompare(b, "ru"));
    const groups = grouped(sorted, t => t[0]);
    return crumbs([["Облако тегов"]]) + phead("Облако тегов",
      `<p class="views"><a data-v="cloud" class="on">Облако</a><span class="s">/</span><a data-v="abc">По алфавиту</a></p>` + lettersBar(groups, ' data-view="abc" hidden')) +
      `<div data-view="cloud"><p class="cloud">` + sorted.map(t => `<a href="${uTag(t)}" style="font-size:calc(${15 + Math.round((m[t].length - 1) / Math.max(max - 1, 1) * 11)}px * var(--s))">${esc(t)}</a>`).join(" ") + `</p></div>` +
      `<div data-view="abc" hidden>` + groups.map(([l, list]) => `<h2 class="lt" id="l-${l}">${l}</h2><ul class="list abcl">` +
        list.map(t => `<li><a href="${uTag(t)}">${esc(t)}</a><span class="y">${m[t].length}</span></li>`).join("") + `</ul>`).join("") + `</div>`;
  }

  /* ---------- Log ---------- */
  const MONTHS_GEN = ["января","февраля","марта","апреля","мая","июня","июля","августа","сентября","октября","ноября","декабря"];
  const linkList = ids => ids.map(id => `<a class="ml" href="${uText(id)}">${esc(menuTitle(S.texts[id]))}</a>`).join(", ");
  function logItem(it) {
    if (it.k === "texts") {
      const where = [...new Set(it.ids.map(id => { const { sec, sub } = findText(id); return sec.title + (sub ? " / " + sub.title : ""); }))].join("; ");
      return `<li><span class="lk">${it.ids.length > 1 ? "Добавлены тексты" : "Добавлен текст"}:</span> ${linkList(it.ids)} <span class="y">(${esc(where)})</span></li>`;
    }
    if (it.k === "audio") return `<li><span class="lk">${it.ids.length > 1 ? "Добавлены аудиозаписи" : "Добавлена аудиозапись"}:</span> ${it.ids.map(id => `<a class="ml" href="/zvuk/#s-${id}">${esc(menuTitle(S.texts[id]))}</a>`).join(", ")}</li>`;
    return `<li><span class="lk">Новое на сайте:</span> ${esc(it.text)}</li>`;
  }
  // дежурные записи за месяцы без обновлений добавляет браузер (работает без пересборки сайта)
  function pageLog() {
    const entries = [...S.log].sort((a, b) => b.date.localeCompare(a.date));
    return crumbs([["Log"]]) + phead("Log") + `<div id="logfeed" data-quiet="${attr(JSON.stringify(S.logQuiet))}">` + entries.map(e => {
      const [y, m, d] = e.date.split("-").map(Number);
      return `<section class="logent" data-date="${e.date}"><h2 class="subhead">${d} ${MONTHS_GEN[m - 1]} ${y}</h2>` +
        (e.note ? `<p class="lnote">${esc(e.note)}</p>` : "") + `<ul class="litems">${e.items.map(logItem).join("")}</ul></section>`;
    }).join("") + `</div>`;
  }

  /* ---------- главная ---------- */
  function pageHome() {
    const poems = placed.filter(id => S.texts[id].kind === "poem");
    const id = poems[0], t = S.texts[id];
    const contact = c => c.mail
      ? `<li><span class="k">${esc(c.label)}</span> <a data-m="${c.mail}" href="${CONTACT}"></a></li>`
      : `<li><span class="k">${esc(c.label)}</span> <a href="${attr(c.url)}" target="_blank" rel="noopener">${esc(c.text)}</a></li>`;
    return `<div class="crumbs">&nbsp;</div>
  <h1>${esc(S.home.name)}</h1>
  <p class="subtitle sections">${S.sections.map(s => `<a href="${uSec(s)}">${s.title}</a>`).join("")}<span class="dot">·</span><a href="/zvuk/">Звук</a><span class="dot">·</span><a href="/log/">Log</a></p>

  <section class="block" id="contact-block" style="scroll-margin-top:calc(var(--head) + var(--ph, 0px))">
    ${S.home.intro.map(x => `<p>${esc(x)}</p>`).join("")}
    <ul class="contacts">${S.home.contacts.map(contact).join("")}</ul>
    <p class="social">${S.home.social.map(([k, u]) => `<a href="${attr(u)}" target="_blank" rel="noopener" title="${attr(k)}" aria-label="${attr(k)}">${ICONS[k]}</a>`).join("")}</p>
  </section>

  <section class="block daily">
    <h2>Случайный текст</h2>
    <div class="dscroll" id="dscroll" data-pool="${attr(JSON.stringify(poems.map(uText)))}">
      <h3><a href="${uText(id)}">${t.title ? esc(t.title) : STAR}</a></h3>
      ${body(t)}
      <div class="meta">${metaHtml(t)}</div>
    </div>
  </section>`;
  }

  /* ---------- весь список страниц ---------- */
  const preview = t => noTags(t.body).split("\n").filter(l => l.trim() && !l.startsWith("### ") && l.trim() !== "*").slice(0, 4).map(l => l.replace(/^\|/, "")).join(" / ");
  const pages = [];
  const add = (url, cur, title, main, o = {}) => pages.push({ url, cur, title, main, ...o });
  const feed = (ids, attrs = "") => `<div class="feed"${attrs}>${ids.map(piece).join("")}</div>` + ORN;

  add("/", "home", S.home.name, pageHome(), { home: true });
  for (const s of S.sections) {
    if (s.id === "pyesy") {
      add(uSec(s), s.id, docTitle(s.title), pageDrama(s));
      for (const id of s.texts || []) add(uText(id), id, docTitle(S.texts[id].title), pagePlay(s, id), { desc: S.texts[id].annotation, ogType: "article" });
      continue;
    }
    const groups = s.subs.length ? s.subs.map(u => [u, u.texts]) : (s.texts || []).length ? [[null, s.texts]] : [];
    if (s.subs.length || !(s.texts || []).length) {
      const n = k => k === 1 ? "текст" : (k < 5 ? "текста" : "текстов");
      add(uSec(s), s.id, docTitle(s.title), crumbs([[s.title]]) + phead(s.title) + `<ul class="list">` +
        s.subs.map(u => `<li><a href="${uSub(s, u)}">${u.title}</a><span class="y">${u.texts.length} ${n(u.texts.length)}</span></li>`).join("") + `</ul>`);
    }
    for (const [u, ids] of groups) {
      const path = [[s.title, uSec(s)]]; if (u) path.push([u.title, uSub(s, u)]);
      const head = crumbs(path) + phead(u ? u.title : s.title);
      const feedUrl = u ? uSub(s, u) : uSec(s);
      add(feedUrl, u ? u.id : s.id, docTitle(u ? u.title : s.title), head + feed(ids), { feedPage: true });
      // страница текста: один текст; браузер подгружает всю ленту и останавливается на нём
      for (const id of ids) add(uText(id), id, docTitle(menuTitle(S.texts[id])), head + feed([id], ` data-feed="${feedUrl}" data-target="${id}"`), { feedPage: true, desc: preview(S.texts[id]), ogType: "article" });
    }
  }
  add("/zvuk/", "zvuk", docTitle("Звук"), pageSound("read"));
  add("/zvuk/pesni/", "zvuk-pesni", docTitle("Звук"), pageSound("songs"));
  for (const al of A.albums) add(uAlbum(al), "zvuk-pesni", docTitle(al.title), pageAlbum(al));
  add("/alfavit/", "index", docTitle("Стихи по алфавиту"), pageIndex());
  add("/tags/", "tags", docTitle("Облако тегов"), pageTags());
  for (const [tag, ids] of Object.entries(allTags()))
    add(uTag(tag), "tags", docTitle(tag), crumbs([["Облако тегов", "/tags/"], [tag]]) + phead(tag) + `<ul class="list">` +
      ids.filter(findText).map(id => `<li><a href="${uText(id)}">${esc(listTitle(S.texts[id]))}</a><span class="y">${yearIn(S.texts[id])}</span></li>`).join("") + `</ul>`);
  add("/knigi/", "books", docTitle("Книги и публикации"), crumbs([["Книги и публикации"]]) + phead("Книги и публикации") +
    (S.books.length ? `<h2 class="subhead">Книги</h2><ul class="pubs">` + S.books.map(b => `<li><a href="${uBook(b)}">${esc(b.title)}</a><div class="m">${pubMeta(b)}</div></li>`).join("") + `</ul>` : "") +
    (S.publications.length ? `<h2 class="subhead">Публикации</h2><ul class="pubs">` + S.publications.map(pubItem).join("") + `</ul>` : ""));
  for (const b of S.books)
    add(uBook(b), "books", docTitle(b.title), crumbs([["Книги и публикации", "/knigi/"], [b.title]]) + phead(b.title) + `<div class="bookmeta">${pubMeta(b)}</div><ul class="toc">` +
      bookContents(b).map(name => { const id = findByTitle(name); return id ? `<li><a href="${uText(id)}">${esc(menuTitle(S.texts[id]))}</a></li>` : `<li class="absent">${esc(name)}</li>`; }).join("") + `</ul>`);
  add("/teatr/", "theatre", docTitle("Театр"), crumbs([["Театр"]]) + phead("Театр") +
    (S.playPubs.length ? `<h2 class="subhead">Публикации пьес</h2><ul class="pubs">${S.playPubs.map(pubItem).join("")}</ul>` : "") +
    `<h2 class="subhead">Постановки</h2><ul class="pubs">` + [...S.productions].sort((a, b) => yearOf(b) - yearOf(a)).map(p => prodItem(p)).join("") + `</ul>`);
  for (const p of S.productions.filter(p => !p.url && p.about))
    add(uShow(p), "theatre", docTitle(p.title), crumbs([["Театр", "/teatr/"], [p.title]]) + phead(p.title) + `<div class="bookmeta">${showMeta(p)}</div><p>${esc(p.about)}</p>`);
  add("/log/", "log", docTitle("Log"), pageLog());
  add("/poisk/", "search", docTitle("Поиск"), crumbs([["Поиск"]]) + phead("Поиск") + `<div id="results"></div>`);
  add("/404.html", "404", docTitle("Такой страницы нет"), crumbs([["Страница не найдена"]]) + `<pre class="cat" aria-hidden="true">&gt;^0.o^&lt;</pre>` +
    phead("Такой страницы нет") + `<p class="muted">Возможно, текст переехал или в адресе опечатка. Попробуйте поиск или вернитесь <a class="ml" href="/">на главную</a>.</p>`);

  return pages.map(p => ({ url: p.url, full: layout(p, tree(p.cur)) }));

  function layout(p, treeHtml) {
    const url = SITE_URL + p.url;
    const desc = p.desc ? `<meta name="description" content="${attr(p.desc)}"><meta property="og:description" content="${attr(p.desc)}">` : "";
    return `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(p.title)}</title>
<meta property="og:title" content="${attr(p.title)}"><meta property="og:type" content="${p.ogType || "website"}"><meta property="og:url" content="${attr(url)}">${desc}
<link rel="stylesheet" href="/assets/fonts.css">
<link rel="stylesheet" href="/assets/site.css">
<script>document.documentElement.classList.add("js");try{var a=JSON.parse(localStorage.getItem("a11y")||"{}");if(a.s)document.documentElement.style.setProperty("--s",a.s)}catch(e){}</script>
<script src="/assets/site.js" defer></script>
</head>
<body${p.feedPage ? ' data-feedpage' : ""}>
<script>try{var a=JSON.parse(localStorage.getItem("a11y")||"{}");if(a.f)document.body.classList.add(a.f);if(a.c)document.body.classList.add(a.c);if(localStorage.getItem("sideCollapsed")==="1")document.body.classList.add("collapsed")}catch(e){}if(matchMedia("(max-width:600px)").matches)document.body.classList.add("collapsed")</script>

<div class="layout">
  <nav class="side" id="side">
    <button class="hide-side" id="hideSide" title="Свернуть оглавление">Свернуть</button>
    <div class="tree" id="tree">${treeHtml}</div>
  </nav>
  <main id="main">${p.main}</main>
</div>
<div class="topband" aria-hidden="true"></div>
<div class="metabar" id="metabar"></div>
<div class="a11y" id="a11y">
  <button type="button" aria-label="Настройки чтения" title="Настройки чтения">Aa</button>
  <div class="pane">
    <div><span class="k">Размер</span><a class="opt" data-s="1">A</a><a class="opt" data-s="1.15" style="font-size:1.1em">A</a><a class="opt" data-s="1.3" style="font-size:1.25em">A</a><a class="opt" data-s="1.5" style="font-size:1.4em">A</a></div>
    <div><span class="k">Шрифт</span><a class="opt" data-f="">книжный</a><a class="opt" data-f="f-sans">без засечек</a><a class="opt" data-f="f-easy">удобное чтение</a></div>
    <div><span class="k">Контраст</span><a class="opt" data-c="">обычный</a><a class="opt" data-c="hc">повышенный</a></div>
    <span class="note">«Удобное чтение» -- шрифт без засечек с увеличенными интервалами: так легче читать при дислексии и слабом зрении.</span>
  </div>
</div>
<form class="search" id="search" role="search" action="/poisk/" method="get">
  <input id="q" name="q" type="search" placeholder="Поиск" aria-label="Поиск по текстам">
  <button type="submit" aria-label="Искать"><svg width="13" height="13" viewBox="0 0 16 16" aria-hidden="true"><circle cx="6.5" cy="6.5" r="5" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M10.3 10.3 15 15" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></button>
</form>
<button class="show-side" id="showSide" title="Показать оглавление">Оглавление</button>
</body>
</html>
`;
  }
}
