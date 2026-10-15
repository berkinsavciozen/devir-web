// npm run geometri:test  →  `node galaksi-geometri.js --test` ile aynı çıktı; %1 üstü hatada çıkış kodu 1.
import { readFileSync } from 'node:fs';
import { test } from '../src/geometri/galaksi-geometri';
import { ornekAkislar, SIMDI } from '../src/geometri/ornek';

const veri = JSON.parse(readFileSync(new URL('../tasarim/kaynak/veri.json', import.meta.url), 'utf8'));
const ham = JSON.parse(readFileSync(new URL('../tasarim/veri/ornek-veri.json', import.meta.url), 'utf8'));
let en = 0;
for (const [kod, akis] of Object.entries(ornekAkislar(veri, ham))) {
  const r = test(akis, { simdi: SIMDI });
  en = Math.max(en, r.hata);
  const ort = Object.values(r.G.gezegen).filter((g) => g.ortak).length;
  console.log(kod.padEnd(5), 'üye', r.G.uyeler.length, '· parça', String(r.parca).padStart(3), '· ortak gezegen', ort, '· en büyük göreli uzunluk hatası', (r.hata * 100).toFixed(3) + '%');
}
console.log(en < 0.01 ? 'TAMAM: bütün yollarda uzunluk ∝ zaman (%1 altında)' : 'UYARI: %1 üstü hata var');
process.exit(en < 0.01 ? 0 : 1);
