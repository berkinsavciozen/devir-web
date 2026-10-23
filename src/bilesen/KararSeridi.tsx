// Karar şeridi (P1-A2, MK-8): sunucunun `karar_ozeti` cümlesi tek bileşende. Galaksi başlığı, Pano, Akışlar, Görevler ve
// dış bağlantı aynı veriyi gösterir; cümleyi sunucu kurar, burada yalnız parçalara ayrılır ve sarılır (adlar kesilmez).
import type { CSSProperties } from 'react';
import { gunAy } from '../cizim/yol.js';
import { akisAdi, ozelEk, paySure, sarSatir } from '../metin/turkce';

export interface KararOzeti {
  cumle: string;
  darbogaz: { no: number; ad: string; tur: 'engel' | 'karar' | 'risk'; tuttugu: number; sahip: string } | null;
  kritik: { ilk_acik: { no: number; ad: string; sahip: string } | null; zincir: number[] };
  bitis: { en_erken: string | null; aralik: [string, string] | null; guven: 'kesin' | 'tahmin' | 'eksik' };
  hedef: { tarih: string; pay_gun: number; durum: 'pay' | 'riskte' | 'geciyor' } | null;
  hamle: { no: number; ad: string; sahip: string; neden: string } | null;
}

export type ParcaTur = 'darbogaz' | 'kritik' | 'tarih' | 'hedef' | 'dis' | 'diger';
export interface Parca { tur: ParcaTur; metin: string; no?: number }

const TUR: [RegExp, ParcaTur][] = [
  [/^(Takılan|Karar bekleniyor|Son tarihini kaçırabilir):/, 'darbogaz'],
  [/^Kritik yol:/, 'kritik'],
  [/^(En erken|Bitiş|Kapandı)\b/, 'tarih'],
  [/^hedef/, 'hedef'],
  [/^Senin adımın/, 'dis'],
];

/** Sunucu cümlesini (" · " ile ayrılmış) parçalara böler. kisa: liste satırında yalnız tarih ve hedef (adlar satırın kendisinde). */
export function kararParcalari(oz: KararOzeti | null | undefined, kisa = false): Parca[] {
  if (!oz?.cumle) return [];
  const P = oz.cumle.split(' · ').map((metin): Parca => {
    const tur = TUR.find(([r]) => r.test(metin))?.[1] ?? 'diger';
    const no = tur === 'darbogaz' ? oz.darbogaz?.no : tur === 'kritik' ? oz.kritik.ilk_acik?.no : undefined;
    return no == null ? { tur, metin } : { tur, metin, no };
  });
  if (!kisa || !oz.bitis.aralik || /^Kapandı/.test(oz.cumle)) return kisa ? P.filter((p) => p.tur !== 'darbogaz' && p.tur !== 'kritik') : P;
  // liste satırı: adlar satırın kendisinde; aralık, süre eksikliği ve hedef kısa yazılır (tek satıra sığsın)
  const h = hedefEtiketi(oz);
  return [
    { tur: 'tarih', metin: aralikMetni(oz.bitis.aralik) },
    ...(oz.bitis.guven === 'eksik' ? [{ tur: 'diger' as const, metin: 'süre eksik' }] : []),
    ...(h ? [{ tur: 'hedef' as const, metin: h === 'riskte' ? 'hedef riskte' : h }] : []),
  ];
}

const gunMs = (t: string) => Date.parse(t + 'T12:00:00+03:00');
/** "28–31 Eki", "30 Eki – 2 Kas", "28 Eki" (sunucudaki aralikMetni ile aynı). */
export function aralikMetni([a, b]: [string, string]): string {
  if (a === b) return gunAy(gunMs(a));
  return a.slice(0, 7) === b.slice(0, 7) ? `${Number(a.slice(8))}–${gunAy(gunMs(b))}` : `${gunAy(gunMs(a))} – ${gunAy(gunMs(b))}`;
}

