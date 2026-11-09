// Разбор Google Документа со стихами (ответ Google Docs API, documents.get) в content/texts/<имя>.json.
// Запуск: node scripts/gdoc-poems.mjs <ответ.json> <имя-файла> [--write]
// Без --write только показывает сводку изменений и вопросы к автору (CLAUDE.md, «Порядок работы с новым документом»).
import fs from "node:fs";

const [src, name, flag] = process.argv.slice(2);
const out = `content/texts/${name}.json`;
const doc = JSON.parse(fs.readFileSync(src, "utf8"));
const tab = (doc.content || doc).tabs[0].documentTab;
const old = fs.existsSync(out) ? JSON.parse(fs.readFileSync(out, "utf8")) : {};
const notes = [];   // вопросы к автору

/* ---------- автоматические правила оформления (п. 2) ---------- */
const typo = s => s
  .replace(/[  ]*[—–][  ]*(?=\D|$)/g, (m, i, str) => /\d$/.test(str.slice(0, i)) && /^\d/.test(str.slice(i + m.length)) ? m : " -- ")
  .replace(/^ -- /, "-- ")
  .replace(/“([^”]*)”/g, "«$1»").replace(/„([^“”]*)[“”]/g, "«$1»")
  .replace(/(^|[\s(«])"([^"]*)"/g, "$1«$2»")
  .replace(/[  ]{2,}/g, " ").replace(/[  ]+$/, "");
const TR = { а:"a",б:"b",в:"v",г:"g",д:"d",е:"e",ё:"e",ж:"zh",з:"z",и:"i",й:"y",к:"k",л:"l",м:"m",н:"n",о:"o",п:"p",р:"r",с:"s",т:"t",у:"u",ф:"f",х:"kh",ц:"ts",ч:"ch",ш:"sh",щ:"shch",ъ:"",ы:"y",ь:"",э:"e",ю:"yu",я:"ya" };
const slug = s => [...s.toLowerCase()].map(c => TR[c] ?? c).join("").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").split("-").slice(0, 3).join("-");
// название капслоком -> обычный регистр; сокращения вида «Ф.М.» не трогаем
const caseTitle = s => s === s.toUpperCase() && /[А-ЯЁA-Z]{2}/.test(s)
  ? s.split(/(\s+)/).map((w, i) => /^([А-ЯЁA-Z]\.)+$/.test(w) ? w : (i === 0 ? w[0] + w.slice(1).toLowerCase() : w.toLowerCase())).join("")
  : s;
const norm = s => s.toLowerCase().replace(/ё/g, "е").replace(/[^a-zа-я0-9]+/g, " ").trim();

/* ---------- кегль: основной размер документа ---------- */
const base = tab.namedStyles.styles.find(s => s.namedStyleType === "NORMAL_TEXT").textStyle.fontSize?.magnitude || 11;
const red = c => { const r = c?.color?.rgbColor; return r && (r.red || 0) > 0.9 && (r.green || 0) < 0.2 && (r.blue || 0) < 0.2; };

/* ---------- абзацы -> строки с разметкой ---------- */
function runsToLines(p, ctx) {
  let line = "", lines = [];
  for (const e of p.elements) {
    if (!e.textRun) { if (!e.pageBreak && !e.horizontalRule) notes.push(`${ctx}: в документе есть объект, который сайт не показывает (${Object.keys(e).join(", ")}).`); continue; }
    const s = e.textRun.textStyle || {};
    const odd = [s.underline && !s.link && "подчёркивание", s.strikethrough && "зачёркивание", s.backgroundColor?.color && "выделение фоном",
      s.foregroundColor?.color?.rgbColor && !red(s.foregroundColor) && "цветной текст", s.link && "ссылка"].filter(Boolean);
    const parts = e.textRun.content.replace(/\n$/, "").split("\u000b");
    parts.forEach((t, i) => {
      if (i) { lines.push(line); line = ""; }
      if (!t) return;
      if (odd.length && t.trim()) notes.push(`${ctx}: «${t.trim()}» -- ${odd.join(", ")}. Переносить на сайт?`);
      let h = t;
      const size = s.fontSize?.magnitude;
      if (size && size !== base && t.trim()) h = `<span style="font-size:${+(size / base).toFixed(2)}em">${h}</span>`;
      if (s.italic && t.trim()) h = `<i>${h}</i>`;
      if (s.bold && t.trim()) h = `<b>${h}</b>`;
      line += h;
    });
  }
  lines.push(line);
  return lines.map(l => l.replace(/<\/(i|b)><\1>/g, ""));
}

