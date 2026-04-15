/**
 * _update_consent.js — מוסיף צ'קבוקס הסכמה לקבצי פוסט ישנים (local IDs)
 */
const fs = require('fs');
const path = require('path');
const postsDir = path.join(__dirname, 'posts');

// הקבצים שנוצרו עם local IDs (1-9) ועדיין לא עודכנו
const OLD_FILES = [
  ...Array.from({length:9}, (_,i) => `kaspim-vefinansim-${i+1}.html`),
  ...Array.from({length:9}, (_,i) => `marketing-digital-${i+1}.html`),
  ...Array.from({length:9}, (_,i) => `briut-veravaha-${i+1}.html`),
  ...Array.from({length:9}, (_,i) => `manhigut-nashit-${i+1}.html`),
];

let updated = 0;
let skipped = 0;

OLD_FILES.forEach(name => {
  const filePath = path.join(postsDir, name);
  if (!fs.existsSync(filePath)) { console.log(`⚠️  לא נמצא: ${name}`); skipped++; return; }

  let html = fs.readFileSync(filePath, 'utf-8');
  if (html.includes('nl-consent')) { console.log(`✓ כבר מעודכן: ${name}`); skipped++; return; }

  // 1. הוסף CSS לאחר .newsletter-note
  html = html.replace(
    /\.newsletter-note\{[^}]+\}/,
    m => m + `\n.nl-consent{display:flex;gap:8px;align-items:flex-start;margin:14px auto 0;max-width:420px;text-align:right;width:100%}\n.nl-consent input[type=checkbox]{margin-top:3px;accent-color:var(--accent);flex-shrink:0;width:16px;height:16px;cursor:pointer}\n.nl-consent label{font-size:.76rem;line-height:1.55;color:rgba(255,255,255,.55);cursor:pointer;font-family:'Assistant',sans-serif}\n.nl-consent label a{color:var(--accent);text-decoration:underline}`
  );

  // 2. הוסף checkbox בטופס (לפני </form>)
  html = html.replace(
    /<button type="submit">הצטרפי בחינם ←<\/button>\s*<\/form>/,
    `<button type="submit">הצטרפי בחינם ←</button>
    <div class="nl-consent" style="flex-basis:100%">
      <input type="checkbox" id="nl-consent" required />
      <label for="nl-consent">אני מסכימה לקבל תוכן שיווקי ועדכונים מבזכות עצמך בדוא"ל. ניתן לבטל בכל עת. <a href="../privacy.html" target="_blank">מדיניות פרטיות</a></label>
    </div>
  </form>`
  );

  // 3. עדכן JS — הוסף בדיקת consent
  html = html.replace(
    /function submitNewsletter\(e\) \{\s*e\.preventDefault\(\);/,
    `function submitNewsletter(e) {
  e.preventDefault();
  const consent = document.getElementById('nl-consent');
  if (!consent || !consent.checked) { alert('יש לסמן הסכמה לקבלת דיוור (תיקון 13).'); return; }`
  );

  fs.writeFileSync(filePath, html, 'utf-8');
  console.log(`✅ עודכן: ${name}`);
  updated++;
});

console.log(`\n✓ עודכנו ${updated} קבצים, דולגו ${skipped}`);