/** Şeridin tonu: hedefe göre (pay / riskte / geçiyor); hedef yoksa süresi eksik akış "eksik". */
export const seritTonu = (oz: KararOzeti | null | undefined) => oz?.hedef?.durum ?? (oz?.bitis.guven === 'eksik' ? 'eksik' : 'yok');

/**
 * Akışın hedefe göre payı, tek kaynaktan (W2, K4): sunucunun karar özetindeki hedef (bitiş aralığının üst ucuna göre);
 * özet yoksa akışın pay_saat'i. Galaksi cümlesi, zaman sürgüsü, akış özeti ve görev detayı aynı sayıyı söyler.
 * "hedefe 5 gün pay" · "hedef riskte" · "hedef 3 gün geçiyor"; hedef yoksa ''.
 */
export function hedefPayi(k: { karar_ozeti?: KararOzeti | null; pay_saat?: number | null }): string {
  const h = k.karar_ozeti?.hedef;
  if (h) {
    if (h.durum === 'pay') return `hedefe ${h.pay_gun} gün pay`;
    if (h.durum === 'riskte') return 'hedef riskte';
    return `hedef ${hedefEtiketi(k.karar_ozeti)!.replace(' g geç', ' gün')} geçiyor`;
  }
  if (k.pay_saat == null) return '';
  return k.pay_saat >= 0 ? `hedefe ${paySure(k.pay_saat)} pay` : `hedef ${paySure(k.pay_saat)} geçiyor`;
}

/** Liste satırı için kısa hedef etiketi ("6 g pay", "riskte", "3 g geç"); üst uca göre, şeritle aynı. */
export function hedefEtiketi(oz: KararOzeti | null | undefined): string | null {
  const h = oz?.hedef;
  if (!h) return null;
  if (h.durum === 'pay') return `${h.pay_gun} g pay`;
  if (h.durum === 'riskte') return 'riskte';
  // geçiyor: sunucu cümlesi gibi alt uca göre ("hedef 3 gün geçiyor")
  const alt = oz!.bitis.aralik?.[0];
  const g = alt ? Math.round((Date.parse(alt) - Date.parse(h.tarih)) / 864e5) : -h.pay_gun;
  return `${Math.max(1, g)} g geç`;
}

const AGIRLIK: Record<string, number> = { geciyor: 0, riskte: 1 };
/** Dikkat isteyen akış: hedefi geçen > riskte > takılan > en dar pay. Pano ve Görevler şeridi bunu gösterir. */
export function oncelikliAkis<T extends { karar_ozeti?: KararOzeti | null; kapandi_at?: string | null; durum?: string }>(kartlar: T[]): T | null {
  const puan = (k: T) => {
    const o = k.karar_ozeti!;
    if (o.hedef && o.hedef.durum in AGIRLIK) return AGIRLIK[o.hedef.durum] * 1e4 + o.hedef.pay_gun;
    if (o.darbogaz?.tur === 'engel') return 2e4;
    return o.hedef ? 3e4 + o.hedef.pay_gun : 9e4;
  };
  const A = kartlar.filter((k) => k.karar_ozeti?.cumle && !k.kapandi_at && k.durum !== 'kapandi');
  return A.sort((a, b) => puan(a) - puan(b))[0] ?? null;
}

/** Hedefe göre en sıkışık durum, karar özetinin üst ucuyla (şeritle aynı): "Test Bank’te hedef riskte", "en dar pay Ege’de: 6 gün". */
export function hedefParcasi(kartlar: any[]): string | null {
  const h = (d: string) => kartlar.filter((k) => k.karar_ozeti?.hedef?.durum === d);
  for (const [d, ad] of [['geciyor', 'geçiyor'], ['riskte', 'riskte']] as const) {
    const L = h(d);
    if (L.length) return L.length === 1 ? `${ozelEk(akisAdi(L[0]), 'de')} hedef ${ad}` : `${L.length} akışta hedef ${ad}`;
  }
  const p = h('pay').sort((a, b) => a.karar_ozeti.hedef.pay_gun - b.karar_ozeti.hedef.pay_gun)[0];
  if (p) return `en dar pay ${ozelEk(akisAdi(p), 'de')}: ${p.karar_ozeti.hedef.pay_gun} gün`;
  // karar özeti olmayan (eski) sunucu: alt uca göre pay
  const dar = kartlar.filter((k) => k.pay_saat != null).sort((a, b) => a.pay_saat - b.pay_saat)[0];
  if (!dar) return null;
  return dar.pay_saat < 0 ? `${ozelEk(akisAdi(dar), 'de')} hedef ${paySure(dar.pay_saat)} geçiyor` : `en dar pay ${ozelEk(akisAdi(dar), 'de')}: ${paySure(dar.pay_saat)}`;
}

