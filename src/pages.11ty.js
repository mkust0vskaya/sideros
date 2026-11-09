import { loadSite, buildPages } from "../lib/render.js";

const dir = process.env.CONTENT_DIR || "content";

export function data() {
  return {
    permalink: d => d.p.url,
    pagination: { data: "sitePages", size: 1, alias: "p" },
    sitePages: buildPages(loadSite(dir)),
    eleventyExcludeFromCollections: true,
  };
}

export function render(d) {
  return d.p.full;
}
