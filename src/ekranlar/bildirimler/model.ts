// Bildirimler (el notu 18): olay cümlesi, art arda olayların toplanması, gün grupları ve süzgeç. Saf mantık.
const GUN = 864e5;
/** Kişi adı cümlede: parantezli ek atılır ("Emre (Test Bank)" → "Emre"). */
export const kisa = (s: string) => (s || '').replace(/\s*\(.*\)$/, '').replace(/'/g, '’');

export type BSekme = 'sen' | 'tum';
export interface BSuzgec { sekme: BSekme; kisi: string | null; akis: string | null }
export function bSuzgecOku(q: URLSearchParams): BSuzgec {
  return { sekme: q.get('sekme') === 'tum' ? 'tum' : 'sen', kisi: q.get('kisi') || null, akis: q.get('akis') || null };
}
export function bSuzgecAdresi(s: BSuzgec): string {
  const p = new URLSearchParams();
  if (s.sekme === 'tum') p.set('sekme', 'tum');
  if (s.kisi) p.set('kisi', s.kisi);
  if (s.akis) p.set('akis', s.akis);
  const q = p.toString();
  return '/bildirimler' + (q ? '?' + q : '');
}

const DURUM_FIIL: Record<string, string> = { suruyor: 'başladı', tamam: 'bitirdi', engelli: 'engel bildirdi', atlandi: 'atladı', ertelendi: 'erteledi', hazir: 'hazır dedi', sirada: 'sıraya aldı' };
const TIP_FIIL: Record<string, string> = { guncelleme: 'ilerleme yazdı', not: 'not düştü', cikti: 'çıktı ekledi', adim_eklendi: 'adım ekledi', karar: 'karar verdi', cevap: 'soruyu cevapladı', sahip: 'sahibini değiştirdi' };
const AKIS_FIIL: Record<string, string> = { akis_olustu: 'akışı kurdu', akis_kapandi: 'akışı kapattı', ders: 'ders çıkardı' };

/** Olayın kısa adım adı: kısa ad, yoksa adın ilk parçası. */
export const adimAdi = (e: any) => e.adim_kisa_ad || (e.adim_ad ? String(e.adim_ad).split(/[,:;(]/)[0].trim() : null);

/**
 * Tek satırlık fiil cümlesi. Yapan + fiil; adım adı ayrı (ek getirmeden): "Selin bitirdi", "Sırası geldi".
 * Sistem olayları öznesiz yazılır.
 */
export function olayFiili(e: any): string {
  const sistem = e.kim_tip === 'sistem';
  if (e.tip === 'durum') {
    if (sistem) return e.durum === 'hazir' ? 'Sırası geldi' : e.durum === 'sirada' ? 'Yeniden sıraya alındı' : e.durum === 'engelli' ? 'Engellendi' : 'Durumu değişti';
    return `${kisa(e.kim)} ${DURUM_FIIL[e.durum] || 'durumu değiştirdi'}`;
  }
  if (e.adim_no == null) return sistem ? (e.tip === 'akis_kapandi' ? 'Akış kapandı' : 'Akışta değişiklik') : `${kisa(e.kim)} ${AKIS_FIIL[e.tip] || 'akışı güncelledi'}`;
  if (sistem) return e.tip === 'not' ? 'Devir not düştü' : 'Devir güncelledi';
  return `${kisa(e.kim)} ${TIP_FIIL[e.tip] || 'güncelledi'}`;
}

/** Olayın açıklaması: özetin önek ve iç ayrıntıları ayıklanmış ilk cümlesi (durum olaylarında yalnız engel). */
export function olayAciklamasi(e: any): string | null {
  let o = String(e.ozet || '');
  const c = o.match(/·\s*çıktı:\s*(.+)$/);
  if (c) return c[1].split(/[:(—]/)[0].trim();
  if (e.tip === 'durum' && e.durum !== 'engelli') return null;
  o = o.replace(/^ilerleme:\s*/i, '').replace(/^Adım \d+[^:;]*[:;]\s*/i, '').replace(/\s*\([^)]*\)/g, '').trim();
  const ilk = o.split(/(?<=[.;])\s/)[0].replace(/[.;]$/, '').trim();
  return ilk || null;
}

export interface Toplu { e: any; n: number; ids: number[]; okundu: boolean; ilgili: boolean; adimlar: string[]; sira?: boolean }
/** Sistemin "sırası geldi" olayı: art arda gelenler akış başına tek satırda toplanır. */
const siraOlayi = (e: any) => e.kim_tip === 'sistem' && e.tip === 'durum' && e.durum === 'hazir';
/**
 * Yeniden eskiye sıralı olaylarda aynı adımdaki, aynı kişinin art arda olayları tek satır olur. Aynı akışta art arda
 * "sırası geldi" olayları da tek satır olur ("4 adımın sırası geldi"); bir adım biterken açılan adımlar böyle gelir.
 */
export function topla(O: any[]): Toplu[] {
  const out: Toplu[] = [];
  for (const e of O) {
    const p = out[out.length - 1];
    const ayniGun = p && gunAnahtari(p.e.zaman) === gunAnahtari(e.zaman) && p.e.akis === e.akis;
    const ayniAdim = ayniGun && e.adim_no != null && p.e.adim_no === e.adim_no && p.e.kim === e.kim;
    const sira = ayniGun && siraOlayi(e) && siraOlayi(p.e);
    if (p && (ayniAdim || sira)) {
      p.n++; p.ids.push(e.id); p.okundu = p.okundu && !!e.okundu; p.ilgili = p.ilgili || !!e.ilgili;
      const a = adimAdi(e); if (a && !p.adimlar.includes(a)) p.adimlar.push(a);
      if (sira && p.e.adim_no !== e.adim_no) p.sira = true;
    } else out.push({ e, n: 1, ids: [e.id], okundu: !!e.okundu, ilgili: !!e.ilgili, adimlar: adimAdi(e) ? [adimAdi(e)] : [] });
  }
  return out;
}

const gunAnahtari = (z: string) => new Date(Date.parse(z) + 3 * 36e5).toISOString().slice(0, 10);
/** Gün başlığı (Türkiye saatiyle): BUGÜN, DÜN, ya da "12 EKİ". */
export function gunBasligi(z: string, now: number, gunAy: (ms: number) => string): string {
  const g = gunAnahtari(z), b = gunAnahtari(new Date(now).toISOString()), d = gunAnahtari(new Date(now - GUN).toISOString());
  return g === b ? 'BUGÜN' : g === d ? 'DÜN' : gunAy(Date.parse(z)).toLocaleUpperCase('tr');
}
export function gunlere<T extends { e: any }>(L: T[], now: number, gunAy: (ms: number) => string): [string, T[]][] {
  const m = new Map<string, T[]>();
  for (const x of L) { const k = gunBasligi(x.e.zaman, now, gunAy); (m.get(k) || m.set(k, []).get(k)!).push(x); }
  return [...m];
}

/** Süzgeç: "Senin için" yalnız ilgili olaylar; kişi ve akış seçimi. */
export function suz(O: any[], s: BSuzgec): any[] {
  return O.filter((e) => (s.sekme === 'tum' || e.ilgili) && (!s.kisi || e.kim === s.kisi) && (!s.akis || e.akis === s.akis));
}

/**
 * Sunucu 0.12.0 yoksa (/olaylar 404): akışların kendi geçmişlerinden (her akışın son 60 olayı) aynı biçimde olaylar.
 * Okundu bilgisi yok; hepsi okunmuş sayılır, zil sayısız kalır.
 */
export function gecmistenOlaylar(detaylar: Record<string, any>, ben: string): any[] {
  const out: any[] = [];
  for (const [kod, d] of Object.entries(detaylar)) {
    const A = d?.adimlar || [];
    for (const e of d?.olaylar || []) {
      if (e.tip === 'okuma' || (ben && e.kim === ben)) continue;
      const s = e.adim_no != null ? A.find((x: any) => x.no === e.adim_no) : null;
      const ilgili = !!s && (s.sahip === ben || A.some((x: any) => (x.bagimli || []).includes(s.no) && x.sahip === ben));
      out.push({ ...e, akis: kod, akis_baslik: d.akis?.baslik || kod, akis_kisa_ad: d.akis?.kisa_ad || null, adim_ad: s?.ad || null, adim_kisa_ad: s?.kisa_ad || null, ilgili, okundu: true });
    }
  }
  return out.sort((a, b) => Date.parse(b.zaman) - Date.parse(a.zaman) || (b.id || 0) - (a.id || 0));
}
