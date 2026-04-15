#!/usr/bin/env node
/**
 * generate-posts.js — יוצר דפי HTML נפרדים לכל פוסט עם SEO מלא
 * הרץ: node generate-posts.js
 * הפלט: תיקיית /posts/ עם 54 קבצי HTML + עדכון sitemap.xml
 */

const fs   = require('fs');
const path = require('path');
const vm   = require('vm');

// ── LOAD POSTS DATA ──────────────────────────────────────────────────────────
const postsDataRaw = fs.readFileSync(path.join(__dirname, 'posts-data.js'), 'utf-8');
const ctx = {};
vm.createContext(ctx);
vm.runInContext(postsDataRaw, ctx);
const ALL_POSTS = ctx.ALL_POSTS;
console.log(`✓ נטענו ${ALL_POSTS.length} פוסטים`);

// ── CATEGORY CONFIG ──────────────────────────────────────────────────────────
const CAT = {
  'עסקים ויזמות': {
    slug: 'esek-viyazmanut', page: 'esek-viyazmanut.html',
    color: '#6B2D7C', light: '#F0E8F8', dark: '#4A1A57',
    images: [
      'https://images.unsplash.com/photo-1573497620053-ea5300f94f21?w=1200&q=80',
      'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=1200&q=80',
      'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=1200&q=80',
    ],
    altPrefix: 'יזמית עסקים',
  },
  'כספים ופיננסים': {
    slug: 'kaspim-vefinansim', page: 'kaspim-vefinansim.html',
    color: '#1A6B4A', light: '#E0F7EE', dark: '#0D4A32',
    images: [
      'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=1200&q=80',
      'https://images.unsplash.com/photo-1579621970795-87facc2f976d?w=1200&q=80',
      'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=1200&q=80',
    ],
    altPrefix: 'כספים ופיננסים',
  },
  'מרקטינג דיגיטלי': {
    slug: 'marketing-digital', page: 'marketing-digital.html',
    color: '#D64F8C', light: '#FCE8F2', dark: '#A03068',
    images: [
      'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1200&q=80',
      'https://images.unsplash.com/photo-1432888622747-4eb9a8efeb07?w=1200&q=80',
      'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=1200&q=80',
    ],
    altPrefix: 'מרקטינג דיגיטלי',
  },
  'בריאות ורווחה': {
    slug: 'briut-veravaha', page: 'briut-veravaha.html',
    color: '#2D7A4F', light: '#E8F8EE', dark: '#1A5535',
    images: [
      'https://images.unsplash.com/photo-1499728603263-13726abce5fd?w=1200&q=80',
      'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=1200&q=80',
      'https://images.unsplash.com/photo-1540497077202-7c8a3999166f?w=1200&q=80',
    ],
    altPrefix: 'בריאות ורווחה',
  },
  'מנהיגות נשית': {
    slug: 'manhigut-nashit', page: 'manhigut-nashit.html',
    color: '#8B1A6B', light: '#F8E8F5', dark: '#5A0E44',
    images: [
      'https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=1200&q=80',
      'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=1200&q=80',
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=1200&q=80',
    ],
    altPrefix: 'מנהיגות נשית',
  },
  'למידה וצמיחה': {
    slug: 'lmida-vetzmikha', page: 'lmida-vetzmikha.html',
    color: '#007A8C', light: '#E0F4F7', dark: '#005A68',
    images: [
      'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=1200&q=80',
      'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=1200&q=80',
      'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=1200&q=80',
    ],
    altPrefix: 'למידה וצמיחה',
  },
};

// ── HELPERS ──────────────────────────────────────────────────────────────────
function esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function formatDate(d) {
  const dt = new Date(d);
  const months = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
  return `${dt.getDate()} ב${months[dt.getMonth()]} ${dt.getFullYear()}`;
}

function addH2Ids(content) {
  let n = 0;
  return content.replace(/<h2(?![^>]*\bid\s*=)([^>]*)>/gi, (m, rest) => `<h2 id="s${++n}"${rest}>`);
}

function buildToc(content) {
  const items = [];
  const re = /<h2[^>]*id="(s\d+)"[^>]*>(.*?)<\/h2>/gi;
  let m;
  while ((m = re.exec(content)) !== null) {
    items.push({ id: m[1], text: m[2].replace(/<[^>]+>/g,'') });
  }
  return items;
}

// ── CREATE OUTPUT DIR ────────────────────────────────────────────────────────
const postsDir = path.join(__dirname, 'posts');
if (!fs.existsSync(postsDir)) fs.mkdirSync(postsDir);

// ── WRITE SHARED CSS ─────────────────────────────────────────────────────────
const SHARED_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Assistant:wght@300;400;600;700&family=Heebo:wght@400;700;900&family=Frank+Ruhl+Libre:wght@400;700&display=swap');

:root {
  --primary:#6B2D7C; --primary-dark:#4A1A57; --primary-light:#9B5DAC;
  --accent:#C9A84C; --accent-dark:#A07830;
  --bg:#FBF6FE; --card-bg:#FFFFFF;
  --text:#1A1A2E; --text-muted:#6B6B8A; --border:#E8DFF5;
  --nav-h:70px; --radius:16px;
  --shadow:0 4px 24px rgba(107,45,124,.10);
  --shadow-hover:0 8px 40px rgba(107,45,124,.18);
  --cat:#007A8C; --cat-light:#E0F4F7; --cat-dark:#005A68;
}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}
body{font-family:'Assistant',sans-serif;background:var(--bg);color:var(--text);line-height:1.7;direction:rtl}
a{text-decoration:none;color:inherit}

