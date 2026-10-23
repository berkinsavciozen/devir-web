// Evren panosu (el notu 3–4): bütün aktif akışların tutanağı ve duruma göre bekleyen işler.
// Süzgeç hem listeyi hem haritayı süzer: eşleşmeyen galaksiler sönükleşir.
import { sayiIyelik } from '../../metin/turkce';
import { tuttugu } from './cumleler';

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
    toplam += A.length; biten += A.filter((a) => BITTI(a.durum)).length;
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
    n('sende') && `${n('sende')} iş senden bekleniyor`,
  ].filter(Boolean);
  const cumle = kartlar.length
    ? `${kartlar.length} aktif akışta toplam ${toplam} adım: ${parca.join(', ')}${eksik ? `; ${eksik === kartlar.length ? 'işler' : `${eksik} akışın işleri`} yükleniyor` : ''}.`
    : 'Aktif akış yok.';
  const sira: PanoTur[] = ['sende', 'engel', 'karar', 'risk', 'sira'];
  const suzgecler = sira.filter((t) => n(t)).map((t) => ({ tur: t, n: n(t) }));
  return { cumle, eksik, suzgecler, adimlar, varsayilan: suzgecler[0]?.tur ?? null };
}
