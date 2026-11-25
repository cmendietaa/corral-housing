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

function matches(pattern: string, path: string): boolean {
  const anchored = pattern.endsWith("$");
  const body = anchored ? pattern.slice(0, -1) : pattern;
  const regex = body
    .split("*")
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp(`^${regex}${anchored ? "$" : ""}`).test(path);
}

/** Whether `path` (path plus query, e.g. "/listing/12?x=1") may be fetched by `agent`. */
export function robotsAllows(robotsTxt: string, path: string, agent: string): boolean {
  const groups = groupsFor(robotsTxt);
  const token = agent.toLowerCase();
  const rules = [...groups.entries()].find(([name]) => name !== "*" && token.includes(name))?.[1] ?? groups.get("*") ?? [];
  let best: Rule | null = null;
  for (const rule of rules) {
    if (!matches(rule.pattern, path)) continue;
    if (!best || rule.pattern.length > best.pattern.length || (rule.pattern.length === best.pattern.length && rule.allow)) best = rule;
  }
  return best ? best.allow : true;
}
