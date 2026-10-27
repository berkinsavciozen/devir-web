import { evrenYerlesimi } from '../geometri/evren';
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

/** Fırtına bulutu glifi (engel) — tasarım ekranlar.js iconCloud */
export const iconCloud = (x: number, y: number, s = 1) => `<g transform="translate(${x},${y}) scale(${s})"><path d="M-15,4 Q-19,4 -19,-1 Q-19,-6 -13,-6 Q-12,-13 -4,-13 Q2,-17 8,-11 Q16,-12 16,-4 Q20,-3 19,2 Q18,5 14,5 Z" fill="#6A5A9C" stroke="#C9BAF2" stroke-width="1.2"/><path d="M1,4 L-4,13 L1,13 L-3,22 L7,10 L2,10 L6,4Z" fill="#FFD27A" stroke="#FF8A78" stroke-width="1"/></g>`;

/** Bekleme halkası glifi — tasarım ekranlar.js iconRings */
export const iconRings = (x: number, y: number, s = 1) => `<g transform="translate(${x},${y}) scale(${s})"><circle r="15" fill="none" stroke="#FFD27A" stroke-width="1.6" stroke-dasharray="3 3" opacity=".6"/><circle r="10" fill="none" stroke="#FFD27A" stroke-width="2" stroke-dasharray="5 2.5"/><circle r="6" fill="url(#pWait)"/></g>`;

const AY_KISA = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
/** Galaksi çerçevesinin galaksi yarıçapından payı; ad hapı bu çizginin üstünde durur (N1, N3). */
export const CERCEVE = 4;
/** Galaksinin sınırı: koyu iç zemin, lila çizgi (haritada akışın kapladığı yer okunur). */
export const cerceve = (x: number, y: number, rr: number) => `<circle cx="${f(x)}" cy="${f(y)}" r="${f(rr + CERCEVE)}" fill="#120B2C" fill-opacity=".38" stroke="#8E80D6" stroke-opacity=".6" stroke-width="1.3"/>`;
/** Çerçeveye takılı ad hapının çizgisi (Evren hapları). */
export const CERCEVE_HAP = '#6B5FB0';
/** pill genişliği (ortak.js pill ile aynı kural) */
export const hapEni = (t: string, fs = 11) => Math.round(t.length * fs * .56 + 14);

export interface UAkis { kod: string; ad: string; hedef: number; kapandi?: number | null; isaret?: 'engel' | 'bekleme'; bitti?: boolean; karar?: boolean; t0?: number; payGun?: number | null; adim?: number; biten?: number; kisiler?: string[] }
export interface UYer { kod: string; x: number; y: number; rr: number; a: number; etiket: { x: number; y: number; w: number }; isik?: number }

/**
 * B1 · usturlap (ekranlar.js astrolabe, §3.10): R 170 bant 22; pirinç yay 1 Eki → bugün; ay adları dışta;
 * iç halka biten adım oranı; galaksiler hedef açısında (yarıçap bandı çakışmaya göre; işaretli akışlar önce yerleşir);
 * kapananlar dış halkada (R+26, kapanış açısında); merkezde taslak kozaları; ibre ve "14 Eki" hapı; en fazla 2 kilit parantezi.
 */
