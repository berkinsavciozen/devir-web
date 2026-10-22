import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '../../api/istemci';
import { sorguIstemcisi } from '../../api/sorgular';
import { Dugme } from '../../bilesen/Dugme';
import { Metin } from '../../bilesen/Sahne';
import { C, planet, shareRing } from '../../cizim/ortak.js';
import { gunAy, kisaAd } from '../../cizim/yol.js';
import { adimAdi, ikiSatir } from '../../metin/turkce';
import { git } from '../../yonlendirme';
import { adimCumlesi, IHLAL_IPUCU, isPayi, sureKisa, takvimIhlali, tarihSayisi, tuttuklari } from './Adim';

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
  serit: { x: number; y: number; w: number; h: number; satir: number; pxGun: number; lw: number; ps: number };
  etiket: { dx: number; dy: number };
  ust: { geriX: number; geriY: number; geriR: number; baslikX: number; baslikY: number; fs: number; cumleX: number; cumleY: number; cumleFs: number; tekSatir: boolean };
  bolum: { x: number; y: number; alt?: { y: number } };
  kart: KartDuzen;
}

/**
 * Duyarlı kırılım (§5 M, T1): < 1024 mobil (null); 1024–1279 T1 (sağda 424 px panel); ≥ 1280 M1 (panel 660).
 * Harita alanı pencereyle orantılı büyür; panel içi ölçüler tasarımdaki gibi sabittir.
 */
