// Küçük yörünge resmi (E1): Evren, Akışlar, Pano ve listelerdeki akış resmi haritanın küçültülmüşüdür.
// Her kişi bir halka (kişinin renginde; agent ince), adımlar sahibinin halkasında durum renginde nokta,
// iğne tepede (bugün), gelecek saat yönünde, geçmiş solda. Bakanın aracı iğnede, onu bekleyen iş halkalı.
import { kur, durumAn } from './index';
import { isSimge, kisiSimge } from './simge';

const GUN = 864e5, RAD = Math.PI / 180;
const AF = 150 * RAD, AP = 120 * RAD, DOK = 14 * RAD;
const f = (n: number) => Math.round(n * 100) / 100;

/** Haritadaki beş durum rengi (lejantla aynı). */
export const DURUM_RENK: Record<string, string> = { lit: '#6EE39A', tahmin: '#6EE39A', run: '#5AB8FF', wait: '#FFB547', block: '#FF5A5A', dark: '#A9C3D6', ertele: '#A9C3D6', ghost: '#A9C3D6' };

export type MiniSecenek = { cx: number; cy: number; R: number; now: number; pr?: number; ayrinti?: boolean };
export type MiniCizim = { svg: string; G: { gezegen: Record<number, { no: number; x: number; y: number }> }; radOf: (no: number) => number; gemiler: { ad: string; x: number; y: number }[] };

const hamVeri = (d: any, simdi: number) => ({ simdi: new Date(simdi).toISOString(), akis: { ...d.akis, bitis: d.bitis || d.akis?.bitis, kritik_yol: d.kritik_yol || d.akis?.kritik_yol || [], adimlar: d.adimlar || [], sahipler: d.sahipler || [], katilimcilar: d.katilimcilar || [], olaylar: d.olaylar || [] } });

/** d: akış ayrıntısı (adimlar, sahipler, olaylar…); ben: bakan kişi. */
export function miniYorunge(d: any, ben: string, o: MiniSecenek): MiniCizim {
  const { cx, cy, R, now } = o;
  const M: any = kur(hamVeri(d, now), ben);
  const D: any = durumAn(M, now);
  const kisiler: any[] = M.kisiler.filter((k: any) => (k.adimlar || []).length);
  const n = Math.max(1, kisiler.length);
  const r0 = R * (n === 1 ? .62 : .34), r1 = R * .92;
  const yar: Record<string, number> = {};
  kisiler.forEach((k, i) => (yar[k.ad] = n === 1 ? r0 : r0 + (r1 - r0) * i / (n - 1)));
  // açı: akışın başı geri uca, sonu ileri uca; bugün tepede
  // çerçeve adımların kendisidir: en geç tahmin ileri uca, en eski bitiş geri uca (küçük resimde boş yay kalmasın)
  const tler = M.adimlar.map((a: any) => a.tPlan).filter((t: any) => t != null);
  const DF = Math.max(2, (Math.max(now, ...tler) - now) / GUN), DP = Math.max(2, (now - Math.min(now, ...tler)) / GUN);
  const aci = (t: number) => { const g = (t - now) / GUN; return g >= 0 ? AF * Math.min(1, g / DF) : -AP * Math.min(1, -g / DP); };
  const nokta = (r: number, a: number) => [cx + r * Math.sin(a), cy - r * Math.cos(a)];
  const buyuk = !!o.ayrinti;
  const pr = buyuk ? Math.max(4.5, Math.min(9, R * .045)) : Math.max(1.3, Math.min(6, R * .038, Math.max((o.pr ?? 0) * .85, R * .03)));
  const bekleyen = new Set(Object.values(D.H || {}).filter((h: any) => h && h.kim === ben).map((h: any) => h.no));

  let halka = '', adim = '', ust = '';
  // çekirdek: akışın bitişi
  halka += `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r0 * (n === 1 ? .38 : .5))}" fill="#FFF6E0" opacity=".07"/>`;
  for (const k of kisiler) {
    const r = yar[k.ad], ag = k.tip === 'agent';
    halka += `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r)}" fill="none" stroke="${k.renk}" stroke-width="${f(Math.max(.5, R * (ag ? .012 : .022)))}" opacity="${ag ? .45 : .6}"${k.tip === 'dis' ? ` stroke-dasharray="${f(R * .05)} ${f(R * .035)}"` : ''}/>`;
  }
  // iğne: bugün
  const [ix0, iy0] = nokta(r0 * .7, 0), [ix1, iy1] = nokta(r1 + R * .08, 0);
  halka += `<line x1="${f(ix0)}" y1="${f(iy0)}" x2="${f(ix1)}" y2="${f(iy1)}" stroke="#FFB59A" stroke-width="${f(Math.max(.6, R * .02))}" stroke-linecap="round" opacity=".85"/>`;

  const gezegen: MiniCizim['G']['gezegen'] = {};
  const sirali = [...M.adimlar].sort((a: any, b: any) => (a.tPlan ?? now) - (b.tPlan ?? now));
  for (const a of sirali) {
    const r = yar[a.sahip]; if (r == null) continue;
    const s = D.S[a.no] || { g: 'dark' }, bitti = ['lit', 'ghost', 'ertele'].includes(s.g);
    let t = aci(a.tPlan ?? now);
    t = bitti ? Math.min(t, -DOK) : Math.max(t, DOK);
    const [x, y] = nokta(r, t);
    gezegen[a.no] = { no: a.no, x, y };
    const renk = DURUM_RENK[s.g] || DURUM_RENK.dark;
    if (bekleyen.has(a.no)) ust += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(pr * 2)}" fill="none" stroke="#FFB59A" stroke-width="${f(Math.max(.7, pr * .45))}"/>`;
    if (buyuk) { adim += isSimge({ ...a, durum: a.durum }, x, y, pr, { gorunum: s.g === 'tahmin' ? 'lit' : s.g }); continue; }
    if (s.g === 'block') adim += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(pr * 1.9)}" fill="${renk}" opacity=".28"/>`;
    const op = s.g === 'ghost' || s.g === 'ertele' ? .3 : s.g === 'dark' ? .55 : 1;
    adim += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(pr)}" fill="${renk}" opacity="${op}"/>`;
  }
  // araçlar iğnede, her biri kendi halkasında; küçük çizimde yalnız bakanın aracı
  const gemiler: MiniCizim['gemiler'] = [];
  for (const k of kisiler) {
    if (!buyuk && k.ad !== ben) continue;
    const [x, y] = nokta(yar[k.ad], 0);
    gemiler.push({ ad: k.ad, x, y });
    if (!buyuk && R < 22) { ust += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(Math.max(1.6, pr * 1.1))}" fill="${k.renk}" stroke="#FFF6E0" stroke-width=".6"/>`; continue; }
    ust += kisiSimge(k, x, y, buyuk ? Math.min(.7, R * .0032) : Math.min(.8, R * .5 / 44));
  }
  return { svg: `<g class="mini-yorunge">${halka}${adim}${ust}</g>`, G: { gezegen }, radOf: () => pr, gemiler };
}
