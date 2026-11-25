/**
 * A small robots.txt reader (RFC 9309): pick the group for our user agent, or
 * the `*` group, then the longest matching Allow/Disallow rule wins (Allow on a
 * tie). Supports `*` wildcards and a trailing `$`.
 */

type Rule = { allow: boolean; pattern: string };

function groupsFor(text: string): Map<string, Rule[]> {
  const groups = new Map<string, Rule[]>();
  let agents: string[] = [];
  let lastWasAgent = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, "").trim();
    const m = /^([A-Za-z-]+)\s*:\s*(.*)$/.exec(line);
    if (!m) continue;
    const key = m[1]!.toLowerCase();
    const value = m[2]!.trim();
    if (key === "user-agent") {
      if (!lastWasAgent) agents = [];
      agents.push(value.toLowerCase());
      for (const a of agents) if (!groups.has(a)) groups.set(a, []);
      lastWasAgent = true;
    } else if (key === "allow" || key === "disallow") {
      lastWasAgent = false;
      // An empty Disallow means "nothing is disallowed"; it adds no rule.
      if (value === "") continue;
      for (const a of agents) groups.get(a)!.push({ allow: key === "allow", pattern: value });
    } else {
      lastWasAgent = false;
    }
  }
  return groups;
}

/**
 * RFC 9309 compares paths in one form: non-ASCII characters percent-encoded
 * (so /café is /caf%C3%A9), percent-encoded unreserved characters decoded (so
 * /%70rivate is /private), and reserved ones kept encoded (%2F isn't /).
 */
function normalize(path: string): string {
  const encoded = path.replace(/[^\x00-\x7F]/gu, (ch) => {
    try {
      return encodeURIComponent(ch);
    } catch {
      return ch; // a lone surrogate can't be encoded; leave it
    }
  });
  return encoded.replace(/%([0-9a-fA-F]{2})/g, (m, hex: string) => {
    const ch = String.fromCharCode(parseInt(hex, 16));
    return /[A-Za-z0-9\-._~]/.test(ch) ? ch : m.toUpperCase();
  });
}

/**
 * `*` matches any run of characters; a trailing `$` means the path must end
 * there; otherwise the rule matches as a prefix. Greedy matching with one
 * backtrack point, so it stays O(rule × path) whatever the rule looks like.
 */
function matches(pattern: string, path: string): boolean {
  const anchored = pattern.endsWith("$");
  const rule = anchored ? pattern.slice(0, -1) : pattern;
  let r = 0;
  let p = 0;
  let star = -1;
  let starP = 0;
  while (p < path.length) {
    if (r < rule.length && rule[r] === "*") {
      star = r++;
      starP = p;
    } else if (r < rule.length && rule[r] === path[p]) {
      r++;
      p++;
    } else if (r === rule.length && !anchored) {
      return true;
    } else if (star >= 0) {
      r = star + 1;
      p = ++starP;
    } else {
      return false;
    }
  }
  while (r < rule.length && rule[r] === "*") r++;
  return r === rule.length;
}

/** Whether `path` (path plus query, e.g. "/listing/12?x=1") may be fetched by `agent`. */
export function robotsAllows(robotsTxt: string, path: string, agent: string): boolean {
  const groups = groupsFor(robotsTxt);
  const token = agent.toLowerCase();
  // Our own group by its exact name (names are stored lower-case), else `*`.
  const rules = groups.get(token) ?? groups.get("*") ?? [];
  const target = normalize(path);
  // The most specific rule wins, measured in the same normalized form it was matched in.
  let best: { allow: boolean; length: number } | null = null;
  for (const rule of rules) {
    const pattern = normalize(rule.pattern);
    if (!matches(pattern, target)) continue;
    if (!best || pattern.length > best.length || (pattern.length === best.length && rule.allow)) best = { allow: rule.allow, length: pattern.length };
  }
  return best ? best.allow : true;
}
