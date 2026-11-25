import { lookup as dnsLookup, type LookupAddress } from "node:dns";
import http from "node:http";
import https from "node:https";
import { isIP } from "node:net";
import { pipeline } from "node:stream";
import zlib from "node:zlib";
import { skippedSite, USER_AGENT } from "./sites";

/**
 * Fetches one public web page for link import, carefully:
 * - http(s) on the standard ports only, no credentials in the URL;
 * - never a private, loopback or link-local address: checked when the socket
 *   connects (not just before), so DNS tricks can't point it inside a network;
 * - redirects followed by hand (up to 3), each one checked again, including
 *   against the skip list (and robots.txt, when the caller asks);
 * - a time limit on the whole request, not just quiet sockets, and a size cap.
 */

export class FetchRefused extends Error {
  constructor(
    message: string,
    readonly reason: "invalid" | "private" | "skipped" | "robots" | "too_large" | "timeout" | "network" | "redirects",
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
    let settled = false;
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(deadline);
      fn();
    };
    const fail = (err: FetchRefused) => {
      finish(() => reject(err));
      req.destroy();
    };
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
        // A redirect's body isn't needed: drop it rather than drain it.
        if (status >= 300 && status < 400) {
          finish(() => resolve({ status, headers: res.headers, body: Buffer.alloc(0) }));
          res.destroy();
          return;
        }
        const encoding = String(res.headers["content-encoding"] ?? "").toLowerCase();
        const decoder =
          encoding === "gzip" ? zlib.createGunzip() : encoding === "deflate" ? zlib.createInflate() : encoding === "br" ? zlib.createBrotliDecompress() : null;
        const chunks: Buffer[] = [];
        let size = 0;
        const collect = async function* (source: AsyncIterable<Buffer>) {
          for await (const chunk of source) {
            size += chunk.length;
            if (size > opts.maxBytes) throw new FetchRefused("That page is too large to read.", "too_large");
            chunks.push(chunk);
          }
        };
        // pipeline passes a failure in any stream (a dropped connection, bad
        // compression, the size cap) to the end and closes them all.
        const done = (err: NodeJS.ErrnoException | null) => {
          if (!err) return finish(() => resolve({ status, headers: res.headers, body: Buffer.concat(chunks) }));
          fail(err instanceof FetchRefused ? err : new FetchRefused("Couldn't read that page.", "network"));
        };
        if (decoder) pipeline(res, decoder, collect, done);
        else pipeline(res, collect, done);
      }
    );
    // The socket timeout only notices silence; this caps the whole request.
    const deadline = setTimeout(() => fail(new FetchRefused("That site took too long to answer.", "timeout")), opts.timeoutMs);
    req.on("timeout", () => fail(new FetchRefused("That site took too long to answer.", "timeout")));
    req.on("error", (err: NodeJS.ErrnoException) => {
      if (err instanceof FetchRefused) return fail(err);
      fail(
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
  opts: { timeoutMs?: number; maxBytes?: number; accept?: string; beforeRedirect?: (to: URL) => Promise<void> } = {}
): Promise<Page> {
  const options = { timeoutMs: opts.timeoutMs ?? 8000, maxBytes: opts.maxBytes ?? 2_000_000, accept: opts.accept ?? "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5" };
  let url = start;
  for (let hop = 0; hop <= 3; hop++) {
    const res = await getOnce(url, options);
    if (res.status >= 300 && res.status < 400 && res.headers.location) {
      url = checkUrl(new URL(res.headers.location, url).toString());
      // e.g. robots.txt for the new address, checked before it's fetched.
      await opts.beforeRedirect?.(url);
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
