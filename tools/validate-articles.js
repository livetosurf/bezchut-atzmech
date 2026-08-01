#!/usr/bin/env node
/**
 * validate-articles.js — בדיקת תקינות לכל כתבות האתר
 * הרץ: node tools/validate-articles.js            (הכל)
 *       node tools/validate-articles.js <slug>     (קבצים שמכילים slug בשם)
 *
 * בודק לכל קובץ ב-posts/:
 *  1. כל בלוק JSON-LD מתפרסר כ-JSON תקין (תופס את באג ה-</h3 שדלף לסכמות)
 *  2. איזון תגיות article/div
 *  3. קישורים יחסיים מצביעים לקבצים קיימים
 *  4. אין placeholder שנשכח (REPLACE_WITH...)
 * בדיקות רוחביות:
 *  5. כל url ב-posts-data.js מצביע לקובץ קיים
 *  6. כל URL של /posts/ ב-sitemap.xml מצביע לקובץ קיים
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const POSTS_DIR = path.join(ROOT, 'posts');
const filter = process.argv[2] || '';

let errors = 0;
function fail(file, msg) { console.log(`✗ ${file}: ${msg}`); errors++; }

// ── per-file checks ──────────────────────────────────────────────────────────
const files = fs.readdirSync(POSTS_DIR)
  .filter(f => f.endsWith('.html') && f.includes(filter));

for (const f of files) {
  const html = fs.readFileSync(path.join(POSTS_DIR, f), 'utf8');

  // 1. JSON-LD validity
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)];
  blocks.forEach((m, i) => {
    try { JSON.parse(m[1]); }
    catch (e) { fail(f, `JSON-LD block ${i} invalid: ${e.message.slice(0, 80)}`); }
  });

  // 2. tag balance
  for (const tag of ['article', 'div']) {
    const open = (html.match(new RegExp('<' + tag + '[\\s>]', 'g')) || []).length;
    const close = (html.match(new RegExp('</' + tag + '>', 'g')) || []).length;
    if (open !== close) fail(f, `<${tag}> mismatch: ${open} open vs ${close} close`);
  }

  // 3. relative links resolve
  const hrefs = [...html.matchAll(/href="([^"#][^"]*)"/g)].map(m => m[1]);
  for (const h of hrefs) {
    if (/^(https?:|mailto:|tel:|javascript:)/.test(h)) continue;
    const clean = h.split('#')[0].split('?')[0];
    if (!clean) continue;
    const target = path.resolve(POSTS_DIR, clean);
    if (!fs.existsSync(target)) fail(f, `broken link: ${h}`);
  }

  // 4. leftover placeholders
  if (/REPLACE_WITH/.test(html)) fail(f, 'leftover REPLACE_WITH placeholder');
}

// ── cross-file checks (only on full runs) ────────────────────────────────────
if (!filter) {
  // 5. posts-data.js urls
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'posts-data.js'), 'utf8'), ctx);
  for (const p of ctx.ALL_POSTS) {
    if (p.url && !fs.existsSync(path.join(ROOT, p.url))) {
      fail('posts-data.js', `id ${p.id}: url points to missing file ${p.url}`);
    }
  }

  // 6. sitemap post URLs
  const xml = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
  const locs = [...xml.matchAll(/<loc>https:\/\/bezchut\.co\.il\/(posts\/[^<]+)<\/loc>/g)].map(m => m[1]);
  for (const loc of locs) {
    if (!fs.existsSync(path.join(ROOT, loc))) fail('sitemap.xml', `missing file: ${loc}`);
  }
}

console.log(errors === 0
  ? `✓ All checks passed (${files.length} files${filter ? ` matching "${filter}"` : ' + posts-data.js + sitemap'})`
  : `${errors} problem(s) found`);
process.exit(errors === 0 ? 0 : 1);
