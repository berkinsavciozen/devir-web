// Ekran süsleri: tasarım kaynağındaki (d3-son/kaynak/son-ortak.js, son-090.js, ekranlar.js) yardımcıların
// yalnız çizim kısmı. Metin, düğme ve alanlar HTML olarak çizilir; burada yalnız SVG süsleri kalır.
// Ölçüler ve renkler kaynakla aynıdır (token dışı illüstrasyon renkleri: tasarim/CELISKILER.md #1).
import { f, sparkle } from './ortak.js';

export const W = 390, H = 844;
export const GUN = 864e5;
/** Takvim halkası: 1 Eki → 1 Oca (92 gün), tepe 1 Eki (§3.10) */
export const TAKVIM0 = Date.parse('2026-10-01T00:00:00+03:00');
export const TAKVIM1 = Date.parse('2027-01-01T00:00:00+03:00');
const tl = (ms: number) => new Date(ms + 3 * 36e5);

/** Zarf (A1b, A1d). */
export function zarf(x: number, y: number, sc = 1, dolgu = 'url(#btn)') {
  return `<g transform="translate(${x},${y}) scale(${sc})"><rect x="-40" y="-28" width="80" height="56" rx="10" fill="${dolgu}"/><path d="M-36,-24 L0,4 L36,-24" fill="none" stroke="#2A1D4F" stroke-opacity=".55" stroke-width="2.4" stroke-linejoin="round"/><path d="M-36,24 L-12,2 M36,24 L12,2" stroke="#2A1D4F" stroke-opacity=".25" stroke-width="1.6"/></g>`;
}

/** Bilgi işareti (i), merkez 0,0 — 18 px kutuya çizilir. */
export const bilgiIkon = (renk = '#B9A6F2') =>
  `<circle r="7" fill="none" stroke="${renk}" stroke-width="1.4"/><rect x="-.8" y="-1" width="1.6" height="4.6" fill="${renk}"/><circle cy="-3.4" r=".9" fill="${renk}"/>`;
/** Uyarı (!) işareti A3'teki: nokta altta. */
export const dikkatIkon = (renk = '#FFD27A') =>
  `<circle r="7" fill="none" stroke="${renk}" stroke-width="1.4"/><rect x="-.8" y="-4" width="1.6" height="4.6" fill="${renk}"/><circle cy="2.6" r=".9" fill="${renk}"/>`;

/** Logo işareti (A4, A5): şeftali ay. Merkez 0,0. */
export const logoIsaret = () => `<circle r="13" fill="url(#btn)"/><circle cx="4" cy="-3" r="9" fill="#120B2C"/>`;

/** Kopyala ikonu (44 px düğmenin içi, sol üst 0,0). */
export const kopyaIkon = () =>
  `<rect x="14" y="11" width="13" height="16" rx="3" fill="none" stroke="#FFD27A" stroke-width="1.6"/><rect x="18" y="16" width="13" height="16" rx="3" fill="#2A1D5C" stroke="#FFD27A" stroke-width="1.6"/>`;
