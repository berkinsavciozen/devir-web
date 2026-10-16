// npm run karsilastir  →  karsilastirma/index.html: tasarım PNG'si ile uygulama çekimi yan yana + üst üste (fark) görünümü.
// Tasarım PNG'leri depoda değil (≈ 92 MB); TASARIM_EKRANLAR ile verilir.
import { copyFileSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const kaynak = process.env.TASARIM_EKRANLAR || '/mnt/project-files/design-competition/tur-3/d3-son/ekranlar';
const kok = 'karsilastirma', app = join(kok, 'uygulama'), tas = join(kok, 'tasarim');
mkdirSync(tas, { recursive: true });
const adlar = existsSync(app) ? readdirSync(app).filter((x) => x.endsWith('.png')).map((x) => x.slice(0, -4)).sort() : [];
const satir = adlar.map((ad) => {
  const var_ = existsSync(join(kaynak, ad + '.png'));
  if (var_) copyFileSync(join(kaynak, ad + '.png'), join(tas, ad + '.png'));
  return `<section><h2>${ad}</h2><div class="cift">
  <figure><figcaption>Tasarım</figcaption>${var_ ? `<img src="tasarim/${ad}.png">` : '<div class="yok">PNG yok</div>'}</figure>
  <figure><figcaption>Uygulama</figcaption><img src="uygulama/${ad}.png"></figure>
  ${var_ ? `<figure class="ust"><figcaption>Üst üste (fark)</figcaption><div class="yigin"><img src="tasarim/${ad}.png"><img class="fark" src="uygulama/${ad}.png"></div></figure>` : ''}
</div></section>`;
}).join('\n');
writeFileSync(join(kok, 'index.html'), `<!doctype html><html lang="tr"><meta charset="utf-8"><title>Devir · tasarım karşılaştırması</title>
<style>body{background:#090619;color:#FFF3E8;font:14px Inter,system-ui,sans-serif;margin:24px}h2{font:700 18px Caladea,Georgia,serif}
.cift{display:flex;gap:16px;align-items:flex-start;flex-wrap:wrap}figure{margin:0}figcaption{color:#BFB0E0;margin-bottom:6px}
img{width:390px;display:block;border-radius:12px}.yigin{position:relative}.yigin .fark{position:absolute;inset:0;mix-blend-mode:difference}
.yok{width:390px;height:200px;display:grid;place-items:center;border:1px dashed #8E80D6;border-radius:12px}</style>
<h1>Tasarım ↔ uygulama</h1><p>Fark görünümünde siyah = aynı; parlak = farklı. Tolerans: bölgeler ±8 px, gezegenler ±2 px (SPESIFIKASYON §11).</p>
${satir}</html>`);
console.log('karşılaştırma:', adlar.length, 'ekran →', join(kok, 'index.html'));
