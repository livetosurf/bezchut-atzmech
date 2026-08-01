---
name: verify-article
description: Verify site articles after creating or editing any HTML in posts/ — JSON-LD validity, tag balance, internal links, sitemap and posts-data.js consistency. Run before declaring article work done. Triggers on writing/editing articles, cluster pages, posts-data.js, or sitemap.xml.
---

# Verifying articles (בזכות עצמך)

Never report article work as complete based on a successful Write/Edit alone.
After creating or editing **any** file in `posts/`, `posts-data.js`, or `sitemap.xml`, run:

```bash
node tools/validate-articles.js
```

To check only specific files (faster during iteration), pass a filename filter:

```bash
node tools/validate-articles.js hasava-miktzoit
```

The script exits non-zero on any failure. **If it fails — fix the issue and rerun until it passes.** Do not hand back partially verified work.

## What it catches (learned from real recurring bugs)

1. **Broken JSON-LD** — the most frequent recurring bug in this project is a stray
   `</h3` leaking into an FAQPage `"name"` field when copying question text between
   the schema block and the visible FAQ section. Also straight quotes (`"`) inside
   Hebrew JSON-LD strings break parsing — use `״` (U+05F4) inside JSON-LD text values.
2. **Tag imbalance** — unclosed `<div>`/`<article>`.
3. **Broken internal links** — related-articles sidebars, prev/next navigation, and
   in-body links that point to files that don't exist yet.
4. **Leftover placeholders** — e.g. `REPLACE_WITH_MAKE_WEBHOOK_URL`.
5. **posts-data.js drift** — entries whose `url` points to a missing file.
6. **sitemap.xml drift** — post URLs with no matching file.

## Checklist for a NEW article (all must be true before done)

- [ ] HTML file created in `posts/` following the structure of an existing article in the same category
- [ ] Entry added to `posts-data.js` (next sequential `id`, correct `cat`, `catColor`, `url`)
- [ ] `<url>` entry added to `sitemap.xml`
- [ ] Category hub page links to the article (card + popular list if relevant)
- [ ] Newsletter form `source` field updated to the article's slug
- [ ] `node tools/validate-articles.js` passes with zero errors

## Checklist for a NEW category

- [ ] Hub page created (copy structure from `hasava-miktzoit.html`, change `--cat*` colors)
- [ ] `CAT_META` entry added in `posts-data.js`
- [ ] Category card added to homepage `bezchut-atzmech.html` #categories grid
- [ ] Cross-links added in sibling category sidebars ("קטגוריות נוספות")
- [ ] sitemap entry for the hub page

## Warning

Do **not** run `generate-posts.js` without checking first: articles created by hand
(ids 72+) have empty `content` fields in posts-data.js, so regenerating would
overwrite the hand-written HTML with empty articles.
