import { AltSayfa } from '../../bilesen/AltSayfa';
import { planet, ship, tower } from '../../cizim/ortak.js';
import { tac, elmas, belge } from '../../cizim/yol.js';
import { iconCloud, iconRings, bayrak } from '../../cizim/ekran';
import { yuzeyKodlamalari, type Yuzey } from '../../geometri/kodlama';
import { bSuzgecAdresi, type OlayTuru } from '../bildirimler/model';
import { git } from '../../yonlendirme';

/** Lejant satırının anahtarı: sayı bu anahtarla gelir; olay türü olan satır o türün bildirimlerine gider (N2). */
export type LejantAnahtar = 'bitti' | 'suruyor' | 'sira' | 'engel' | 'ertele' | 'kritik' | 'cikti' | 'darbogaz' | 'sirada' | 'atlandi' | 'karar' | 'insan' | 'agent' | 'dis' | 'galaksi';
const TUR: Partial<Record<LejantAnahtar, OlayTuru>> = { bitti: 'bitti', sira: 'sira', engel: 'engel', atlandi: 'atlandi', karar: 'karar' };

// Harita dili (denetim planı, CELISKILER 64): haritadaki işaretlerin ne demek olduğu. "?" düğmesiyle açılır.
type Satir = [string, string, string, LejantAnahtar?];
const SATIRLAR: Satir[] = [
  [planet(22, 22, 9, 'lit', { life: false }), 'Bitti', 'Işıklı', 'bitti'],
  [planet(22, 22, 9, 'run', { life: false }), 'Sürüyor', 'Yeşil, dönen kesik halka', 'suruyor'],
  [planet(22, 22, 9, 'wait', { life: false, waitRings: 1 }), 'Sırası geldi', 'Amber halka; sahibini bekliyor', 'sira'],
  [planet(22, 22, 9, 'block', { life: false, cloudGap: 2 }), 'Engelli', 'Fırtına bulutu ve şimşek', 'engel'],
  [planet(22, 22, 9, 'dark', { life: false }), 'Sırada', 'Karanlık; önündeki adım bitince yanar', 'sirada'],
  [planet(22, 22, 9, 'ertele', { life: false }), 'Ertelendi', 'Soluk, saatli; açık iş olarak kalır', 'ertele'],
  [planet(22, 22, 9, 'ghost', { life: false }), 'Atlandı', 'Kesik çizgili', 'atlandi'],
  [planet(22, 22, 9, 'wait', { life: false, waitRings: 1, karar: true }), 'Karar', 'Bayraklı: son söz insanda', 'karar'],
  [tac(22, 22, 8, 1) + planet(22, 22, 8, 'dark', { life: false }), 'Darboğaz', 'Taç: arkasında en çok iş bekleyen adım; ne kadar parlaksa o kadar çok', 'darbogaz'],
  [planet(22, 22, 8, 'dark', { life: false }) + elmas(13, 13, 1.3), 'Kritik yol', 'Altın elmas: gecikirse hedef tarih kayar', 'kritik'],
  [planet(22, 22, 8, 'lit', { life: false }) + belge(31, 30, 1.3), 'Çıktı', 'Belge: adımın teslim ettiği bir iş var', 'cikti'],
  [ship(22, 22, -12, 'insan', 'B', '#8EC5FF', .62, { flame: false }), 'İnsan', 'Yuvarlak pencere, baş harf', 'insan'],
  [ship(22, 22, -12, 'agent', 'C', '#B9A6F2', .62, { flame: false }), 'Agent', 'İki anten, köşeli pencere', 'agent'],
  [ship(22, 24, 0, 'dis', '', '#F2B8D8', .6), 'Dış katılımcı', 'Yelkenli; yalnız kendi adımlarını görür', 'dis'],
  [tower(22, 34, .34, true), 'Hedef tarih', 'Kule; dokununca pay ve kritik yol'],
];

