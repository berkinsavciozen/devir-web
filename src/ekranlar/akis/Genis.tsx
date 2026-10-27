import { C } from '../../cizim/ortak.js';

const BITTI = (d: string) => ['tamam', 'atlandi', 'ertelendi'].includes(d);

/** Kart yerleşimi (kart sol üstüne göre). */
interface KartDuzen {
  x: number; y: number; w: number; h: number; rx: number;
  pl: { dx: number; dy: number; r: number; ring: number; br: number; bead: number };
  baslik: { dx: number; dy: number; fs: number }; meta: { dy: number; fs: number };
  cumle: { dx: number; dy: number; fs: number; lh: number; w: number };
  chip: { dx: number; dy: number; w: number; ara: number };
  bek: { dx: number; dy: number; fs: number };
  btn: { dx: number; dy: number; w: number; h: number; fs: number };
}
export interface GenisDuzen {
  tur: 'M' | 'T'; W: number; H: number; PX: number;
  harita: { cx: number; cy: number; R: number; ps: number };
  surgu: { x: number; y: number; w: number; ps: number };
  etiket: { dx: number; dy: number };
  ust: { geriX: number; geriY: number; geriR: number; baslikX: number; baslikY: number; fs: number; cumleX: number; cumleY: number; cumleFs: number; tekSatir: boolean };
  kart: KartDuzen;
}

/**
 * Duyarlı kırılım (§5 M, T1): < 1024 mobil (null); 1024–1279 T1 (sağda 424 px panel); ≥ 1280 M1 (panel 660).
 * Harita alanı pencereyle orantılı büyür; panel içi ölçüler tasarımdaki gibi sabittir. Kart (liste ya da görev) panelin
 * üstünden başlar (plan 27 Eki, 2.5: şeritler kalktı).
 */
export function genisDuzen(W: number, H: number): GenisDuzen | null {
  if (W < 1024 || H < 600) return null;
  if (W >= 1280) {
    const PX = W - 660, R = Math.min(PX * .385, H * .333), k = R / 300;
    const ky = 112;
    return {
      tur: 'M', W, H, PX,
      harita: { cx: PX / 2, cy: H * .52, R, ps: 1.35 * k },
      // sürgü yüzen gezinmenin üstünde (N14)
      surgu: { x: 44, y: H - 112, w: PX - 90, ps: 1.1 },
      etiket: { dx: 1.5, dy: 34 / 26 },
      ust: { geriX: 48, geriY: 54, geriR: 18, baslikX: 80, baslikY: 63, fs: 28, cumleX: 48, cumleY: 108, cumleFs: 19, tekSatir: true },
      kart: {
        x: PX + 20, y: ky, w: 620, h: 384, rx: 26,
        pl: { dx: 76, dy: 96, r: 34, ring: 50, br: 7.5, bead: 1.9 }, baslik: { dx: 148, dy: 72, fs: 26 }, meta: { dy: 96, fs: 13.5 },
        cumle: { dx: 148, dy: 130, fs: 17, lh: 22, w: 440 }, chip: { dx: 24, dy: 190, w: 180, ara: 196 }, bek: { dx: 24, dy: 280, fs: 13 },
        btn: { dx: 24, dy: 304, w: 572, h: 54, fs: 16 },
      },
    };
  }
  const PX = W - 424, R = Math.min(PX * .357, H * .279), k = R / 214;
  const ky = 104;
  return {
    tur: 'T', W, H, PX,
    harita: { cx: PX / 2, cy: H * .51, R, ps: 1.05 * k },
    surgu: { x: 24, y: H - 108, w: PX - 48, ps: 1 },
    etiket: { dx: 52 / 44, dy: 30 / 26 },
    ust: { geriX: 40, geriY: 50, geriR: 20, baslikX: 72, baslikY: 59, fs: 25, cumleX: 32, cumleY: 100, cumleFs: 17, tekSatir: false },
    kart: {
      x: PX + 12, y: ky, w: 400, h: 372, rx: 24,
      pl: { dx: 56, dy: 70, r: 26, ring: 39, br: 6.5, bead: 1.7 }, baslik: { dx: 108, dy: 60, fs: 22 }, meta: { dy: 82, fs: 12.5 },
      cumle: { dx: 20, dy: 140, fs: 16, lh: 21, w: 360 }, chip: { dx: 20, dy: 172, w: 116, ara: 122 }, bek: { dx: 20, dy: 256, fs: 12 },
      btn: { dx: 20, dy: 280, w: 360, h: 52, fs: 15.5 },
    },
  };
}

/** Panel zemini, bölüm başlığı (çizim katmanı). */
export function panelZemini(G: GenisDuzen): string {
  const { PX, W, H } = G, w = W - PX;
  return `<rect x="${PX}" y="0" width="${w}" height="${H}" fill="url(#sheet)"/><rect x="${PX}" y="0" width="${w}" height="${H}" filter="url(#paper)" opacity=".5"/><rect x="${PX}" y="0" width="1" height="${H}" fill="#FFC9A3" opacity=".35"/>` +
    `<g transform="translate(${G.ust.geriX},${G.ust.geriY})"><circle r="${G.ust.geriR}" fill="#1E1645" stroke="#FFFFFF" stroke-opacity=".14"/><path d="M3,-6 L-4,0 L3,6" stroke="${C.ink}" stroke-width="2" fill="none" stroke-linecap="round"/></g>`;
}

/** Ekrandaki varsayılan seçim: engelli, yoksa kritik yolun ilk açık adımı, yoksa sırası gelmiş ilk adım. */
export function varsayilanSecim(d: any): number | null {
  const by = new Map<number, any>(d.adimlar.map((a: any) => [a.no, a]));
  const eng = d.adimlar.find((a: any) => a.durum === 'engelli');
  if (eng) return eng.no;
  const kr = (d.kritik_yol || []).map((no: number) => by.get(no)).find((a: any) => a && !BITTI(a.durum));
  if (kr) return kr.no;
  return (d.adimlar.find((a: any) => a.durum === 'hazir' || a.durum === 'suruyor') || d.adimlar.find((a: any) => !BITTI(a.durum)) || d.adimlar[d.adimlar.length - 1])?.no ?? null;
}
