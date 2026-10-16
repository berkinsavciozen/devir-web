// E · Soru ve dal (§5 E1–E3): tarihi bilinmeyen adım yollara girmez; koşullu dalın adımları ikiz olarak durur.
import { yolCiz, type Model } from '../../cizim/yol.js';
import { f, pill, planet } from '../../cizim/ortak.js';
import { adimAdi, ek } from '../../metin/turkce';

const BITTI = (d: string) => ['tamam', 'atlandi', 'ertelendi'].includes(d);
const HARF = ['A', 'B', 'C', 'D'];

export const soruRozet = (x: number, y: number, sc = 1) => `<g transform="translate(${f(x)},${f(y)}) scale(${sc})"><circle r="10" fill="#FFF1DC" stroke="#2A1D4F" stroke-width="1.2"/><text y="4.5" text-anchor="middle" font-family="Inter" font-weight="800" font-size="13" fill="#2A1D4F">?</text></g>`;

export interface Dal { kod: string; soru: any; kollar: { harf: string; deger: string; etiket: string; kisa: string; sonuc: string; no: number }[] }

/** Açık seçim sorusuna bağlı, henüz bitmemiş koşullu adımlar: her seçenek bir kol (ilk adımı ikiz olur). */
export function acikDallar(d: any): Dal[] {
  const out: Dal[] = [];
  for (const q of d.acik_sorular || []) {
    if (q.tip === 'tarih') continue;
    const adimlar = d.adimlar.filter((a: any) => a.kosul?.soru === q.kod && !BITTI(a.durum));
    if (!adimlar.length) continue;
    const ops: any[] = q.secenekler?.length ? q.secenekler : [...new Set(adimlar.map((a: any) => String(a.kosul.deger)))].map((deger) => ({ deger, etiket: deger }));
    const kollar = ops.map((o, i) => {
      const a = adimlar.find((x: any) => String(x.kosul.deger).split('|').includes(String(o.deger)));
      return a ? { harf: HARF[i] || String(i + 1), deger: String(o.deger), etiket: o.etiket || String(o.deger), kisa: o.kisa || o.etiket || String(o.deger), sonuc: o.sonuc || `${adimAdi(a)} adımı kalır`, no: a.no as number } : null;
    }).filter(Boolean) as Dal['kollar'];
    if (kollar.length) out.push({ kod: q.kod, soru: q, kollar });
  }
  return out;
}

/** Tarihi bir soruya bağlı, son tarihi olmayan açık adımlar (§4.1 tarih_bilinmiyor). */
export function tarihBekleyenler(d: any): { a: any; soru: any }[] {
  return d.adimlar.filter((a: any) => a.capa_soru && !a.son_tarih && !BITTI(a.durum))
    .map((a: any) => ({ a, soru: (d.acik_sorular || []).find((q: any) => q.kod === a.capa_soru) || { kod: a.capa_soru, soru: a.capa_soru, tip: 'tarih' } }));
}

/** Ana geometriden çıkan adımlar: açık dalların bütün adımları (tarihi bilinmeyenleri `kur` zaten çıkarır). */
export function dalHaric(d: any): number[] {
  const acik = new Set(acikDallar(d).map((x) => x.kod));
  return d.adimlar.filter((a: any) => a.kosul?.soru && acik.has(a.kosul.soru) && !BITTI(a.durum)).map((a: any) => a.no);
}

/** E1/E2 cümlesi (bugünde, öbür cümlelerden önce). */
export function soruCumlesi(d: any): string | null {
  const t = tarihBekleyenler(d)[0];
  const dal = acikDallar(d)[0];
  if (dal) {
    const n = dal.kollar.length, sayi = n === 2 ? 'iki' : String(n);
    return `${dal.soru.kisa || 'Açık soru'} cevaplanınca bu ${sayi} adımdan biri kalır.`;
  }
  if (t) {
    const kisa = t.soru.kisa || `${t.soru.soru.replace(/\?$/, '').replace(/^./, (c: string) => c.toLocaleLowerCase('tr'))} cevaplanınca`;
    return `${ek(adimAdi(t.a), 'in')} tarihi, ${kisa} belli olur.`;
  }
  return null;
}

