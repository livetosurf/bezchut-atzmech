#!/usr/bin/env node
/**
 * validate-articles.js — בדיקת תקינות לכל האתר
 * הרץ: node tools/validate-articles.js            (הכל)
 *       node tools/validate-articles.js <slug>     (רק קבצי posts/ שמכילים slug בשם)
 *
 * בודק לכל קובץ ב-posts/:
 *  1. כל בלוק JSON-LD מתפרסר כ-JSON תקין (תופס את באג ה-</h3 שדלף לסכמות)
 *  2. איזון תגיות article/div
 *  3. קישורים פנימיים מצביעים לקבצים קיימים (כולל קישורי "/" מוחלטים לשורש האתר)
 *  4. אין placeholder שנשכח (REPLACE_WITH...)
 * בדיקות רוחביות (בהרצה מלאה):
 *  5. כל url ב-posts-data.js מצביע לקובץ קיים
 *  6. כל URL ב-sitemap.xml מצביע לקובץ קיים
 *  7. עמודי השורש (דף בית, קטגוריות, כלים): JSON-LD תקין, קישורים פנימיים קיימים,
 *     וכל סקריפט inline מתקמפל — עמוד קטגוריה עם שגיאת תחביר ב-JS לא מציג כתבות בכלל
 *  8. כל כתבה מקושרת בקישור <a href> אמיתי מעמוד הקטגוריה שלה (גוגל לא עוקב אחרי onclick)
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const POSTS_DIR = path.join(ROOT, 'posts');
const filter = process.argv[2] || '';

let errors = 0;
function fail(file, msg) { console.log(`✗ ${file}: ${msg}`); errors++; }

/** Resolve an internal href to a file on disk. Returns null for external/anchor-only links. */
function resolveHref(href, baseDir) {
  if (/^(https?:|mailto:|tel:|javascript:|data:|whatsapp:|sms:)/i.test(href)) return null;
  const clean = href.split('#')[0].split('?')[0];
  if (!clean) return null;
  if (clean.startsWith('/')) return path.join(ROOT, clean === '/' ? 'index.html' : clean.slice(1));
  return path.resolve(baseDir, clean);
}

function checkJsonLd(file, html) {
  [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)].forEach((m, i) => {
    try { JSON.parse(m[1]); }
    catch (e) { fail(file, `JSON-LD block ${i} invalid: ${e.message.slice(0, 80)}`); }
  });
}

function checkLinks(file, html, baseDir) {
  for (const m of html.matchAll(/href="([^"#][^"]*)"/g)) {
    if (m[1].includes('${')) continue; // JS template literal, resolved at runtime
    const target = resolveHref(m[1], baseDir);
    if (target && !fs.existsSync(target)) fail(file, `broken link: ${m[1]}`);
  }
}

// ── per-file checks: posts/ ──────────────────────────────────────────────────
const files = fs.readdirSync(POSTS_DIR)
  .filter(f => f.endsWith('.html') && f.includes(filter));

for (const f of files) {
  const html = fs.readFileSync(path.join(POSTS_DIR, f), 'utf8');

  checkJsonLd(f, html);                                         // 1

  for (const tag of ['article', 'div']) {                       // 2
    const open = (html.match(new RegExp('<' + tag + '[\\s>]', 'g')) || []).length;
    const close = (html.match(new RegExp('</' + tag + '>', 'g')) || []).length;
    if (open !== close) fail(f, `<${tag}> mismatch: ${open} open vs ${close} close`);
  }

  checkLinks(f, html, POSTS_DIR);                               // 3

  if (/REPLACE_WITH/.test(html)) fail(f, 'leftover REPLACE_WITH placeholder'); // 4
}

// ── cross-file checks (only on full runs) ────────────────────────────────────
let rootCount = 0;
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

  // 6. sitemap URLs
  const xml = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
  for (const m of xml.matchAll(/<loc>https:\/\/bezchut\.co\.il\/([^<]*)<\/loc>/g)) {
    const rel = m[1] === '' ? 'index.html' : m[1];
    if (!fs.existsSync(path.join(ROOT, rel))) fail('sitemap.xml', `missing file: ${rel}`);
  }

  // 7. root pages
  const rootPages = fs.readdirSync(ROOT).filter(f => f.endsWith('.html'));
  rootCount = rootPages.length;
  for (const f of rootPages) {
    const html = fs.readFileSync(path.join(ROOT, f), 'utf8');
    checkJsonLd(f, html);
    checkLinks(f, html, ROOT);
    let n = 0;
    for (const m of html.matchAll(/<script(?![^>]*\bsrc=)(?![^>]*application\/ld\+json)[^>]*>([^]*?)<\/script>/g)) {
      n++;
      try { new vm.Script(m[1]); }
      catch (e) { fail(f, `inline script #${n} has a syntax error: ${e.message.slice(0, 80)}`); }
    }
  }

  // 8. every post is linked with a real anchor from its category hub
  for (const [cat, meta] of Object.entries(ctx.CAT_META)) {
    const posts = ctx.ALL_POSTS.filter(p => p.cat === cat && p.url && p.content && p.content.trim());
    if (!posts.length || !fs.existsSync(path.join(ROOT, meta.href))) continue;
    const hub = fs.readFileSync(path.join(ROOT, meta.href), 'utf8');
    for (const p of posts) {
      if (!hub.includes(`href="${p.url}"`)) fail(meta.href, `no crawlable <a href> to ${p.url} (run: node tools/build-listings.js)`);
    }
  }
}

console.log(errors === 0
  ? `✓ All checks passed (${files.length} post files${filter ? ` matching "${filter}"` : ` + ${rootCount} root pages + posts-data.js + sitemap + hub links`})`
  : `${errors} problem(s) found`);
process.exit(errors === 0 ? 0 : 1);
