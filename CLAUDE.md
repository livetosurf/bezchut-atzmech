# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **static HTML site** for "בזכות עצמך" — a Hebrew women's empowerment portal selling digital courses and publishing articles. All pages are self-contained `.html` files with embedded CSS and JavaScript. There is no build system, bundler, or framework.

**Note:** `index.html` is a separate Chess Openings learning app (unrelated to the portal). The portal's main entry point is linked from category/content pages.

## Running the Site

Open any `.html` file directly in a browser, or serve with any static file server:

```bash
npx serve .
# or
python -m http.server 8080
```

## Generating the Google Ads Campaign Spreadsheet

The `generate-sheets.js` script creates `גרר-פארס-קמפיין.xlsx` (a Google Ads campaign for a separate towing-company client):

```bash
npm install
node generate-sheets.js
```

## Architecture

### Content Management Flow

- **[posts-data.js](posts-data.js)** — Single source of truth. Exports a global `ALL_POSTS` array of post objects with fields: `id`, `cat`, `catColor`, `icon`, `bg`, `title`, `excerpt`, `author`, `authorIcon`, `read` (minutes), `date`, `views`, and optionally `content` (HTML string).
- **[admin.html](admin.html)** — Browser-based CMS. Loads `posts-data.js`, stores edits in `localStorage`, then lets you export an updated `posts-data.js` to replace manually. **Do not edit `posts-data.js` directly — use `admin.html`.**
- Image uploads in admin go to **ImgBB** (`https://api.imgbb.com/1/upload`) using a user-supplied API key.

### Page Types

| Page | Purpose |
|------|---------|
| [post.html](post.html) | Article template — reads post ID from URL params, pulls content from embedded data |
| [all-posts.html](all-posts.html) | Archive/listing of all posts with filtering |
| [course.html](course.html) | Course sales landing page |
| [baalat-haesek.html](baalat-haesek.html), [kaspim-vefinansim.html](kaspim-vefinansim.html), [marketing-digital.html](marketing-digital.html), [lmida-vetzmikha.html](lmida-vetzmikha.html), [manhigut-nashit.html](manhigut-nashit.html), [esek-viyazmanut.html](esek-viyazmanut.html), [briut-veravaha.html](briut-veravaha.html) | Category hub pages |
| [about.html](about.html), [newsletter.html](newsletter.html), [resources.html](resources.html) | Supporting portal pages |
| [machshevon-tmhur.html](machshevon-tmhur.html) | Pricing calculator tool |
| [admin.html](admin.html) | Content management interface |

### Design System (shared across all portal pages)

- **Fonts:** `Assistant` (body), `Heebo` (headings/logo), loaded from Google Fonts
- **Brand colors:** `--primary: #6B2D7C` (purple), `--accent: #C9A84C` (gold), `--bg: #FBF6FE`
- **Direction:** `dir="rtl"`, `direction: rtl` — all content is Hebrew right-to-left
- **Nav pattern:** Fixed transparent header that gains white background + blur on scroll (`.scrolled` class toggled by JS)
- Category colors are defined per-category within `posts-data.js` (`catColor` field)

### SEO / Misc Files

- [sitemap.xml](sitemap.xml), [robots.txt](robots.txt) — standard SEO files, update manually when adding pages
- [og-image.svg](og-image.svg) / [og-image-gen.html](og-image-gen.html) — Open Graph image assets
- `.md` cluster files (`cluster-1-beaches.md` etc.) — SEO content outlines for a surf beginners topic cluster (content research, not rendered pages)
