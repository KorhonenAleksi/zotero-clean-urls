# Zotero Clean URLs

A Zotero 9/10 plugin that removes library-database and proxy links from
selected items, so they stop cluttering APA-style reference lists.

When an article has no DOI, APA (and most journal styles) print its URL. If
that URL is a database login link such as

```
https://search.ebscohost.com/login.aspx?direct=true&db=bth&AN=9509210295&site=ehost-live&authtype=sso&custid=ns000000
```

it ends up in your reference list. APA 7 says not to include database URLs,
and proxy links only work for members of one university.

## Use

Select items (or Cmd/Ctrl+A for a whole collection or library), right-click,
and pick **Remove database links…**. A dialog lists the items that would
change, each with the exact link that will be removed. Nothing is removed
until you click **Remove N links**; Cancel is the default button.

Every removed link is first appended to `clean-urls-log.csv` in your Zotero
data folder (Settings → Advanced → Files and Folders → Show Data Directory),
with the item key, title and full URL, so any link can be restored.

## What it removes

Only the URL field, and only when **all** of these hold:

- the item is a journal article, conference paper, book, book section,
  thesis, report, magazine or newspaper article, or encyclopedia entry;
- it has **no DOI** (in the DOI field or as `DOI:` in Extra) — with a DOI,
  styles print the DOI and ignore the URL;
- the URL points to
  - a research database: EBSCO, ProQuest (incl. Ebook Central), JSTOR, Gale,
    Web of Science, Scopus, Nexis Uni, Factiva;
  - a library proxy: `libproxy`, `ezproxy`/`ezp`, OCLC-hosted
    (`*.idm.oclc.org`), or `/login?url=` links;
  - an academic social network or search engine: ResearchGate,
    Academia.edu, Semantic Scholar, Google Scholar.

Publisher pages (Wiley, SAGE, ScienceDirect, Taylor & Francis, …),
open-access repositories, `doi.org` links, web pages, and PDF attachments are
never touched. Read-only group libraries are skipped.

## Install

Zotero: Tools → Plugins → gear icon → Install Plugin From File…, and pick
`build/zotero-clean-urls.xpi`.

## Development

```sh
npm install
npm test            # unit tests for the pure core (src/core), runs in Node
npm run build       # → build/zotero-clean-urls.xpi
npm start           # hot-reload into a separate dev Zotero profile (needs .env, see .env.example)
```

Layout: `src/core/links.ts` holds the link rules as pure TypeScript with no
Zotero dependency and is unit-tested. `src/modules/cleanLinks.ts` is the thin
Zotero adapter (menu, confirmation dialog, item updates).

Built on [windingwind/zotero-plugin-template](https://github.com/windingwind/zotero-plugin-template). Licensed AGPL-3.0-or-later.
