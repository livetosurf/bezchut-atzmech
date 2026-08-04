#!/usr/bin/env node
/**
 * generate-sitemap.js — סורק את כל דפי ה-HTML באתר ובונה sitemap.xml תקני מאפס.
 * הרץ: node tools/generate-sitemap.js
 *
 * כללי הכללה:
 *   נסרקים: כל *.html בתיקיית השורש וב-posts/
 *   מוחרגים: עמודי מערכת (admin, 404, og-image-gen, post.html התבנית),
 *             עמודי redirect (meta refresh), עמודים עם noindex,
 *             ועמודים שה-canonical שלהם מצביע לעמוד אחר.
 *   lastmod: תאריך הקומיט האחרון של הקובץ ב-git (fallback: תאריך שינוי בדיסק).
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const DOMAIN = 'https://bezchut.co.il';

const EXCLUDE_FILES = new Set([
  'admin.html',        // ממשק ניהול
  '404.html',          // עמוד שגיאה
  'og-image-gen.html', // כלי פנימי ליצירת תמונות OG
  'post.html',         // תבנית קוראת-id, לא עמוד תוכן עצמאי
]);

const CATEGORY_PAGES = new Set([
  'esek-viyazmanut.html', 'kaspim-vefinansim.html', 'marketing-digital.html',
  'briut-veravaha.html', 'manhigut-nashit.html', 'lmida-vetzmikha.html',
  'mosach-nashim.html', 'hasava-miktzoit.html', 'gerushin-atzmaut.html',
]);

// ── git lastmod: one pass over history, first (=latest) date per file ────────
const gitDates = {};
try {
  const log = execSync('git log --format="C %cs" --name-only', { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 }).toString();
  let current = null;
  for (const line of log.split('\n')) {
    if (line.startsWith('C ')) current = line.slice(2).trim();
    else if (line.trim() && current && !(line.trim() in gitDates)) gitDates[line.trim()] = current;
  }
} catch { /* git unavailable — mtime fallback below */ }

function lastmod(rel) {
  if (gitDates[rel]) return gitDates[rel];
  const st = fs.statSync(path.join(ROOT, rel));
  return st.mtime.toISOString().slice(0, 10);
}

// ── collect candidate pages ──────────────────────────────────────────────────
const pages = [];
const rootFiles = fs.readdirSync(ROOT).filter(f => f.endsWith('.html'));
const postFiles = fs.readdirSync(path.join(ROOT, 'posts')).filter(f => f.endsWith('.html'));
const candidates = [...rootFiles, ...postFiles.map(f => 'posts/' + f)];

let excluded = { system: 0, redirect: 0, noindex: 0, canonicalElsewhere: 0 };

for (const rel of candidates) {
  const base = path.basename(rel);
  if (EXCLUDE_FILES.has(base)) { excluded.system++; continue; }

  const html = fs.readFileSync(path.join(ROOT, rel), 'utf8');

  if (/http-equiv="refresh"/i.test(html)) { excluded.redirect++; continue; }
  if (/<meta name="robots" content="[^"]*noindex/i.test(html)) { excluded.noindex++; continue; }

  const expectedUrl = `${DOMAIN}/${rel.replace(/\\/g, '/')}`;
  const canonM = html.match(/<link rel="canonical" href="([^"]+)"/);
  if (canonM && canonM[1] !== expectedUrl) { excluded.canonicalElsewhere++; continue; }

  let priority, changefreq;
  if (base === 'bezchut-atzmech.html') { priority = '1.0'; changefreq = 'weekly'; }
  else if (CATEGORY_PAGES.has(base))   { priority = '0.9'; changefreq = 'weekly'; }
  else if (rel.startsWith('posts/'))   { priority = '0.8'; changefreq = 'monthly'; }
  else                                 { priority = '0.5'; changefreq = 'monthly'; }

  pages.push({ loc: expectedUrl, lastmod: lastmod(rel), priority, changefreq });
}

// homepage first, then categories, then the rest alphabetically
pages.sort((a, b) => (b.priority.localeCompare(a.priority)) || a.loc.localeCompare(b.loc));

// ── emit XML ─────────────────────────────────────────────────────────────────
const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.map(p => `  <url>
    <loc>${p.loc}</loc>
    <lastmod>${p.lastmod}</lastmod>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`).join('\n')}
</urlset>
`;

fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), xml, 'utf8');

console.log(`✓ sitemap.xml נכתב עם ${pages.length} עמודים`);
console.log(`  הוחרגו: ${excluded.system} מערכת, ${excluded.redirect} הפניות, ${excluded.noindex} noindex, ${excluded.canonicalElsewhere} canonical-אחר`);