/** Evren dili (el notu 2): usturlap, yörünge ve işaretler (ip, plan 27 Eki 3.27 ile kalktı). */
const EVREN_SATIRLAR: Satir[] = [
  [`<circle cx="22" cy="22" r="19" fill="none" stroke="#120B2C" stroke-width="6"/><path d="M22,3 A19,19 0 0 1 39,14" fill="none" stroke="#FFC9A3" stroke-width="4" stroke-linecap="round"/><path d="M22,22 L37,12" stroke="#FFD9B8" stroke-width="1.8" stroke-linecap="round"/><circle cx="22" cy="22" r="2.6" fill="#FFD27A"/>`, 'Takvim halkası ve ibre', 'Halka aylar; ibre bugün, dolan yay geçen zaman'],
  [`<circle cx="22" cy="22" r="12" fill="url(#glowGold)" opacity=".5"/><circle cx="22" cy="22" r="8" fill="url(#pLit)"/><circle cx="22" cy="22" r="12" fill="none" stroke="#3A3170" stroke-width="1.6"/><path d="M22,10 A12,12 0 0 1 34,22" fill="none" stroke="#FFD27A" stroke-width="1.8"/>`, 'Galaksi', 'Bir akış; çerçeveli, adı çerçevede; boyu adım sayısı, ışığı ve yayı biten adımlar', 'galaksi'],
  [`<path d="M6,34 A24,24 0 0 1 22,10" fill="none" stroke="#FFD27A" stroke-width="1.6" opacity=".7"/><path d="M22,10 A24,24 0 0 1 38,20" fill="none" stroke="#B9A6F2" stroke-width="1.2" opacity=".6"/><circle cx="38" cy="20" r="5" fill="url(#pLit)"/>`, 'Yörünge', 'Başlangıçtan hedefe; altın kısım geçen süre'],
  [`<circle cx="22" cy="22" r="18" fill="none" stroke="#8E80D6" stroke-dasharray="2 3"/><circle cx="22" cy="5" r="4" fill="#FFD27A"/><circle cx="22" cy="30" r="4" fill="#B9A6F2"/>`, 'Halkaya uzaklık', 'Hedefe az pay kalan akış halkaya yakın durur'],
  [`<g transform="translate(22,24)">${iconCloud(0, 0, .6)}</g>`, 'Takılan iş', 'Engelli adımı olan akış', 'engel'],
  [`<g transform="translate(22,22)">${iconRings(0, 0, .8)}</g>`, 'Bekleyen iş', 'Sırası gelmiş, sahibini bekliyor', 'sira'],
  [bayrak(22, 22, .9), 'Karar', 'Karar bekleyen adımı var', 'karar'],
];

/** Haritada odak (plan 27 Eki, 2.C): kişi ve durum; "?" sayfasının başında. Seçince sayfa kapanır, harita süzülür. */
export interface OdakAyar {
  kisiler: string[]; kisi: string | null; kisiSec: (k: string | null) => void;
  durumlar: { k: string; ad: string; n: number }[]; durum: string | null; durumSec: (k: string | null) => void;
}
function OdakSecici({ o, kapat }: { o: OdakAyar; kapat: () => void }) {
  const cip = (ad: string, basili: boolean, sec: () => void, etiket = ad) => <button key={etiket} type="button" className="filtre-cip" aria-pressed={basili} onClick={() => { sec(); kapat(); }}>{ad}</button>;
  return (
    <div className="odak-secici">
      <h3 className="lejant-alt-baslik">Haritada göster</h3>
      {o.kisiler.length > 1 && <div className="odak-cipler" role="group" aria-label="Kişi">
        {cip('Herkes', !o.kisi, () => o.kisiSec(null), 'kisi-hepsi')}
        {o.kisiler.map((k) => cip(k.replace(/\s*\(.*\)$/, ''), o.kisi === k, () => o.kisiSec(o.kisi === k ? null : k), 'kisi-' + k))}
      </div>}
      <div className="odak-cipler" role="group" aria-label="Durum">
        {cip('Hepsi', !o.durum, () => o.durumSec(null), 'durum-hepsi')}
        {o.durumlar.filter((d) => d.n > 0).map((d) => cip(`${d.ad} ${d.n}`, o.durum === d.k, () => o.durumSec(o.durum === d.k ? null : d.k), 'durum-' + d.k))}
      </div>
    </div>
  );
}