export interface SoruHedef { x: number; y: number; r: number; soru: string; etiket: string }

/**
 * Soru katmanı: dalların ikizleri (her kol kendi `kur`undan, öteki kolların adımları hariç) ve "?" düğümü;
 * tarihi bilinmeyen adımın kesik yörüngesi, ipi ve "Tarih bekliyor" hapı.
 * o.sec: seçili kolun değeri (E3), o.hap: etiket hapları (E2'de var, E3'te yok).
 */
export function soruKatmani(d: any, M: Model, Y: any, geo: { cx: number; cy: number; R: number; ps: number; now: number }, o: { sec?: string | null; hap?: boolean; yuzer?: boolean } = {}) {
  let s = '';
  const hedefler: SoruHedef[] = [];
  const G = Y.G, haricAna = dalHaric(d);
  const doluMu = (x: number, y: number, r: number) => Object.values<any>(G.gezegen).some((g) => Math.hypot(g.x - x, g.y - y) < r + (g.r || 10));
  for (const dal of acikDallar(d)) {
    const pts = dal.kollar.map((k) => {
      const Gk = yolCiz(M, { ...geo, x: geo.now, haric: haricAna.filter((n) => n !== k.no), labels: [], kuleEtiket: false }).G;
      const g = Gk.gezegen[k.no];
      return g ? { k, p: [g.x, g.y] as [number, number] } : null;
    }).filter(Boolean) as { k: Dal['kollar'][0]; p: [number, number] }[];
    if (!pts.length) continue;
    const m = [pts.reduce((a, q) => a + q.p[0], 0) / pts.length, pts.reduce((a, q) => a + q.p[1], 0) / pts.length];
    const q = [m[0] + (G.cx - m[0]) * .25, m[1] + (G.cy - m[1]) * .25];
    for (const { p } of pts) {
      const mx = (q[0] + p[0]) / 2, my = (q[1] + p[1]) / 2;
      s += `<path d="M${f(q[0])},${f(q[1])} Q${f(mx + (G.cx - mx) * .15)},${f(my + (G.cy - my) * .15)} ${f(p[0])},${f(p[1])}" fill="none" stroke="#D9CCFF" stroke-width="1.4" stroke-dasharray="3 4"/>`;
    }
    for (const { k, p } of pts) {
      const sec = o.sec == null ? undefined : o.sec === k.deger;
      s += `<g opacity="${sec === false ? .28 : sec ? 1 : .62}">` + planet(p[0], p[1], 11, sec ? 'wait' : 'dark', { life: false, waitRings: 1 }) + `<circle cx="${f(p[0])}" cy="${f(p[1])}" r="16" fill="none" stroke="#D9CCFF" stroke-width="1.2" stroke-dasharray="2 3"/></g>`;
      s += `<g transform="translate(${f(p[0] + 13)},${f(p[1] - 13)})"><circle r="8" fill="#FFF1DC" stroke="#2A1D4F"/><text y="3.8" text-anchor="middle" font-family="Inter" font-weight="800" font-size="10.5" fill="#2A1D4F">${k.harf}</text></g>`;
      hedefler.push({ x: p[0], y: p[1], r: 22, soru: dal.kod, etiket: `${k.harf} dalı: ${k.etiket}. ${k.sonuc}.` });
    }
    s += `<circle cx="${f(q[0])}" cy="${f(q[1])}" r="18" fill="url(#glowGold)"/>` + soruRozet(q[0], q[1], 1.1);
    hedefler.push({ x: q[0], y: q[1], r: 22, soru: dal.kod, etiket: `Açık soru: ${dal.soru.soru}` });
    if (o.hap !== false && pts.length >= 2) {
      // etiketler: soldaki ikizin solunda, sağdakinin sağında (dikeyde ayrık)
      const [sol, sag] = [...pts].sort((a, b) => a.p[0] - b.p[0]);
      const ay = Math.abs(sol.p[1] - sag.p[1]) < 28 ? 16 : 0;
      const ys = sol.p[1] + 30 + ay, yg = sag.p[1] - 30 - ay;
      const ts = `${sol.k.harf} · ${sol.k.kisa}`, tg = `${sag.k.harf} · ${sag.k.kisa}`;
      const ws = Math.round(ts.length * 11 * .56 + 14), wg = Math.round(tg.length * 11 * .56 + 14);
      s += pill(Math.min(Math.max(sol.p[0] - 22, 150), 390 - 4), ys, ts, { fs: 11, fw: 650, stroke: '#D9CCFF', anchor: 'end' });
      void ws;
      s += pill(Math.max(Math.min(sag.p[0] + 22, 240), 4), yg, tg, { fs: 11, fw: 650, stroke: '#D9CCFF', anchor: 'start', ...(Math.min(sag.p[0] + 22, 240) + wg > 386 ? { anchor: 'end' } : {}) });
    }
  }
  if (o.yuzer !== false) for (const { a, soru } of tarihBekleyenler(d)) {
    // sahibinin yolunun bittiği yön; yolu yoksa sağ üst
    const u = G.uyeOf?.[a.sahip], son = u?.yol?.length ? u.yol[u.yol.length - 1] : null;
    let aci = son ? Math.atan2(son.y - G.cy, son.x - G.cx) : -42 * Math.PI / 180;
    const uz = G.R + 32;
    const yer = (t: number) => [Math.min(350, Math.max(40, G.cx + Math.cos(t) * uz)), Math.min(G.cy + G.R, Math.max(170, G.cy + Math.sin(t) * uz))];
    let [fx, fy] = yer(aci);
    for (let i = 1; i < 12 && doluMu(fx, fy, 30); i++) { const t = aci + (i % 2 ? 1 : -1) * Math.ceil(i / 2) * .17; [fx, fy] = yer(t); if (!doluMu(fx, fy, 30)) { aci = t; break; } }
    const [ix, iy] = son ? [son.x, son.y] : [G.cx, G.cy];
    s += `<path d="M${f(ix)},${f(iy)} Q${f((ix + fx) / 2 + 30)},${f((iy + fy) / 2 + 30)} ${f(fx)},${f(fy)}" fill="none" stroke="#D9CCFF" stroke-width="1" stroke-dasharray="1.5 5" opacity=".7"/>`;
    for (let i = 0; i < 6; i++) {
      const a0 = i * 60 + 10, a1 = a0 + 34, r = 24, p = (t: number) => [fx + Math.cos(t * Math.PI / 180) * r, fy + Math.sin(t * Math.PI / 180) * r];
      const [x0, y0] = p(a0), [x1, y1] = p(a1);
      s += `<path d="M${f(x0)},${f(y0)} A${r},${r} 0 0 1 ${f(x1)},${f(y1)}" fill="none" stroke="#FFD27A" stroke-width="1.6" stroke-linecap="round"/>`;
    }
    s += planet(fx, fy, 12, 'dark', { life: false }) + soruRozet(fx + 14, fy - 14, .9);
    if (o.hap !== false) {
      const w = Math.round('Tarih bekliyor'.length * 11 * .56 + 14);
      s += pill(Math.min(Math.max(fx - 18, w / 2 + 8), 390 - w / 2 - 8), fy + 40, 'Tarih bekliyor', { fs: 11, fw: 700, stroke: '#FFD27A', col: '#FFE6B0' });
    }
    hedefler.push({ x: fx, y: fy, r: 26, soru: soru.kod, etiket: `${a.no}. adım, ${a.ad}. Tarih bekliyor: ${soru.soru}` });
  }
  return { svg: s, hedefler };
}
