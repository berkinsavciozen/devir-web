// tasarim/tokens.json → src/stil/tokens.css (CSS değişkenleri) + src/stil/tokens.ts (SVG çizimleri için).
// Elle düzenleme yok: değer değişecekse tokens.json değişir, bu betik yeniden çalışır (npm run tokens).
import { readFileSync, writeFileSync } from 'node:fs';

const T = JSON.parse(readFileSync(new URL('../tasarim/tokens.json', import.meta.url), 'utf8'));
const v = (n) => n.$value;
const css = [], ts = {};
const ad = (...p) => p.join('-').toLowerCase();

// Renkler: --renk-<grup>-<ad>
for (const [grup, renkler] of Object.entries(T.renk)) {
  if (grup.startsWith('$') || grup === 'degrade') continue;
  ts[grup] = {};
  for (const [k, n] of Object.entries(renkler)) {
    if (k.startsWith('$')) continue;
    css.push(`  --renk-${ad(grup, k)}: ${v(n)};`);
    ts[grup][k] = v(n);
  }
}
// Degradeler: durak listesi → TS dizisi; CSS'te doğrusal olanlar linear-gradient
const durak = (s) => { const m = s.match(/^(#[0-9A-Fa-f]{6})(?:\/([\d.]+))?(?:\s+([\d.]+))?$/); return { renk: m[1], opaklik: m[2] ? +m[2] : 1, konum: m[3] != null ? +m[3] : null }; };
ts.degrade = {};
for (const [k, n] of Object.entries(T.renk.degrade)) {
  if (k.startsWith('$')) continue;
  ts.degrade[k] = v(n).map(durak);
}
const lin = (k) => `linear-gradient(180deg, ${ts.degrade[k].map((d) => `${d.renk} ${(d.konum ?? 0) * 100}%`).join(', ')})`;
css.push(`  --degrade-gok: ${lin('gok')};`);
css.push(`  --degrade-sayfa: ${lin('sayfa')};`);
css.push(`  --degrade-dugme: linear-gradient(135deg, ${ts.degrade.dugme.map((d) => `${d.renk} ${(d.konum ?? 0) * 100}%`).join(', ')});`);
css.push(`  --degrade-pirinc: linear-gradient(135deg, ${ts.degrade.pirinc.map((d) => `${d.renk} ${(d.konum ?? 0) * 100}%`).join(', ')});`);

// Tipografi
const aile = T.tipografi.aile;
css.push(`  --font-serif: ${v(aile.serif)};`, `  --font-sans: ${v(aile.sans)};`);
ts.tipografi = {};
for (const [k, n] of Object.entries(T.tipografi.olcek)) {
  if (k.startsWith('$')) continue;
  const o = v(n); ts.tipografi[k] = o;
  css.push(`  --tip-${k}-aile: var(--font-${o.aile});`, `  --tip-${k}-boyut: ${o.boyut}px;`, `  --tip-${k}-agirlik: ${o.agirlik};`);
  if (o.satir) css.push(`  --tip-${k}-satir: ${o.satir}px;`);
}
// Aralık, yarıçap
for (const [k, n] of Object.entries(T.aralik)) if (!k.startsWith('$')) css.push(`  --aralik-${k}: ${v(n)}px;`);
for (const [k, n] of Object.entries(T.yaricap)) if (!k.startsWith('$') && typeof v(n) === 'number') css.push(`  --yaricap-${k}: ${v(n)}px;`);
// Hareket
for (const [k, n] of Object.entries(T.hareket.sure)) if (!k.startsWith('$')) css.push(`  --sure-${k}: ${v(n)}ms;`);
for (const [k, n] of Object.entries(T.hareket.egri)) if (!k.startsWith('$') && v(n).startsWith('cubic')) css.push(`  --egri-${k}: ${v(n)};`);
ts.sure = Object.fromEntries(Object.entries(T.hareket.sure).filter(([k]) => !k.startsWith('$')).map(([k, n]) => [k, v(n)]));
ts.boyut = Object.fromEntries(Object.entries(T.boyut).filter(([k]) => !k.startsWith('$')).map(([k, n]) => [k, v(n)]));
ts.galaksi = Object.fromEntries(Object.entries(T.galaksi).filter(([k]) => !k.startsWith('$')).map(([k, n]) => [k, v(n)]));
ts.dosya = Object.fromEntries(Object.entries(T.dosya).filter(([k]) => !k.startsWith('$')).map(([k, n]) => [k, v(n)]));

const bas = '/* Üretildi: npm run tokens (kaynak tasarim/tokens.json). Elle düzenleme. */\n';
writeFileSync(new URL('../src/stil/tokens.css', import.meta.url), `${bas}:root {\n${css.join('\n')}\n}\n`);
writeFileSync(new URL('../src/stil/tokens.ts', import.meta.url), `${bas}export const tokens = ${JSON.stringify(ts, null, 2)} as const;\nexport type Tokens = typeof tokens;\n`);
console.log('tokens:', css.length, 'CSS değişkeni');
