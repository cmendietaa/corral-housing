/**
 * Sites whose terms of use forbid automated access to their listings. Corral
 * never fetches these links: it keeps the link and asks for the text or a
 * screenshot instead. Their robots.txt files would allow some listing pages,
 * but the terms are what count.
 */
const SKIP: { name: string; domains: string[] }[] = [
  { name: "Zillow", domains: ["zillow.com", "zillowstatic.com", "trulia.com", "hotpads.com", "streeteasy.com"] },
  { name: "Apartments.com", domains: ["apartments.com", "apartmentfinder.com", "forrent.com", "apartmenthomeliving.com"] },
  { name: "Craigslist", domains: ["craigslist.org"] },
  { name: "Realtor.com", domains: ["realtor.com", "rdcpix.com"] },
  { name: "Redfin", domains: ["redfin.com", "cdn-redfin.com", "rent.com", "apartmentguide.com"] },
  { name: "Facebook", domains: ["facebook.com", "fb.com", "fbcdn.net", "instagram.com", "cdninstagram.com"] }
];

/** The site's name if Corral doesn't read its pages, else null. Matches the domain and its subdomains. */
export function skippedSite(hostname: string): string | null {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  for (const site of SKIP) {
    if (site.domains.some((d) => host === d || host.endsWith(`.${d}`))) return site.name;
  }
  return null;
}

/** The User-Agent Corral sends, and the token it looks for in robots.txt. */
export const USER_AGENT_TOKEN = "CorralLinkPreview";
export const USER_AGENT = `Mozilla/5.0 (compatible; ${USER_AGENT_TOKEN}/1.0; fetches one page a person pasted)`;
