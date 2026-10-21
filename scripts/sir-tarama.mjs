// S-B1 kapısı: kaynakta, testlerde ve derleme çıktısında gerçek biçimli Devir anahtarı ya da adrese gömülü anahtar olmasın.
// Testlerdeki kısa sahte anahtarlar (dv_sahip) kalıba girmez; kalıp yalnız üretilen uzunluktaki (18+) anahtarları yakalar.
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const KOKLER = ['src', 'sunucu', 'e2e', 'scripts', 'supabase', 'docs', 'dist', 'index.html'];
const ATLA = new Set(['node_modules', '.git']);
const ANAHTAR = /dv_(?!sahte)[A-Za-z0-9]{18,}/g; // sahte kipin uydurma anahtarları (dv_sahte…) gerçek değil
const ADRESTE = /devir-mcp\/dv_(?!sahte)[A-Za-z0-9]{10,}|[?&]k=dv_(?!sahte)[A-Za-z0-9]{10,}/g;

function* dosyalar(yol) {
  if (!existsSync(yol)) return;
  const s = statSync(yol);
  if (s.isFile()) { yield yol; return; }
  for (const ad of readdirSync(yol)) if (!ATLA.has(ad)) yield* dosyalar(join(yol, ad));
}

const bulgular = [];
for (const k of KOKLER) for (const d of dosyalar(k)) {
  if (!/\.(ts|tsx|js|mjs|json|html|css|md|sql|map)$/.test(d)) continue;
  const metin = readFileSync(d, 'utf8');
  for (const re of [ANAHTAR, ADRESTE]) for (const m of metin.matchAll(re)) bulgular.push(`${d}: ${m[0].slice(0, 9)}…`);
}
if (bulgular.length) {
  console.error(`✗ ${bulgular.length} anahtar izi bulundu (değer kısaltıldı):\n` + bulgular.join('\n'));
  process.exit(1);
}
console.log('✓ kaynakta, testlerde ve derleme çıktısında Devir anahtarı yok');
