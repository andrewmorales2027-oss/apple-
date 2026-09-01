import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Collapses the dist-artifact build into one self-contained HTML fragment for the
 * Artifact host, which wraps the file in its own <!doctype>/<head>/<body> — so this emits
 * page content only: title, styles, root, script.
 */
const dist = "dist-artifact";
const assets = readdirSync(join(dist, "assets"));

const js = assets.filter((f) => f.endsWith(".js"));
const css = assets.filter((f) => f.endsWith(".css"));
if (js.length !== 1) throw new Error(`expected exactly one JS chunk, got ${js.length}: ${js}`);
if (css.length !== 1) throw new Error(`expected exactly one CSS file, got ${css.length}: ${css}`);

const styles = readFileSync(join(dist, "assets", css[0]), "utf8");
// A closing script tag anywhere in the bundle (a string, a regex) would end the inline
// script early, so neutralise it.
const script = readFileSync(join(dist, "assets", js[0]), "utf8").replaceAll("</script", "<\\/script");

const html = `<title>The Blackout Meal</title>

<!-- Google Fonts is the one font host the Artifact CSP admits; imported here rather than
     as a <link> because the host owns the document head. -->
<style>
@import url("https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700;800&family=Inter:wght@400;500;600&display=swap");

${styles}
</style>

<div id="root"></div>

<script type="module">
${script}
</script>
`;

writeFileSync("artifact/blackout-meal.html", html);
console.log(`artifact/blackout-meal.html — ${(Buffer.byteLength(html) / 1024 / 1024).toFixed(2)} MB`);