/**
 * Şeridin yüksekliği (altına yerleşenler için): satırlar yazı ölçüsüyle tahmin edilir; tarayıcı yine kendisi sarar.
 * Genişlik %6 dar ölçülür ki tahmin kısa kalmasın. DOM'dan ölçmek (ResizeObserver) evrenden akışa geçişi yavaşlatıyordu.
 */
/** Telefon sütununda (sahne en çok 430 px, iki yanda 20 px) şeridin eni. */
export const sutunEni = () => (typeof window === 'undefined' ? 350 : Math.min(window.innerWidth, 430) - 40);

export function seritYuksekligi(oz: KararOzeti | null | undefined, en: number, o: { onek?: string; kisa?: boolean; neden?: boolean } = {}): number {
  const P = kararParcalari(oz, o.kisa);
  if (!P.length) return 0;
  const metin = [o.onek, ...P.map((p) => p.metin), o.neden ? 'Bu tarih neden?' : null].filter(Boolean).join(' · ');
  return sarSatir(metin, en * .94, `600 ${o.kisa ? 12 : 13}px Inter`).length * (o.kisa ? 16 : 18);
}

export interface KararSeridiOz {
  oz: KararOzeti | null | undefined;
  /** liste satırı: yalnız tarih ve hedef */
  kisa?: boolean;
  /** şeridin başında akış adı (Pano, Görevler) */
  onek?: string;
  /** darboğaz / kritik yol parçasına dokununca o adım */
  adimaGit?: (no: number) => void;
  /** "Bu tarih neden?" paneli */
  neden?: () => void;
  /** bütün şerit bir düğme (liste yüzeyleri: akışa gider) */
  ac?: () => void;
  className?: string;
  style?: CSSProperties;
}

export function KararSeridi({ oz, kisa, onek, adimaGit, neden, ac, className = '', style }: KararSeridiOz) {
  const P = kararParcalari(oz, kisa);
  if (!P.length) return null;
  const sinif = `karar-seridi ton-${seritTonu(oz)}${kisa ? ' kisa' : ''}${ac ? ' git' : ''} ${className}`;
  const etiket = `${onek ? onek + ': ' : ''}${P.map((p) => p.metin).join(' · ')}`;
  const parca = (p: Parca, i: number) => {
    const s = `ks-parca ks-${p.tur}`;
    return p.no != null && adimaGit && !ac
      // satır içinde sarılabilsin diye düğme değil, düğme rolünde span (düğme satır içinde bölünmez)
      ? <span key={i} role="button" tabIndex={0} className={s + ' ks-adim'} onClick={() => adimaGit(p.no!)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); adimaGit(p.no!); } }}>{p.metin}</span>
      : <span key={i} className={s}>{p.metin}</span>;
  };
  const ic = <>
    {onek && <span className="ks-parca ks-onek">{onek}</span>}
    {P.map(parca)}
    {neden && !ac && <button type="button" className="ks-parca ks-neden" aria-haspopup="dialog" onClick={neden}>Bu tarih neden?</button>}
  </>;
  if (ac) return <button type="button" className={sinif} style={style} aria-label={etiket} onClick={ac}>{ic}</button>;
  return <div className={sinif} style={style} role="group" aria-label={`Karar özeti: ${etiket}`}>{ic}</div>;
}
