import { lookup as dnsLookup, type LookupAddress } from "node:dns";
import http from "node:http";
import https from "node:https";
import { isIP } from "node:net";
import zlib from "node:zlib";
import { skippedSite, USER_AGENT } from "./sites";

/**
 * Fetches one public web page for link import, carefully:
 * - http(s) on the standard ports only, no credentials in the URL;
 * - never a private, loopback or link-local address: checked when the socket
 *   connects (not just before), so DNS tricks can't point it inside a network;
 * - redirects followed by hand (up to 3), each one checked again, including
 *   against the skip list;
 * - a short timeout and a size cap.
 */

export class FetchRefused extends Error {
  constructor(
    message: string,
    readonly reason: "invalid" | "private" | "skipped" | "too_large" | "timeout" | "network" | "redirects",
    readonly site?: string
  ) {
    super(message);
  }
}

export type Page = { status: number; contentType: string; body: string; bytes: Buffer; url: URL };

/** True for addresses that aren't on the public internet. */
export function isPrivateAddress(address: string): boolean {
  const kind = isIP(address);
  if (kind === 4) {
    const [a, b] = address.split(".").map(Number) as [number, number, number, number];
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    );
  }
  if (kind === 6) {
    const lower = address.toLowerCase();
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(lower);
    if (mapped) return isPrivateAddress(mapped[1]!);
    return (
      lower === "::" ||
      lower === "::1" ||
      lower.startsWith("fc") ||
      lower.startsWith("fd") ||
      /^fe[89ab]/.test(lower) ||
      lower.startsWith("ff") ||
      lower.startsWith("64:ff9b") ||
      lower.startsWith("2001:db8")
    );
  }
  return true;
}

/** Parses and checks a pasted link. Throws FetchRefused with a plain-words message. */
export function checkUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new FetchRefused("That doesn't look like a link. It should start with https://", "invalid");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new FetchRefused("Only http and https links can be read.", "invalid");
  if (url.username || url.password) throw new FetchRefused("Links with a username or password can't be read.", "invalid");
  if (url.port && url.port !== "80" && url.port !== "443") throw new FetchRefused("Links to unusual ports can't be read.", "invalid");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (isIP(host) || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal") || !host.includes(".")) {
    throw new FetchRefused("Only links to public websites can be read.", "private");
  }
  const site = skippedSite(host);
  if (site) throw new FetchRefused(`${site} doesn't allow apps to read its listings.`, "skipped", site);
  url.hash = "";
  return url;
}

/** A DNS lookup that refuses private addresses, used when the socket connects. */
function guardedLookup(
  hostname: string,
  options: object,
  callback: (err: NodeJS.ErrnoException | null, address: string | LookupAddress[], family?: number) => void
) {
  dnsLookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err, "");
    const list = addresses as LookupAddress[];
    if (!list.length || list.some((a) => isPrivateAddress(a.address))) {
      const refused: NodeJS.ErrnoException = new Error("private address");
      refused.code = "EPRIVATE";
      return callback(refused, "");
    }
    // Node asks for a list when `all` is set, otherwise one address.
    if ((options as { all?: boolean }).all) callback(null, list);
    else callback(null, list[0]!.address, list[0]!.family);
  });
}

function getOnce(url: URL, opts: { timeoutMs: number; maxBytes: number; accept: string }): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: Buffer }> {
  return new Promise((resolve, reject) => {
    const client = url.protocol === "https:" ? https : http;
    const req = client.request(
      url,
      {
        method: "GET",
        lookup: guardedLookup as unknown as http.RequestOptions["lookup"],
        headers: {
          "User-Agent": USER_AGENT,
          Accept: opts.accept,
          "Accept-Language": "en-US,en;q=0.8",
          "Accept-Encoding": "gzip, deflate, br"
        },
        timeout: opts.timeoutMs
      },
      (res) => {
        const status = res.statusCode ?? 0;
        // Redirects carry no body we need.
        if (status >= 300 && status < 400) {
          res.resume();
          return resolve({ status, headers: res.headers, body: Buffer.alloc(0) });
        }
        const encoding = String(res.headers["content-encoding"] ?? "").toLowerCase();
        const stream =
          encoding === "gzip" ? res.pipe(zlib.createGunzip()) : encoding === "deflate" ? res.pipe(zlib.createInflate()) : encoding === "br" ? res.pipe(zlib.createBrotliDecompress()) : res;
        const chunks: Buffer[] = [];
        let size = 0;
        stream.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > opts.maxBytes) {
            req.destroy();
            reject(new FetchRefused("That page is too large to read.", "too_large"));
            return;
          }
          chunks.push(chunk);
        });
        stream.on("end", () => resolve({ status, headers: res.headers, body: Buffer.concat(chunks) }));
        stream.on("error", () => reject(new FetchRefused("Couldn't read that page.", "network")));
      }
    );
    req.on("timeout", () => {
      req.destroy();
      reject(new FetchRefused("That site took too long to answer.", "timeout"));
    });
    req.on("error", (err: NodeJS.ErrnoException) => {
      if (err instanceof FetchRefused) return reject(err);
      reject(
        err.code === "EPRIVATE"
          ? new FetchRefused("Only links to public websites can be read.", "private")
          : new FetchRefused("Couldn't reach that site.", "network")
      );
    });
    req.end();
  });
}

/** GET a page, following up to 3 redirects, each checked like the first link. */
export async function fetchPage(
  start: URL,
  opts: { timeoutMs?: number; maxBytes?: number; accept?: string } = {}
): Promise<Page> {
  const options = { timeoutMs: opts.timeoutMs ?? 8000, maxBytes: opts.maxBytes ?? 2_000_000, accept: opts.accept ?? "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5" };
  let url = start;
  for (let hop = 0; hop <= 3; hop++) {
    const res = await getOnce(url, options);
    if (res.status >= 300 && res.status < 400 && res.headers.location) {
      url = checkUrl(new URL(res.headers.location, url).toString());
      continue;
    }
    return {
      status: res.status,
      contentType: String(res.headers["content-type"] ?? ""),
      body: res.body.toString("utf8"),
      bytes: res.body,
      url
    };
  }
  throw new FetchRefused("That link redirects too many times.", "redirects");
}