/* PROGRESS */
#progress-bar{position:fixed;top:0;right:0;left:0;z-index:200;height:3px;background:transparent}
#progress-fill{height:100%;width:0%;background:linear-gradient(90deg,var(--primary),var(--accent));transition:width .1s linear}

/* NAV */
header{position:fixed;top:3px;right:0;left:0;z-index:100;height:var(--nav-h);background:transparent;transition:background .3s,box-shadow .3s}
header.scrolled{background:rgba(255,255,255,.97);box-shadow:0 2px 20px rgba(107,45,124,.12);backdrop-filter:blur(12px)}
nav{max-width:1200px;margin:0 auto;padding:0 24px;height:100%;display:flex;align-items:center;gap:16px}
.logo{font-family:'Heebo',sans-serif;font-size:1.4rem;font-weight:900;color:#fff;transition:color .3s}
header.scrolled .logo{color:var(--primary)}
.logo span{color:var(--accent)}
.nav-links{display:flex;gap:4px;margin-right:auto}
.nav-links a{padding:7px 13px;border-radius:8px;font-size:.88rem;font-weight:600;color:rgba(255,255,255,.85);transition:all .2s}
header.scrolled .nav-links a{color:var(--text-muted)}
.nav-links a:hover{background:var(--cat-light);color:var(--cat-dark)}
.nav-cta{background:var(--accent)!important;color:#fff!important;border-radius:50px!important;padding:7px 18px!important;font-weight:700!important}
.hamburger{display:none;flex-direction:column;gap:5px;cursor:pointer;padding:4px}
.hamburger span{width:24px;height:2px;background:#fff;border-radius:2px;transition:background .3s}
header.scrolled .hamburger span{background:var(--primary)}
.mobile-menu{display:none;position:fixed;top:calc(var(--nav-h) + 3px);right:0;left:0;background:rgba(255,255,255,.98);padding:20px 24px;box-shadow:0 8px 32px rgba(107,45,124,.15);z-index:99;flex-direction:column;gap:8px}
.mobile-menu.open{display:flex}
.mobile-menu a{padding:12px 16px;border-radius:10px;font-weight:600;color:var(--text)}
.mobile-menu a:hover{background:var(--cat-light);color:var(--cat-dark)}

/* HERO */
.post-hero{min-height:55vh;display:flex;flex-direction:column;justify-content:flex-end;padding:calc(var(--nav-h) + 40px) 24px 60px;position:relative;overflow:hidden}
.post-hero-inner{max-width:860px;margin:0 auto;width:100%}
.breadcrumb{display:flex;align-items:center;gap:8px;color:rgba(255,255,255,.5);font-size:.82rem;margin-bottom:16px;flex-wrap:wrap}
.breadcrumb a{color:rgba(255,255,255,.6);transition:color .2s}
.breadcrumb a:hover{color:#fff}
.post-cat-badge{display:inline-flex;align-items:center;gap:6px;background:var(--cat);color:#fff;font-size:.78rem;font-weight:700;padding:5px 14px;border-radius:50px;margin-bottom:16px}
.post-hero h1{font-family:'Heebo',sans-serif;font-size:clamp(1.6rem,4vw,2.6rem);font-weight:900;color:#fff;line-height:1.3;margin-bottom:20px;text-shadow:0 2px 20px rgba(0,0,0,.3)}
.post-hero-meta{display:flex;align-items:center;gap:16px;flex-wrap:wrap}
.author-chip{display:flex;align-items:center;gap:10px}
.author-avatar{width:42px;height:42px;border-radius:50%;background:rgba(255,255,255,.15);display:flex;align-items:center;justify-content:center;font-size:1.3rem;border:2px solid rgba(255,255,255,.3)}
.author-name{color:#fff;font-weight:700;font-size:.9rem}
.author-title{color:rgba(255,255,255,.6);font-size:.78rem}
.meta-pills{display:flex;gap:8px;flex-wrap:wrap}
.meta-pill{background:rgba(255,255,255,.12);color:rgba(255,255,255,.8);border:1px solid rgba(255,255,255,.2);border-radius:50px;padding:5px 14px;font-size:.82rem;display:flex;align-items:center;gap:5px}
.hero-particle{position:absolute;opacity:.08;font-size:2rem;animation:particleFloat 7s ease-in-out infinite}
.hero-particle:nth-child(1){top:20%;right:5%;animation-delay:0s}
.hero-particle:nth-child(2){top:50%;left:5%;animation-delay:2s;font-size:1.5rem}
.hero-particle:nth-child(3){bottom:30%;right:15%;animation-delay:4s;font-size:2.5rem}
@keyframes particleFloat{0%,100%{transform:translateY(0) rotate(-5deg)}50%{transform:translateY(-15px) rotate(5deg)}}
.hero-wave{position:absolute;bottom:0;right:0;left:0}
.hero-wave svg{display:block}

/* LAYOUT */
.post-layout{max-width:1160px;margin:0 auto;padding:40px 24px 60px;display:grid;grid-template-columns:1fr 280px;gap:48px;align-items:start}

/* FEATURED IMAGE */
.featured-image{margin:0 0 32px;border-radius:var(--radius);overflow:hidden}
.featured-image img{width:100%;height:360px;object-fit:cover;display:block}

/* ARTICLE */
article{background:var(--card-bg);border-radius:var(--radius);box-shadow:var(--shadow);padding:40px 44px;font-family:'Frank Ruhl Libre','Assistant',serif}
article p{font-size:1.05rem;line-height:1.85;color:#2A2A40;margin-bottom:22px}
article h2{font-family:'Heebo',sans-serif;font-size:1.4rem;font-weight:900;color:var(--text);margin:36px 0 14px;padding-top:8px;border-top:2px solid var(--cat-light)}
article h3{font-family:'Heebo',sans-serif;font-size:1.15rem;font-weight:700;color:var(--primary);margin:24px 0 10px}
article h4{font-family:'Heebo',sans-serif;font-size:1rem;font-weight:700;color:var(--text);margin:18px 0 8px}
article ul,article ol{padding-right:20px;margin-bottom:22px}
article li{font-size:1.02rem;line-height:1.8;margin-bottom:8px;color:#2A2A40}
article blockquote{border-right:4px solid var(--accent);padding:18px 20px;background:linear-gradient(135deg,#FFFBF0,#FFF8E6);border-radius:0 12px 12px 0;margin:24px 0;font-style:italic;font-size:1.08rem;color:#5A4A10}
article blockquote cite{display:block;margin-top:8px;font-size:.85rem;font-style:normal;color:var(--text-muted);font-weight:600}
.tip-box{background:var(--cat-light);border:1px solid rgba(0,122,140,.2);border-radius:12px;padding:18px 20px;margin:24px 0;display:flex;gap:12px}
.tip-icon{font-size:1.4rem;flex-shrink:0;margin-top:2px}
.tip-content strong{display:block;font-size:.95rem;color:var(--cat-dark);margin-bottom:4px;font-family:'Heebo',sans-serif}
.tip-content p{font-size:.9rem;color:var(--cat-dark);margin:0;line-height:1.6;font-family:'Assistant',sans-serif}
.book-card{background:var(--card-bg);border:1.5px solid var(--border);border-radius:var(--radius);padding:20px 22px;margin:24px 0;display:flex;gap:18px;align-items:flex-start;transition:box-shadow .2s}
.book-card:hover{box-shadow:var(--shadow)}
.book-emoji{font-size:2.5rem;flex-shrink:0;line-height:1;margin-top:2px}
.book-info h4{font-family:'Heebo',sans-serif;font-weight:900;font-size:1.05rem;color:var(--text);margin-bottom:4px}
.book-info .book-by{color:var(--text-muted);font-size:.85rem;margin-bottom:8px;font-family:'Assistant',sans-serif}
.book-info p{font-size:.9rem;color:#3A3A50;margin:0;line-height:1.6;font-family:'Assistant',sans-serif}
.book-num{width:28px;height:28px;border-radius:50%;background:var(--primary);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:.85rem;font-family:'Heebo',sans-serif;flex-shrink:0}
.article-divider{border:none;border-top:1px dashed var(--border);margin:32px 0}
.article-tags{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:32px;padding-top:20px;border-top:1px solid var(--border)}
.article-tags span{color:var(--text-muted);font-size:.85rem}
.art-tag{background:#F0E8F8;color:var(--primary);border-radius:50px;padding:4px 12px;font-size:.82rem;font-weight:600;font-family:'Assistant',sans-serif}

/* KEY INSIGHT BOX */
.article-key{background:linear-gradient(135deg,#F8F0FF,#F0E8F8);border:1.5px solid var(--border);border-radius:12px;padding:18px 22px;margin:28px 0;position:relative;padding-right:52px}
.article-key::before{content:'💡';position:absolute;right:16px;top:18px;font-size:1.3rem}
.article-key strong{display:block;font-family:'Heebo',sans-serif;font-size:.95rem;color:var(--primary);margin-bottom:6px}
.article-key p{font-size:.92rem;color:#3A2A50;margin:0;line-height:1.65;font-family:'Assistant',sans-serif}

/* CTA BOX */
.article-cta{background:linear-gradient(135deg,var(--primary),var(--primary-dark));border-radius:var(--radius);padding:24px 28px;margin:32px 0;text-align:center}
.article-cta p{color:rgba(255,255,255,.9);font-size:1rem;margin-bottom:12px;font-family:'Assistant',sans-serif}
.article-cta a{display:inline-block;background:var(--accent);color:#fff;padding:10px 24px;border-radius:50px;font-weight:700;font-size:.95rem;font-family:'Assistant',sans-serif;transition:background .2s}
.article-cta a:hover{background:var(--accent-dark)}

/* SHARE BAR */
.share-bar{display:flex;align-items:center;gap:10px;margin-top:24px;padding:18px 0;border-top:1px solid var(--border)}
.share-label{font-size:.88rem;color:var(--text-muted);font-family:'Assistant',sans-serif}
.share-btn{display:flex;align-items:center;gap:6px;padding:8px 16px;border-radius:8px;border:1.5px solid var(--border);font-family:'Assistant',sans-serif;font-size:.85rem;font-weight:600;cursor:pointer;background:var(--card-bg);color:var(--text);transition:all .2s}
.share-btn:hover{border-color:var(--primary);color:var(--primary);background:#F0E8F8}
.share-btn.copy{background:var(--primary);color:#fff;border-color:var(--primary)}
.share-btn.copy:hover{background:var(--primary-dark)}

/* AUTHOR BIO */
.author-bio{background:linear-gradient(135deg,#F8F0FF,#F0E8F8);border:1px solid var(--border);border-radius:var(--radius);padding:24px 28px;margin-top:32px;display:flex;gap:18px;align-items:flex-start}
.bio-avatar{width:68px;height:68px;border-radius:50%;background:var(--primary);display:flex;align-items:center;justify-content:center;font-size:2rem;flex-shrink:0}
.bio-name{font-family:'Heebo',sans-serif;font-weight:900;font-size:1.05rem;color:var(--text);margin-bottom:3px}
.bio-role{color:var(--primary);font-size:.82rem;font-weight:600;margin-bottom:8px}
.bio-text{color:var(--text-muted);font-size:.88rem;line-height:1.65;font-family:'Assistant',sans-serif}

/* NEWSLETTER BOX */
.newsletter-box{background:linear-gradient(135deg,#0A2A30,#1A0528);border-radius:var(--radius);padding:36px 40px;margin:48px 0;text-align:center}
.newsletter-box h3{font-family:'Heebo',sans-serif;font-size:1.5rem;font-weight:900;color:#fff;margin-bottom:10px}
.newsletter-box p{color:rgba(255,255,255,.75);margin-bottom:22px;font-family:'Assistant',sans-serif}
.newsletter-form{display:flex;gap:10px;max-width:420px;margin:0 auto;flex-wrap:wrap;justify-content:center}
.newsletter-form input{flex:1;min-width:200px;padding:12px 18px;border-radius:50px;border:none;font-family:'Assistant',sans-serif;font-size:.95rem;outline:none;direction:rtl}
.newsletter-form button{padding:12px 24px;border-radius:50px;background:var(--accent);color:#fff;border:none;font-family:'Heebo',sans-serif;font-weight:700;font-size:.95rem;cursor:pointer;transition:background .2s;white-space:nowrap}
.newsletter-form button:hover{background:var(--accent-dark)}
.newsletter-note{color:rgba(255,255,255,.4);font-size:.78rem;margin-top:10px;font-family:'Assistant',sans-serif}
.nl-consent{text-align:right;margin:14px auto 0;max-width:420px}
.nl-consent label{display:inline-flex;gap:8px;align-items:flex-start;direction:rtl;font-size:.76rem;line-height:1.55;color:rgba(255,255,255,.55);cursor:pointer;font-family:'Assistant',sans-serif}
.nl-consent input[type=checkbox]{margin-top:3px;accent-color:var(--accent);flex-shrink:0;width:16px;height:16px;cursor:pointer}
.nl-consent label a{color:var(--accent);text-decoration:underline}

/* SIDEBAR */
.post-sidebar{display:flex;flex-direction:column;gap:24px;position:sticky;top:calc(var(--nav-h) + 16px)}
.sidebar-box{background:var(--card-bg);border-radius:var(--radius);box-shadow:var(--shadow);padding:20px}
.sidebar-title{font-family:'Heebo',sans-serif;font-size:.95rem;font-weight:700;margin-bottom:14px;padding-bottom:10px;border-bottom:2px solid var(--cat-light)}
.toc-list{list-style:none;display:flex;flex-direction:column;gap:4px}
.toc-link{display:block;padding:6px 10px;border-radius:8px;font-size:.85rem;color:var(--text-muted);font-family:'Assistant',sans-serif;transition:all .2s;border-right:3px solid transparent;cursor:pointer}
.toc-link:hover,.toc-link.active{background:var(--cat-light);color:var(--cat-dark);border-right-color:var(--cat)}
.toc-link.active{font-weight:700}
.social-share{display:flex;flex-direction:column;gap:8px}
.social-share-btn{display:flex;align-items:center;gap:10px;padding:10px 14px;border-radius:10px;border:1.5px solid var(--border);font-family:'Assistant',sans-serif;font-size:.88rem;font-weight:600;cursor:pointer;background:var(--card-bg);color:var(--text);transition:all .2s}
.social-share-btn:hover{transform:translateX(-3px)}
.social-share-btn.wa{border-color:#25D366}.social-share-btn.wa:hover{background:#25D366;color:#fff}
.social-share-btn.fb{border-color:#1877F2}.social-share-btn.fb:hover{background:#1877F2;color:#fff}
.social-share-btn.li{border-color:#0A66C2}.social-share-btn.li:hover{background:#0A66C2;color:#fff}
.social-share-btn.cp:hover{background:var(--primary);color:#fff;border-color:var(--primary)}
.related-list{display:flex;flex-direction:column;gap:12px}
.related-item{display:flex;gap:10px;align-items:flex-start;cursor:pointer}
.related-item:hover .related-title{color:var(--cat)}
.related-thumb{width:50px;height:50px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:1.5rem;flex-shrink:0}
.related-title{font-weight:600;font-size:.84rem;line-height:1.4;margin-bottom:3px;transition:color .2s}
.related-read{color:var(--text-muted);font-size:.78rem}

/* PREV/NEXT NAV */
.post-nav{max-width:1160px;margin:0 auto;padding:0 24px 60px;display:grid;grid-template-columns:1fr 1fr;gap:16px}
.post-nav-card{background:var(--card-bg);border-radius:var(--radius);box-shadow:var(--shadow);padding:20px 24px;border:1px solid var(--border);transition:all .2s;cursor:pointer;display:flex;align-items:center;gap:14px}
.post-nav-card:hover{box-shadow:var(--shadow-hover);border-color:var(--primary-light);transform:translateY(-2px)}
.post-nav-card.next{text-align:right}
.nav-direction{font-size:.78rem;color:var(--text-muted);margin-bottom:4px}
.nav-title{font-family:'Heebo',sans-serif;font-weight:700;font-size:.95rem;line-height:1.4}
.nav-arrow{font-size:1.5rem;color:var(--primary);flex-shrink:0}

/* FOOTER */
footer{background:linear-gradient(135deg,#1A0528 0%,#0D1040 100%);color:rgba(255,255,255,.7);padding:48px 24px 24px}
.footer-inner{max-width:1200px;margin:0 auto}
.footer-grid{display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:40px;margin-bottom:40px}
.footer-logo{font-family:'Heebo',sans-serif;font-size:1.5rem;font-weight:900;color:#fff;margin-bottom:12px}
.footer-logo span{color:var(--accent)}
.footer-desc{font-size:.9rem;line-height:1.7;margin-bottom:16px}
.footer-social{display:flex;gap:10px}
.social-btn-f{width:36px;height:36px;border-radius:50%;background:rgba(255,255,255,.1);display:flex;align-items:center;justify-content:center;transition:background .2s}
.social-btn-f:hover{background:var(--primary-light)}
.footer-col h4{font-family:'Heebo',sans-serif;font-weight:700;color:#fff;margin-bottom:14px}
.footer-col ul{list-style:none;display:flex;flex-direction:column;gap:8px}
.footer-col ul li a{font-size:.9rem;transition:color .2s}
.footer-col ul li a:hover{color:#fff}
.footer-bottom{border-top:1px solid rgba(255,255,255,.1);padding-top:20px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;font-size:.85rem}
.footer-bottom a{color:rgba(255,255,255,.5);transition:color .2s}
.footer-bottom a:hover{color:#fff}

/* SCROLL TOP */
.scroll-top{position:fixed;bottom:28px;left:28px;z-index:99;width:44px;height:44px;border-radius:50%;background:var(--primary);color:#fff;border:none;font-size:1.1rem;cursor:pointer;box-shadow:0 4px 16px rgba(0,0,0,.2);opacity:0;transition:opacity .3s,transform .3s;display:flex;align-items:center;justify-content:center}
.scroll-top.visible{opacity:1}
.scroll-top:hover{transform:translateY(-3px)}

/* RESPONSIVE */
@media(max-width:960px){
  .post-layout{grid-template-columns:1fr}
  .post-sidebar{position:static}
  article{padding:28px 24px}
  .nav-links{display:none}
  .hamburger{display:flex}
  .footer-grid{grid-template-columns:1fr 1fr;gap:24px}
  .post-nav{grid-template-columns:1fr}
  .newsletter-box{padding:28px 20px}
}
@media(max-width:600px){
  .footer-grid{grid-template-columns:1fr}
  article{padding:20px 16px}
  .featured-image img{height:220px}
}
`;

fs.writeFileSync(path.join(postsDir, 'posts.css'), SHARED_CSS, 'utf-8');
console.log('✓ נכתב posts/posts.css');

// ── GENERATE HTML PER POST ───────────────────────────────────────────────────
function generateHTML(post, allPosts) {
  const cat = CAT[post.cat];
  if (!cat) { console.warn(`קטגוריה לא מוכרת: ${post.cat}`); return null; }

  const slug     = `${cat.slug}-${post.id}`;
  const url      = `https://bezchut-atzmech.co.il/posts/${slug}.html`;
  const imgUrl   = cat.images[post.id % cat.images.length];
  const imgAlt   = `${cat.altPrefix} — ${post.title}`;
  const dateFmt  = formatDate(post.date);
  const content  = addH2Ids(post.content || '');
  const toc      = buildToc(content);
  const tocItems = toc.length
    ? toc.map(t => `<li><span class="toc-link" onclick="scrollTo('${t.id}')">${esc(t.text)}</span></li>`).join('\n        ')
    : `<li><span class="toc-link">תוכן הכתבה</span></li>`;

  // Related posts (same category, excl. current, up to 3)
  const sameCat = allPosts.filter(p => p.cat === post.cat);
  const related = sameCat.filter(p => p.id !== post.id).slice(0, 3);
  const relatedHTML = related.map(r => {
    const rSlug = `${cat.slug}-${r.id}`;
    return `
        <a class="related-item" href="${rSlug}.html">
          <div class="related-thumb" style="background:${r.bg}">${r.icon}</div>
          <div>
            <div class="related-title">${esc(r.title)}</div>
            <div class="related-read">${r.read} דק׳ קריאה</div>
          </div>
        </a>`;
  }).join('');

  // Prev/Next within same category
  const catIdx  = sameCat.findIndex(p => p.id === post.id);
  const prev    = catIdx > 0 ? sameCat[catIdx - 1] : null;
  const next    = catIdx < sameCat.length - 1 ? sameCat[catIdx + 1] : null;
  const prevH   = prev
    ? `<div class="post-nav-card" onclick="window.location='${cat.slug}-${prev.id}.html'">
    <span class="nav-arrow">←</span>
    <div><div class="nav-direction">הכתבה הקודמת</div><div class="nav-title">${esc(prev.title)}</div></div>
  </div>`
    : '<div></div>';
  const nextH   = next
    ? `<div class="post-nav-card next" onclick="window.location='${cat.slug}-${next.id}.html'" style="justify-content:flex-end">
    <div><div class="nav-direction">הכתבה הבאה</div><div class="nav-title">${esc(next.title)}</div></div>
    <span class="nav-arrow">→</span>
  </div>`
    : '<div></div>';

  // JSON-LD
  const articleLD = JSON.stringify({
    "@context":"https://schema.org","@type":"Article",
    headline: post.title, description: post.excerpt,
    inLanguage: "he", url, image: imgUrl,
    datePublished: post.date, dateModified: post.date,
    author: { "@type":"Person", name: post.author },
    publisher: { "@type":"Organization", name:"בזכות עצמך", url:"https://bezchut-atzmech.co.il" }
  });
  const breadcrumbLD = JSON.stringify({
    "@context":"https://schema.org","@type":"BreadcrumbList",
    itemListElement:[
      { "@type":"ListItem", position:1, name:"בית", item:"https://bezchut-atzmech.co.il/bezchut-atzmech.html" },
      { "@type":"ListItem", position:2, name: post.cat, item:`https://bezchut-atzmech.co.il/${cat.page}` },
      { "@type":"ListItem", position:3, name: post.title, item: url }
    ]
  });

  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <!-- Google Tag Manager -->
  <script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
  new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
  j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
  'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
  })(window,document,'script','dataLayer','GTM-NGFRBXF3');<\/script>
  <!-- End Google Tag Manager -->
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(post.title)} | בזכות עצמך</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link rel="stylesheet" href="posts.css" />
  <style>
    :root { --cat:${cat.color}; --cat-light:${cat.light}; --cat-dark:${cat.dark}; }
  </style>
  <meta name="description" content="${esc(post.excerpt)}" />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="${url}" />
  <meta property="og:type" content="article" />
  <meta property="og:title" content="${esc(post.title)} | בזכות עצמך" />
  <meta property="og:description" content="${esc(post.excerpt)}" />
  <meta property="og:url" content="${url}" />
  <meta property="og:image" content="${imgUrl}" />
  <meta property="og:locale" content="he_IL" />
  <meta property="og:site_name" content="בזכות עצמך" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${esc(post.title)} | בזכות עצמך" />
  <meta name="twitter:description" content="${esc(post.excerpt)}" />
  <meta name="twitter:image" content="${imgUrl}" />
  <script type="application/ld+json">${articleLD}<\/script>
  <script type="application/ld+json">${breadcrumbLD}<\/script>
</head>
<body>
  <!-- Google Tag Manager (noscript) -->
  <noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-NGFRBXF3"
  height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
  <!-- End Google Tag Manager (noscript) -->

<div id="progress-bar"><div id="progress-fill"></div></div>

<header id="site-header">
  <nav>
    <a href="../bezchut-atzmech.html" class="logo">בזכות <span>עצמך</span></a>
    <div class="nav-links">
      <a href="../esek-viyazmanut.html">עסקים</a>
      <a href="../kaspim-vefinansim.html">כספים</a>
      <a href="../marketing-digital.html">מרקטינג</a>
      <a href="../briut-veravaha.html">בריאות</a>
      <a href="../manhigut-nashit.html">מנהיגות</a>
      <a href="../lmida-vetzmikha.html">למידה</a>
      <a href="../resources.html" class="nav-cta">כלים ✦</a>
    </div>
    <div class="hamburger" id="hamburger" onclick="toggleMenu()">
      <span></span><span></span><span></span>
    </div>
  </nav>
</header>

<div class="mobile-menu" id="mobile-menu">
  <a href="../bezchut-atzmech.html">🏠 דף הבית</a>
  <a href="../esek-viyazmanut.html">💼 עסקים ויזמות</a>
  <a href="../kaspim-vefinansim.html">💰 כספים ופיננסים</a>
  <a href="../marketing-digital.html">📱 מרקטינג דיגיטלי</a>
  <a href="../briut-veravaha.html">🌿 בריאות ורווחה</a>
  <a href="../manhigut-nashit.html">👑 מנהיגות נשית</a>
  <a href="../lmida-vetzmikha.html">📚 למידה וצמיחה</a>
  <a href="../resources.html">🛠️ כלים ומשאבים</a>
</div>

<section class="post-hero" style="background:linear-gradient(135deg,#0A2A30 0%,#0D1A35 50%,#1A0528 100%)">
  <span class="hero-particle">${post.icon}</span>
  <span class="hero-particle">✨</span>
  <span class="hero-particle">💡</span>
  <div class="post-hero-inner">
    <div class="breadcrumb">
      <a href="../bezchut-atzmech.html">בית</a>
      <span>›</span>
      <a href="../${cat.page}">${esc(post.cat)}</a>
      <span>›</span>
      <span>${esc(post.title)}</span>
    </div>
    <span class="post-cat-badge" style="background:${cat.color}">${post.icon} ${esc(post.cat)}</span>
    <h1>${esc(post.title)}</h1>
    <div class="post-hero-meta">
      <a class="author-chip" href="../author.html" style="text-decoration:none;color:inherit">
        <div class="author-avatar">${post.authorIcon}</div>
        <div>
          <div class="author-name">${esc(post.author)}</div>
          <div class="author-title">כותבת, בזכות עצמך</div>
        </div>
      </a>
      <div class="meta-pills">
        <span class="meta-pill">📅 ${dateFmt}</span>
        <span class="meta-pill">⏱️ ${post.read} דק׳ קריאה</span>
        <span class="meta-pill">👁️ ${post.views.toLocaleString('he-IL')} צפיות</span>
      </div>
    </div>
  </div>
  <div class="hero-wave">
    <svg viewBox="0 0 1200 60" preserveAspectRatio="none" style="width:100%;height:60px">
      <path d="M0,30 C300,60 900,0 1200,30 L1200,60 L0,60 Z" fill="#FBF6FE"/>
    </svg>
  </div>
</section>

<div class="post-layout">
  <article id="article-body">

    <figure class="featured-image">
      <img src="${imgUrl}" alt="${esc(imgAlt)}" width="800" height="360" loading="lazy" />
    </figure>

    ${content}

    <div class="share-bar">
      <span class="share-label">שתפי:</span>
      <button class="share-btn" onclick="shareWA()">📱 ווטסאפ</button>
      <button class="share-btn" onclick="shareFB()">👥 פייסבוק</button>
      <button class="share-btn copy" id="copy-btn" onclick="copyLink()">🔗 העתיקי קישור</button>
    </div>

    <a class="author-bio" href="../author.html">
      <div class="bio-avatar">${post.authorIcon}</div>
      <div>
        <div class="bio-name">${esc(post.author)}</div>
        <div class="bio-role">כותבת, בזכות עצמך</div>
        <div class="bio-text">תוכן מקצועי לנשים יזמיות — כלים, תובנות והשראה לבניית עסק שאת גאה בו.</div>
      </div>
    </a>

  </article>

  <aside class="post-sidebar">
    <div class="sidebar-box">
      <div class="sidebar-title">📋 תוכן עניינים</div>
      <ul class="toc-list" id="toc-list">
        ${tocItems}
      </ul>
    </div>

    <div class="sidebar-box">
      <div class="sidebar-title">🔗 שתפי את הכתבה</div>
      <div class="social-share">
        <button class="social-share-btn wa" onclick="shareWA()">📱 שתפי בוואטסאפ</button>
        <button class="social-share-btn fb" onclick="shareFB()">👥 שתפי בפייסבוק</button>
        <button class="social-share-btn li" onclick="shareLI()">💼 שתפי בלינקדאין</button>
        <button class="social-share-btn cp" id="sb-copy-btn" onclick="copyLink()">🔗 העתיקי קישור</button>
      </div>
    </div>

    <div class="sidebar-box">
      <div class="sidebar-title">📖 כתבות קשורות</div>
      <div class="related-list">${relatedHTML}</div>
    </div>

    <a href="../${cat.page}" style="display:block;text-align:center;padding:14px;background:${cat.light};border-radius:var(--radius);color:${cat.dark};font-weight:700;font-size:.9rem;transition:all .2s"
       onmouseover="this.style.background='${cat.color}';this.style.color='#fff'"
       onmouseout="this.style.background='${cat.light}';this.style.color='${cat.dark}'">
      ← חזרה לקטגוריה: ${esc(post.cat)}
    </a>
  </aside>
</div>

<section id="newsletter" class="newsletter-box" style="max-width:860px;margin:0 auto 60px;padding:36px 40px">
  <h3>📬 קבלי תוכן בלעדי ישירות למייל</h3>
  <p>הצטרפי לאלפי יזמיות שמקבלות כל שבוע כלים, תובנות ומשאבים מעשיים.</p>
  <form class="newsletter-form" onsubmit="submitNewsletter(event)">
    <input type="email" id="nl-email" placeholder="כתובת המייל שלך" required />
    <button type="submit">הצטרפי בחינם ←</button>
    <div class="nl-consent" style="flex-basis:100%">
      <label><input type="checkbox" id="nl-consent" required />אני מסכימה לקבל תוכן שיווקי ועדכונים מבזכות עצמך בדוא"ל. ניתן לבטל בכל עת. <a href="../privacy.html" target="_blank">מדיניות פרטיות</a></label>
    </div>
  </form>
  <p class="newsletter-note">ללא ספאם. מתנתקת בקליק.</p>
</section>

<div class="post-nav">
  ${prevH}
  ${nextH}
</div>

<button class="scroll-top" id="scroll-top" onclick="window.scrollTo({top:0,behavior:'smooth'})">↑</button>

<footer>
  <div class="footer-inner">
    <div class="footer-grid">
      <div>
        <div class="footer-logo">בזכות <span>עצמך</span></div>
        <div class="footer-desc">פורטל התוכן המוביל לנשים יזמיות בישראל.</div>
        <div class="footer-social">
          <a class="social-btn-f" href="#">📸</a>
          <a class="social-btn-f" href="#">👥</a>
          <a class="social-btn-f" href="#">🎵</a>
          <a class="social-btn-f" href="#">💼</a>
        </div>
      </div>
      <div class="footer-col">
        <h4>קטגוריות</h4>
        <ul>
          <li><a href="../esek-viyazmanut.html">עסקים ויזמות</a></li>
          <li><a href="../kaspim-vefinansim.html">כספים ופיננסים</a></li>
          <li><a href="../marketing-digital.html">מרקטינג דיגיטלי</a></li>
          <li><a href="../briut-veravaha.html">בריאות ורווחה</a></li>
          <li><a href="../manhigut-nashit.html">מנהיגות נשית</a></li>
          <li><a href="../lmida-vetzmikha.html">למידה וצמיחה</a></li>
        </ul>
      </div>
      <div class="footer-col">
        <h4>משאבים</h4>
        <ul>
          <li><a href="../resources.html">כלים מומלצים</a></li>
          <li><a href="../machshevon-tmhur.html">🧮 מחשבון</a></li>
          <li><a href="../about.html">אודות</a></li>
        </ul>
      </div>
      <div class="footer-col">
        <h4>פרטיות</h4>
        <ul>
          <li><a href="../privacy.html">מדיניות פרטיות</a></li>
          <li><a href="../about.html">צרי קשר</a></li>
        </ul>
      </div>
    </div>
    <div class="footer-bottom">
      <span>© 2026 בזכות עצמך. כל הזכויות שמורות.</span>
      <div style="display:flex;gap:16px">
        <a href="../privacy.html">פרטיות</a>
      </div>
    </div>
  </div>
</footer>

<script>
// READING PROGRESS
function updateProgress() {
  const art = document.getElementById('article-body');
  const pct = Math.min(100, Math.max(0,
    ((window.scrollY - art.offsetTop + 200) / (art.offsetHeight - 200)) * 100));
  document.getElementById('progress-fill').style.width = pct + '%';
}

// TOC
const tocIds = Array.from(document.querySelectorAll('article h2[id]')).map(h => h.id);
function updateToc() {
  const y = window.scrollY + 120;
  let active = tocIds[0];
  tocIds.forEach(id => {
    const el = document.getElementById(id);
    if (el && el.offsetTop <= y) active = id;
  });
  document.querySelectorAll('.toc-link').forEach((link, i) => {
    link.classList.toggle('active', tocIds[i] === active);
  });
}
window.addEventListener('scroll', () => {
  updateProgress(); updateToc();
  document.getElementById('site-header').classList.toggle('scrolled', window.scrollY > 40);
  document.getElementById('scroll-top').classList.toggle('visible', window.scrollY > 300);
});
function scrollTo(id) {
  const el = document.getElementById(id);
  if (el) window.scrollTo({ top: el.offsetTop - 90, behavior: 'smooth' });
}

// SHARE
function shareWA() { window.open('https://api.whatsapp.com/send?text=' + encodeURIComponent(document.title + '\\n' + location.href)); }
function shareFB() { window.open('https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(location.href)); }
function shareLI() { window.open('https://www.linkedin.com/sharing/share-offsite/?url=' + encodeURIComponent(location.href)); }
function copyLink() {
  navigator.clipboard.writeText(location.href).then(() => {
    ['copy-btn','sb-copy-btn'].forEach(id => {
      const btn = document.getElementById(id);
      if (btn) { btn.textContent = '✓ הועתק!'; setTimeout(() => btn.textContent = '🔗 העתיקי קישור', 2000); }
    });
  });
}

// NAV
function toggleMenu() { document.getElementById('mobile-menu').classList.toggle('open'); }

// NEWSLETTER — עדכני את ה-URL להook של Make.com שלך
function submitNewsletter(e) {
  e.preventDefault();
  const consent = document.getElementById('nl-consent');
  if (!consent || !consent.checked) { alert('יש לסמן הסכמה לקבלת דיוור (תיקון 13).'); return; }
  const email = document.getElementById('nl-email').value;
  const WEBHOOK = 'REPLACE_WITH_MAKE_WEBHOOK_URL'; // ← הכניסי את ה-Webhook URL של Make.com
  fetch(WEBHOOK, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, source: 'post-${slug}', page: location.href })
  }).then(() => {
    window.location.href = '../thank-you.html?source=post-${slug}';
  }).catch(() => {
    window.location.href = '../thank-you.html?source=post-${slug}';
  });
}

updateProgress(); updateToc();
<\/script>
</body>
</html>`;
}

// ── RUN GENERATION ────────────────────────────────────────────────────────────
let count = 0;
const slugs = [];

ALL_POSTS.forEach(post => {
  const cat = CAT[post.cat];
  if (!cat) return;
  const slug = `${cat.slug}-${post.id}`;
  const html = generateHTML(post, ALL_POSTS);
  if (!html) return;
  fs.writeFileSync(path.join(postsDir, `${slug}.html`), html, 'utf-8');
  slugs.push({ slug, date: post.date });
  count++;
});

console.log(`✓ נוצרו ${count} קבצי HTML ב-posts/`);

// ── UPDATE SITEMAP.XML ────────────────────────────────────────────────────────
const sitemapPath = path.join(__dirname, 'sitemap.xml');
let sitemap = fs.readFileSync(sitemapPath, 'utf-8');

// Remove old post entries if any
sitemap = sitemap.replace(/\s*<!-- Blog Posts -->[^]*?(?=\s*<\/urlset>)/, '');

// Build new post entries
const postEntries = slugs.map(({ slug, date }) => `
  <url>
    <loc>https://bezchut-atzmech.co.il/posts/${slug}.html</loc>
    <lastmod>${date}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>`).join('');

sitemap = sitemap.replace('</urlset>', `
  <!-- Blog Posts -->${postEntries}

</urlset>`);

fs.writeFileSync(sitemapPath, sitemap, 'utf-8');
console.log(`✓ עודכן sitemap.xml עם ${slugs.length} פוסטים`);
console.log('\n🎉 סיום! הרץ את האתר ובדוק posts/esek-viyazmanut-1.html');
console.log('⚠️  זכרי לעדכן את REPLACE_WITH_MAKE_WEBHOOK_URL בקוד הניוזלטר');
