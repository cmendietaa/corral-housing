import { fetchPage, FetchRefused } from "./fetch-page";
import { robotsAllows } from "./robots";
import { USER_AGENT_TOKEN } from "./sites";

/** RFC 9309: a missing robots.txt allows everything; one that can't be reached means don't read (yet). */
export async function robotsSay(url: URL): Promise<"allow" | "disallow" | "private" | "unreachable" | "skipped"> {
  try {
    const res = await fetchPage(new URL("/robots.txt", url.origin), { timeoutMs: 5000, maxBytes: 500_000, accept: "text/plain,*/*;q=0.5" });
    if (res.status >= 500) return "unreachable";
    if (res.status >= 400) return "allow";
    return robotsAllows(res.body, `${url.pathname}${url.search}`, USER_AGENT_TOKEN) ? "allow" : "disallow";
  } catch (e) {
    // Either way we don't read it; the reason decides what the person is told.
    if (e instanceof FetchRefused && (e.reason === "private" || e.reason === "skipped")) return e.reason;
    return "unreachable";
  }
}

/** For fetchPage's redirects: refuse a new address unless its robots.txt allows it. */
export async function robotsAllowRedirect(to: URL): Promise<void> {
  const say = await robotsSay(to);
  if (say === "allow") return;
  if (say === "private") throw new FetchRefused("Only links to public websites can be read.", "private");
  if (say === "skipped") throw new FetchRefused("That link leads to a site that doesn't allow apps to read its listings.", "skipped");
  throw new FetchRefused(`${to.hostname.replace(/^www\./, "")} asks apps not to read this page.`, "robots");
}
