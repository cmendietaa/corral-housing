// Renders each benchmark case that has `screenshot` into eval/screens/<id>.jpg,
// so text and screenshot extraction are measured on the same listing.
//
//   node eval/render-screens.mjs
//
// Three generic phone-app looks (a group post, a group chat, a listing page),
// none modeled on a real app's branding. Phone width (390 CSS px) at 2x like a
// real screenshot; the "lowres" variant renders at 1x, "dark" in dark mode.
// Output is a JPEG at quality 85 with the long side kept within 2048 px, the
// same limits the browser applies before upload.
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { CASES } from "./cases.ts";

const outDir = fileURLToPath(new URL("./screens/", import.meta.url));
mkdirSync(outDir, { recursive: true });

const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const initials = (name) => name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();

const BASE_CSS = `
  * { box-sizing: border-box; margin: 0; }
  body { width: 390px; font: 15px/1.42 -apple-system, system-ui, sans-serif; background: var(--bg); color: var(--fg); }
  :root { --bg: #f2f2f4; --card: #fff; --fg: #1c1c1e; --muted: #77777c; --line: #e2e2e6; --bubble: #e9e9ee; --mine: #2f7d6d; }
  .dark { --bg: #0e0e10; --card: #1c1c1f; --fg: #ececf0; --muted: #9a9aa2; --line: #2c2c31; --bubble: #2a2a2f; --mine: #3a8f7e; }
  .status { display: flex; justify-content: space-between; padding: 14px 26px 8px; font-weight: 600; background: var(--card); }
  .bar { display: flex; align-items: center; gap: 10px; padding: 8px 16px 12px; background: var(--card); border-bottom: 1px solid var(--line); }
  .bar .back { font-size: 22px; color: var(--muted); }
  .bar h1 { font-size: 16px; font-weight: 700; }
  .bar small { display: block; font-size: 12px; color: var(--muted); font-weight: 400; }
  .avatar { width: 40px; height: 40px; border-radius: 50%; background: #7a9e7e; color: #fff; display: grid; place-items: center; font-weight: 700; flex: none; }
  .pre { white-space: pre-line; }
`;

function page(variant, body, css = "") {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${BASE_CSS}${css}</style></head>
<body class="${variant === "dark" ? "dark" : ""}"><div class="status"><span>9:41</span><span>●●● 84%</span></div>${body}</body></html>`;
}

function post(c, variant) {
  const css = `
    .post { background: var(--card); margin-top: 8px; padding: 14px 16px 6px; }
    .who { display: flex; gap: 10px; align-items: center; } .who b { display: block; } .who span { font-size: 12px; color: var(--muted); }
    .text { margin-top: 10px; }
    .photo { margin: 12px -16px 0; height: 170px; background: linear-gradient(#bfe0f0, #e9f4f8 62%, #9cc59a 62%); }
    .meta { display: flex; justify-content: space-between; font-size: 13px; color: var(--muted); padding: 10px 0; border-bottom: 1px solid var(--line); }
    .actions { display: flex; justify-content: space-around; padding: 8px 0; font-size: 14px; color: var(--muted); font-weight: 600; }`;
  return page(
    variant,
    `<div class="bar"><span class="back">‹</span><h1>IV Housing Exchange<small>Private group · 6.1K members</small></h1></div>
     <div class="post">
       <div class="who"><div class="avatar">AL</div><div><b>Alex L.</b><span>3h · Isla Vista</span></div></div>
       <p class="text pre">${esc(c.text)}</p>
       <div class="photo"></div>
       <div class="meta"><span>♥ 31</span><span>12 comments</span></div>
       <div class="actions"><span>♡ Like</span><span>Comment</span><span>↗ Share</span></div>
     </div>`,
    css
  );
}

function chat(c, variant) {
  const css = `
    .msgs { padding: 10px 12px 24px; display: flex; flex-direction: column; gap: 6px; background: var(--card); min-height: 760px; }
    .m { max-width: 78%; } .m small { display: block; font-size: 11px; color: var(--muted); margin: 6px 0 2px 10px; }
    .m p { background: var(--bubble); border-radius: 18px; padding: 8px 12px; }
    .me { align-self: flex-end; } .me p { background: var(--mine); color: #fff; }`;
  const lines = c.text.split("\n").filter(Boolean).map((line) => {
    const i = line.indexOf(": ");
    const who = i > 0 ? line.slice(0, i) : "";
    const msg = i > 0 ? line.slice(i + 2) : line;
    const mine = who === "Jordan";
    return `<div class="m ${mine ? "me" : ""}">${mine ? "" : `<small>${esc(who)}</small>`}<p>${esc(msg)}</p></div>`;
  });
  return page(
    variant,
    `<div class="bar"><span class="back">‹</span><div class="avatar" style="width:34px;height:34px;font-size:13px">IV</div><h1>house hunt 🏠<small>Maya, Jordan, Sam, Priya, Riley</small></h1></div>
     <div class="msgs">${lines.join("")}</div>`,
    css
  );
}

function listing(c, variant) {
  const css = `
    .url { margin: 0 12px 8px; padding: 8px 12px; border-radius: 10px; background: var(--bubble); font-size: 13px; color: var(--muted); text-align: center; }
    .card { background: var(--card); margin: 8px 12px; border-radius: 14px; padding: 16px; border: 1px solid var(--line); }
    .photo { height: 150px; border-radius: 10px; background: linear-gradient(135deg, #d9d2c3, #b9c7b4); margin-bottom: 14px; }
    h2 { font-size: 18px; line-height: 1.3; margin-bottom: 8px; }
    .btn { margin-top: 16px; padding: 12px; border-radius: 10px; text-align: center; font-weight: 700; background: var(--mine); color: #fff; }`;
  const [first, ...rest] = c.text.split("\n");
  return page(
    variant,
    `<div style="background:var(--card);padding-top:4px"><div class="url">🔒 listings.example</div></div>
     <div class="card"><div class="photo"></div><h2>${esc(first)}</h2><p class="pre">${esc(rest.join("\n"))}</p><div class="btn">Contact about this listing</div></div>`,
    css
  );
}

const TEMPLATES = { post, chat, listing };

const browser = await chromium.launch();
let count = 0;
for (const c of CASES) {
  if (!c.screenshot) continue;
  const variant = c.screenshot.variant ?? "light";
  const scale = variant === "lowres" ? 1 : 2;
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: scale });
  const p = await ctx.newPage();
  await p.setContent(TEMPLATES[c.screenshot.template](c, variant));
  const height = await p.evaluate(() => document.documentElement.scrollHeight);
  if (height * scale > 2048) throw new Error(`${c.id}: ${height * scale}px tall; shorten the text or the template`);
  await p.screenshot({ path: `${outDir}${c.id}.jpg`, type: "jpeg", quality: 85, fullPage: true });
  await ctx.close();
  count++;
}
await browser.close();
console.log(`rendered ${count} screenshots to eval/screens/`);
