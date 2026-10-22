import { describe, expect, it } from "vitest";
import {
  classifyLink,
  formatRemovalList,
  linkToRemove,
  PlannedRemoval,
  summarizeSources,
} from "../../src/core/links";

describe("classifyLink", () => {
  it("recognises research databases", () => {
    expect(
      classifyLink(
        "https://search.ebscohost.com/login.aspx?direct=true&db=bth&AN=9509210295&site=ehost-live&authtype=sso&custid=ns000000",
      ),
    ).toMatchObject({ kind: "database", source: "EBSCO" });
    expect(
      classifyLink("https://research.ebsco.com/c/abc/details/xyz"),
    ).toMatchObject({ source: "EBSCO" });
    expect(
      classifyLink("https://www.proquest.com/docview/1234567"),
    ).toMatchObject({ source: "ProQuest" });
    expect(
      classifyLink("https://search.proquest.com/openview/abc"),
    ).toMatchObject({ source: "ProQuest" });
    expect(classifyLink("https://www.jstor.org/stable/2393553")).toMatchObject({
      source: "JSTOR",
    });
  });

  it("recognises library proxies before the database behind them", () => {
    expect(
      classifyLink("https://www.jstor.org.libproxy.example.edu/stable/2393553"),
    ).toMatchObject({ kind: "proxy", host: "www.jstor.org.libproxy.example.edu" });
    expect(
      classifyLink("https://login.example.edu/login?url=https://example.org"),
    ).toMatchObject({ kind: "proxy" });
    expect(
      classifyLink("https://www-sciencedirect-com.ezproxy.example.edu/x"),
    ).toMatchObject({ kind: "proxy" });
    expect(
      classifyLink("https://onlinelibrary-wiley-com.ezp.lib.example.ac.uk/x"),
    ).toMatchObject({ kind: "proxy" });
    expect(
      classifyLink("https://www-jstor-org.example.idm.oclc.org/stable/1"),
    ).toMatchObject({ kind: "proxy" });
  });

  it("recognises academic social networks", () => {
    expect(
      classifyLink("https://www.researchgate.net/publication/123_Title"),
    ).toMatchObject({ kind: "network", source: "ResearchGate" });
    expect(classifyLink("https://scholar.google.fi/scholar?q=x")).toMatchObject(
      { source: "Google Scholar" },
    );
  });

  it("keeps publisher, repository and other links", () => {
    for (const url of [
      "https://onlinelibrary.wiley.com/doi/10.1002/smj.4250050207",
      "https://journals.sagepub.com/doi/10.1177/0170840610397486",
      "https://www.sciencedirect.com/science/article/pii/S0024630114000",
      "https://www.tandfonline.com/doi/full/10.1080/00076791.2020.1",
      "https://deepblue.lib.umich.edu/handle/2027.42/1",
      "https://opus.lib.uts.edu.au/handle/10453/1",
      "https://journal.fi/ht/article/view/1",
      "https://doi.org/10.1002/smj.70136",
      "https://www.ebsco-not.example.com/x",
    ]) {
      expect(classifyLink(url), url).toBeNull();
    }
  });

  it("handles links stored without a scheme", () => {
    expect(classifyLink("www.jstor.org/stable/2486455")).toMatchObject({
      source: "JSTOR",
    });
    expect(classifyLink("onlinelibrary.wiley.com/doi/10.1/x")).toBeNull();
  });

  it("ignores empty and non-web values", () => {
    expect(classifyLink("")).toBeNull();
    expect(classifyLink(undefined)).toBeNull();
    expect(classifyLink("not a url")).toBeNull();
    expect(classifyLink("file:///Users/x/paper.pdf")).toBeNull();
  });
});

describe("linkToRemove", () => {
  const ebsco = "https://search.ebscohost.com/login.aspx?AN=1";

  it("removes database links from articles without a DOI", () => {
    expect(
      linkToRemove({ itemType: "journalArticle", url: ebsco }),
    ).toMatchObject({ source: "EBSCO" });
    expect(
      linkToRemove({
        itemType: "book",
        url: "https://ebookcentral.proquest.com/lib/example/detail.action?docID=1",
      }),
    ).toMatchObject({ source: "ProQuest" });
  });

  it("leaves items with a DOI alone", () => {
    expect(
      linkToRemove({
        itemType: "journalArticle",
        url: ebsco,
        DOI: "10.1002/smj.1",
      }),
    ).toBeNull();
    expect(
      linkToRemove({
        itemType: "bookSection",
        url: ebsco,
        extra: "Place: London\nDOI: 10.4135/9781446200",
      }),
    ).toBeNull();
  });

  it("treats a blank DOI as missing", () => {
    expect(
      linkToRemove({ itemType: "journalArticle", url: ebsco, DOI: "  " }),
    ).not.toBeNull();
  });

  it("leaves item types where the URL is the point", () => {
    expect(linkToRemove({ itemType: "webpage", url: ebsco })).toBeNull();
    expect(linkToRemove({ itemType: "blogPost", url: ebsco })).toBeNull();
    expect(linkToRemove({ itemType: "attachment", url: ebsco })).toBeNull();
  });
});

describe("confirmation text", () => {
  const removal = (n: number, source = "EBSCO"): PlannedRemoval => ({
    citation: `Author${n} (2001)`,
    title: `Title ${n}`,
    match: { kind: "database", source, host: "x" },
  });

  it("lists items and caps the list", () => {
    const list = formatRemovalList(
      Array.from({ length: 18 }, (_, i) => removal(i + 1)),
      15,
    );
    const lines = list.split("\n");
    expect(lines).toHaveLength(16);
    expect(lines[0]).toBe("• Author1 (2001) — Title 1  [EBSCO]");
    expect(lines[15]).toBe("…and 3 more");
  });

  it("shortens long titles", () => {
    const list = formatRemovalList([{ ...removal(1), title: "A".repeat(100) }]);
    expect(list).toContain("A".repeat(59) + "…");
    expect(list).not.toContain("A".repeat(61));
  });

  it("summarises sources by count", () => {
    expect(
      summarizeSources([
        removal(1, "JSTOR"),
        removal(2, "EBSCO"),
        removal(3, "EBSCO"),
      ]),
    ).toBe("EBSCO 2, JSTOR 1");
  });
});
