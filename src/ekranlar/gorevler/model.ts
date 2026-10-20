// Görevler (el notu 16): bütün işlerin haritası. Saf mantık: süzgeç, cümle, gruplar, bağımlılık işareti ve görev haritası.
import { ozelEk } from '../../metin/turkce';

const BITTI = (d: string) => ['tamam', 'atlandi', 'ertelendi'].includes(d);
const GUN = 864e5;
const tarihMs = (t: string) => Date.parse(t.length === 10 ? t + 'T12:00:00+03:00' : t);
const kisa = (s: string) => s.replace(/\s*\(.*\)$/, '');

export type Durum = 'acik' | 'bitti' | 'hepsi';
export const DURUM_AD: Record<Durum, string> = { acik: 'Bitmemiş', bitti: 'Bitti', hepsi: 'Hepsi' };
export interface Suzgec { kisi: string; akis: string[]; durum: Durum }

/** Adresten süzgeç: kisi "ben" (varsayılan), bir ad ya da "hepsi"; akis virgüllü kodlar; durum acik (varsayılan). */
export function suzgecOku(q: URLSearchParams): Suzgec {
  const d = q.get('durum');
  return { kisi: q.get('kisi') || 'ben', akis: (q.get('akis') || '').split(',').filter(Boolean), durum: d === 'bitti' || d === 'hepsi' ? d : 'acik' };
}
export function suzgecAdresi(s: Suzgec): string {
  const p = new URLSearchParams();
  if (s.kisi !== 'ben') p.set('kisi', s.kisi);
  if (s.akis.length) p.set('akis', s.akis.join(','));
  if (s.durum !== 'acik') p.set('durum', s.durum);
  const q = p.toString();
  return '/gorevler' + (q ? '?' + q : '');
}

/** Sunucu 0.12.0 yoksa (/gorevler 404): /ozet.benim'den yalnız kendi açık işlerin. */
export function ozettenGorevler(benim: any[], kartlar: any[], ben: string) {
  return benim.map((b) => {
    const k = kartlar.find((x) => x.kod === b.akis);
    return { akis: b.akis, akis_baslik: b.akis_baslik, akis_kisa_ad: k?.kisa_ad || null, no: b.no, ad: b.ad, kisa_ad: null, sahip: ben, sahip_tip: 'insan', durum: b.durum, engel: b.engel, karar_adimi: b.karar_adimi, kritik: false, tuttugu: k?.sira?.find((s: any) => s.no === b.no)?.tuttugu ?? 0, onceki: [], sonraki: [], son_tarih: b.son_tarih, en_erken_bitis: null, gec_risk: false, bekleme_saat: b.bekleme_saat, durum_at: null };
  });
}

/** "Sende 3 iş sırada; biri engelli." · "Selin'de 2 iş sırada." · "Seçilen işler bitti." */
export function gorevCumlesi(G: any[], kisi: string, ben: string, durum: Durum): string {
  const kim = kisi === 'ben' || kisi === ben ? 'Sende' : kisi === 'hepsi' ? 'Bütün akışlarda' : ozelEk(kisa(kisi), 'de');
  if (durum === 'bitti') return G.length ? `${kim} ${G.length} iş bitti.` : 'Henüz biten iş yok.';
  const sira = G.filter((a) => a.durum === 'hazir').length, engel = G.filter((a) => a.durum === 'engelli').length, suren = G.filter((a) => a.durum === 'suruyor').length;
  const acik = G.filter((a) => !BITTI(a.durum)).length;
  if (!acik) return kisi === 'ben' ? 'Şu an senden beklenen iş yok.' : 'Bu süzgeçte açık iş yok.';
  if (!sira && !engel) return suren ? `${kim} ${suren} iş sürüyor.` : `${kim} ${acik} iş sırasını bekliyor.`;
  const bas = sira ? `${kim} ${sira} iş sırada` : `${kim} ${engel} iş engelli`;
  return `${bas}${sira && engel ? `; ${engel === 1 ? 'biri' : engel} engelli` : ''}${suren ? `, ${suren} iş sürüyor` : ''}.`;
}

export type GrupAd = 'SIRASI GELEN' | 'ENGELLİ' | 'SÜRÜYOR' | 'SIRADA' | 'BİTTİ';
/** Durum grupları, ekrandaki sırayla; içte sunucu sırası (engel ve karar önce, en çok tutan). */
export function gruplar(G: any[]): [GrupAd, any[]][] {
  const g: [GrupAd, (a: any) => boolean][] = [['SIRASI GELEN', (a) => a.durum === 'hazir'], ['ENGELLİ', (a) => a.durum === 'engelli'], ['SÜRÜYOR', (a) => a.durum === 'suruyor'], ['SIRADA', (a) => a.durum === 'sirada' || a.durum === 'bekliyor'], ['BİTTİ', (a) => BITTI(a.durum)]];
  return g.map(([ad, f]) => [ad, G.filter(f)] as [GrupAd, any[]]).filter(([, L]) => L.length);
}

