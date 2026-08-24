/**
 * One-off: stamp test phone lines onto admin-seed Autopoblar infographics for OCR tests.
 * Run: node scripts/stamp-seed-infographic-phones.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = path.join(root, "public", "admin-seed");

const JOBS = [
  { file: "infographic-exact-americana.png", line: "WhatsApp 33 1234 5678" },
  { file: "infographic-exact-mexico.png", line: "WhatsApp 33 3456 7890" },
  { file: "infographic-colonia-providencia.png", line: "Tel 33 4567 8901" },
];

async function stamp({ file, line }) {
  const imgPath = path.join(dir, file);
  const b64 = fs.readFileSync(imgPath).toString("base64");
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setContent(`<!doctype html><html><body style="margin:0">
<canvas id="c"></canvas>
<script>
const line = ${JSON.stringify(line)};
const img = new Image();
img.onload = () => {
  const c = document.getElementById("c");
  const ctx = c.getContext("2d");
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  ctx.drawImage(img, 0, 0);
  const fontSize = Math.max(28, Math.round(c.width * 0.045));
  ctx.font = "700 " + fontSize + "px system-ui, Segoe UI, sans-serif";
  const padX = Math.round(c.width * 0.07);
  const padY = Math.round(c.height * 0.055);
  const metrics = ctx.measureText(line);
  const boxH = fontSize * 1.7;
  const boxW = metrics.width + fontSize * 0.9;
  const x = padX;
  const y = c.height - padY - boxH;
  ctx.fillStyle = "rgba(20, 61, 48, 0.92)";
  ctx.fillRect(x, y, boxW, boxH);
  ctx.strokeStyle = "rgba(168, 224, 16, 0.85)";
  ctx.lineWidth = Math.max(2, Math.round(fontSize * 0.06));
  ctx.strokeRect(x + 1, y + 1, boxW - 2, boxH - 2);
  ctx.fillStyle = "#C8F04A";
  ctx.textBaseline = "middle";
  ctx.fillText(line, x + fontSize * 0.4, y + boxH / 2);
  window.__done = true;
};
img.src = "data:image/png;base64,${b64}";
</script></body></html>`);
  await page.waitForFunction(() => window.__done === true, null, { timeout: 30_000 });
  const dataUrl = await page.evaluate(() => document.getElementById("c").toDataURL("image/png"));
  await browser.close();
  const out = Buffer.from(dataUrl.split(",")[1], "base64");
  fs.writeFileSync(imgPath, out);
  console.log("stamped", file, "→", line, `(${out.length} bytes)`);
}

for (const job of JOBS) {
  await stamp(job);
}