export function usturlap(o: {
  simdi: number; akislar: UAkis[]; oran: number; taslak: number;
  kucuk: (kod: string, x: number, y: number, r: number, pr: number) => string;
  c?: { cx: number; cy: number; R: number };
  /** takvim penceresi (evrenTakvimi); yoksa sabit Eki–Ara */
  takvim?: { CA: number; CB: number };
}) {
  const { cx, cy, R } = o.c || { cx: 195, cy: 470, R: 170 }, NOW = o.simdi, CA = o.takvim?.CA ?? TAKVIM0, CB = o.takvim?.CB ?? TAKVIM1;
  const ang = (ms: number) => -90 + (ms - CA) / (CB - CA) * 360;
  const pol = (a: number, r: number) => [cx + Math.cos(a * Math.PI / 180) * r, cy + Math.sin(a * Math.PI / 180) * r];
  const arc = (a0: number, a1: number, r: number) => { const [x0, y0] = pol(a0, r), [x1, y1] = pol(a1, r); return `M${f(x0)},${f(y0)} A${r},${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${f(x1)},${f(y1)}`; };
  let s = `<circle cx="${cx}" cy="${cy}" r="${R + 40}" fill="url(#glowLilac)" opacity=".35"/>`;
  // ince halka (plan 27 Eki, 3.29): 12 px bant, ±6 kenar
  s += `<circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="#120B2C" stroke-width="12"/>`;
  s += `<circle cx="${cx}" cy="${cy}" r="${R + 6}" fill="none" stroke="#8E80D6" stroke-opacity=".45" stroke-width="1"/><circle cx="${cx}" cy="${cy}" r="${R - 6}" fill="none" stroke="#8E80D6" stroke-opacity=".45" stroke-width="1"/>`;
  const aNow = Math.min(270, Math.max(-90, ang(NOW)));
  s += `<path d="${arc(-90, aNow, R)}" fill="none" stroke="#FFB47F" stroke-width="12" opacity=".35" filter="url(#blur6)"/>`;
  s += `<path d="${arc(-90, aNow, R)}" fill="none" stroke="url(#brass)" stroke-width="6" stroke-linecap="round"/>`;
  const days = Math.round((CB - CA) / GUN);
  for (let d = 0; d < days; d++) {
    const ms = CA + d * GUN, a = ang(ms), first = tl(ms).getUTCDate() === 1;
    const [x0, y0] = pol(a, R - (first ? 6 : 3.5)), [x1, y1] = pol(a, R + (first ? 6 : 3.5));
    s += `<line x1="${f(x0)}" y1="${f(y0)}" x2="${f(x1)}" y2="${f(y1)}" stroke="${ms < NOW ? '#3A1F2E' : '#B9A6F2'}" stroke-width="${first ? 1.6 : .7}" opacity="${first ? .95 : .6}"/>`;
  }
  // ay adları: ayın 5'i; ekran dışına taşarsa ayın ilerisine kayar
  for (let m = tl(CA); m.getTime() < CB + 3 * 36e5; m = new Date(Date.UTC(m.getUTCFullYear(), m.getUTCMonth() + 1, 1))) {
    for (const gun of [5, 12, 22]) {
      const ms = Date.UTC(m.getUTCFullYear(), m.getUTCMonth(), gun) - 3 * 36e5, [x, y] = pol(ang(ms), R + 18);
      if (x < 30 || x > 360) continue;
      s += `<text x="${f(x)}" y="${f(y + 4)}" font-family="Inter" font-size="11.5" font-weight="600" fill="#BFB0E0" text-anchor="middle">${AY_KISA[m.getUTCMonth()]}</text>`;
      break;
    }
  }
  // iç ince halka: biten adım oranı
  s += `<circle cx="${cx}" cy="${cy}" r="${R - 20}" fill="none" stroke="#3A3170" stroke-width="2.4" stroke-dasharray="1 4"/>`;
  if (o.oran > 0) {
    const a1 = -90 + Math.min(.9999, o.oran) * 360;
    s += `<path d="${arc(-90, a1, R - 20)}" fill="none" stroke="#FFD27A" stroke-width="2.6" stroke-linecap="round"/><path d="${arc(-90, a1, R - 20)}" fill="none" stroke="#FFD27A" stroke-width="8" opacity=".3" filter="url(#blur2)"/>`;
  }
  // yerleşim: engelli ve bekleyen işaretli akışlar önce, sonra açı sırası
  const dx = cx - 52, dy = cy - 46;
  const engeller: { x: number; y: number; r: number }[] = [{ x: cx, y: cy, r: 12 }];
  if (o.taslak) engeller.push({ x: dx + 8, y: dy + 5, r: 26 });
  const [hx, hy] = pol(aNow, R + 30);
  const yer: UYer[] = [];
  const oncelik = (F: UAkis) => (F.isaret === 'engel' ? 0 : F.isaret === 'bekleme' ? 1 : 2);
  const aktif = o.akislar.filter((F) => !F.kapandi).map((F) => ({ F, a: ang(F.hedef) })).sort((p, q) => oncelik(p.F) - oncelik(q.F) || p.a - q.a);
  const bantlar = [R - 60, R - 30, R - 90, R - 115];
  // evren matematiği (el notu 5, geometri/evren.ts): açı = hedef, uzaklık = pay, alan ∝ adım; çakışma yalnız yarıçap yönünde
  const matematik = aktif.length > 0 && aktif.every((x) => x.F.adim != null && x.F.t0 != null);
  const EY = matematik ? evrenYerlesimi(aktif.map(({ F }) => ({ kod: F.kod, t0: F.t0!, hedef: F.hedef, payGun: F.payGun ?? null, adim: F.adim!, biten: F.biten ?? 0, kisiler: F.kisiler || [] })), { cx, cy, R, CA, CB, engeller: engeller.slice(1) }) : null;
  if (EY) {
    // zaman yayı (yörünge): galaksinin kendi uzaklığında, başlangıcından hedefine; bugüne kadarki kısmı altın. İbre her yörüngeyi
    // o akışın bugünkü noktasında keser
    for (const g of EY.yer) {
      const a0 = Math.max(-90, g.yay[0]), a1 = Math.min(270, Math.max(a0 + .5, g.yay[1])), an = Math.min(a1, Math.max(a0, aNow));
      s += `<path d="${arc(a0, a1, g.rho)}" fill="none" stroke="#B9A6F2" stroke-width="1.2" opacity=".28" stroke-linecap="round"/>`;
      if (an > a0 + .3) s += `<path d="${arc(a0, an, g.rho)}" fill="none" stroke="#FFD27A" stroke-width="1.6" opacity=".6" stroke-linecap="round"/>`;
    }
    // etiket galaksinin çerçevesine takılı (N3): altta, üstte, merkeze bakan yanda, dış yanda; halkaya, başka etikete,
    // taslak hapına ve başka galaksiye binmeyen ilk yer. Hap ortası çerçeve çizgisinde durur.
    const kutular: { x: number; y: number; w: number }[] = o.taslak ? [{ x: dx + 8, y: dy + 32, w: hapEni(`${o.taslak} taslak`, 11) }] : [];
    const carpar = (kod: string, x: number, y: number, w: number) => Math.hypot(x - cx, y - cy) + w / 2 > R - 10
      || kutular.some((k) => Math.abs(k.x - x) < (k.w + w) / 2 + 4 && Math.abs(k.y - y) < 22)
      || EY.yer.some((q) => q.kod !== kod && Math.abs(q.x - x) < q.rr + 4 + w / 2 && Math.abs(q.y - y) < q.rr + 4 + 10);
    for (const g of EY.yer) {
      const w = hapEni(o.akislar.find((F) => F.kod === g.kod)!.ad, 11.5), yon = g.x > cx + 4 ? -1 : 1, c = g.rr + CERCEVE;
      const aday: [number, number][] = [[g.x, g.y + c], [g.x, g.y - c], [g.x + yon * (c + w / 2 - 6), g.y], [g.x - yon * (c + w / 2 - 6), g.y]];
      const [ex, ey] = aday.find(([x, y]) => !carpar(g.kod, x, y, w)) || aday[0];
      kutular.push({ x: ex, y: ey, w });
      yer.push({ kod: g.kod, x: g.x, y: g.y, rr: g.rr, a: g.a, etiket: { x: ex, y: ey, w }, isik: g.isik });
    }
  }
  if (!EY) for (const it of aktif) {
    const rr0 = .54 * 62;
    let best: { p: number[]; clash: number } | null = null;
    for (const b of bantlar) {
      const p = pol(it.a, b);
      const clash = [...engeller, ...yer.map((q) => ({ x: q.x, y: q.y, r: q.rr }))].reduce((m, q) => Math.max(m, (rr0 + q.r + 6) - Math.hypot(p[0] - q.x, p[1] - q.y)), -1e9);
      if (!best || clash < best.clash) best = { p, clash };
      if (clash <= 0) break;
    }
    const rr = best!.clash > 0 ? Math.max(12, rr0 - best!.clash) : rr0, [gx, gy] = best!.p;
    const w = hapEni(it.F.ad, 11.5);
    // etiket çerçevenin altında; halkaya taşarsa yanda (merkeze bakan yanda)
    let ex = gx, ey = gy + rr + CERCEVE;
    if (Math.hypot(ex - cx, ey + 10 - cy) > R - 14) { const yon = gx > cx + 4 ? -1 : 1; ex = gx + yon * (rr + CERCEVE + w / 2 - 6); ey = gy; }
    yer.push({ kod: it.F.kod, x: gx, y: gy, rr, a: it.a, etiket: { x: ex, y: ey, w } });
  }
  for (const F of o.akislar) {
    const q = yer.find((y) => y.kod === F.kod); if (!q) continue;
    const [tx, ty] = pol(q.a, R - 12), tam = !!F.bitti;
    s += `<line x1="${f(q.x)}" y1="${f(q.y)}" x2="${f(tx)}" y2="${f(ty)}" stroke="${tam ? '#FFD27A' : '#8E80D6'}" stroke-width=".8" stroke-dasharray="1.5 3" opacity=".7"/><circle cx="${f(tx)}" cy="${f(ty)}" r="3.2" fill="${tam ? '#FFE29A' : '#B9A6F2'}"/>`;
    // galaksinin sınırı (N1): koyu zeminli, görünür çerçeve; ışık (biten / toplam) hale ve çerçevedeki ilerleme yayı
    if (q.isik != null) s += `<circle cx="${f(q.x)}" cy="${f(q.y)}" r="${f(q.rr * 1.7)}" fill="url(#glowGold)" opacity="${f(.08 + .5 * q.isik)}"/>`;
    s += cerceve(q.x, q.y, q.rr);
    if (q.isik != null && q.isik > 0) { const c = q.rr + CERCEVE, a1 = -90 + Math.min(.9999, q.isik) * 360, [x0, y0] = [q.x, q.y - c], [x1, y1] = [q.x + Math.cos(a1 * Math.PI / 180) * c, q.y + Math.sin(a1 * Math.PI / 180) * c]; s += `<path d="M${f(x0)},${f(y0)} A${f(c)},${f(c)} 0 ${q.isik > .5 ? 1 : 0} 1 ${f(x1)},${f(y1)}" fill="none" stroke="#FFD27A" stroke-width="1.8" stroke-linecap="round"/>`; }
    s += o.kucuk(F.kod, q.x, q.y, q.rr, 3);
    if (F.karar) s += bayrak(q.x + q.rr * .9, q.y - q.rr * .9, .8);
  }
  // kapananlar: dış halka, kapanış açısında; bugün hapına çarpmasın
  const RO = R + 26;
  for (const F of o.akislar.filter((x) => x.kapandi)) {
    let a = ang(F.kapandi!);
    if (Math.abs(a - aNow) < 16) a = aNow - 16;
    const [gx, gy] = pol(a, RO), rr = .3 * 62, w = hapEni(F.ad, 11.5), [ex, ey] = pol(a, RO + rr + 16);
    s += `<circle cx="${f(gx)}" cy="${f(gy)}" r="22" fill="url(#bloom)" opacity=".8"/>` + o.kucuk(F.kod, gx, gy, rr, 3);
    yer.push({ kod: F.kod, x: gx, y: gy, rr, a, etiket: { x: ex, y: ey, w } });
  }
  // taslaklar: merkezde iki koza
  if (o.taslak) for (const [ox, oy, r] of [[0, 0, 11], [17, 10, 8]]) {
    s += `<circle cx="${dx + ox}" cy="${dy + oy}" r="${r * 2.3}" fill="url(#glowLilac)"/><circle cx="${dx + ox}" cy="${dy + oy}" r="${r}" fill="#B9A6F2" fill-opacity=".12" stroke="#D9CCFF" stroke-width="1" stroke-dasharray="1.5 3"/>` + sparkle(dx + ox, dy + oy, r * .4, '#FFF1D6', .95);
  }
  // ibre: bugün
  const [nx, ny] = pol(aNow, R + 2), [bx, by] = pol(aNow + 180, 26);
  s += `<line x1="${f(bx)}" y1="${f(by)}" x2="${f(nx)}" y2="${f(ny)}" stroke="#FFD9B8" stroke-width="6" opacity=".25" filter="url(#blur2)"/>`;
  s += `<path d="M${f(bx)},${f(by)} L${f(nx)},${f(ny)}" stroke="url(#brass)" stroke-width="2.2" stroke-linecap="round"/>`;
  s += sparkle(nx, ny, 9, '#FFF1D6', 1) + `<circle cx="${f(nx)}" cy="${f(ny)}" r="18" fill="url(#glowGold)"/>`;
  s += `<circle cx="${cx}" cy="${cy}" r="9" fill="url(#brass)"/><circle cx="${cx}" cy="${cy}" r="3.4" fill="#2A1D4F"/>`;
  return { svg: s, yer, taslak: o.taslak ? { x: dx + 8, y: dy + 32 } : null, hap: { x: hx + 4, y: hy - 4 }, ang, pol };
}

