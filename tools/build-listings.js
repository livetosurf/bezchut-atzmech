#!/usr/bin/env node
/**
 * build-listings.js — מסנכרן את כל רשימות הכתבות באתר מול posts-data.js
 * ומוודא שלכל כתבה יש קישורי <a href> אמיתיים שגוגל יכול לסרוק.
 *
 * מה הוא מעדכן (אידמפוטנטי — אפשר להריץ שוב ושוב):
 *   1. עמודי קטגוריה ישנים (מערך allPosts מוטמע + render ב-JS):
 *      מחליף את המערך בנתונים עדכניים, מתקן את תבניות הקישור, ומרנדר מראש
 *      כרטיסים סטטיים לתוך ה-HTML כך שהקישורים קיימים גם בלי JavaScript.
 *   2. עמודי קטגוריה חדשים (כרטיסים סטטיים עם onclick): עוטף כותרות ב-<a href>
 *      ומסנכרן את הכותרת מול posts-data.js.
 *   3. דף הבית (index.html): 6 הכתבות האחרונות + ספירת כתבות לכל קטגוריה.
 *   4. all-posts.html: המערך המלא + אינדקס סטטי של כל הכתבות לפי קטגוריה.
 *
 * הרץ: node tools/build-listings.js   (חלק מ-node build.js)
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const ctx = {};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'posts-data.js'), 'utf8'), ctx);
const POSTS = ctx.ALL_POSTS.filter(p => p.url && p.content && p.content.trim());
const CAT_META = ctx.CAT_META;

const MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
function heDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
  return m ? `${+m[3]} ב${MONTHS[+m[2] - 1]} ${m[1]}` : (iso || '');
}
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const byNewest = (a, b) => (b.updated || b.date).localeCompare(a.updated || a.date) || b.id - a.id;

let problems = 0;
function warn(file, msg) { problems++; console.log(`  ✗ ${file}: ${msg}`); }

function readFile(name) {
  const raw = fs.readFileSync(path.join(ROOT, name), 'utf8');
  return { crlf: raw.includes('\r\n'), s: raw.replace(/\r\n/g, '\n') };
}
function writeFile(name, f) {
  fs.writeFileSync(path.join(ROOT, name), f.crlf ? f.s.replace(/\n/g, '\r\n') : f.s, 'utf8');
}

/**
 * Find the [start,end) range of the array literal that follows `decl` (e.g. "const allPosts").
 * Legacy arrays hold free-form article text, so instead of hand-tracking quotes we let the JS
 * parser decide: the array ends at the first "]" where the slice compiles as an expression.
 */
function arrayRange(s, decl) {
  const d = s.indexOf(decl);
  if (d < 0) return null;
  const open = s.indexOf('[', d);
  for (let i = s.indexOf(']', open); i >= 0; i = s.indexOf(']', i + 1)) {
    try { new vm.Script('(' + s.slice(open, i + 1) + ')'); return { start: open, end: i + 1 }; } catch { /* keep looking */ }
  }
  // The embedded array itself has a syntax error (page JS is broken) — fall back to the
  // first line that closes it, so replacing the array repairs the page.
  const m = /\n\s*\];/.exec(s.slice(open));
  return m ? { start: open, end: open + m.index + m[0].length - 1 } : null;
}

/** Replace content between marker comments, creating the markers inside `container` on first run. */
function setMarked(s, key, html, firstRun) {
  const a = `<!--${key}:START-->`, b = `<!--${key}:END-->`;
  const i = s.indexOf(a), j = s.indexOf(b);
  if (i >= 0 && j > i) return s.slice(0, i + a.length) + '\n' + html + '\n' + s.slice(j);
  return firstRun(s, `${a}\n${html}\n${b}`);
}

