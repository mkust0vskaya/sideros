// Разовый перенос данных из prototype/index.html.
// content/ получает только настоящие данные; prototype/content-demo/ (не в хранилище) -- всё, включая заглушки,
// чтобы сверять вид и поведение с прототипом.
import fs from "node:fs";

const html = fs.readFileSync("prototype/index.html", "utf8");
const from = html.indexOf("const SITE = {");
const to = html.indexOf("/* ---------- фирменная пунктуация");
const SITE = new Function(html.slice(from, to) + "\nreturn SITE;")();

const dashes = x => x == null ? x : x.replace(/\s*—\s*/g, m => m.startsWith("\n") ? "\n-- " : " -- ")
  .replace(/(^|\n)\s*--\s*/g, "$1-- ")
  .replace(/ – /g, " -- ");
for (const t of Object.values(SITE.texts)) {
  t.body = dashes(t.body); t.annotation = dashes(t.annotation); if (t.title) t.title = dashes(t.title);
}

// Адрес почты в хранилище и в готовых страницах открытым текстом не хранится.
const hideMail = home => ({
  ...home,
  contacts: home.contacts.map(([k, v, u]) => u.startsWith("mailto:")
    ? { label: k, mail: Buffer.from([...v].reverse().join("")).toString("base64") }
    : { label: k, text: v, url: u }),
});

const write = (dir, name, data) => {
  fs.mkdirSync(`${dir}/texts`, { recursive: true });
  fs.writeFileSync(`${dir}/${name}.json`, JSON.stringify(data, null, 1) + "\n");
};
const pick = ids => Object.fromEntries(ids.map(id => [id, SITE.texts[id]]));
const subTexts = id => SITE.sections[0].subs.find(u => u.id === id).texts;

// Настоящее содержимое. Даты публикации пустые: тексты первого запуска значка «new» не получают.
const launch = ids => Object.fromEntries(Object.entries(pick(ids)).map(([id, t]) => [id, { ...t, published: null }]));
const real = "content";
write(real, "home", hideMail(SITE.home));
write(real, "sections", [
  { id: "stihi", title: "Стихи", subs: SITE.sections[0].subs },
  { id: "pyesy", title: "Пьесы", subs: [], texts: [] },
  { id: "proza", title: "Проза", subs: [] },
]);
write(real, "books", { books: SITE.books, publications: SITE.publications });
write(real, "theatre", { playPubs: SITE.playPubs, productions: SITE.productions });
write(real, "log", { entries: [], quiet: SITE.logQuiet });
write(real, "sound", { readings: [], albums: [], covers: [] });
write(real, "texts/stihi-2026", launch(subTexts("stihi-2026")));
write(real, "texts/stihi-2025", launch(subTexts("stihi-2025")));

// Демо: всё как в прототипе.
const demo = "prototype/content-demo";
write(demo, "home", hideMail(SITE.home));
write(demo, "sections", SITE.sections);
write(demo, "books", { books: SITE.books, publications: SITE.publications });
write(demo, "theatre", { playPubs: SITE.playPubs, productions: SITE.productions });
write(demo, "log", { entries: SITE.log, quiet: SITE.logQuiet });
write(demo, "sound", SITE.audio);
write(demo, "texts/all", SITE.texts);
fs.mkdirSync(`${demo}/audio`, { recursive: true });
fs.copyFileSync("prototype/audio/sluchay-na-severe.mp3", `${demo}/audio/sluchay-na-severe.mp3`);

console.log("texts:", Object.keys(SITE.texts).length, "books:", SITE.books.length, "pubs:", SITE.publications.length, "prods:", SITE.productions.length);
