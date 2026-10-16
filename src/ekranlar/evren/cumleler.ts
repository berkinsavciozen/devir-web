// B1 · evrenin iki akıllı cümlesi (§5 B1): engel (senin) ve bekleme (başkasının hazır adımı en çok adımı tutan).
import { adimAdi, akisAdi, ozelEk } from '../../metin/turkce';

const BITTI = (d: string) => ['tamam', 'atlandi', 'ertelendi'].includes(d);

export interface EvrenCumle { tur: 'engel' | 'bekleme' | 'ozet'; metin: string; kod?: string; no?: number }

/** Geçişli bekleyen açık adım sayısı (sunucu `sira[].tuttugu` vermezse detaydan). */
export function tuttugu(adimlar: any[], no: number): number {
  const g = new Set<number>(), q = [no];
  while (q.length) { const x = q.pop()!; for (const b of adimlar) if ((b.bagimli || []).includes(x) && !g.has(b.no) && !BITTI(b.durum)) { g.add(b.no); q.push(b.no); } }
  return g.size;
}

/** Liste içinde küçük harf: "Sızma testi raporu" → "sızma testi raporu"; "App Store onayı" olduğu gibi. */
const kucuk = (s: string) => { const w = s.split(' '); return /^[A-ZÇĞİÖŞÜ][^A-ZÇĞİÖŞÜ]*$/.test(w[0]) && !(w[1] && /^[A-ZÇĞİÖŞÜ]/.test(w[1])) ? s[0].toLocaleLowerCase('tr') + s.slice(1) : s; };
const kisiAdi = (s: string) => s.replace(/\s*\(.*\)$/, '');
const ajan = (a: any) => a.sahip_tip === 'agent' || /agent|Claude|ChatGPT/i.test(a.sahip);

/**
 * kartlar: /ozet.akislar; detay: kod → GET /akis/:kod (yoksa kartın `sira`sı).
 * Engel: "{akış} senin {engel özeti} bekliyor; {n} adımı tutuyor." (engel sende ya da metninde adın geçiyor)
 * Bekleme: "{akış}'te {kişi}'in {adım} {n} adımı tutuyor." (sende olmayan, insan ya da dış kişideki hazır adım)
 */
export function evrenCumleleri(kartlar: any[], detay: Record<string, any>, ben: string, ozet?: string): EvrenCumle[] {
  const adayE: { k: any; a: any; n: number }[] = [], adayB: { k: any; a: any; n: number }[] = [];
  const benimAd = new RegExp(`(^|[^\\p{L}])${ben.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}])`, 'u');
  for (const k of kartlar) {
    const d = detay[k.kod];
    const adimlar: any[] = d?.adimlar || k.sira || [];
    const say = (a: any) => (typeof a.tuttugu === 'number' ? a.tuttugu : d ? tuttugu(d.adimlar, a.no) : 0);
    for (const a of adimlar) {
      if (a.durum === 'engelli' && ben && (a.sahip === ben || (a.engel && benimAd.test(a.engel)))) adayE.push({ k, a, n: say(a) });
      else if (a.durum === 'hazir' && a.sahip !== ben && !ajan(a)) adayB.push({ k, a, n: say(a) });
    }
  }
  const sec = (xs: typeof adayE) => xs.sort((p, q) => q.n - p.n || (q.a.bekleme_saat || 0) - (p.a.bekleme_saat || 0))[0];
  const out: EvrenCumle[] = [];
  const e = sec(adayE);
  if (e) {
    const ek = e.a.engel_kisa || 'engelini';
    out.push({ tur: 'engel', kod: e.k.kod, no: e.a.no, metin: `${akisAdi(e.k)} senin ${ek} bekliyor${e.n ? `; ${e.n} adımı tutuyor` : ''}.` });
  }
  const b = sec(adayB.filter((x) => x.n > 0));
  if (b) out.push({ tur: 'bekleme', kod: b.k.kod, no: b.a.no, metin: `${ozelEk(akisAdi(b.k), 'de')} ${ozelEk(kisiAdi(b.a.sahip), 'in')} ${kucuk(adimAdi(b.a))} ${b.n} adımı tutuyor.` });
  if (!out.length && ozet) out.push({ tur: 'ozet', metin: ozet.split(/(?<=\.)\s+/).slice(0, 2).join(' ') });
  return out;
}