export const tikIkon = () => `<path d="M15,22 L20,27 L29,17" stroke="#FFD27A" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;

/** Anahtar ikonu (Anahtarla gir), merkez 0,0. */
export const anahtarIkon = () => `<circle cx="-4" r="5" fill="none" stroke="#D9CCFF" stroke-width="1.6"/><path d="M1,0 L10,0 M7,0 L7,4" stroke="#D9CCFF" stroke-width="1.6" stroke-linecap="round"/>`;
/** Kalem ikonu (Buradan yaz), merkez 0,0. */
export const kalemIkon = () => `<path d="M-6,5 L4,-5 L7,-2 L-3,8 L-7,9Z" fill="none" stroke="#FFD27A" stroke-width="1.6" stroke-linejoin="round"/>`;

export interface EvrenAkis { kapandi?: number; hedef: string; _sc?: number; _karar?: boolean; _isim?: string }
export interface EvrenSecenek {
  c?: { cx: number; cy: number; R: number };
  bands?: number[];
  simdi: number;
  /** küçük galaksi çizicisi (galaksi.js → small); boş evrende gerekmez */
  kucuk?: (F: EvrenAkis, x: number, y: number, r: number, pr: number) => string;
  rozet?: (x: number, y: number, sc: number) => string;
  hap?: (x: number, y: number, t: string) => string;
}

/**
 * Usturlap halkası + N akış (son-ortak.js → evrenN). Açı = hedef tarih; yarıçap bantları çakışmaya göre seçilir.
 * Kapanan akışlar dış halkada (R + 26) küçük yanık galaksi.
 */
export function evrenHalkasi(flows: EvrenAkis[], o: EvrenSecenek) {
  const c = o.c || { cx: 195, cy: 470, R: 160 }, { cx, cy, R } = c;
  const NOW = o.simdi;
  const CA = TAKVIM0, CB = TAKVIM1;
  const ang = (ms: number) => -90 + (ms - CA) / (CB - CA) * 360;
  const pol = (a: number, r: number) => [cx + Math.cos(a * Math.PI / 180) * r, cy + Math.sin(a * Math.PI / 180) * r];
  let s = `<circle cx="${cx}" cy="${cy}" r="${R + 40}" fill="url(#glowLilac)" opacity=".35"/>`;
  s += `<circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="#120B2C" stroke-width="20"/>`;
  s += `<circle cx="${cx}" cy="${cy}" r="${R + 10}" fill="none" stroke="#8E80D6" stroke-opacity=".45"/><circle cx="${cx}" cy="${cy}" r="${R - 10}" fill="none" stroke="#8E80D6" stroke-opacity=".45"/>`;
  const aNow = ang(NOW);
  const arc = (a0: number, a1: number, r: number) => { const [x0, y0] = pol(a0, r), [x1, y1] = pol(a1, r); return `M${f(x0)},${f(y0)} A${r},${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${f(x1)},${f(y1)}`; };
  s += `<path d="${arc(-90, aNow, R)}" fill="none" stroke="url(#brass)" stroke-width="9" stroke-linecap="round"/>`;
  const days = Math.round((CB - CA) / GUN);
  for (let d = 0; d < days; d++) {
    const ms = CA + d * GUN, a = ang(ms), first = tl(ms).getUTCDate() === 1;
    const [x0, y0] = pol(a, R - (first ? 10 : 5)), [x1, y1] = pol(a, R + (first ? 10 : 5));
    s += `<line x1="${f(x0)}" y1="${f(y0)}" x2="${f(x1)}" y2="${f(y1)}" stroke="${ms < NOW ? '#3A1F2E' : '#B9A6F2'}" stroke-width="${first ? 1.5 : .6}" opacity="${first ? .95 : .55}"/>`;
  }
  const RO = R + 26;
  s += `<circle cx="${cx}" cy="${cy}" r="${RO}" fill="none" stroke="#FFD27A" stroke-width=".8" stroke-dasharray="1 5" opacity=".6"/>`;
  const bands = o.bands || [R - 42, R - 82, R - 120];
  const placed: Array<{ F: EvrenAkis; a: number; rr: number; p: number[]; b: number }> = [];
  const act = flows.filter((F) => !F.kapandi).map((F) => ({ F, a: ang(Date.parse(F.hedef + 'T12:00:00+03:00')) })).sort((p, q) => p.a - q.a);
  for (const it of act) {
    const rr = (it.F._sc || .3) * 62;
    let best: { b: number; p: number[]; clash: number } | null = null;
    for (const b of bands) {
      const p = pol(it.a, b);
      const clash = placed.reduce((m, q) => Math.max(m, (rr + q.rr + 6) - Math.hypot(p[0] - q.p[0], p[1] - q.p[1])), -1e9);
      if (!best || clash < best.clash) best = { b, p, clash };
      if (clash <= 0) break;
    }
    if (!best) continue;
    placed.push({ ...it, rr: best.clash > 0 ? Math.max(9, rr - best.clash) : rr, p: best.p, b: best.b });
  }
  for (const it of placed) {
    const [gx, gy] = it.p, [tx, ty] = pol(it.a, R - 11);
    s += `<line x1="${f(gx)}" y1="${f(gy)}" x2="${f(tx)}" y2="${f(ty)}" stroke="#8E80D6" stroke-width=".7" stroke-dasharray="1.5 3" opacity=".6"/><circle cx="${f(tx)}" cy="${f(ty)}" r="2.6" fill="#B9A6F2"/>`;
    if (o.kucuk) s += o.kucuk(it.F, gx, gy, it.rr, 2.4);
    if (it.F._karar && o.rozet) s += o.rozet(gx + it.rr * .9, gy - it.rr * .9, .8);
    if (it.F._isim && o.hap) s += o.hap(gx, gy + it.rr + 12, it.F._isim);
  }
  for (const F of flows.filter((x) => x.kapandi)) {
    const a = ang(F.kapandi!), [gx, gy] = pol(a, RO);
    s += `<circle cx="${f(gx)}" cy="${f(gy)}" r="17" fill="url(#bloom)" opacity=".85"/>` + (o.kucuk ? o.kucuk(F, gx, gy, 10, 1.6) : '');
  }
  const [nx, ny] = pol(aNow, R + 2), [bx, by] = pol(aNow + 180, 22);
  s += `<path d="M${f(bx)},${f(by)} L${f(nx)},${f(ny)}" stroke="url(#brass)" stroke-width="2" stroke-linecap="round"/>` + sparkle(nx, ny, 8, '#FFF1D6', 1) + `<circle cx="${f(nx)}" cy="${f(ny)}" r="16" fill="url(#glowGold)"/>`;
  s += `<circle cx="${cx}" cy="${cy}" r="8" fill="url(#brass)"/><circle cx="${cx}" cy="${cy}" r="3" fill="#2A1D4F"/>`;
  return { svg: s, placed, pol, ang };
}
