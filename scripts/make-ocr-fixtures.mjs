// Regenerates OCR fixtures: `node scripts/make-ocr-fixtures.mjs`
// Renders Spanish notes with Chromium as images (a "photo") and as an image-only PDF (a "scan").
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
const { chromium } = createRequire(import.meta.url)("@playwright/test");

const page1 = `<h1>Tema 1. La célula</h1>
<p>La célula es la unidad estructural y funcional de todos los seres vivos.</p>
<p>La mitocondria es el orgánulo donde se produce la respiración celular y se obtiene energía.</p>
<p>El núcleo es la estructura que contiene el material genético de la célula eucariota.</p>`;
const page2 = `<h1>Tema 2. La fotosíntesis</h1>
<p>La fotosíntesis es el proceso por el cual las plantas transforman la energía luminosa en energía química.</p>
<p>La clorofila es el pigmento verde que absorbe la luz en los cloroplastos.</p>`;
const css = `body{font-family:Georgia,serif;font-size:22px;line-height:1.5;padding:40px;width:900px;background:#fbfaf6;color:#222}
h1{font-size:30px}`;

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1000, height: 700 } });
// "Photo": slightly rotated with light noise.
await p.setContent(`<style>${css} body{transform:rotate(-1.2deg);background-image:radial-gradient(#00000010 1px,transparent 1px);background-size:5px 5px}</style>${page1}`);
writeFileSync("tests/fixtures/apuntes-foto.png", await p.screenshot());
writeFileSync("tests/fixtures/apuntes-foto.jpg", await p.screenshot({ type: "jpeg", quality: 70 }));
// "Scan": each page rendered to an image, then embedded in a PDF with no text layer.
const imgs = [];
for (const html of [page1, page2]) {
  await p.setContent(`<style>${css}</style>${html}`);
  imgs.push((await p.screenshot()).toString("base64"));
}
await p.setContent(imgs.map((s) => `<img src="data:image/png;base64,${s}" style="width:100%;page-break-after:always">`).join(""));
writeFileSync("tests/fixtures/apuntes-escaneados.pdf", await p.pdf({ format: "A4", margin: { top: "1cm", bottom: "1cm" } }));
await b.close();
console.log("fixtures ok");