/**
 * Harita dili. sayilar verilirse her işaretin yanında bu haritada kaç tane olduğu yazar; olay türü olan işaret
 * (bitti, sırası geldi, engel, atlandı, karar) o türün bildirimlerine gider (N2). akis: galaksinin kodu (bildirimler o akışa süzülür).
 */
export function Lejant({ acik, kapat, yuzey = 'galaksi', sayilar, akis, odak }: { acik: boolean; kapat: () => void; yuzey?: Extract<Yuzey, 'galaksi' | 'evren'>; sayilar?: Partial<Record<LejantAnahtar, number>>; akis?: string; odak?: OdakAyar }) {
  // işaretlerin altında haritanın matematiği: hangi veri neyi belirliyor (geometri/kodlama.ts, madde 11)
  const K = yuzeyKodlamalari(yuzey).filter((k) => k.durum === 'var');
  const SATIRLAR_ = yuzey === 'evren' ? EVREN_SATIRLAR : SATIRLAR;
  const baslik = yuzey === 'evren' ? 'Evren dili' : 'Harita dili';
  const y0 = Math.max(60, 844 - (SATIRLAR_.length * 52 + K.length * 40 + 150 + (odak ? 150 : 0)));
  return (
    <AltSayfa acik={acik} kapat={kapat} baslik={baslik} yukseklik={Math.max(110, y0)} duraklar={['orta']}>
      <div className="lejant">
        {odak && <OdakSecici o={odak} kapat={kapat} />}
        <h2 className="lejant-baslik">{baslik}</h2>
        <ul aria-label="Harita işaretleri">
          {/* yalnız bu haritada olan işaretler (plan 27 Eki, 3.32): sayısı 0 olan satır gösterilmez */}
          {SATIRLAR_.filter(([, , , an]) => !(an && sayilar && sayilar[an] === 0)).map(([svg, ad, alt, an]) => {
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
        {yuzey === 'galaksi' && <p className="lejant-not">Yol üzerindeki sıra zamandır: soldan sağa, saat yönünde ilerler. Gezegenin boyu, ona bağlı iş sayısıdır.</p>}
        <h3 className="lejant-alt-baslik">Ne neyi gösterir</h3>
        <dl className="lejant-kodlama">
          {K.map((k) => <div key={k.kod}><dt>{k.veri}</dt><dd>{k[yuzey]}</dd></div>)}
        </dl>
      </div>
    </AltSayfa>
  );
}

/** Galaksi haritasının sayıları: adım durumları ve kişi türleri. */
export function galaksiSayilari(adimlar: any[], d?: { kritik_yol?: number[]; akis?: any }): Partial<Record<LejantAnahtar, number>> {
  const n = (f: (a: any) => boolean) => adimlar.filter(f).length;
  const acik = (a: any) => !['tamam', 'atlandi', 'ertelendi'].includes(a.durum), kritik = new Set(d?.kritik_yol || []);
  const kisi = (t: string) => new Set(adimlar.filter((a) => (a.sahip_tip || 'insan') === t).map((a) => a.sahip)).size;
  return {
    bitti: n((a) => a.durum === 'tamam'), suruyor: n((a) => a.durum === 'suruyor'), sira: n((a) => a.durum === 'hazir'), engel: n((a) => a.durum === 'engelli'),
    sirada: n((a) => a.durum === 'sirada'), ertele: n((a) => a.durum === 'ertelendi'), atlandi: n((a) => a.durum === 'atlandi'),
    kritik: n((a) => a.ust_adim == null && kritik.has(a.no) && acik(a)), cikti: n((a) => a.ust_adim == null && (a.cikti_sayisi || 0) > 0),
    darbogaz: d?.akis?.karar_ozeti?.darbogaz?.no != null ? 1 : undefined,
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