/** Pull the card template literal out of a render function so static cards match the page's own markup. */
function cardTemplate(s, anchorText) {
  const from = s.indexOf(anchorText);
  if (from < 0) return null;
  const m = /\.map\(\s*p\s*=>\s*`/.exec(s.slice(from));
  if (!m) return null;
  const start = from + m.index + m[0].length;
  const end = s.indexOf('`).join(', start);
  return end < 0 ? null : { start, end, tpl: s.slice(start, end) };
}
function renderTemplate(tpl, p) {
  return new Function('p', 'return `' + tpl + '`;')(p);
}

// ── tag heuristics for the JS filter bars of the old hubs ───────────────────
const TAG_WORDS = {
  'שיווק': ['שיווק', 'קהל יעד', 'מכיר'], 'פיננסים': ['מחיר', 'תמחור', 'כסף', 'הכנס', 'דוח'],
  'ניהול זמן': ['זמן', 'שגר', '90 הימים'], 'לקוחות': ['לקוח'], 'בניית עסק': ['עסק', 'יזמ', 'פרילנס'],
  'שינה': ['שינה'], 'תזונה': ['תזונה', 'משקל', 'מטבוליזם'], 'תנועה': ['תנועה', 'מנוחה אקטיבית', 'העצם'],
  'שחיקה': ['שחיקה', 'חרדה', 'גבולות'], 'מיינדפולנס': ['מיינדפולנס', 'אנרגיה', 'מצב רוח'],
  'פייסבוק': ['פייסבוק', 'פיקסל', 'meta'], 'אינסטגרם': ['אינסטגרם', 'קפשן', 'tiktok', 'טיקטוק'],
  'SEO': ['seo', 'גוגל'], 'תוכן': ['תוכן', 'קופי', 'קפשן', 'תפוצה', 'וואטסאפ'],
  'פרסום ממומן': ['ממומן', 'ריטרגטינג', 'טרגוט', 'טירגוט', 'קמפיין'],
  'קורסים': ['קורס', 'ללמוד', 'למידה'], 'ספרים': ['ספר', 'קריאה'], 'פודקאסטים': ['פודקאסט'],
  'מנטורינג': ['מנטור', 'ליווי'], 'כישורים': ['כישור', 'מיומנו', 'הרגל', 'חשיבה', 'צמיחה'],
  'גיל המעבר': ['גיל המעבר', 'הורמונ', 'גלי חום', 'מנופאוזה'],
};
function tagsFor(post, vocab, fallback) {
  const hay = (post.title + ' ' + post.excerpt).toLowerCase();
  const hit = vocab.filter(t => (TAG_WORDS[t] || [t]).some(w => hay.includes(w.toLowerCase())));
  return hit.length ? hit.slice(0, 2) : [fallback];
}

function hubItem(p, vocab, fallback) {
  return {
    id: p.id, tags: tagsFor(p, vocab, fallback), icon: p.icon, bg: p.bg, title: p.title, excerpt: p.excerpt,
    author: p.author, read: `${p.read} דק׳ קריאה`, date: heDate(p.date), url: p.url, content: '', text: '',
  };
}

// ════════════════════════════════════════════════════════════════════════════
// 1. OLD-STYLE HUBS
// ════════════════════════════════════════════════════════════════════════════
const OLD_HUBS = [
  { file: 'esek-viyazmanut.html',   cat: 'עסקים ויזמות',   slug: 'esek-viyazmanut',   fallback: 'בניית עסק' },
  { file: 'kaspim-vefinansim.html', cat: 'כספים ופיננסים', slug: 'kaspim-vefinansim', fallback: 'כסף חכם' },
  { file: 'marketing-digital.html', cat: 'מרקטינג דיגיטלי', slug: 'marketing-digital', fallback: 'שיווק' },
  { file: 'briut-veravaha.html',    cat: 'בריאות ורווחה',  slug: 'briut-veravaha',    fallback: 'בריאות', extraTags: ['גיל המעבר'] },
  { file: 'manhigut-nashit.html',   cat: 'מנהיגות נשית',   slug: 'manhigut-nashit',   fallback: 'מנהיגות' },
  { file: 'lmida-vetzmikha.html',   cat: 'למידה וצמיחה',   slug: 'lmida-vetzmikha',   fallback: 'כישורים', lmida: true },
];

for (const hub of OLD_HUBS) {
  const f = readFile(hub.file);
  let s = f.s;
  const posts = POSTS.filter(p => p.cat === hub.cat);
  if (!posts.length) { warn(hub.file, 'no posts for category'); continue; }

  // tag vocabulary: static filter buttons, or lmida's `const tags` list
  let vocab = [...new Set([...s.matchAll(/filterByTag\('([^']+)'/g)].map(m => m[1]))].filter(t => t !== 'הכל');
  if (hub.lmida) vocab = ['קורסים', 'ספרים', 'פודקאסטים', 'מנטורינג', 'כישורים'];
  for (const t of hub.extraTags || []) if (!vocab.includes(t)) vocab.push(t);
  const items = posts.map(p => hubItem(p, vocab, hub.fallback));

  // (a) swap the embedded array
  const r = arrayRange(s, 'const allPosts');
  if (!r) { warn(hub.file, 'allPosts array not found'); continue; }
  s = s.slice(0, r.start) + JSON.stringify(items, null, 2) + s.slice(r.end);

  // (b) link templates -> real URLs
  s = s.split('posts/' + hub.slug + '-${p.id}.html').join('${p.url}');
  s = s.replace(new RegExp(`window\\.location\\s*=\\s*'posts/${hub.slug}-'\\s*\\+\\s*id\\s*\\+\\s*'\\.html';?`),
    `const _p = allPosts.find(x => x.id === id); if (_p) window.location = _p.url;`);
  if (hub.lmida) {
    // cards and popular items opened a modal with stale text — make them real links
    s = s.replace('<div class="blog-card" onclick="openModal(${p.id})">', '<a class="blog-card" href="${p.url}" style="text-decoration:none;color:inherit;display:block">');
    s = s.replace('<div class="pop-item" onclick="openModal(${p.id})">', '<a class="pop-item" href="${p.url}" style="text-decoration:none;color:inherit">');
    for (const open of ['<a class="blog-card" href="${p.url}"', '<a class="pop-item" href="${p.url}"']) {
      const o = s.indexOf(open);
      if (o < 0) { warn(hub.file, 'card template not found: ' + open); continue; }
      const end = s.indexOf('`).join(', o);
      const lastDiv = s.lastIndexOf('</div>', end);
      if (s.slice(lastDiv, end).trim() === '</div>') s = s.slice(0, lastDiv) + '</a>' + s.slice(lastDiv + 6);
    }
    s = s.replace(/\[allPosts\[0\], allPosts\[3\], allPosts\[5\], allPosts\[8\]\]/, 'allPosts.slice(0, 4)');
  }

  // some hubs render <article onclick="openPost(id)"> cards that opened a modal with stale text:
  // send openPost to the real article and give every card title a crawlable anchor
  s = s.replace(/(function openPost\(id\)\s*\{\s*const p\s*=\s*allPosts\.find\(x\s*=>\s*x\.id\s*===\s*id\);\s*if\s*\(!p\)\s*return;)(?!\s*window\.location)/,
    '$1window.location=p.url;return;');
  {
    const t = cardTemplate(s, hub.lmida ? 'function renderGrid' : 'function render');
    if (t && !t.tpl.includes('href="${p.url}"')) {
      const linked = t.tpl.replace('<h3>${p.title}</h3>', '<h3><a href="${p.url}" style="color:inherit;text-decoration:none">${p.title}</a></h3>');
      if (linked === t.tpl) warn(hub.file, 'card template has no link and no <h3> title to wrap');
      s = s.slice(0, t.start) + linked + s.slice(t.end);
    }
  }

  // (c) show every post (static HTML already contains them all)
  s = s.replace(/shownCount\s*=\s*6\b/g, 'shownCount = 999');

  // (d) filter buttons: add extra tags, drop tags no post uses
  const used = new Set(items.flatMap(i => i.tags));
  for (const t of hub.extraTags || []) {
    if (used.has(t) && !s.includes(`filterByTag('${t}'`)) {
      const last = [...s.matchAll(/<button class="tag-btn"[^>]*filterByTag\('[^']+'[^>]*>[^<]*<\/button>/g)].pop();
      if (last) s = s.slice(0, last.index + last[0].length) + `\n          <button class="tag-btn" onclick="filterByTag('${t}', this)">${t}</button>` + s.slice(last.index + last[0].length);
    }
  }
  for (const t of vocab) {
    if (!used.has(t)) s = s.replace(new RegExp(`\\s*<button class="tag-btn"[^>]*filterByTag\\('${t}'[^>]*>[^<]*</button>`), '');
  }
  if (hub.lmida) s = s.replace(/const tags = \[[^\]]*\];/, `const tags = ${JSON.stringify(['הכל', ...vocab.filter(t => used.has(t))])};`);

  // (e) featured card -> first post of the category
  const fp = items[0];
  const fc = s.indexOf('<div class="featured-card"');
  if (fc >= 0) {
    const blockEnd = s.indexOf('featured-thumb', fc);
    let block = s.slice(fc, blockEnd);
    block = block.replace(/onclick="[^"]*"/, `onclick="window.location='${fp.url}'"`);
    block = block.replace(/(<h2[^>]*>)[^]*?(<\/h2>)/, `$1<a href="${fp.url}" style="color:inherit;text-decoration:none">${esc(fp.title)}</a>$2`);
    block = block.replace(/(<div class="featured-title">)[^]*?(<\/div>)/, `$1<a href="${fp.url}" style="color:inherit;text-decoration:none">${esc(fp.title)}</a>$2`);
    block = block.replace(/(<p class="excerpt"[^>]*>)[^]*?(<\/p>)/, `$1${esc(fp.excerpt)}$2`);
    block = block.replace(/(<div class="featured-excerpt">)[^]*?(<\/div>)/, `$1${esc(fp.excerpt)}$2`);
    block = block.replace(/(<div class="avatar">)[^<]*(<\/div>\s*<span>)[^<]*(<\/span>)/, `$1${esc(fp.author.charAt(0))}$2${esc(fp.author)}$3`);
    block = block.replace(/<span>⏱[^<]*<\/span>(\s*)<span>📅[^<]*<\/span>/, `<span>⏱ ${fp.read}</span>$1<span>📅 ${fp.date}</span>`);
    block = block.replace(/(<div class="meta-name">)[^<]*(<\/div>)/, `$1${esc(fp.author)}$2`);
    block = block.replace(/(<div class="meta-info">)[^]*?(<\/div>)/, `$1${fp.read} <span class="meta-dot">·</span> ${fp.date}$2`);
    s = s.slice(0, fc) + block + s.slice(blockEnd);
    s = s.replace(/(<div class="featured-thumb" style=")[^"]*(">)\s*[^<]*\s*(<\/div>)/, `$1background:${fp.bg}$2${fp.icon}$3`);
  } else warn(hub.file, 'featured card not found');

  // (f) pre-render static cards with the page's own template
  const tplInfo = cardTemplate(s, hub.lmida ? 'function renderGrid' : 'function render');
  if (!tplInfo) { warn(hub.file, 'card template not found'); }
  else {
    const cards = items.map(p => renderTemplate(tplInfo.tpl, p)).join('');
    const gridId = hub.lmida ? 'blog-grid' : 'blogGrid';
    s = setMarked(s, 'POSTS', cards, (str, block) => {
      const empty = `<div class="blog-grid" id="${gridId}"></div>`;
      if (!str.includes(empty)) { warn(hub.file, 'empty grid container not found'); return str; }
      return str.replace(empty, `<div class="blog-grid" id="${gridId}">${block}</div>`);
    });
  }

  f.s = s;
  writeFile(hub.file, f);
  console.log(`✓ ${hub.file}: ${items.length} כתבות, תגיות: ${[...used].join(', ')}`);
}

// ════════════════════════════════════════════════════════════════════════════
// 2. NEW-STYLE HUBS — static cards: wrap titles in anchors, sync titles
// ════════════════════════════════════════════════════════════════════════════
const NEW_HUBS = ['mosach-nashim.html', 'hasava-miktzoit.html', 'gerushin-atzmaut.html', 'diur-nadlan.html', 'zchuyot-avoda.html'];
const byUrl = Object.fromEntries(POSTS.map(p => [p.url, p]));

for (const file of NEW_HUBS) {
  const f = readFile(file);
  let n = 0;
  f.s = f.s.replace(/(<article class="blog-card"[^>]*onclick="window\.location='(posts\/[^']+)'"[^>]*>[^]*?<h3>)([^]*?)(<\/h3>)/g, (all, pre, url, inner, post) => {
    const p = byUrl[url];
    if (!p) { warn(file, 'card points to unknown post ' + url); return all; }
    n++;
    return `${pre}<a href="${url}" style="color:inherit;text-decoration:none">${esc(p.title)}</a>${post}`;
  });
  // featured card: it is already an <a>; keep its heading in sync with the pillar title
  f.s = f.s.replace(/(<a href="(posts\/[^"]+)" class="featured-card"[^>]*>[^]*?<h2>)([^]*?)(<\/h2>)/, (all, pre, url, inner, post) => {
    const p = byUrl[url];
    return p ? `${pre}${esc(p.title)}${post}` : all;
  });
  writeFile(file, f);
  console.log(`✓ ${file}: ${n} כרטיסים עם קישורי <a>`);
}

// ════════════════════════════════════════════════════════════════════════════
// 3. HOMEPAGE
// ════════════════════════════════════════════════════════════════════════════
{
  const file = 'index.html';
  const f = readFile(file);
  let s = f.s;
  const latest = [...POSTS].sort(byNewest).map(p => ({
    id: p.id, cat: p.cat, icon: p.icon, bg: p.bg, title: p.title, excerpt: p.excerpt,
    author: p.author, read: `${p.read} דק׳ קריאה`, date: heDate(p.date), url: p.url,
  }));
  const r = arrayRange(s, 'const posts');
  if (!r) warn(file, 'posts array not found');
  else s = s.slice(0, r.start) + JSON.stringify(latest.slice(0, 12), null, 2) + s.slice(r.end);

  s = s.split('href="posts/${catSlug(p.cat)}-${p.id}.html"').join('href="${p.url}"');
  s = s.replace("window.location = 'posts/' + catSlug(p.cat) + '-' + id + '.html';", 'window.location = p.url;');

  const tplInfo = cardTemplate(s, 'function renderBlog');
  if (!tplInfo) warn(file, 'renderBlog template not found');
  else {
    const cards = latest.slice(0, 6).map(p => renderTemplate(tplInfo.tpl, p)).join('');
    s = setMarked(s, 'POSTS', cards, (str, block) => {
      const re = /(<div class="blog-grid" id="blogGrid">)\s*<!-- Rendered by JS -->\s*(<\/div>)/;
      if (!re.test(str)) { warn(file, 'blogGrid placeholder not found'); return str; }
      return str.replace(re, `$1${block}$2`);
    });
  }

  // category cards: real article counts
  for (const [cat, meta] of Object.entries(CAT_META)) {
    const count = POSTS.filter(p => p.cat === cat).length;
    if (!count) continue;
    const re = new RegExp(`(<a class="cat-card" href="${meta.href.replace('.', '\\.')}">[^]*?<p class="cat-count">)[^<]*(</p>)`);
    s = s.replace(re, `$1${count} כתבות$2`);
  }
  f.s = s;
  writeFile(file, f);
  console.log(`✓ ${file}: 6 כתבות אחרונות + ספירות קטגוריה`);
}

// ════════════════════════════════════════════════════════════════════════════
// 4. ALL-POSTS — full data + static crawlable index
// ════════════════════════════════════════════════════════════════════════════
{
  const file = 'all-posts.html';
  const f = readFile(file);
  let s = f.s;
  const all = POSTS.map(p => ({
    id: p.id, cat: p.cat, catColor: p.catColor, icon: p.icon, bg: p.bg, title: p.title, excerpt: p.excerpt,
    author: p.author, authorIcon: p.authorIcon, read: p.read, date: p.date, views: p.views || 0, url: p.url,
  }));
  const r = arrayRange(s, 'const allPosts');
  if (!r) warn(file, 'allPosts array not found');
  else s = s.slice(0, r.start) + '[\n' + all.map(p => '  ' + JSON.stringify(p)).join(',\n') + '\n]' + s.slice(r.end);

  // JS cards: div+onclick -> anchor
  const oldOpen = `<div class="post-card" onclick="window.location='\${p.url || 'post.html'}'">`;
  const newOpen = `<a class="post-card" href="\${p.url || 'post.html'}" style="text-decoration:none;color:inherit">`;
  if (s.includes(oldOpen)) {
    s = s.replace(oldOpen, newOpen);
    const o = s.indexOf(newOpen), end = s.indexOf('`).join(', o), lastDiv = s.lastIndexOf('</div>', end);
    s = s.slice(0, lastDiv) + '</a>' + s.slice(lastDiv + 6);
    s = s.replace(`onclick="event.stopPropagation();window.location='author.html'"`, `onclick="event.preventDefault();event.stopPropagation();window.location='author.html'"`);
  } else if (!s.includes(newOpen)) warn(file, 'post-card template not found');

  // static index grouped by category
  const groups = Object.keys(CAT_META).map(cat => {
    const list = POSTS.filter(p => p.cat === cat);
    if (!list.length) return '';
    return `    <div class="pi-group">
      <h3><a href="${CAT_META[cat].href}">${CAT_META[cat].icon} ${esc(cat)}</a></h3>
      <ul>
${list.map(p => `        <li><a href="${p.url}">${esc(p.title)}</a></li>`).join('\n')}
      </ul>
    </div>`;
  }).filter(Boolean).join('\n');
  const index = `<section class="post-index" aria-label="אינדקס כל הכתבות">
  <style>
    .post-index{max-width:1200px;margin:0 auto 56px;padding:0 24px}
    .post-index h2{font-family:'Heebo',sans-serif;font-size:1.4rem;font-weight:800;margin-bottom:18px}
    .post-index .pi-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:24px}
    .post-index h3{font-size:1rem;font-weight:700;margin-bottom:8px}
    .post-index ul{list-style:none;padding:0;margin:0}
    .post-index li{font-size:.88rem;line-height:1.5;padding:4px 0;border-bottom:1px solid rgba(107,45,124,.08)}
    .post-index a{color:inherit;text-decoration:none}
    .post-index a:hover{color:#6B2D7C;text-decoration:underline}
  </style>
  <h2>אינדקס כל הכתבות לפי נושא</h2>
  <div class="pi-grid">
${groups}
  </div>
</section>`;
  s = setMarked(s, 'INDEX', index, (str, block) => {
    const at = str.indexOf('<footer');
    if (at < 0) { warn(file, 'footer not found'); return str; }
    return str.slice(0, at) + block + '\n\n' + str.slice(at);
  });
  f.s = s;
  writeFile(file, f);
  console.log(`✓ ${file}: ${all.length} כתבות במערך + אינדקס סטטי`);
}

if (problems) { console.log(`\n✗ ${problems} בעיות — בדקי את הפלט למעלה`); process.exit(1); }
console.log('\n✓ כל הרשימות מסונכרנות מול posts-data.js');