/* ---------- структура ---------- */
const META = { "Время": "date", "Место": "place", "Цикл": "cycle", "Книга": "book", "Теги": "tags" };
const sections = [];   // подразделы (Заголовок 1)
let sub = null, text = null;
const texts = {};
const finish = () => {
  if (!text) return;
  const b = text.lines.join("\n").replace(/\n{3,}/g, "\n\n").replace(/^\n+|\n+$/g, "");
  text.body = b;
  delete text.lines;
};
for (const el of tab.body.content) {
  if (!el.paragraph) { if (el.table) notes.push("В документе есть таблица -- сайт её не показывает."); continue; }
  const p = el.paragraph, st = p.paragraphStyle.namedStyleType;
  const plain = p.elements.map(e => e.textRun?.content || "").join("").replace(/\n$/, "").replace(/\u000b/g, " ").trim();
  // серый курсивный блок «КАК ЗАПОЛНЯТЬ» и пустые заголовки пропускаем
  if (st === "HEADING_1") { finish(); text = null; if (plain) { sub = { title: plain, texts: [] }; sections.push(sub); } continue; }
  if (st === "HEADING_2") {
    finish();
    if (!sub) { notes.push(`«${plain}» стоит до первого «Заголовка 1» (года) -- к какому подразделу он относится?`); sub = { title: "?", texts: [] }; sections.push(sub); }
    const star = /^\*\s*\*\s*\*$/.test(plain);
    text = { title: star ? null : typo(caseTitle(plain)), titleDoc: plain, kind: "poem", lines: [], date: null, place: null, cycle: null, book: null, tags: [] };
    sub.texts.push(text);
    continue;
  }
  if (!text) continue;
  if (st === "HEADING_3") { text.lines.push("", "### " + typo(plain), ""); continue; }
  if (st !== "NORMAL_TEXT") notes.push(`«${text.title || plain}»: абзац «${plain.slice(0, 40)}» оформлен стилем ${st} -- это заголовок или обычный текст?`);
  const m = plain.match(/^(Время|Место|Цикл|Книга|Теги)\s*:\s*(.*)$/);
  if (m) {
    let v = typo(m[2].trim()).replace(/,$/, "").trim();
    const k = META[m[1]];
    if (k === "tags") text.tags = v ? v.split(/\s*,\s*/).filter(Boolean) : [];
    else if (k === "book") text.book = v.replace(/^«(.*)»$/, "$1") || null;
    else text[k] = v || null;
    continue;
  }
  for (const l of runsToLines(p, `«${text.title || "* * *"}»`)) text.lines.push(typo(l));
}
finish();

/* ---------- адреса и даты публикации: у знакомых текстов сохраняются ---------- */
const oldByTitle = {};
for (const [id, t] of Object.entries(old)) oldByTitle[norm(t.title || t.body.split("\n")[0])] = id;
const used = new Set();
const result = {};
for (const u of sections) for (const t of u.texts) {
  const key = norm(t.title || t.body.split("\n")[0]);
  let id = oldByTitle[key];
  if (!id) { id = slug(t.title || t.body.split("\n")[0].replace(/<[^>]+>/g, "")); while (used.has(id) || (old[id] && oldByTitle[key] !== id)) id += "-2"; }
  used.add(id);
  const { titleDoc, ...rest } = t;
  // у новых текстов каждое название, переведённое из капслока, показываем автору (имена собственные теряют заглавную)
  if (!old[id] && t.title && titleDoc !== t.title && titleDoc === titleDoc.toUpperCase()) notes.push(`Название «${titleDoc}» -> «${t.title}»: регистр верный?`);
  result[id] = { published: old[id]?.published ?? null, title: rest.title, kind: rest.kind, date: rest.date, place: rest.place, cycle: rest.cycle, book: rest.book, tags: rest.tags, body: rest.body };
  if (!t.date) notes.push(`«${t.title || id}»: не заполнено поле «Время».`);
}

/* ---------- сводка ---------- */
const report = [];
const lines = s => s.split("\n");
for (const [id, t] of Object.entries(result)) {
  const o = old[id];
  if (!o) { report.push(`+ новый текст: «${t.title || t.body.split("\n")[0].replace(/<[^>]+>/g, "") + "…"}» (адрес: ${id})`); continue; }
  for (const k of ["title", "date", "place", "cycle", "book"]) if ((o[k] ?? null) !== (t[k] ?? null)) report.push(`~ «${t.title}»: ${k}: «${o[k]}» -> «${t[k]}»`);
  if (JSON.stringify(o.tags) !== JSON.stringify(t.tags)) report.push(`~ «${t.title}»: теги: ${o.tags.join(", ")} -> ${t.tags.join(", ")}`);
  if (o.body !== t.body) {
    const a = lines(o.body), b = lines(t.body);
    let shown = 0;
    for (let i = 0; i < Math.max(a.length, b.length) && shown < 6; i++) if (a[i] !== b[i]) { report.push(`~ «${t.title}», строка ${i + 1}: «${a[i] ?? ""}» -> «${b[i] ?? ""}»`); shown++; }
    if (a.length !== b.length) report.push(`  (строк было ${a.length}, стало ${b.length})`);
  }
}
for (const id of Object.keys(old)) if (!result[id]) report.push(`- пропал текст: «${old[id].title || id}» (${id}) -- удалён или переименован?`);
// теги сверяются со всем сайтом, а не только с этим документом
const allTags = new Set(fs.readdirSync("content/texts").filter(f => f.endsWith(".json"))
  .flatMap(f => Object.values(JSON.parse(fs.readFileSync("content/texts/" + f, "utf8"))).flatMap(t => t.tags)));
for (const t of Object.values(result)) for (const g of t.tags) if (!allTags.has(g)) { allTags.add(g); report.push(`? новый тег «${g}» -- новый или вариант существующего?`); }

console.log(`Документ: ${(doc.content || doc).title}; подразделы: ${sections.map(s => s.title + " (" + s.texts.length + ")").join(", ")}`);
console.log(report.length ? report.join("\n") : "Изменений по сравнению с content/ нет.");
if (notes.length) console.log("\nВопросы к автору:\n" + [...new Set(notes)].map((n, i) => `${i + 1}. ${n}`).join("\n"));
if (flag === "--write") { fs.writeFileSync(out, JSON.stringify(result, null, 1) + "\n"); console.log("\nЗаписано: " + out); }
