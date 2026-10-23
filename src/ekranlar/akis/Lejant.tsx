import { AltSayfa } from '../../bilesen/AltSayfa';
import { planet, ship, tower } from '../../cizim/ortak.js';
import { iconCloud, iconRings, bayrak } from '../../cizim/ekran';
import { yuzeyKodlamalari, type Yuzey } from '../../geometri/kodlama';
import { bSuzgecAdresi, type OlayTuru } from '../bildirimler/model';
import { git } from '../../yonlendirme';

/** Lejant satırının anahtarı: sayı bu anahtarla gelir; olay türü olan satır o türün bildirimlerine gider (N2). */
export type LejantAnahtar = 'bitti' | 'sira' | 'engel' | 'sirada' | 'atlandi' | 'karar' | 'insan' | 'agent' | 'dis' | 'galaksi';
const TUR: Partial<Record<LejantAnahtar, OlayTuru>> = { bitti: 'bitti', sira: 'sira', engel: 'engel', atlandi: 'atlandi', karar: 'karar' };

// Harita dili (denetim planı, CELISKILER 64): haritadaki işaretlerin ne demek olduğu. "?" düğmesiyle açılır.
type Satir = [string, string, string, LejantAnahtar?];
const SATIRLAR: Satir[] = [
  [planet(22, 22, 9, 'lit', { life: false }), 'Bitti', 'Işıklı', 'bitti'],
  [planet(22, 22, 9, 'wait', { life: false, waitRings: 1 }), 'Sırası geldi', 'Halkalı; sürüyorsa halka döner', 'sira'],
  [planet(22, 22, 9, 'block', { life: false, cloudGap: 2 }), 'Engelli', 'Fırtına bulutu ve şimşek', 'engel'],
  [planet(22, 22, 9, 'dark', { life: false }), 'Sırada', 'Karanlık; önündeki adım bitince yanar', 'sirada'],
  [planet(22, 22, 9, 'ghost', { life: false }), 'Atlandı', 'Kesik çizgili', 'atlandi'],
  [planet(22, 22, 9, 'wait', { life: false, waitRings: 1, karar: true }), 'Karar', 'Bayraklı: son söz insanda', 'karar'],
  [ship(22, 22, -12, 'insan', 'B', '#9EE6CF', .62, { flame: false }), 'İnsan', 'Yuvarlak pencere, baş harf', 'insan'],
  [ship(22, 22, -12, 'agent', 'C', '#B9A6F2', .62, { flame: false }), 'Agent', 'İki anten, köşeli pencere', 'agent'],
  [ship(22, 24, 0, 'dis', '', '#F2B8D8', .6), 'Dış katılımcı', 'Yelkenli; yalnız kendi adımlarını görür', 'dis'],
  [tower(22, 34, .34, true), 'Hedef tarih', 'Kule; dokununca pay ve kritik yol'],
];

/** Evren dili (el notu 2): usturlap, yörünge, ip ve işaretler. */
const EVREN_SATIRLAR: Satir[] = [
  [`<circle cx="22" cy="22" r="19" fill="none" stroke="#120B2C" stroke-width="6"/><path d="M22,3 A19,19 0 0 1 39,14" fill="none" stroke="#FFC9A3" stroke-width="4" stroke-linecap="round"/><path d="M22,22 L37,12" stroke="#FFD9B8" stroke-width="1.8" stroke-linecap="round"/><circle cx="22" cy="22" r="2.6" fill="#FFD27A"/>`, 'Takvim halkası ve ibre', 'Halka aylar; ibre bugün, dolan yay geçen zaman'],
  [`<circle cx="22" cy="22" r="12" fill="url(#glowGold)" opacity=".5"/><circle cx="22" cy="22" r="8" fill="url(#pLit)"/><circle cx="22" cy="22" r="12" fill="none" stroke="#3A3170" stroke-width="1.6"/><path d="M22,10 A12,12 0 0 1 34,22" fill="none" stroke="#FFD27A" stroke-width="1.8"/>`, 'Galaksi', 'Bir akış; çerçeveli, adı çerçevede; boyu adım sayısı, ışığı ve yayı biten adımlar', 'galaksi'],
  [`<path d="M6,34 A24,24 0 0 1 22,10" fill="none" stroke="#FFD27A" stroke-width="1.6" opacity=".7"/><path d="M22,10 A24,24 0 0 1 38,20" fill="none" stroke="#B9A6F2" stroke-width="1.2" opacity=".6"/><circle cx="38" cy="20" r="5" fill="url(#pLit)"/>`, 'Yörünge', 'Başlangıçtan hedefe; altın kısım geçen süre'],
  [`<circle cx="22" cy="22" r="18" fill="none" stroke="#8E80D6" stroke-dasharray="2 3"/><circle cx="22" cy="5" r="4" fill="#FFD27A"/><circle cx="22" cy="30" r="4" fill="#B9A6F2"/>`, 'Halkaya uzaklık', 'Hedefe az pay kalan akış halkaya yakın durur'],
  [`<path d="M8,30 Q22,14 36,30" fill="none" stroke="#D9CCFF" stroke-width="1.6" stroke-dasharray="2 3"/><circle cx="8" cy="30" r="4" fill="url(#pLit)"/><circle cx="36" cy="30" r="4" fill="url(#pLit)"/>`, 'İp', 'İki akışta aynı kişi çalışıyor'],
  [`<g transform="translate(22,24)">${iconCloud(0, 0, .6)}</g>`, 'Takılan iş', 'Cümledeki engel; köşeli çerçeveyle işaretli', 'engel'],
  [`<g transform="translate(22,22)">${iconRings(0, 0, .8)}</g>`, 'Bekleyen iş', 'Sırası gelmiş, sahibini bekliyor', 'sira'],
  [bayrak(22, 22, .9), 'Karar', 'Karar bekleyen adımı var', 'karar'],
];

