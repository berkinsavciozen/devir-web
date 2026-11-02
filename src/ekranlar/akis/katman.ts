// Harita üst katmanları: yakınlaşınca etiketler, kişi adları, kule kartı (B3 "Pinch"; küme yelpazesi plan 2 Kas'ta kalktı, küme yakınlaşarak ayrışır).
// Hepsi ekran koordinatında (yakınlaşmış yolCiz çıktısı) çizilir; çizgi kalınlığı ölçekle büyümez.
import { C, f, pill } from '../../cizim/ortak.js';
import { gunAy, kisaAd, sans } from '../../cizim/yol.js';
import { adimAdi, adimEtiketi, gunAyUzun, paySure } from '../../metin/turkce';
import type { Bolge } from './gezinme';

const BITTI = (d: string) => ['tamam', 'atlandi', 'ertelendi'].includes(d);
export type Daire = { x: number; y: number; r: number };
export type Kutu = { x0: number; y0: number; x1: number; y1: number };
const kesisir = (a: Kutu, b: Kutu) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
const daireKutu = (c: Daire): Kutu => ({ x0: c.x - c.r, y0: c.y - c.r, x1: c.x + c.r, y1: c.y + c.r });
/** Dokunma alanı başkalarıyla çakışmıyor mu (≥ 44 px hedefler üst üste binmez) */
export const bos = (c: Daire, dolu: Daire[]) => dolu.every((t) => Math.hypot(c.x - t.x, c.y - t.y) >= c.r + t.r - .5);
const hapEni = (t: string, fs: number) => Math.round(t.length * fs * .56 + 14);
const icinde = (b: Bolge, k: Kutu) => k.x0 >= b.x + 2 && k.x1 <= b.x + b.w - 2 && k.y0 >= b.y + 2 && k.y1 <= b.y + b.h - 2;

/** Yakınlaşınca adım etiketleri: öncelik engelli > kritik > sırası gelmiş > sırada > bitmiş; sınır ölçekle artar, çakışan yazılmaz. */
export function yakinEtiketler(d: any, Y: any, b: Bolge, k: number, odak: string | null, gemiler: Daire[], kad = 2): { svg: string; kutular: Kutu[] } {
  const kritik = new Set<number>(d.kritik_yol || []), byNo = new Map<number, any>(d.adimlar.map((a: any) => [a.no, a]));
  const inCl = new Set<number>((Y.clusters || []).flat());
  const sinir = kad <= 1 ? 4 : Math.round(2 + (k - 1) * 3);
  // öncelik (karar 3.D): engelli > karar > kritik yol > sürüyor > sırada > bitti; Z1'de yalnız ilk dördü
  const oncelik = (a: any) => (a.durum === 'engelli' ? 0 : a.karar_adimi && !BITTI(a.durum) ? 1 : kritik.has(a.no) && !BITTI(a.durum) ? 2 : a.durum === 'suruyor' ? 3 : BITTI(a.durum) ? 5 : 4);
  const Z1 = (a: any) => a.durum === 'engelli' || (a.karar_adimi && !BITTI(a.durum)) || a.durum === 'suruyor';
  const aday = Object.values(Y.G.gezegen as Record<string, any>)
    .map((g: any) => ({ g, a: byNo.get(g.no) }))
    .filter(({ g, a }) => a && (kad >= 2 || Z1(a)) && !inCl.has(g.no) && g.x > b.x && g.x < b.x + b.w && g.y > b.y && g.y < b.y + b.h && (!odak || g.uyeler.includes(odak)))
    .sort((p, q) => oncelik(p.a) - oncelik(q.a) || p.g.t - q.g.t);
  const dolu: Kutu[] = [...Object.values(Y.G.gezegen as Record<string, any>).map((g: any) => daireKutu({ x: g.x, y: g.y, r: Y.radOf(g.no) + 2 })), ...gemiler.map(daireKutu)];
  const kutular: Kutu[] = [];
  let s = '', n = 0;
  for (const { g, a } of aday) {
    if (n >= sinir) break;
    const t = adimEtiketi(a) + (kad >= 3 ? ` · ${gunAy(g.t)}` : ''), w = hapEni(t, 11), h = 20, r = Y.radOf(g.no);
    for (const dy of [r + 16, -(r + 16)]) {
      const kt = { x0: g.x - w / 2, y0: g.y + dy - h / 2, x1: g.x + w / 2, y1: g.y + dy + h / 2 };
      if (!icinde(b, kt) || kutular.some((q) => kesisir(q, kt)) || dolu.some((q) => kesisir(q, kt))) continue;
      const o = oncelik(a);
      s += pill(g.x, g.y + dy, t, { fs: 11, fw: 650, col: o === 0 ? '#FFD6CC' : o <= 2 ? '#FFE6B0' : o === 5 ? C.ink3 : C.ink, stroke: o === 0 ? '#FF8A78' : o <= 2 ? '#FFD27A' : undefined });
      kutular.push(kt); n++; break;
    }
  }
  return { svg: s, kutular };
}