/** Karar bekleyen bayrak rozeti (son-ortak.js bayrak). */
export const bayrak = (x: number, y: number, sc = 1) => `<g transform="translate(${f(x)},${f(y)}) scale(${sc})"><circle r="11" fill="#150E33" stroke="#FFD27A" stroke-width="1.4"/><rect x="-3.6" y="-6.5" width="1.4" height="13" fill="#FFF1E0"/><path d="M-2.2,-6.5 L6,-3.6 L-2.2,-.8Z" fill="#FFD27A"/></g>`;
/** Fatura işareti (son-ortak.js makbuz): dolu = var, boş ve çizik = yok/teyitsiz. */
export const makbuz = (x: number, y: number, var_ = true) => `<g transform="translate(${x},${y})"><path d="M-6,-8 L6,-8 L6,8 L3,6 L0,8 L-3,6 L-6,8Z" fill="${var_ ? '#FFD27A' : 'none'}" stroke="${var_ ? '#FFD27A' : '#9C8BE0'}" stroke-width="1.3"/>${var_ ? '<path d="M-3,-3 L3,-3 M-3,1 L2,1" stroke="#2A1D4F" stroke-width="1.3"/>' : '<path d="M-6,-8 L6,8" stroke="#9C8BE0" stroke-width="1.3"/>'}</g>`;

