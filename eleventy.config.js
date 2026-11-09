import fs from "node:fs";

export default function (config) {
  const content = process.env.CONTENT_DIR || "content";
  config.addPassthroughCopy({ "src/assets": "assets" });
  config.addPassthroughCopy({ "node_modules/@fontsource/pt-serif/files/*-{cyrillic,latin}-{400,700}-{normal,italic}.woff2": "assets/fonts" });
  config.addPassthroughCopy({ "node_modules/@fontsource/pt-sans/files/*-{cyrillic,latin}-{400,700}-{normal,italic}.woff2": "assets/fonts" });
  if (fs.existsSync(`${content}/audio`)) config.addPassthroughCopy({ [`${content}/audio`]: "audio" });
  config.addWatchTarget(content);
  config.addWatchTarget("lib");
  return { dir: { input: "src", output: "_site" }, templateFormats: ["11ty.js"] };
}
