/**
 * Pure rules for spotting URLs that should not appear in a reference list:
 * library-database links, institutional proxy links, and academic social
 * networks. No Zotero dependency, so everything here is unit-tested in Node
 * (test/unit/links.test.ts).
 *
 * APA 7 says not to include database URLs for works found in
 * academic research databases; the same goes for proxy links, which only
 * work for members of one university.
 */

export type LinkKind = "database" | "proxy" | "network";

export interface LinkMatch {
  kind: LinkKind;
  /** Human-readable source shown in the confirmation, e.g. "EBSCO". */
  source: string;
  host: string;
}

const DATABASES: [RegExp, string][] = [
  [/(^|\.)ebscohost\.com$/, "EBSCO"],
  [/(^|\.)ebsco\.com$/, "EBSCO"],
  [/(^|\.)proquest\.com$/, "ProQuest"],
  [/(^|\.)jstor\.org$/, "JSTOR"],
  [/(^|\.)gale\.com$/, "Gale"],
  [/(^|\.)galegroup\.com$/, "Gale"],
  [/(^|\.)webofscience\.com$/, "Web of Science"],
  [/(^|\.)webofknowledge\.com$/, "Web of Science"],
  [/(^|\.)scopus\.com$/, "Scopus"],
  [/(^|\.)nexisuni\.com$/, "Nexis Uni"],
  [/(^|\.)factiva\.com$/, "Factiva"],
];

const NETWORKS: [RegExp, string][] = [
  [/(^|\.)researchgate\.net$/, "ResearchGate"],
  [/(^|\.)academia\.edu$/, "Academia.edu"],
  [/(^|\.)semanticscholar\.org$/, "Semantic Scholar"],
  [/(^|\.)scholar\.google\.[a-z.]+$/, "Google Scholar"],
];

// Proxy hosts rewrite the publisher's host ("www.jstor.org.libproxy.example.edu"),
// so they are checked before the database list.
const PROXY_HOSTS = [
  /(^|[.-])(lib)?proxy[0-9]*\./,
  /(^|[.-])ezp(roxy)?[0-9]*[.-]/,
  /\.idm\.oclc\.org$/,
];
const PROXY_PATHS = [/\/login\?(qurl|url)=/i];

/**
 * Item types whose reference-list entry should not carry a database link.
 * Web pages, blog posts, datasets, software etc. are excluded: for those the
 * URL is the point.
 */
export const CLEANABLE_TYPES = new Set([
  "journalArticle",
  "conferencePaper",
  "book",
  "bookSection",
  "thesis",
  "report",
  "magazineArticle",
  "newspaperArticle",
  "encyclopediaArticle",
]);

function parseUrl(url: string): URL | null {
  let s = url.trim();
  // Some imports store links without a scheme ("www.jstor.org/stable/1")
  if (/^[a-z0-9-]+(\.[a-z0-9-]+)+(\/|$)/i.test(s)) s = `https://${s}`;
  try {
    const parsed = new URL(s);
    return /^https?:$/.test(parsed.protocol) ? parsed : null;
  } catch {
    return null;
  }
}

/** Classifies a URL, or returns null when it is an ordinary link to keep. */
export function classifyLink(url: string | null | undefined): LinkMatch | null {
  if (!url) return null;
  const parsed = parseUrl(url);
  if (!parsed) return null;
  const host = parsed.hostname.toLowerCase();

  if (
    PROXY_HOSTS.some((re) => re.test(host)) ||
    PROXY_PATHS.some((re) => re.test(parsed.pathname + parsed.search))
  ) {
    return { kind: "proxy", source: "Library proxy", host };
  }
  for (const [re, source] of DATABASES) {
    if (re.test(host)) return { kind: "database", source, host };
  }
  for (const [re, source] of NETWORKS) {
    if (re.test(host)) return { kind: "network", source, host };
  }
  return null;
}

export interface ItemFields {
  itemType: string;
  url?: string;
  DOI?: string;
  extra?: string;
}

function hasDoi(item: ItemFields): boolean {
  if (item.DOI?.trim()) return true;
  // Types without a DOI field keep it in Extra ("DOI: 10.…"), which citation
  // styles read too.
  return /^\s*DOI:\s*10\.\S+/im.test(item.extra ?? "");
}

/**
 * The link to remove from an item, or null to leave it alone. Items with a
 * DOI are skipped: styles print the DOI instead of the URL, so the link never
 * reaches the reference list.
 */
export function linkToRemove(item: ItemFields): LinkMatch | null {
  if (!CLEANABLE_TYPES.has(item.itemType)) return null;
  if (hasDoi(item)) return null;
  return classifyLink(item.url);
}

export interface PlannedRemoval {
  /** e.g. "Langley (1999)" */
  citation: string;
  title: string;
  match: LinkMatch;
}

function shorten(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1).trimEnd() + "…" : s;
}

/**
 * One line per item for the confirmation dialog, capped at `limit` lines
 * with a final "…and N more" line.
 */
export function formatRemovalList(
  removals: PlannedRemoval[],
  limit = 15,
): string {
  const lines = removals
    .slice(0, limit)
    .map(
      (r) => `• ${r.citation} — ${shorten(r.title, 60)}  [${r.match.source}]`,
    );
  if (removals.length > limit) {
    lines.push(`…and ${removals.length - limit} more`);
  }
  return lines.join("\n");
}

/** Count per source, e.g. "EBSCO 70, ProQuest 34". */
export function summarizeSources(removals: PlannedRemoval[]): string {
  const counts = new Map<string, number>();
  for (const r of removals) {
    counts.set(r.match.source, (counts.get(r.match.source) ?? 0) + 1);
  }
  return [...counts]
    .sort((a, b) => b[1] - a[1])
    .map(([source, n]) => `${source} ${n}`)
    .join(", ");
}