/**
 * J1 · Ölçekte evren (son-ortak.js evrenN, §4.13–4.14): R 158, 4 bant [124, 94, 64, 34]; galaksiler hedef açısında,
 * çakışmasız ilk banda, yoksa en az çakışana (çakışma kalırsa küçülür, en az 9 px); kapananlar R+26'da etiketsiz; ay adı yok.
 * Etiket en çok 6: işaretli, karar bekleyen, sonra hedefi en yakın 3.
 */
export function evrenOlcek(o: {
  simdi: number; akislar: UAkis[];
  kucuk: (kod: string, x: number, y: number, r: number, pr: number) => string;
  c?: { cx: number; cy: number; R: number }; bantlar?: number[];
  /** takvim penceresi (evrenTakvimi); yoksa sabit Eki–Ara (J1 sarma hatası: hedefi pencere dışındaki akış başa dolanırdı) */
  takvim?: { CA: number; CB: number };
}) {
  const { cx, cy, R } = o.c || { cx: 195, cy: 452, R: 158 }, NOW = o.simdi, CA = o.takvim?.CA ?? TAKVIM0, CB = o.takvim?.CB ?? TAKVIM1;
  const ang = (ms: number) => -90 + (ms - CA) / (CB - CA) * 360;
  const pol = (a: number, r: number) => [cx + Math.cos(a * Math.PI / 180) * r, cy + Math.sin(a * Math.PI / 180) * r];
  const arc = (a0: number, a1: number, r: number) => { const [x0, y0] = pol(a0, r), [x1, y1] = pol(a1, r); return `M${f(x0)},${f(y0)} A${r},${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${f(x1)},${f(y1)}`; };
  let s = `<circle cx="${cx}" cy="${cy}" r="${R + 40}" fill="url(#glowLilac)" opacity=".35"/>`;
  s += `<circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="#120B2C" stroke-width="12"/>`;
  s += `<circle cx="${cx}" cy="${cy}" r="${R + 6}" fill="none" stroke="#8E80D6" stroke-opacity=".45"/><circle cx="${cx}" cy="${cy}" r="${R - 6}" fill="none" stroke="#8E80D6" stroke-opacity=".45"/>`;
  const aNow = Math.min(270, Math.max(-90, ang(NOW)));
  s += `<path d="${arc(-90, aNow, R)}" fill="none" stroke="url(#brass)" stroke-width="6" stroke-linecap="round"/>`;
  const days = Math.round((CB - CA) / GUN);
  for (let d = 0; d < days; d++) { const ms = CA + d * GUN, a = ang(ms), first = tl(ms).getUTCDate() === 1; const [x0, y0] = pol(a, R - (first ? 6 : 3.5)), [x1, y1] = pol(a, R + (first ? 6 : 3.5)); s += `<line x1="${f(x0)}" y1="${f(y0)}" x2="${f(x1)}" y2="${f(y1)}" stroke="${ms < NOW ? '#3A1F2E' : '#B9A6F2'}" stroke-width="${first ? 1.5 : .6}" opacity="${first ? .95 : .55}"/>`; }
  const RO = R + 26;
  s += `<circle cx="${cx}" cy="${cy}" r="${RO}" fill="none" stroke="#FFD27A" stroke-width=".8" stroke-dasharray="1 5" opacity=".6"/>`;
  const bantlar = o.bantlar || [124, 94, 64, 34];
  const yer: UYer[] = [];
  const aktif = o.akislar.filter((F) => !F.kapandi).map((F) => ({ F, a: ang(F.hedef) })).sort((p, q) => p.a - q.a);
  // etiketliler: işaretli, karar bekleyen, sonra hedefi bugüne en yakın 3; en çok 6
  const sec = new Set<string>();
  for (const it of aktif) if (it.F.isaret && sec.size < 6) sec.add(it.F.kod);
  for (const it of aktif) if (it.F.karar && sec.size < 6) sec.add(it.F.kod);
  for (const it of aktif.filter((x) => x.F.hedef >= NOW).sort((p, q) => p.F.hedef - q.F.hedef).slice(0, 3)) if (sec.size < 6) sec.add(it.F.kod);
  for (const it of aktif) {
    const rr0 = 18.6;
    let best: { p: number[]; clash: number } | null = null;
    for (const b of bantlar) {
      const p = pol(it.a, b);
      const clash = yer.reduce((m, q) => Math.max(m, (rr0 + q.rr + 6) - Math.hypot(p[0] - q.x, p[1] - q.y)), -1e9);
      if (!best || clash < best.clash) best = { p, clash };
      if (clash <= 0) break;
    }
    const rr = best!.clash > 0 ? Math.max(9, rr0 - best!.clash) : rr0, [gx, gy] = best!.p;
    yer.push({ kod: it.F.kod, x: gx, y: gy, rr, a: it.a, etiket: { x: gx, y: gy + rr + 12, w: hapEni(it.F.ad, 10.5) } });
  }
  for (const it of aktif) {
    const q = yer.find((y) => y.kod === it.F.kod)!, [tx, ty] = pol(q.a, R - 11);
    s += `<line x1="${f(q.x)}" y1="${f(q.y)}" x2="${f(tx)}" y2="${f(ty)}" stroke="#8E80D6" stroke-width=".7" stroke-dasharray="1.5 3" opacity=".6"/><circle cx="${f(tx)}" cy="${f(ty)}" r="2.6" fill="#B9A6F2"/>`;
    s += o.kucuk(it.F.kod, q.x, q.y, q.rr, 2.4);
    if (it.F.karar) s += bayrak(q.x + q.rr * .9, q.y - q.rr * .9, .8);
  }
  const etiketler = yer.filter((q) => sec.has(q.kod));
  const kapanan = o.akislar.filter((x) => x.kapandi);
  for (const F of kapanan) {
    const a = ang(F.kapandi!), [gx, gy] = pol(a, RO);
    s += `<circle cx="${f(gx)}" cy="${f(gy)}" r="17" fill="url(#bloom)" opacity=".85"/>` + o.kucuk(F.kod, gx, gy, 10, 1.6);
    yer.push({ kod: F.kod, x: gx, y: gy, rr: 12, a, etiket: { x: gx, y: gy, w: 0 } });
  }
  const [nx, ny] = pol(aNow, R + 2), [bx, by] = pol(aNow + 180, 22);
  s += `<path d="M${f(bx)},${f(by)} L${f(nx)},${f(ny)}" stroke="url(#brass)" stroke-width="2" stroke-linecap="round"/>` + sparkle(nx, ny, 8, '#FFF1D6', 1) + `<circle cx="${f(nx)}" cy="${f(ny)}" r="16" fill="url(#glowGold)"/>`;
  s += `<circle cx="${cx}" cy="${cy}" r="8" fill="url(#brass)"/><circle cx="${cx}" cy="${cy}" r="3" fill="#2A1D4F"/>`;
  return { svg: s, yer, etiketler, kapanan: kapanan.length, kapananHap: { x: 304, y: cy - 216 } };
}
