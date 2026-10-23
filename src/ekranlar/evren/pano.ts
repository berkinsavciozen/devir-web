// Evren panosu (el notu 3–4): bütün aktif akışların tutanağı ve duruma göre bekleyen işler.
// Süzgeç hem listeyi hem haritayı süzer: eşleşmeyen galaksiler sönükleşir.
import { sayiIyelik } from '../../metin/turkce';
import { tuttugu } from './cumleler';
import { ilerleme } from '../../api/ilerleme';

const BITTI = (d: string) => ['tamam', 'atlandi', 'ertelendi'].includes(d);
const ACIK = (a: any) => !BITTI(a.durum) && a.durum !== 'sirada' && a.durum !== 'bekliyor';
/** Sırası gelmiş karar (sıradaki kararlar henüz kimseyi beklemiyor). */
const KARAR = (a: any) => a.karar_adimi && (a.durum === 'hazir' || a.durum === 'suruyor');

export type PanoTur = 'sende' | 'engel' | 'karar' | 'risk' | 'sira';
export const PANO_AD: Record<PanoTur, string> = { sende: 'Sende', engel: 'Takılı', karar: 'Karar', risk: 'Gecikebilir', sira: 'Sırada' };
const UYAR: Record<PanoTur, (a: any, ben: string) => boolean> = {
  sende: (a, ben) => !!ben && a.sahip === ben && ACIK(a),
  engel: (a) => a.durum === 'engelli',
  karar: KARAR,
  risk: (a) => a.gec_risk && !BITTI(a.durum),
  sira: (a) => a.durum === 'hazir' || a.durum === 'suruyor',
};

export interface PanoAdim { kod: string; no: number; ad: string; kisa_ad?: string | null; sahip: string; durum: string; karar: boolean; tuttugu: number; son?: string | null }
/** eksik: detayı henüz gelmemiş akış sayısı; listeler ve sayılar o akışlar gelmeden eksiktir (M-M3). */
export interface Pano { cumle: string; eksik: number; suzgecler: { tur: PanoTur; n: number }[]; adimlar: Record<PanoTur, PanoAdim[]>; varsayilan: PanoTur | null }

/** kartlar: /ozet.akislar (aktif); detay: kod → GET /akis/:kod. */
export function pano(kartlar: any[], detay: Record<string, any>, ben: string): Pano {
  const adimlar = {} as Record<PanoTur, PanoAdim[]>;
  for (const t of Object.keys(UYAR) as PanoTur[]) adimlar[t] = [];
  let toplam = 0, biten = 0, eksik = 0;
  for (const k of kartlar) {
    const A: any[] | undefined = detay[k.kod]?.adimlar;
    if (!A) { toplam += k.ilerleme?.toplam || 0; biten += k.ilerleme?.tamam || 0; eksik++; continue; }
    const i = ilerleme(A); toplam += i.toplam; biten += i.tamam;
    for (const a of A) for (const t of Object.keys(UYAR) as PanoTur[]) {
      if (!UYAR[t](a, ben)) continue;
      adimlar[t].push({ kod: k.kod, no: a.no, ad: a.ad, kisa_ad: a.kisa_ad ?? null, sahip: a.sahip, durum: a.durum, karar: !!a.karar_adimi, tuttugu: tuttugu(A, a.no), son: a.son_tarih ?? a.en_gec_bitis ?? null });
    }
  }
  for (const t of Object.keys(adimlar) as PanoTur[]) adimlar[t].sort((p, q) => q.tuttugu - p.tuttugu || p.kod.localeCompare(q.kod) || p.no - q.no);
  const n = (t: PanoTur) => adimlar[t].length;
  const parca = [
    toplam === biten ? 'hepsi bitti' : biten ? `${sayiIyelik(biten)} bitti` : 'henüz biten yok',
    n('engel') && `${n('engel')} adım takılı`,
    n('karar') && `${n('karar')} karar bekliyor`,
    n('sende') && `${n('sende')} görev senden bekleniyor`,
  ].filter(Boolean);
  const cumle = kartlar.length
    ? `${kartlar.length} aktif akışta toplam ${toplam} adım: ${parca.join(', ')}${eksik ? `; ${eksik === kartlar.length ? 'işler' : `${eksik} akışın işleri`} yükleniyor` : ''}.`
    : 'Aktif akış yok.';
  const sira: PanoTur[] = ['sende', 'engel', 'karar', 'risk', 'sira'];
  const suzgecler = sira.filter((t) => n(t)).map((t) => ({ tur: t, n: n(t) }));
  return { cumle, eksik, suzgecler, adimlar, varsayilan: suzgecler[0]?.tur ?? null };
}

export type KatilimciTip = 'insan' | 'agent' | 'dis';
export interface Katilimci { ad: string; tip: KatilimciTip; acik: number; sirasi: number; akislar: string[]; kod: string; siradaki: { kod: string; no: number; ad: string; kisa_ad?: string | null } | null }
const ajanMi = (ad: string, tip?: string) => tip === 'agent' || /agent|Claude/i.test(ad);
/**
 * Panodaki katılımcılar (N5, N10): aktif akışlardaki ekip, agent ve dış katılımcılar; sen hariç.
 * Önce sırası gelmiş işi olan, sonra açık işi çok olan. kod: kişinin açık işinin olduğu ilk akış (kişi sayfası oradan açılır).
 */
export function katilimcilar(kartlar: any[], detay: Record<string, any>, ben: string): Katilimci[] {
  const m = new Map<string, Katilimci>();
  for (const k of kartlar) {
    const A: any[] | undefined = detay[k.kod]?.adimlar;
    if (!A) continue;
    for (const a of A) {
      if (!a.sahip || a.sahip === ben) continue;
      const anahtar = a.sahip.toLocaleLowerCase('tr');
      let p = m.get(anahtar);
      if (!p) { p = { ad: a.sahip, tip: a.sahip_tip === 'dis' ? 'dis' : ajanMi(a.sahip, a.sahip_tip) ? 'agent' : 'insan', acik: 0, sirasi: 0, akislar: [], kod: k.kod, siradaki: null }; m.set(anahtar, p); }
      if (!p.akislar.includes(k.kod)) p.akislar.push(k.kod);
      if (BITTI(a.durum)) continue;
      if (!p.acik) p.kod = k.kod;
      p.acik++;
      if (a.durum === 'hazir' || a.durum === 'suruyor' || a.durum === 'engelli') { p.sirasi++; if (!p.siradaki) p.siradaki = { kod: k.kod, no: a.no, ad: a.ad, kisa_ad: a.kisa_ad ?? null }; }
    }
  }
  return [...m.values()].sort((p, q) => Number(q.sirasi > 0) - Number(p.sirasi > 0) || q.acik - p.acik || p.ad.localeCompare(q.ad, 'tr'));
}
