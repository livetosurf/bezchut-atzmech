#!/usr/bin/env node
/**
 * build.js — בונה את כל האתר ממקור האמת (posts-data.js) בפקודה אחת:
 *   1. generate-posts.js          — דפי הכתבות ב-posts/
 *   2. tools/build-listings.js    — רשימות הכתבות בדף הבית, בעמודי הקטגוריה וב-all-posts
 *   3. tools/generate-sitemap.js  — sitemap.xml
 *   4. tools/validate-articles.js — אימות (נכשל = לא דוחפים)
 *
 * הרץ: node build.js
 */
const { execFileSync } = require('child_process');
const path = require('path');

const steps = ['generate-posts.js', 'tools/build-listings.js', 'tools/generate-sitemap.js', 'tools/validate-articles.js'];
for (const step of steps) {
  console.log(`\n━━ ${step} ━━`);
  try {
    execFileSync(process.execPath, [path.join(__dirname, step)], { stdio: 'inherit', cwd: __dirname });
  } catch {
    console.error(`\n✗ ${step} נכשל — הבנייה נעצרה. תקני את הבעיה והריצי שוב.`);
    process.exit(1);
  }
}
console.log('\n✓ האתר נבנה ואומת. אפשר לעשות commit ו-push.');
