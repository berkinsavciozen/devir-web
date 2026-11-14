// Harita dışındaki sayfalarda (görev detayı, kartlar, listeler) haritadaki araç ve gezegenin aynısı.
// Çıktı bir <g class="ky-svg ky-simge">; herhangi bir svg içine konur, harita stilini (yorunge.css) kullanır.
import { arac, gezegen } from './index';
import { kisiRengi } from '../hamle';

const f = (n: number) => Math.round(n * 100) / 100;
const sar = (ic: string, x: number, y: number, k: number, ek = '') => `<g class="ky-svg ky-simge${ek}" transform="translate(${f(x)},${f(y)}) scale(${f(k)})">${ic}</g>`;

export type SimgeKisi = { ad: string; tip?: string | null; sahibi?: string | null; renk?: string };

/** Kişi aracı: gövde kişinin renginde, durumsuz (roket = ekip, küp = agent, disk = dış). Gövde yaklaşık 44×30; k ölçek. */
export function kisiSimge(k: SimgeKisi, x = 0, y = 0, olcek = 1): string {
  const tip = k.tip === 'agent' ? 'agent' : k.tip === 'dis' ? 'dis' : 'insan';
  const renk = k.renk || kisiRengi(k.ad, { tip, sahibi: k.sahibi });
  return sar(arac({ ad: k.ad || '?', tip, sahibi: k.sahibi || null, renk }, { durum: 'notr', acik: [], hamleler: [] }, {}).svg, x, y, olcek);
}

/** Adımın haritadaki görünüş sınıfı ve ışığı. */
export function isGorunum(a: any): { g: string; isik: number } {
  const d = a?.durum;
  if (d === 'tamam') return { g: 'lit', isik: 1 };
  if (d === 'atlandi') return { g: 'ghost', isik: 0 };
  if (d === 'ertelendi') return { g: 'ertele', isik: 0 };
  if (d === 'engelli') return { g: 'block', isik: 0 };
  if (d === 'suruyor') return { g: 'run', isik: .45 };
  if (d === 'hazir') return { g: 'wait', isik: 0 };
  return { g: 'dark', isik: 0 };
}

/** Gezegen = iş: halka sahibinin renginde, ışık durumu söyler, içinde numarası. Yarıçap 8 (halkalarla ~13); r istenen yarıçap. */
export function isSimge(a: any, x = 0, y = 0, r = 8, o: { renk?: string; renkler?: Record<string, string>; gorunum?: string; numarasiz?: boolean } = {}): string {
  const G = o.gorunum ? { g: o.gorunum, isik: o.gorunum === 'lit' ? 1 : o.gorunum === 'run' ? .45 : 0 } : isGorunum(a);
  const renk = o.renk || (a?.sahip ? kisiRengi(a.sahip, { tip: a.sahip_tip, sahibi: a.agent_sahibi, renkler: o.renkler }) : '#A9C3D6');
  const acik = !['lit', 'ghost', 'ertele'].includes(G.g);
  let ic = gezegen({ no: o.numarasiz || a?.no == null ? '' : a.no }, { renk, karar: !!a?.karar_adimi && acik, kritik: !!a?.kritik && acik }) as string;
  ic = ic.replace('class="ates" r="0"', `class="ates" r="${f(7.4 * Math.sqrt(G.isik))}"`);
  return sar(`<g class="gz g-${G.g}"><g class="ol">${ic}</g></g>`, x, y, r / 8, ' kd1');
}