/** Satırın bağımlılık işareti: "← Claude'u bekliyor" ya da "→ Selin seni bekliyor" (açık işte). */
export function bagIsareti(a: any, ben: string): string | null {
  if (BITTI(a.durum)) return null;
  const sen = a.sahip === ben;
  const bekledigi = (a.onceki || []).filter((x: any) => x.sahip !== a.sahip);
  if (a.durum !== 'hazir' && a.durum !== 'suruyor' && bekledigi.length) {
    const k = kisa(bekledigi[0].sahip);
    return `← ${k === ben ? 'seni' : ozelEk(k, 'i')} bekliyor${bekledigi.length > 1 ? ` +${bekledigi.length - 1}` : ''}`;
  }
  const bekleyen = (a.sonraki || []).filter((x: any) => x.sahip !== a.sahip);
  if (bekleyen.length) {
    const k = kisa(bekleyen[0].sahip);
    const n = bekleyen.length > 1 ? ` +${bekleyen.length - 1}` : '';
    return k === ben ? `→ sen bekliyorsun${n}` : `→ ${k} ${sen ? 'seni' : 'bunu'} bekliyor${n}`;
  }
  return null;
}

/** Görevin haritadaki zamanı: biten bitiş anı; açıkta son tarih (görevin vakti), yoksa en erken bitiş, yoksa bugün. */
export const gorevAni = (a: any, now: number) => BITTI(a.durum) && a.durum_at ? Date.parse(a.durum_at) : a.son_tarih ? tarihMs(a.son_tarih) : a.en_erken_bitis ? Date.parse(a.en_erken_bitis) : now;

export interface HNokta { a: any; x: number; y: number; serit: number }
export interface Harita { seritler: { ad: string; tip: 'kisi' | 'akis'; sahipTip?: string; y: number }[]; noktalar: HNokta[]; t0: number; t1: number; x0: number; x1: number; bugunX: number; h: number }

/**
 * Görev haritası (quest haritası): tek zaman ekseninde şeritler. Kişi süzgeci "hepsi" ise şerit kişi başına,
 * tek kişi seçiliyse akış başına. Aynı şeritte yakın düşen görevler dikeyde ayrışır. En çok 6 şerit, gerisi "+n".
 */
export function gorevHaritasi(G: any[], o: { kisiBasina: boolean; now: number; x0?: number; x1?: number; y0?: number; satir?: number; en?: number }): Harita {
  const x0 = o.x0 ?? 112, x1 = o.x1 ?? 360, y0 = o.y0 ?? 0, S = o.satir ?? 36, EN = o.en ?? 6;
  const anahtar = (a: any) => (o.kisiBasina ? a.sahip : a.akis);
  const sayi = new Map<string, number>();
  for (const a of G) sayi.set(anahtar(a), (sayi.get(anahtar(a)) || 0) + 1);
  const sirali = [...sayi.keys()].sort((p, q) => sayi.get(q)! - sayi.get(p)! || p.localeCompare(q, 'tr')).slice(0, EN);
  const anlar = G.map((a) => gorevAni(a, o.now));
  const t0 = Math.min(o.now - 2 * GUN, ...anlar), t1 = Math.max(o.now + 12 * GUN, ...anlar) + GUN;
  const X = (t: number) => x0 + ((t - t0) / (t1 - t0)) * (x1 - x0);
  const seritler = sirali.map((k, i) => {
    const a = G.find((g) => anahtar(g) === k);
    return { ad: o.kisiBasina ? k : a.akis_kisa_ad || a.akis_baslik, tip: (o.kisiBasina ? 'kisi' : 'akis') as 'kisi' | 'akis', sahipTip: o.kisiBasina ? a.sahip_tip : undefined, y: y0 + S / 2 + i * S };
  });
  const noktalar: HNokta[] = [];
  G.forEach((a, i) => {
    const s = sirali.indexOf(anahtar(a));
    if (s < 0) return;
    const x = X(anlar[i]);
    // aynı şeritte 14 px'ten yakın olanlar: sırayla üst, alt, daha üst…
    const yakin = noktalar.filter((n) => n.serit === s && Math.abs(n.x - x) < 14).length;
    const dy = yakin ? (yakin % 2 ? -1 : 1) * Math.ceil(yakin / 2) * 8 : 0;
    noktalar.push({ a, x, y: seritler[s].y + Math.max(-S / 2 + 6, Math.min(S / 2 - 6, dy)), serit: s });
  });
  return { seritler, noktalar, t0, t1, x0, x1, bugunX: X(o.now), h: Math.max(1, sirali.length) * S };
}
