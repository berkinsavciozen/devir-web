// Galaksi başlığı (el notu 7–8): kural tabanlı durum cümlesi ve rol bazlı çipler.
// Cümle iki parça: önce darboğaz (ne tutuyor), sonra ne iyi gidiyor / ne bitti. Kurallar sırayla denenir, ilk tutan yazılır.
import { adimAdi, ek, gunAyUzun, sayiIyelik } from '../../metin/turkce';
import { hedefPayi } from '../../bilesen/KararSeridi';
import type { Rol } from '../../api/turler';
import { ilerleme as ilerlemeSay } from '../../api/ilerleme';

const BITTI = (d: string) => ['tamam', 'atlandi', 'ertelendi'].includes(d);
const ACIK_KARAR = (a: any) => a.karar_adimi && !BITTI(a.durum);

/** Bir adımın bitmeden tuttuğu (geçişli bağımlı, açık) adım sayısı. */
export function tuttugu(d: any, no: number): number {
  const g = new Set<number>(), q = [no];
  while (q.length) { const x = q.pop()!; for (const b of d.adimlar) if ((b.bagimli || []).includes(x) && !g.has(b.no) && !BITTI(b.durum)) { g.add(b.no); q.push(b.no); } }
  return g.size;
}

export interface Sayilar { toplam: number; biten: number; engelli: any[]; karar: any[]; gecRisk: any[]; sirasi: any[]; benim: any[] }

export function sayilar(d: any, ben?: string | null): Sayilar {
  const A: any[] = d.adimlar;
  const byT = (xs: any[]) => xs.sort((a, b) => tuttugu(d, b.no) - tuttugu(d, a.no) || a.no - b.no);
  return {
    toplam: ilerlemeSay(A).toplam,
    biten: ilerlemeSay(A).tamam,
    engelli: byT(A.filter((a) => a.durum === 'engelli')),
    karar: byT(A.filter(ACIK_KARAR)),
    gecRisk: byT(A.filter((a) => a.gec_risk && a.durum !== 'engelli')),
    sirasi: A.filter((a) => a.durum === 'hazir' || a.durum === 'suruyor'),
    benim: ben ? A.filter((a) => a.sahip === ben && (a.durum === 'hazir' || a.durum === 'suruyor' || a.durum === 'engelli' || ACIK_KARAR(a))) : [],
  };
}

const buyukBas = (s: string) => s[0].toLocaleUpperCase('tr') + s.slice(1);
/** Cümle içinde adım adı: kısa ad varsa o (isim öbeği, ek alır); yoksa tam adın başı, iki noktadan sonra yazılır (çekime girmez). */
const ad = (a: any) => (a.kisa_ad ? a.kisa_ad : a.ad.length <= 32 ? a.ad : a.ad.slice(0, a.ad.lastIndexOf(' ', 31)).replace(/[,;:]$/, '') + '…');

/** Darboğaz parçası: takılan > karar > son tarih riski > kritik yol. Yoksa null. */
function darbogaz(d: any, S: Sayilar): string | null {
  if (S.engelli.length) {
    const a = S.engelli[0], m = tuttugu(d, a.no);
    if (S.engelli.length > 1) return `${S.engelli.length} adım takıldı; en çok tutan: ${ad(a)}${m ? ` (${m} adım)` : ''}`;
    if (!a.kisa_ad) return `Takılan adım: ${ad(a)}${m ? `; ${m} adımı tutuyor` : ''}`;
    return `${buyukBas(adimAdi(a))} takıldı${m ? `, ${m} adımı tutuyor` : ''}`;
  }
  if (S.karar.length) {
    const a = S.karar[0];
    return S.karar.length > 1 ? `${S.karar.length} karar bekleniyor; ilki: ${ad(a)}` : `Karar bekleniyor: ${ad(a)}`;
  }
  if (S.gecRisk.length) return S.gecRisk.length > 1 ? `${S.gecRisk.length} adım son tarihini kaçırabilir` : `Son tarihini kaçırabilir: ${ad(S.gecRisk[0])}`;
  const by = new Map<number, any>(d.adimlar.map((a: any) => [a.no, a]));
  const kr = (d.kritik_yol || []).map((no: number) => by.get(no)).find((a: any) => a && !BITTI(a.durum));
  return kr ? `Kritik yol ${ek(adimAdi(kr), 'den')} geçiyor` : null;
}

/** İlerleme parçası: kaç adım bitti ve hedefe göre durum. */
function ilerleme(d: any, S: Sayilar): string {
  const k = d.akis;
  const bitti = S.biten === S.toplam ? 'bütün adımlar bitti' : S.biten ? `${S.toplam} adımdan ${sayiIyelik(S.biten)} bitti` : 'henüz biten adım yok';
  const pay = hedefPayi(k);
  const erken = !pay && k.en_erken_bitis ? `en erken ${gunAyUzun(k.en_erken_bitis)}` : '';
  return [bitti, pay || erken].filter(Boolean).join(', ');
}

/** Galaksi başlığının altındaki cümle (kural tabanlı). Kapalı akışta null. */
export function akilliCumle(d: any): string | null {
  if (d.akis.kapandi_at || !d.adimlar.length) return null;
  const S = sayilar(d);
  const b = darbogaz(d, S), i = ilerleme(d, S);
  return b ? `${b}; ${i}.` : `${buyukBas(i)}.`;
}

export type CipTur = 'engel' | 'karar' | 'risk' | 'sende' | 'sira' | 'bitti';
export interface Cip { tur: CipTur; sayi: number; metin: string; etiket: string; no?: number }

/**
 * Rol bazlı çipler (en çok 4). Herkes için önce kendi işi ("Sende"), sonra akışın darboğazları.
 * Sahip ve üye bütün darboğazları görür; dış katılımcı yalnız kendi işini ve bitenleri.
 */
export function basliktaCipler(d: any, ben: string | null, rol: Rol | null, en = 4): Cip[] {
  const S = sayilar(d, ben), C: Cip[] = [];
  if (S.benim.length) C.push({ tur: 'sende', sayi: S.benim.length, metin: `Sende ${S.benim.length}`, etiket: `Sende ${S.benim.length} açık adım; dokununca yalnız seninkiler görünür` });
  if (rol !== 'dis') {
    if (S.engelli.length) C.push({ tur: 'engel', sayi: S.engelli.length, metin: `${S.engelli.length} takılı`, etiket: `${S.engelli.length} adım takılı; dokununca en çok tutan açılır`, no: S.engelli[0].no });
    if (S.karar.length) C.push({ tur: 'karar', sayi: S.karar.length, metin: `${S.karar.length} karar`, etiket: `${S.karar.length} karar bekliyor; dokununca ilki açılır`, no: S.karar[0].no });
    if (S.gecRisk.length) C.push({ tur: 'risk', sayi: S.gecRisk.length, metin: `${S.gecRisk.length} gecikebilir`, etiket: `${S.gecRisk.length} adım son tarihini kaçırabilir; dokununca ilki açılır`, no: S.gecRisk[0].no });
    if (!S.engelli.length && S.sirasi.length) C.push({ tur: 'sira', sayi: S.sirasi.length, metin: `${S.sirasi.length} sırada`, etiket: `${S.sirasi.length} adımın sırası geldi` });
  }
  C.push({ tur: 'bitti', sayi: S.biten, metin: `${S.biten}/${S.toplam}`, etiket: `${S.toplam} adımdan ${S.biten} tanesi bitti` });
  return C.slice(0, en);
}
