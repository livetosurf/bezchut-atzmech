---
name: verify-article
description: Build and verify the site after creating or editing articles, category hubs, the homepage, posts-data.js or sitemap.xml — JSON-LD validity, tag balance, internal links, inline-script syntax, crawlable hub links, sitemap and posts-data.js consistency. Run before declaring any site work done.
---

# Building and verifying the site (בזכות עצמך)

Never report site work as complete based on a successful Write/Edit alone.
After changing `posts-data.js`, `generate-posts.js`, any hub page, `index.html` or `all-posts.html`, run:

```bash
node build.js
```

It rebuilds article pages, post listings and the sitemap from `posts-data.js`, then runs the validator, and stops on the first failure. **If it fails — fix the issue and rerun until it passes.** Do not commit or push partially verified work (pushing to `main` deploys the site).

To only validate (no rebuild), or to check specific article files while iterating:

```bash
node tools/validate-articles.js
node tools/validate-articles.js hasava-miktzoit
```

## What the validator catches (learned from real recurring bugs)

1. **Broken JSON-LD** — the most frequent recurring bug is a stray `</h3` leaking into an
   FAQPage `"name"` field when copying question text between the schema block and the
   visible FAQ section. Straight quotes (`"`) inside Hebrew JSON-LD strings also break
   parsing — use `״` (U+05F4) inside JSON-LD text values.
2. **Tag imbalance** — unclosed `<div>`/`<article>` in article pages.
3. **Broken internal links** — in article pages *and* root pages, including root-absolute `/` links.
4. **Leftover placeholders** — e.g. `REPLACE_WITH_MAKE_WEBHOOK_URL`.
5. **posts-data.js drift** — entries whose `url` points to a missing file.
6. **sitemap.xml drift** — URLs with no matching file.
7. **Inline script syntax errors in root pages** — a broken embedded array once left the
   מנהיגות נשית hub showing no articles at all, unnoticed, in production.
8. **Articles without a crawlable link from their hub** — Google does not follow `onclick`
   navigation. Every article needs a real `<a href>` on its category page.

## Checklist for a NEW article (all must be true before done)

**Do NOT write article HTML by hand.** posts-data.js is the single source of truth.

- [ ] Entry added to `posts-data.js`: next sequential `id`, correct `cat`, `catColor`,
      `url` (e.g. `posts/<category-slug>-<n>.html`), `image` (Unsplash URL), full
      article body in `content` (HTML: p/h2/h3/ul/table/tip-box/article-key/article-cta),
      and optional `ld` array with FAQPage/HowTo JSON-LD strings
- [ ] On a **newer hub** (mosach-nashim, hasava-miktzoit, gerushin-atzmaut, diur-nadlan,
      zchuyot-avoda): a card added by hand to the hub's `#blogGrid`. The six older hubs,
      the homepage and all-posts.html are regenerated automatically.
- [ ] `node build.js` passes with zero errors

## Checklist for EDITING an existing article

- [ ] Edit the entry in `posts-data.js` (never the file in `posts/`)
- [ ] Set `updated:'YYYY-MM-DD'` on the entry (drives `dateModified` and sitemap `lastmod`)
- [ ] `node build.js` passes

## Checklist for a NEW category

- [ ] Hub page created (copy structure from `diur-nadlan.html`, change `--cat*` colors)
- [ ] `CAT_META` entry added in `posts-data.js`
- [ ] `CAT` config entry added in `generate-posts.js` (slug, page, colors, images, altPrefix),
      plus the mobile-menu and footer links in the template
- [ ] Category card added to the `#categories` grid of `index.html`
- [ ] Hub file name added to `NEW_HUBS` in `tools/build-listings.js`
- [ ] Cross-links added in sibling category sidebars ("קטגוריות נוספות")
- [ ] `node build.js` passes

## Notes

- The homepage is `index.html` (served at `/`). `bezchut-atzmech.html` is a redirect stub — never edit it.
- Home links are root-absolute (`href="/"`); preview locally with `node tools/dev-server.js`, not `file://`.
- `generate-posts.js` skips posts with empty `content` and never overwrites `posts/posts.css`.
- For a global change (nav, footer, webhook, schema, layout of all articles) — edit the
  template inside `generate-posts.js` once and run `node build.js`.