export function genisDuzen(W: number, H: number): GenisDuzen | null {
  if (W < 1024 || H < 600) return null;
  if (W >= 1280) {
    const PX = W - 660, R = Math.min(PX * .385, H * .333), k = R / 300;
    return {
      tur: 'M', W, H, PX,
      harita: { cx: PX / 2, cy: H * .52, R, ps: 1.35 * k },
      surgu: { x: 44, y: H - 58, w: PX - 90, ps: 1.1 },
      serit: { x: PX + 20, y: 96, w: 620, h: 360, satir: 72, pxGun: 52, lw: 112, ps: 1.3 },
      etiket: { dx: 1.5, dy: 34 / 26 },
      ust: { geriX: 48, geriY: 54, geriR: 18, baslikX: 80, baslikY: 63, fs: 28, cumleX: 48, cumleY: 108, cumleFs: 19, tekSatir: true },
      bolum: { x: PX + 32, y: 52, alt: { y: 76 } },
      kart: {
        x: PX + 20, y: 486, w: 620, h: 384, rx: 26,
        pl: { dx: 76, dy: 96, r: 34, ring: 50, br: 7.5, bead: 1.9 }, baslik: { dx: 148, dy: 72, fs: 26 }, meta: { dy: 96, fs: 13.5 },
        cumle: { dx: 148, dy: 130, fs: 17, lh: 22, w: 440 }, chip: { dx: 24, dy: 190, w: 180, ara: 196 }, bek: { dx: 24, dy: 280, fs: 13 },
        btn: { dx: 24, dy: 304, w: 572, h: 54, fs: 16 },
      },
    };
  }
  const PX = W - 424, R = Math.min(PX * .357, H * .279), k = R / 214;
  return {
    tur: 'T', W, H, PX,
    harita: { cx: PX / 2, cy: H * .51, R, ps: 1.05 * k },
    surgu: { x: 24, y: H - 54, w: PX - 48, ps: 1 },
    serit: { x: PX + 12, y: 58, w: 400, h: 300, satir: 62, pxGun: 38, lw: 96, ps: 1.1 },
    etiket: { dx: 52 / 44, dy: 30 / 26 },
    ust: { geriX: 40, geriY: 50, geriR: 20, baslikX: 72, baslikY: 59, fs: 25, cumleX: 32, cumleY: 100, cumleFs: 17, tekSatir: false },
    bolum: { x: PX + 24, y: 44 },
    kart: {
      x: PX + 12, y: 378, w: 400, h: 372, rx: 24,
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

const durumGor = (a: any) => (BITTI(a.durum) ? (a.durum === 'atlandi' ? 'ghost' : 'lit') : a.durum === 'engelli' ? 'block' : a.durum === 'hazir' || a.durum === 'suruyor' ? 'wait' : 'dark');

/** Seçili adımın kartının çizimi (gezegen + iş payı halesi, sayı kutuları). */
export function kartCizimi(K: KartDuzen, a: any, olaylar: any[] | null): string {
  const dg = durumGor(a), px = K.x + K.pl.dx, py = K.y + K.pl.dy;
  let s = `<rect x="${K.x}" y="${K.y}" width="${K.w}" height="${K.h}" rx="${K.rx}" fill="#120B2C" fill-opacity=".72" stroke="${dg === 'block' ? '#FF8A78' : '#FFFFFF'}" stroke-opacity="${dg === 'block' ? .35 : .08}"/>`;
  s += `<ellipse cx="${px}" cy="${py - 4}" rx="${K.pl.r * 2.35}" ry="${K.pl.r * 1.65}" fill="url(#${dg === 'block' ? 'glowCoral' : 'glowGold'})" opacity=".4"/>`;
  s += planet(px, py, K.pl.r, dg, { cloudGap: K.pl.r > 30 ? 10 : 8, karar: a.karar_adimi, waitRings: 2 });
  const pay = olaylar ? isPayi(olaylar) : [];
  if (pay.length) s += shareRing(px, py, K.pl.ring, pay, { br: K.pl.br, bead: K.pl.bead });
  const renk = ['#FF8A78', '#B9A6F2', '#FFD27A'];
  for (let i = 0; i < 3; i++) s += `<rect x="${K.x + K.chip.dx + i * K.chip.ara}" y="${K.y + K.chip.dy}" width="${K.chip.w}" height="54" rx="18" fill="#FFFFFF" fill-opacity=".06" stroke="${renk[i]}" stroke-opacity=".6"/>`;
  return s;
}

/** Seçili adım kartı (B4 içeriği; §5 M1, T1): ad, durum, 2 cümle, 3 sayı, bekliyor/tutuyor, eylem. */
export function GenisKart({ K, d, a, kod, ben }: { K: KartDuzen; d: any; a: any; kod: string; ben: string }) {
  const by = new Map<number, any>(d.adimlar.map((x: any) => [x.no, x]));
  const tut = tuttuklari(d.adimlar, a.no);
  const bek = ((a.bekledigi?.map((b: any) => b.no) ?? a.bagimli ?? []) as number[]).map((no) => by.get(no)).filter(Boolean);
  const sayilar: [string, string][] = [
    [a.durum === 'engelli' || a.durum === 'hazir' || a.durum === 'suruyor' ? sureKisa(a.bekleme_saat) : BITTI(a.durum) ? gunAy(Date.parse(a.durum_at)) : '–', a.durum === 'engelli' ? 'engelli' : a.durum === 'hazir' ? 'bekliyor' : a.durum === 'suruyor' ? 'sürüyor' : a.durum_etiket || a.durum],
    [`${tut.length} adım`, 'tutuyor'],
    tarihSayisi(a),
  ];
  const ihlal = takvimIhlali(a);
  const cumle = ikiSatir(adimCumlesi(a, ben), K.cumle.w, `${K.cumle.fs}px Caladea`);
  const zincir = [bek.length ? `Bekliyor: ${bek.map((b: any) => adimAdi(b)).join(' · ')}` : '', tut.length ? `Tutuyor: ${tut.slice(0, 3).map((n) => adimAdi(by.get(n))).join(' → ')}` : ''].filter(Boolean).join('   ·   ');
  const benim = a.sahip === ben && !BITTI(a.durum);
  const claude = a.linkler?.claude;
  const bitir = useMutation({
    mutationFn: () => api.post<any>(`/akis/${encodeURIComponent(kod)}/adim/${a.no}`, { durum: 'tamam' }),
    onSuccess: () => { for (const k of [['akis', kod], ['adim', kod, a.no], ['ozet']]) void sorguIstemcisi.invalidateQueries({ queryKey: k }); },
  });
  const ayrinti = () => git(`/akis/${encodeURIComponent(kod)}/adim/${a.no}?tam=1`);
  const B = K.btn;
  return (
    <section aria-label={`Seçili adım: ${adimAdi(a)}`}>
      <button type="button" className="genis-baslik" style={{ left: K.x + K.baslik.dx, top: K.y + K.baslik.dy - K.baslik.fs * 1.02, fontSize: K.baslik.fs, lineHeight: `${Math.round(K.baslik.fs * 1.25)}px` }} onClick={ayrinti} aria-label={`${adimAdi(a)}: ayrıntılar, geçmiş ve çıktılar`}>{adimAdi(a)}</button>
      <Metin y={K.y + K.meta.dy} x={K.x + K.baslik.dx} fs={K.meta.fs} renk="ink3" className="tek-satir">{kisaAd(a.sahip)} · {a.durum_etiket || a.durum}{a.son_tarih ? ` · son ${gunAy(Date.parse(a.son_tarih + 'T12:00:00+03:00'))}` : ''}</Metin>
      <Metin y={K.y + K.cumle.dy} x={K.x + K.cumle.dx} fs={K.cumle.fs} lh={K.cumle.lh} serif renk="ink2" style={{ whiteSpace: 'nowrap' }}>{cumle.map((c, i) => <span key={i}>{i ? <br /> : null}{c}</span>)}</Metin>
      {sayilar.map(([b, k], i) => <div key={k} className={`sayi-kutusu${i === 2 && ihlal ? ' ihlal' : ''}`} title={i === 2 && ihlal ? IHLAL_IPUCU : undefined} style={{ position: 'absolute', left: K.x + K.chip.dx + i * K.chip.ara, top: K.y + K.chip.dy, width: K.chip.w }}><b>{b}</b><small>{k}</small></div>)}
      {zincir && <Metin y={K.y + K.bek.dy} x={K.x + K.bek.dx} fs={K.bek.fs} agirlik={600} renk="ink2" className="tek-satir" style={{ whiteSpace: 'pre' }}>{zincir}</Metin>}
      <div className="genis-kart-eylem" style={{ left: K.x + B.dx, top: K.y + B.dy, width: B.w }}>
        {benim ? <>
          {claude && <Dugme tur="ikincil" ton="lila" yukseklik={B.h} fs={B.fs} onClick={() => window.open(claude, '_blank', 'noopener')}>Claude’da aç</Dugme>}
          <Dugme yukseklik={B.h} fs={B.fs} mesgul={bitir.isPending} onClick={() => (a.karar_adimi ? git(`/akis/${encodeURIComponent(kod)}/karar/${a.no}`) : bitir.mutate())}>{a.karar_adimi ? 'Kararı ver' : 'Bitti olarak işaretle'}</Dugme>
        </> : claude ? <Dugme yukseklik={B.h} fs={B.fs} onClick={() => window.open(claude, '_blank', 'noopener')}>Claude’da aç</Dugme>
          : <Dugme tur="ikincil" ton="lila" yukseklik={B.h} fs={B.fs} onClick={ayrinti}>Ayrıntılar</Dugme>}
      </div>
    </section>
  );
}

/** Seçili adımın olayları (iş payı halesi için). */
export const useAdimOlaylari = (kod: string, no: number | null) => useQuery({ queryKey: ['adim', kod, no], enabled: no != null, queryFn: () => api.get<any>(`/akis/${encodeURIComponent(kod)}/adim/${no}`) });