/**
 * Harita dili. sayilar verilirse her işaretin yanında bu haritada kaç tane olduğu yazar; olay türü olan işaret
 * (bitti, sırası geldi, engel, atlandı, karar) o türün bildirimlerine gider (N2). akis: galaksinin kodu (bildirimler o akışa süzülür).
 */
export function Lejant({ acik, kapat, yuzey = 'galaksi', sayilar, akis }: { acik: boolean; kapat: () => void; yuzey?: Extract<Yuzey, 'galaksi' | 'evren'>; sayilar?: Partial<Record<LejantAnahtar, number>>; akis?: string }) {
  // işaretlerin altında haritanın matematiği: hangi veri neyi belirliyor (geometri/kodlama.ts, madde 11)
  const K = yuzeyKodlamalari(yuzey).filter((k) => k.durum === 'var');
  const SATIRLAR_ = yuzey === 'evren' ? EVREN_SATIRLAR : SATIRLAR;
  const baslik = yuzey === 'evren' ? 'Evren dili' : 'Harita dili';
  const y0 = Math.max(60, 844 - (SATIRLAR_.length * 52 + K.length * 40 + 150));
  return (
    <AltSayfa acik={acik} kapat={kapat} baslik={baslik} yukseklik={Math.max(110, y0)} duraklar={['orta']}>
      <div className="lejant">
        <h2 className="lejant-baslik">{baslik}</h2>
        <ul aria-label="Harita işaretleri">
          {SATIRLAR_.map(([svg, ad, alt, an]) => {
            const n = an ? sayilar?.[an] : undefined, tur = an ? TUR[an] : undefined;
            const ic = <>
              <svg aria-hidden width="44" height="44" viewBox="0 0 44 44" style={{ overflow: 'visible' }} dangerouslySetInnerHTML={{ __html: svg }} />
              <span><b>{ad}</b><small>{alt}</small></span>
              {n != null && <em className="lejant-sayi">{n}</em>}
            </>;
            // sayısı olan olay türü: bildirimlerde o tür (akış haritasında o akış); diğerleri yalnız açıklama
            return tur && sayilar ? (
              <li key={ad}><button type="button" className="lejant-satir" title={`${ad}: ${alt}. Bildirimlerde göster.`} aria-label={`${ad}: ${n ?? 0}. ${alt}. Bildirimlerde göster.`}
                onClick={() => { kapat(); git(bSuzgecAdresi({ sekme: 'tum', kisi: null, akis: akis || null, tur })); }}>{ic}</button></li>
            ) : <li key={ad} title={`${ad}: ${alt}`}>{ic}</li>;
          })}
        </ul>
        <h3 className="lejant-alt-baslik">Ne neyi gösterir</h3>
        <dl className="lejant-kodlama">
          {K.map((k) => <div key={k.kod}><dt>{k.veri}</dt><dd>{k[yuzey]}</dd></div>)}
        </dl>
      </div>
    </AltSayfa>
  );
}

/** Galaksi haritasının sayıları: adım durumları ve kişi türleri. */
export function galaksiSayilari(adimlar: any[]): Partial<Record<LejantAnahtar, number>> {
  const n = (f: (a: any) => boolean) => adimlar.filter(f).length;
  const kisi = (t: string) => new Set(adimlar.filter((a) => (a.sahip_tip || 'insan') === t).map((a) => a.sahip)).size;
  return {
    bitti: n((a) => a.durum === 'tamam'), sira: n((a) => a.durum === 'hazir' || a.durum === 'suruyor'), engel: n((a) => a.durum === 'engelli'),
    sirada: n((a) => a.durum === 'sirada'), atlandi: n((a) => a.durum === 'atlandi' || a.durum === 'ertelendi'),
    karar: n((a) => a.karar_adimi && a.durum !== 'tamam' && a.durum !== 'atlandi'), insan: kisi('insan'), agent: kisi('agent'), dis: kisi('dis'),
  };
}
/** Evren haritasının sayıları: akış sayısı, takılan, bekleyen ve karar bekleyen işler (bütün akışlarda). */
export function evrenSayilari(kartlar: any[], detay: Record<string, any>): Partial<Record<LejantAnahtar, number>> {
  const A = kartlar.flatMap((k) => detay[k.kod]?.adimlar || []);
  const g = galaksiSayilari(A);
  return { galaksi: kartlar.length, engel: g.engel, sira: A.filter((a: any) => a.durum === 'hazir').length, karar: A.filter((a: any) => a.karar_adimi && (a.durum === 'hazir' || a.durum === 'suruyor')).length };
}

/** "?" düğmesinin içi */
export const SoruIkon = () => <svg aria-hidden viewBox="-10 -10 20 20"><path d="M-3.2,-3.4 Q-3.2,-7 0,-7 Q3.4,-7 3.4,-3.8 Q3.4,-1.6 0.8,-0.4 Q0,0 0,1.8" /><circle cx="0" cy="5.4" r=".6" /></svg>;
