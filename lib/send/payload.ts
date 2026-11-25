import { z } from "zod";

/**
 * Send to Corral: what a person's browser sends about the listing they're
 * looking at. It's read from their own screen (rendered text, rent included),
 * so Corral never contacts the listing site.
 *
 * Two ways in:
 * - Desktop bookmark: opens /send in a new tab and hands the page over with
 *   postMessage (never in the address, so it stays out of logs and history).
 * - iPhone Shortcut: opens /send#p=<base64url>. The part after # is never sent
 *   to a server, and /send clears it as soon as it's read.
 */

export const MAX_SENT_TEXT = 40_000;

export const sentPageSchema = z.object({
  v: z.literal(1).optional(),
  url: z
    .string()
    .trim()
    .max(2000)
    .regex(/^https?:\/\/\S+$/i),
  title: z.string().max(500).default(""),
  text: z.string().max(MAX_SENT_TEXT),
  ld: z.array(z.string().max(20_000)).max(5).default([]),
  /** Photo addresses on the page (large images, the share image), for the person to pick from. */
  images: z.array(z.string().max(2000)).max(12).default([])
});

export type SentPage = z.infer<typeof sentPageSchema>;

/** Read a page from /send's #p= fragment. Null if it's missing or malformed. */
export function decodeFragment(hash: string): SentPage | null {
  const m = /[#&]p=([A-Za-z0-9_-]+)/.exec(hash);
  if (!m) return null;
  try {
    const b64 = m[1]!.replace(/-/g, "+").replace(/_/g, "/");
    const bytes = Uint8Array.from(atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4)), (c) => c.charCodeAt(0));
    const parsed = sentPageSchema.safeParse(JSON.parse(new TextDecoder().decode(bytes)));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** The inverse, for tests and for anything that builds a /send link. */
export function encodeFragment(page: SentPage): string {
  const bytes = new TextEncoder().encode(JSON.stringify(page));
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return `p=${btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")}`;
}

/** The message a /send tab receives from the bookmark. */
export function readMessage(data: unknown): SentPage | null {
  if (!data || typeof data !== "object" || (data as { type?: unknown }).type !== "corral:page") return null;
  const parsed = sentPageSchema.safeParse((data as { page?: unknown }).page);
  return parsed.success ? parsed.data : null;
}

/** The desktop bookmark ("bookmarklet") for a Corral at `origin`. */
export function bookmarklet(origin: string): string {
  const code =
    `(()=>{const O=${JSON.stringify(origin)};` +
    `const d={v:1,url:location.href,title:document.title,` +
    `text:((document.body&&document.body.innerText)||"").slice(0,${MAX_SENT_TEXT}),` +
    `ld:[...document.querySelectorAll('script[type="application/ld+json"]')].slice(0,5).map(s=>(s.textContent||"").slice(0,20000)),` +
    // Large <img>s, then large elements' background images (many galleries use those), then the share image.
    `images:[...new Set([...[...document.images].filter(i=>i.naturalWidth>=400&&i.naturalHeight>=250).map(i=>i.currentSrc||i.src),` +
    `...[...document.querySelectorAll("body *")].filter(e=>e.offsetWidth>=300&&e.offsetHeight>=200).map(e=>(getComputedStyle(e).backgroundImage.match(/url\\(["']?([^"')]+)/)||[])[1]),` +
    `document.querySelector('meta[property="og:image"]')?.content].filter(u=>u&&/^https?:/.test(u)))].slice(0,12)};` +
    `const w=window.open(O+"/send","corral-send");` +
    `if(!w){alert("Let this site open a window, then try Send to Corral again.");return}` +
    `const f=e=>{if(e.origin===O&&e.source===w&&e.data==="corral:ready"){removeEventListener("message",f);w.postMessage({type:"corral:page",page:d},O)}};` +
    `addEventListener("message",f)})()`;
  return `javascript:${encodeURIComponent(code)}`;
}

/** The script for the iPhone Shortcut's "Run JavaScript on Web Page" step. */
export function shortcutScript(origin: string): string {
  return [
    `var d = { v: 1, url: location.href, title: document.title,`,
    `  text: ((document.body && document.body.innerText) || "").slice(0, 12000),`,
    `  ld: Array.prototype.slice.call(document.querySelectorAll('script[type="application/ld+json"]'), 0, 3)`,
    `    .map(function (s) { return (s.textContent || "").slice(0, 8000); }),`,
    `  images: Array.prototype.slice.call(document.images).filter(function (i) { return i.naturalWidth >= 400 && i.naturalHeight >= 250; })`,
    `    .map(function (i) { return i.currentSrc || i.src; })`,
    `    .concat(Array.prototype.slice.call(document.querySelectorAll("body *")).filter(function (e) { return e.offsetWidth >= 300 && e.offsetHeight >= 200; })`,
    `      .map(function (e) { var m = getComputedStyle(e).backgroundImage.match(/url\\(["']?([^"')]+)/); return m ? m[1] : ""; }))`,
    `    .filter(function (u, n, a) { return /^https?:/.test(u) && a.indexOf(u) === n; }).slice(0, 8) };`,
    `var b = btoa(unescape(encodeURIComponent(JSON.stringify(d)))).replace(/\\+/g, "-").replace(/\\//g, "_").replace(/=+$/, "");`,
    `completion(${JSON.stringify(origin)} + "/send#p=" + b);`
  ].join("\n");
}

/** Hand-off between /send and the board it adds to, within this tab. */
export const INCOMING_KEY = "corral:incoming";
export type Incoming = { boardId: string; page: SentPage };
