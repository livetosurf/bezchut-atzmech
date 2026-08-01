#!/usr/bin/env node
/**
 * extract-content.js — הופך את posts-data.js למקור אמת יחיד.
 * עובר על כל הפוסטים, מאתר את קובץ ה-HTML הקיים שלהם, ומחלץ ממנו חזרה:
 *   content — גוף הכתבה (בלי featured-image / share-bar / author-bio שהתבנית מוסיפה)
 *   image   — תמונת og:image שנבחרה ידנית
 *   ld      — בלוקי JSON-LD נוספים (FAQPage / HowTo / ItemList)
 *   url     — נתיב הקובץ (מקבע את שם הקובץ הקיים)
 * ואז כותב posts-data.js חדש. פוסטים ללא קובץ קיים נשארים כמו שהם.
 *
 * הרץ: node tools/extract-content.js
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const POSTS_DIR = path.join(ROOT, 'posts');

const CAT_SLUG = {
  'עסקים ויזמות': 'esek-viyazmanut',
  'כספים ופיננסים': 'kaspim-vefinansim',
  'מרקטינג דיגיטלי': 'marketing-digital',
  'בריאות ורווחה': 'briut-veravaha',
  'מנהיגות נשית': 'manhigut-nashit',
  'למידה וצמיחה': 'lmida-vetzmikha',
  'מוסך ורכב': 'mosach-nashim',
  'הסבה מקצועית': 'hasava-miktzoit',
  'גירושין ועצמאות כלכלית': 'gerushin-atzmaut',
};

// mosach posts (ids 55-65) were hand-written with per-cluster numbering
const MOSACH_URL_BY_ID = {};
for (let i = 0; i < 11; i++) MOSACH_URL_BY_ID[55 + i] = `posts/mosach-nashim-${i + 1}.html`;

// ── load data ────────────────────────────────────────────────────────────────
const ctx = {};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'posts-data.js'), 'utf8'), ctx);
const ALL_POSTS = ctx.ALL_POSTS;
const CAT_META = ctx.CAT_META;

// ── extraction ───────────────────────────────────────────────────────────────
let extracted = 0, skipped = 0;

for (const post of ALL_POSTS) {
  // resolve the file this post lives in
  let rel = post.url || MOSACH_URL_BY_ID[post.id]
    || (CAT_SLUG[post.cat] ? `posts/${CAT_SLUG[post.cat]}-${post.id}.html` : null);
  if (!rel || !fs.existsSync(path.join(ROOT, rel))) {
    console.log(`· id ${post.id} (${post.title.slice(0, 30)}…) — אין קובץ, נשאר כמו שהוא`);
    skipped++;
    continue;
  }
  const html = fs.readFileSync(path.join(ROOT, rel), 'utf8');

  // og:image
  const imgM = html.match(/<meta property="og:image" content="([^"]+)"/);
  if (imgM && !imgM[1].includes('og-image')) post.image = imgM[1];

  // extra JSON-LD (keep everything except Article + BreadcrumbList, which the template rebuilds)
  const ld = [];
  for (const m of html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)) {
    try {
      const parsed = JSON.parse(m[1]);
      if (parsed['@type'] !== 'Article' && parsed['@type'] !== 'BreadcrumbList') ld.push(m[1]);
    } catch { /* invalid blocks are dropped; validator would have caught them */ }
  }
  if (ld.length) post.ld = ld;

  // article body content
  const artM = html.match(/<article id="article-body">([^]*?)<\/article>/);
  if (!artM) { console.log(`✗ id ${post.id}: לא נמצא article-body ב-${rel}`); skipped++; continue; }
  let content = artM[1];
  content = content.replace(/\s*<figure class="featured-image">[^]*?<\/figure>/, '');
  content = content.replace(/\s*<div class="share-bar">[^]*?<\/div>/, ''); // no nested divs inside
  content = content.replace(/\s*<a class="author-bio"[^]*?<\/a>/, '');
  post.content = content.trim();
  post.url = rel;
  extracted++;
}

console.log(`\n✓ חולץ תוכן מ-${extracted} קבצים, ${skipped} דולגו`);

// ── serialize posts-data.js ──────────────────────────────────────────────────
function q(s) { // single-quoted JS string
  return "'" + String(s ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n') + "'";
}
function bt(s) { // backtick template literal
  return '`' + String(s ?? '').replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${') + '`';
}

function serializePost(p) {
  const parts = [
    `id:${p.id}`,
    `cat:${q(p.cat)}`,
    `catColor:${q(p.catColor)}`,
    `icon:${q(p.icon)}`,
    `bg:${q(p.bg)}`,
    `title:${q(p.title)}`,
    `excerpt:${q(p.excerpt)}`,
    `author:${q(p.author)}`,
    `authorIcon:${q(p.authorIcon)}`,
    `read:${p.read}`,
    `date:${q(p.date)}`,
    `views:${p.views || 0}`,
  ];
  if (p.url) parts.push(`url:${q(p.url)}`);
  if (p.image) parts.push(`image:${q(p.image)}`);
  if (p.ld && p.ld.length) parts.push(`ld:[${p.ld.map(q).join(',\n    ')}]`);
  parts.push(`content:${bt(p.content || '')}`);
  return '  { ' + parts.join(', ') + ' }';
}

let out = `/**
 * posts-data.js — מאגר הכתבות המרכזי של פורטל "בזכות עצמך"
 * מקור האמת היחיד: תוכן, מטא-דאטה וסכמות של כל כתבה.
 * דפי ה-HTML ב-posts/ נוצרים ממנו עם: node generate-posts.js
 * אימות אחרי כל שינוי: node tools/validate-articles.js
 */

var ALL_POSTS = [
`;

let lastCat = null;
out += ALL_POSTS.map(p => {
  let s = '';
  if (p.cat !== lastCat) { s += `\n  // ${p.cat}\n`; lastCat = p.cat; }
  return s + serializePost(p);
}).join(',\n');

out += `\n];\n\n// Category metadata\nvar CAT_META = ${JSON.stringify(CAT_META, null, 2).replace(/"([a-zA-Z]+)":/g, '$1:')};\n`;

fs.writeFileSync(path.join(ROOT, 'posts-data.js'), out, 'utf8');
console.log('✓ posts-data.js נכתב מחדש כמקור אמת יחיד');