/** Kişi adları: her kişinin işaretinin üstünde kısa ad (yakınlaşınca); dokunulan kişide açık adım sayısıyla (kişi kartı). */
export function kisiAdlari(d: any, Y: any, b: Bolge, hepsi: boolean, kart: string | null, dolu: Kutu[]): string {
  let s = '';
  const engel = [...dolu, ...Object.values(Y.G.gezegen as Record<string, any>).map((g: any) => daireKutu({ x: g.x, y: g.y, r: Y.radOf(g.no) + 2 }))];
  for (const g of Y.gemiler || []) {
    if (!hepsi && g.ad !== kart) continue;
    const acik = d.adimlar.filter((a: any) => a.sahip === g.ad && !BITTI(a.durum)).length;
    const t = g.ad === kart ? `${kisaAd(g.ad)} · ${acik} açık adım` : kisaAd(g.ad), w = hapEni(t, 11);
    for (const y of [g.y - 26, g.y + 26]) {
      const kt = { x0: g.x - w / 2, y0: y - 10, x1: g.x + w / 2, y1: y + 10 };
      if (!icinde(b, kt) || engel.some((q) => kesisir(q, kt))) continue;
      s += pill(g.x, y, t, { fs: 11, fw: 650, col: Y.RENK[g.ad] || C.ink, stroke: g.ad === kart ? (Y.RENK[g.ad] || C.ink) : undefined });
      engel.push(kt); dolu.push(kt); break;
    }
  }
  return s;
}

/** Kule kartı: hedef tarih, en erken bitiş ve pay, kritik yolun açık adımları. */
export function kuleKarti(d: any, kule: { x: number; y: number }, b: Bolge): string {
  const k = d.akis, byNo = new Map<number, any>(d.adimlar.map((a: any) => [a.no, a]));
  const satir: [string, number, number, string][] = [];
  if (k.hedef_tarih) satir.push([`Hedef ${gunAyUzun(k.hedef_tarih)}`, 14, 700, C.ink]);
  if (k.en_erken_bitis) satir.push([`En erken ${gunAyUzun(k.en_erken_bitis)}${k.pay_saat == null ? '' : k.pay_saat >= 0 ? ` · ${paySure(k.pay_saat)} pay` : ` · ${paySure(k.pay_saat)} geç`}`, 12.5, 600, k.pay_saat != null && k.pay_saat < 0 ? '#FFC2B8' : '#FFE6B0']);
  const kr = (d.kritik_yol || []).map((no: number) => byNo.get(no)).filter((a: any) => a && !BITTI(a.durum)).map((a: any) => adimAdi(a));
  if (kr.length) {
    let t = 'Kritik yol: ', i = 0;
    while (i < kr.length && (t + kr[i]).length < 34) t += (i ? ', ' : '') + kr[i++];
    if (i < kr.length) t += i ? ` +${kr.length - i}` : kr[0].slice(0, 20) + '…';
    satir.push([t, 12, 500, C.ink2]);
  }
  if (!satir.length) satir.push(['Hedef tarih yok', 13, 600, C.ink2]);
  const w = 236, h = 22 + satir.length * 19, x = Math.min(Math.max(kule.x - w / 2, b.x + 8), b.x + b.w - w - 8);
  const ust = kule.y - 40 - h > b.y + 4, y = ust ? kule.y - 40 - h : Math.min(kule.y + 26, b.y + b.h - h - 4);
  let s = `<rect x="${f(x)}" y="${f(y)}" width="${w}" height="${h}" rx="18" fill="#08222E" fill-opacity=".96" stroke="#FFD27A" stroke-opacity=".6"/>`;
  satir.forEach(([t, fs, fw, col], i) => { s += sans(f(x + 16), f(y + 24 + i * 19), t, { fs, fw, col }); });
  return s;
}
