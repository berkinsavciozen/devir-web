import { useEffect, useState } from 'react';
import { AltSayfa } from '../../bilesen/AltSayfa';
import { Dugme } from '../../bilesen/Dugme';
import { destekGemisi, planet, ship, kapi, DURUM_RENK, DURUM_GRUP_AD, DURUM_SIMGE, type DurumGrubu } from '../../cizim/ortak.js';
import { otoRozet, kisiRozeti } from '../../cizim/yol.js';
import { haritaBicimi } from '../../geometri/kol-bayrak';
import { acik, damla, type HamleTur } from '../../cizim/hamle';
import { iconCloud, iconRings, bayrak } from '../../cizim/ekran';
import { yuzeyKodlamalari, type Yuzey } from '../../geometri/kodlama';
import { bSuzgecAdresi, type OlayTuru } from '../bildirimler/model';
import { git } from '../../yonlendirme';

/** Lejant satırının anahtarı: sayı bu anahtarla gelir; olay türü olan satır o türün bildirimlerine gider (N2). */
export type LejantAnahtar = 'bitti' | 'suruyor' | 'sira' | 'engel' | 'ertele' | 'kritik' | 'cikti' | 'darbogaz' | 'ortak' | 'ip' | 'sirada' | 'atlandi' | 'karar' | 'insan' | 'agent' | 'dis' | 'galaksi' | 'ai' | 'ai_onay';
const TUR: Partial<Record<LejantAnahtar, OlayTuru>> = { bitti: 'bitti', sira: 'sira', engel: 'engel', atlandi: 'atlandi', karar: 'karar' };

// Harita dili (13 Kas, sentez): gövde ve hat = kim (kişinin rengi) · pencere ve ışık = durum (beş sabit renk) · yuvarlak düğme = hamle
// (yapacak kişinin renginde, simgesi görev kartındaki düğme). 6 Kas'taki "durum renksiz" kuralının yerini aldı.
type Satir = [string, string, string, LejantAnahtar?, Grup?];
type Grup = 'Hamle' | 'Işık' | 'Kim' | 'Yol';
const SEN = '#7D8CFF', O = '#D8F26B';
const dm = (tur: HamleTur, renk: string, ben = false) => `<g transform="translate(22,31)">${planet(0, 0, 7, tur === 'engel' ? 'block' : tur === 'bitir' ? 'wait' : 'dark', { life: false, halka: renk })}${ben ? `<circle r="13" fill="none" stroke="${renk}" stroke-width="1" opacity=".55"/>` : ''}${damla({ tur, kim: '', renk, etiket: '' }, 0, ben ? -21 : -19, ben ? 1.15 : .95)}</g>`;
const yol = (c: string, o: { kesik?: boolean; isik?: string } = {}) => `${o.isik ? `<path d="M2,32 Q22,4 42,26" fill="none" stroke="${o.isik}" stroke-width="7" opacity=".45" filter="url(#blur2)"/>` : ''}<path d="M2,32 Q22,4 42,26" fill="none" stroke="${c}" stroke-width="2.2" stroke-linecap="round"${o.kesik ? ' stroke-dasharray="5 4"' : ''}/>`;
const SATIRLAR: Satir[] = [
  [dm('bitir', SEN, true), 'Senin hamlen', 'Senin renginde, büyük ve zıplayan düğme; çevresinde nabız. Ünlem: “Bitir”', undefined, 'Hamle'],
  [dm('karar', O), 'Karar ver', 'Soru işareti. Düğme, kararı verecek kişinin renginde', 'karar', 'Hamle'],
  [dm('onayla', SEN), 'AI yazdı, onayla', 'Göz. Agent’ın işini sahibi onaylar; düğme sahibinin renginde', 'ai_onay', 'Hamle'],
  [dm('engel', O), 'Engeli kaldır', 'Şimşek; gezegende kırmızı çatlak', 'engel', 'Hamle'],
  [dm('kur', SEN), 'AI yapsın’ı kur', 'Kıvılcım. AI yapsın açık ama Claude rutinin yok; kurana kadar iş kendiliğinden başlamaz. AI çalışırken düğme yoktur', undefined, 'Hamle'],
  [planet(22, 22, 9, 'lit', { life: false, halka: SEN }), 'Bitti', 'Yeşil, tam yanık; sağ altta ne çıktığı: tik, belge, terazi', 'bitti', 'Işık'],
  [planet(22, 22, 9, 'run', { life: false, halka: SEN }), 'Sürüyor', 'Mavi; yarısı yanık, ışık döner', 'suruyor', 'Işık'],
  [planet(22, 22, 9, 'wait', { life: false, halka: SEN }), 'Sırası geldi', 'Kehribar: nabız atan halka ve iç ışık', 'sira', 'Işık'],
  [planet(22, 22, 9, 'dark', { life: false, halka: SEN }), 'Sırada', 'Karanlık; önündeki iş bitince yanar', 'sirada', 'Işık'],
  [planet(22, 22, 9, 'ertele', { life: false, halka: SEN }), 'Ertelendi', 'Küçük, gri, saatli; açık iş olarak kalır', 'ertele', 'Işık'],
  [planet(22, 22, 9, 'ghost', { life: false }), 'Atlandı', 'Silik, üstü çizik', 'atlandi', 'Işık'],
  [yol(SEN), 'Kişinin yolu ve halkası', 'Kişinin renginde dolu çizgi; renk Ayarlar’dan seçilir', undefined, 'Kim'],
  [yol(acik(SEN), { kesik: true }), 'Agent’ın yolu', 'Sahibinin renginin açık tonu, kesik çizgi', undefined, 'Kim'],
  [planet(22, 22, 9, 'dark', { life: false, halka: [SEN, O] }), 'Ortak görev', 'Halka kişilerin renginde bölünür', 'ortak', 'Kim'],
  [ship(22, 22, -12, 'insan', 'B', SEN, 1.15, { flame: false }), 'Ekip üyesi', 'Oklu, kanatlı roket; penceresinde baş harfi', 'insan', 'Kim'],
  [destekGemisi(30, 30, -18, -14, acik(SEN), .62, { ip: true, yon: -.5 }) + ship(30, 30, -12, 'insan', 'B', SEN, .62, { flame: false }), 'Agent', 'Köşeli, iki antenli; sahibinin gemisine iple bağlı, kendi yolunda gider', 'agent', 'Kim'],
  [ship(22, 22, 0, 'dis', '', O, 1.1), 'Dış katılımcı', 'Kubbeli disk; yalnız kendi işlerini görür', 'dis', 'Kim'],
  [yol(SEN, { isik: '#FFF6E0' }), 'Geride kalan yol', 'Beyaz parlar; gecikince kırmızı', undefined, 'Yol'],
  [`<path d="M4,30 Q22,6 40,24" fill="none" stroke="#FFF6E0" stroke-width="1.4" stroke-dasharray="1 4" stroke-linecap="round"/>`, 'Kritik yol', 'Beyaz noktalı zincir: gecikirse hedef tarih kayar', 'kritik', 'Yol'],
  [planet(22, 18, 8, 'dark', { life: false, halka: O }) + `<g transform="translate(22,36)"><rect x="-7" y="-6.5" width="14" height="13" rx="6.5" fill="#08222E" stroke="#FFF6E0"/><text y="3.4" text-anchor="middle" font-family="Bricolage" font-size="8.5" font-weight="800" fill="#FFF6E0">3</text></g>`, 'Darboğaz', 'Altındaki sayı: onu bekleyen iş; yakınlaşınca yazıyla', 'darbogaz', 'Yol'],
  [planet(22, 22, 9, 'lit', { life: false, halka: SEN, sonuc: 'belge' }), 'Çıktı', 'Belge rozeti: işin teslim ettiği bir şey var', 'cikti', 'Yol'],
  [kapi(22, 34, .34, true), 'Hedef tarih', 'Varış kapısı; dokununca pay ve kritik yol', undefined, 'Yol'],
];
/**
 * Zaman spiralinin dili (12 Kas, harita durum denetimi D1–D4): gemi = kişi. Gemi o anki ya da sıradaki işinin yanında durur,
 * rozeti durumunu söyler; bekleme ipi onu tutan işe, onay ipi robottan sahibine gider. Eski haritada eski satırlar kalır.
 */
const rz = (durum: string, kind: 'insan' | 'agent' = 'insan', gecGun = 0) => (kind === 'agent' ? ship(22, 22, 0, 'agent', 'B', acik(SEN), 1.2, { durum }) : ship(22, 22, -12, 'insan', 'B', SEN, 1.2, { durum, gun: 3 }))
  + kisiRozeti({ durum, gecGun }, { x: 22, y: 24 }, .8, SEN, kind, 0, { t0: 3 * 864e5 });
const ip = (kesik: boolean) => `<path d="M6,34 L36,12" stroke="${SEN}" stroke-width="1.5" ${kesik ? 'stroke-dasharray="5 3"' : 'stroke-dasharray="1 3.5" stroke-linecap="round"'}/>${kesik ? '' : '<path d="M36,12 L30,13.5 L33,18Z" fill="' + SEN + '"/>'}`;
const SPIRAL_KIM: Satir[] = [
  [ship(22, 22, -12, 'insan', 'B', SEN, 1.15, { flame: false }), 'Kişi', 'Roket; gövdesi kendi renginde. O anki ya da sıradaki işinin yanında durur', 'insan', 'Kim'],
  [ship(22, 22, 0, 'agent', 'B', acik(SEN), 1.15, { flame: false }), 'Agent', 'İki antenli küp; sahibinin açık tonu, kendi işinin yanında durur', 'agent', 'Kim'],
  [ship(22, 22, 0, 'dis', '', O, 1.1), 'Dış katılımcı', 'Kubbeli disk; yalnız kendi işlerini görür', 'dis', 'Kim'],
  [`<g opacity=".8">${rz('bekliyor')}</g>`, 'Bekliyor', 'Gri pencere, kum saati: başkasının işini bekliyor', undefined, 'Kim'],
  [rz('gelecek'), 'Sırası gelecek', 'İçi boş, kesik çerçeve; pencerede kaç gün sonra başlayacağı', undefined, 'Kim'],
  [`<g opacity=".8">${rz('bitti')}</g>`, 'İşi bitti', 'Yeşil pencere, tik: bu akışta açık işi kalmadı', undefined, 'Kim'],
  [rz('calisiyor', 'insan', 2), 'Geç kalıyor', 'Kırmızı gün etiketi: açık işinin tarihi geçti', undefined, 'Kim'],
  [rz('engel'), 'Takıldı', 'Kırmızı kenar, pencerede çizgi: işi engelli', undefined, 'Kim'],
  [rz('karar'), 'Karar verecek', 'Kehribar kenar, pencerede karar karosu', undefined, 'Kim'],
  [rz('sira'), 'Sırası geldi', 'Kehribar kenar, pencerede oynat', undefined, 'Kim'],
  [rz('calisiyor'), 'Çalışıyor', 'Mavi pencere, dönen ok; arkasında mavi iz', undefined, 'Kim'],
  [rz('ai_onay', 'agent'), 'Onay bekliyor', 'Kehribar, yukarı ok: AI yazdı, sahibinin onayına sundu', 'ai_onay', 'Kim'],
  [rz('ai_hata', 'agent'), 'AI yapamadı', 'Kırmızı kenar, pencerede çarpı: sahibi bakmalı', undefined, 'Kim'],
  [rz('ai_rutinsiz', 'agent'), 'Rutin yok', 'İçi boş, pencerede fiş: işi alacak rutin kurulmamış', undefined, 'Kim'],
  [rz('ai_sirada', 'agent'), 'AI sırada', 'Gri pencere, saat: AI yapsın açık, iş agent’ın sırasını bekliyor', undefined, 'Kim'],
  [rz('ai_calisiyor', 'agent'), 'AI çalışıyor', 'Mavi pencere, dönen ok; arkasında kare ışıklar', 'ai', 'Kim'],
  [planet(22, 22, 9, 'dark', { life: false, halka: acik(SEN), agentIsi: true }), 'Agent’ın işi', 'Gezegenin halkası kesik', undefined, 'Kim'],
  [planet(22, 22, 9, 'dark', { life: false, halka: [SEN, O] }), 'Ortak görev', 'Halka kişilerin renginde bölünür', 'ortak', 'Kim'],
];
const SPIRAL_BAG: Satir[] = [
  [yol(SEN), 'Kişinin şeridi', 'Herkes aynı spiral yolda kendi renkli şeridinde; yol boyu tarih', undefined, 'Yol'],
  [ip(false), 'Bekleme ipi', 'Noktalı, kişinin renginde: bekleyen gemiden onu tutan işe', undefined, 'Yol'],
  [ip(true), 'Onay ipi', 'Kesik: onay bekleyen robottan sahibinin gemisine', 'ai_onay', 'Yol'],
  [`<path d="M10,34 L34,10" stroke="#FFC9A3" stroke-width="2.4" stroke-linecap="round"/>`, 'Bugün', 'Yolun enine şeftali çentik; geride kalan bant aydınlık', undefined, 'Yol'],
];
const SPIRAL_SATIRLAR: Satir[] = [
  ...SATIRLAR.filter(([, , , , g]) => g === 'Hamle' || g === 'Işık'),
  ...SPIRAL_KIM, ...SPIRAL_BAG,
  ...SATIRLAR.filter(([, ad, , , g]) => g === 'Yol' && !['Geride kalan yol'].includes(ad)),
];
const GRUP_AD_SPIRAL: Record<Grup, string> = { Kim: 'Kim nerede', Işık: 'İş', Hamle: 'Hamle', Yol: 'Bağ ve zaman' };
const GRUP_ALT_SPIRAL: Record<Grup, string> = { Kim: 'Gövde kim, pencere ne durumda', Işık: 'Gezegenin iç ışığı işin durumu; aynı beş renk', Hamle: 'Düğmenin rengi kimin, simgesi hangi düğme', Yol: 'Kim kimi bekliyor, zaman nerede' };
const GRUPLAR: Grup[] = ['Hamle', 'Işık', 'Kim', 'Yol'];
const GRUP_ALT: Record<Grup, string> = { Hamle: 'Düğmenin rengi kimin, simgesi hangi düğme', Işık: 'İç ışık durumu söyler; aynı beş renk', Kim: 'Gövde ve hat kişinin rengi', Yol: 'Zaman ve bağlar' };

/** Evren dili (el notu 2): usturlap, yörünge ve işaretler (ip, plan 27 Eki 3.27 ile kalktı). */
const EVREN_SATIRLAR: Satir[] = [
  [`<circle cx="22" cy="22" r="19" fill="none" stroke="#061A24" stroke-width="6"/><path d="M22,3 A19,19 0 0 1 39,14" fill="none" stroke="#FFC9A3" stroke-width="4" stroke-linecap="round"/><path d="M22,22 L37,12" stroke="#FFD9B8" stroke-width="1.8" stroke-linecap="round"/><circle cx="22" cy="22" r="2.6" fill="#FFD27A"/>`, 'Takvim halkası ve ibre', 'Halka aylar; ibre bugün, dolan yay geçen zaman'],
  [`<circle cx="22" cy="22" r="12" fill="url(#glowGold)" opacity=".5"/><circle cx="22" cy="22" r="8" fill="url(#pGreen)"/><circle cx="22" cy="22" r="12" fill="none" stroke="#3A3170" stroke-width="1.6"/><path d="M22,10 A12,12 0 0 1 34,22" fill="none" stroke="#FFD27A" stroke-width="1.8"/>`, 'Galaksi', 'Bir akış; çerçeveli, adı çerçevede; boyu adım sayısı, ışığı ve yayı biten adımlar', 'galaksi'],
  [`<path d="M6,34 A24,24 0 0 1 22,10" fill="none" stroke="#FFD27A" stroke-width="1.6" opacity=".7"/><path d="M22,10 A24,24 0 0 1 38,20" fill="none" stroke="#B9A6F2" stroke-width="1.2" opacity=".6"/><circle cx="38" cy="20" r="5" fill="url(#pGreen)"/>`, 'Yörünge', 'Başlangıçtan hedefe; altın kısım geçen süre'],
  [`<circle cx="22" cy="22" r="18" fill="none" stroke="#8E80D6" stroke-dasharray="2 3"/><circle cx="22" cy="22" r="5" fill="url(#brass)"/><circle cx="22" cy="10" r="3.5" fill="#FFD27A"/><circle cx="22" cy="38" r="3.5" fill="#B9A6F2"/>`, 'Merkeze uzaklık', 'Kalan iş: bitmeye yaklaşan akış merkeze iner; merkez biten akışlar'],
  [`<circle cx="22" cy="22" r="13" fill="#061A24" fill-opacity=".4" stroke="#FF8A78" stroke-width="2"/><circle cx="22" cy="22" r="6" fill="url(#pGreen)"/>`, 'Kırmızı çerçeve', 'Hedef tarihi geçiyor'],
  [`<g transform="translate(22,24)">${iconCloud(0, 0, .6)}</g>`, 'Takılan iş', 'Engelli adımı olan akış', 'engel'],
  [`<g transform="translate(22,22)">${iconRings(0, 0, .8)}</g>`, 'Bekleyen iş', 'Sırası gelmiş, sahibini bekliyor', 'sira'],
  [bayrak(22, 22, .9), 'Karar', 'Karar bekleyen adımı var', 'karar'],
];

const GRUP_SIRA: DurumGrubu[] = ['alarm', 'eylem', 'calisma', 'bekleme', 'bitti'];
/**
 * Renk kuralı (13 Kas, sentez): harita lejantının ve Bildirimler'in başında aynı blok. Gövde ve hat kim olduğunu (kişinin rengi),
 * pencere ve ışık durumu (beş sabit renk), yuvarlak düğme kime ne düştüğünü söyler.
 */
export function RenkKurali({ renk = SEN }: { renk?: string }) {
  const kutu = (ic: string, vb = '-12 -12 24 24', w = 26) => <svg aria-hidden width={w} height="26" viewBox={vb} style={{ overflow: 'visible' }} dangerouslySetInnerHTML={{ __html: ic }} />;
  return (
    <section className="renk-kurali" aria-label="Renk kuralı">
      <div className="renk-kurali-uc">
        <div>{kutu(ship(0, 0, 0, 'insan', 'E', renk, .8, { flame: false }), '-17 -13 34 26', 34)}<span><b>Gövde, hat</b><small>kim</small></span></div>
        <div>{kutu(`<circle r="8" fill="#08222E" stroke="${DURUM_RENK.eylem}" stroke-width="1.5"/>${DURUM_SIMGE.sira(1.5, DURUM_RENK.eylem)}`)}<span><b>Pencere, ışık</b><small>durum</small></span></div>
        <div>{kutu(`<circle r="10" fill="${renk}" opacity=".26"/><circle r="8" fill="${renk}" stroke="#08222E" stroke-width="1.2"/><rect x="-.9" y="-3.8" width="1.8" height="4.7" rx=".8" fill="#08222E"/><circle cy="2.9" r="1" fill="#08222E"/>`)}<span><b>Düğme</b><small>hamle</small></span></div>
      </div>
      <p className="renk-kurali-renkler" aria-label="Durum renkleri">{GRUP_SIRA.map((g) => <span key={g} style={{ ['--gr' as string]: DURUM_RENK[g] }}><i aria-hidden />{DURUM_GRUP_AD[g]}</span>)}</p>
    </section>
  );
}

/** Haritada odak (plan 27 Eki, 2.C): kişi ve durum; "?" kutusunun başında. Seçim Uygula ile haritaya geçer (plan 28 Eki, Q1). */
export interface OdakAyar {
  kisiler: string[]; kisi: string | null; kisiSec: (k: string | null) => void;
  durumlar: { k: string; ad: string; n: number }[]; durum: string | null; durumSec: (k: string | null) => void;
}
type Bekleyen = { kisi: string | null; durum: string | null };
function OdakSecici({ o, b, setB }: { o: OdakAyar; b: Bekleyen; setB: (b: Bekleyen) => void }) {
  const cip = (ad: string, basili: boolean, sec: () => void, etiket = ad) => <button key={etiket} type="button" className="filtre-cip" aria-pressed={basili} onClick={sec}>{ad}</button>;
  return (
    <div className="odak-secici">
      <h3 className="lejant-alt-baslik">Haritada göster</h3>
      {o.kisiler.length > 1 && <div className="odak-cipler" role="group" aria-label="Kişi">
        {cip('Herkes', !b.kisi, () => setB({ ...b, kisi: null }), 'kisi-hepsi')}
        {o.kisiler.map((k) => cip(k.replace(/\s*\(.*\)$/, ''), b.kisi === k, () => setB({ ...b, kisi: b.kisi === k ? null : k }), 'kisi-' + k))}
      </div>}
      <div className="odak-cipler" role="group" aria-label="Durum">
        {cip('Hepsi', !b.durum, () => setB({ ...b, durum: null }), 'durum-hepsi')}
        {o.durumlar.filter((d) => d.n > 0).map((d) => cip(`${d.ad} ${d.n}`, b.durum === d.k, () => setB({ ...b, durum: b.durum === d.k ? null : d.k }), 'durum-' + d.k))}
      </div>
    </div>
  );
}

/**
 * Harita dili. sayilar verilirse her işaretin yanında bu haritada kaç tane olduğu yazar; olay türü olan işaret
 * (bitti, sırası geldi, engel, atlandı, karar) o türün bildirimlerine gider (N2). akis: galaksinin kodu (bildirimler o akışa süzülür).
 */
export function Lejant({ acik, kapat, yuzey = 'galaksi', sayilar, akis, odak, vurgula }: { acik: boolean; kapat: () => void; yuzey?: Extract<Yuzey, 'galaksi' | 'evren'>; sayilar?: Partial<Record<LejantAnahtar, number>>; akis?: string; odak?: OdakAyar; vurgula?: (an: LejantAnahtar) => void }) {
  // işaretlerin altında haritanın matematiği: hangi veri neyi belirliyor (geometri/kodlama.ts, madde 11)
  const K = yuzeyKodlamalari(yuzey).filter((k) => k.durum === 'var');
  const SP = haritaBicimi() === 'spiral' || haritaBicimi() === 'yorunge';
  const SATIRLAR_ = yuzey === 'evren' ? EVREN_SATIRLAR : SP ? SPIRAL_SATIRLAR : SATIRLAR;
  const baslik = yuzey === 'evren' ? 'Evren dili' : 'Harita dili';
  const y0 = Math.max(60, 844 - (SATIRLAR_.length * 52 + K.length * 40 + 150 + (odak ? 150 : 0)));
  // seçim kutuda bekler; Uygula haritaya geçirir, Vazgeç bırakır
  const [b, setB] = useState<Bekleyen>({ kisi: odak?.kisi ?? null, durum: odak?.durum ?? null });
  useEffect(() => { if (acik) setB({ kisi: odak?.kisi ?? null, durum: odak?.durum ?? null }); }, [acik]); // eslint-disable-line react-hooks/exhaustive-deps
  const uygula = () => { if (odak) { if (b.kisi !== odak.kisi) odak.kisiSec(b.kisi); if (b.durum !== odak.durum) odak.durumSec(b.durum); } kapat(); };
  const alt = odak ? <><Dugme tur="ikincil" yukseklik={48} onClick={kapat}>Vazgeç</Dugme><Dugme yukseklik={48} onClick={uygula}>Uygula</Dugme></> : undefined;
  return (
    <AltSayfa acik={acik} kapat={kapat} baslik={baslik} yukseklik={Math.max(110, y0)} duraklar={['orta']} kutu alt={alt}>
      <div className="lejant">
        {odak && <OdakSecici o={odak} b={b} setB={setB} />}
        <h2 className="lejant-baslik">{baslik}</h2>
        {yuzey === 'galaksi' && <RenkKurali />}
        {(yuzey === 'evren' ? [null] : SP ? (['Kim', 'Işık', 'Hamle', 'Yol'] as Grup[]) : GRUPLAR).map((gr) => <div key={gr || 'evren'}>
        {gr && <h3 className="lejant-alt-baslik">{SP ? GRUP_AD_SPIRAL[gr] : gr}<small> · {(SP ? GRUP_ALT_SPIRAL : GRUP_ALT)[gr]}</small></h3>}
        <ul aria-label={gr ? `${gr} işaretleri` : 'Harita işaretleri'}>
          {/* yalnız bu haritada olan işaretler (plan 27 Eki, 3.32): sayısı 0 olan satır gösterilmez */}
          {SATIRLAR_.filter(([, , , an, g]) => (!gr || g === gr) && !(an && sayilar && sayilar[an] === 0)).map(([svg, ad, alt, an]) => {
            const n = an ? sayilar?.[an] : undefined, tur = an ? TUR[an] : undefined;
            const ic = <>
              <svg aria-hidden width="44" height="44" viewBox="0 0 44 44" style={{ overflow: 'visible' }} dangerouslySetInnerHTML={{ __html: svg }} />
              <span><b>{ad}</b><small>{alt}</small></span>
              {n != null && <em className="lejant-sayi">{n}</em>}
            </>;
            const bildirim = () => { kapat(); git(bSuzgecAdresi({ sekme: 'tum', kisi: null, akis: akis || null, tur })); };
            // galaksi: satır haritada o işaretli gezegenleri yakar (3.G); olay türü olanın yanında bildirim düğmesi
            if (vurgula && an && GEZEGEN_ISARETI.has(an) && n) return (
              <li key={ad} className="lejant-cift">
                <button type="button" className="lejant-satir" aria-label={`${ad}: ${n}. ${alt}. Haritada göster.`} onClick={() => { kapat(); vurgula(an); }}>{ic}</button>
                {tur && <button type="button" className="lejant-bildirim" aria-label={`${ad}: bildirimlerde göster`} title="Bildirimlerde göster" onClick={bildirim}><svg aria-hidden viewBox="-10 -10 20 20"><path d="M-5,3 V-1 A5,5 0 0 1 5,-1 V3 L6.5,5 H-6.5Z M-1.8,6.5 A1.8,1.8 0 0 0 1.8,6.5" /></svg></button>}
              </li>
            );
            // sayısı olan olay türü: bildirimlerde o tür (akış haritasında o akış); diğerleri yalnız açıklama
            return tur && sayilar ? (
              <li key={ad}><button type="button" className="lejant-satir" title={`${ad}: ${alt}. Bildirimlerde göster.`} aria-label={`${ad}: ${n ?? 0}. ${alt}. Bildirimlerde göster.`}
                onClick={bildirim}>{ic}</button></li>
            ) : <li key={ad} title={`${ad}: ${alt}`}>{ic}</li>;
          })}
        </ul></div>)}
        {yuzey === 'galaksi' && <p className="lejant-not">{SP ? 'Merkez akışın başlangıcı, spiralin sonu hedef tarih. Yol boyunca günler eşit aralıklı; pazartesiler tarihli.' : 'Yol üzerindeki sıra zamandır: soldan sağa, saat yönünde ilerler. Gezegenler aynı boydadır; çok yolun buluştuğu ortak gezegen yollar sığsın diye biraz büyür.'}</p>}
        <h3 className="lejant-alt-baslik">Ne neyi gösterir</h3>
        <dl className="lejant-kodlama">
          {K.map((k) => <div key={k.kod}><dt>{k.veri}</dt><dd>{k[yuzey]}</dd></div>)}
        </dl>
      </div>
    </AltSayfa>
  );
}

const GEZEGEN_ISARETI = new Set<LejantAnahtar>(['bitti', 'suruyor', 'sira', 'engel', 'sirada', 'ertele', 'atlandi', 'karar', 'kritik', 'cikti', 'darbogaz', 'ortak', 'ai', 'ai_onay']);
/** Lejant satırının haritadaki gezegenleri (yalnız çizilen ana görevler); darboğaz: taçlı ya da sunucunun darboğazı. */
export function lejantGezegenleri(d: any, G?: { gezegen: Record<number, { kritik?: boolean; korona?: number; ortak?: boolean }> }): Record<string, number[]> {
  const A = (d?.adimlar || []).filter((a: any) => a.ust_adim == null && G?.gezegen[a.no]);
  const s = (f: (a: any) => boolean) => A.filter(f).map((a: any) => a.no as number);
  const acik = (a: any) => !['tamam', 'atlandi', 'ertelendi'].includes(a.durum), sunucu = d?.akis?.karar_ozeti?.darbogaz?.no;
  return {
    bitti: s((a) => a.durum === 'tamam'), suruyor: s((a) => a.durum === 'suruyor'), sira: s((a) => a.durum === 'hazir'), engel: s((a) => a.durum === 'engelli'),
    sirada: s((a) => a.durum === 'sirada'), ertele: s((a) => a.durum === 'ertelendi'), atlandi: s((a) => a.durum === 'atlandi'),
    karar: s((a) => a.karar_adimi && acik(a)), kritik: s((a) => !!G?.gezegen[a.no].kritik && acik(a)), cikti: s((a) => (a.cikti_sayisi || 0) > 0),
    darbogaz: s((a) => acik(a) && ((G?.gezegen[a.no].korona || 0) > 0 || a.no === sunucu)), ortak: s((a) => !!G?.gezegen[a.no].ortak),
    ai: s((a) => acik(a) && !!a.oto && otoRozet(a) !== 'bakilacak'), ai_onay: s((a) => acik(a) && otoRozet(a) === 'bakilacak'),
  };
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
    ai: n((a) => acik(a) && !!a.oto && otoRozet(a) !== 'bakilacak'), ai_onay: n((a) => acik(a) && otoRozet(a) === 'bakilacak'),
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

/** Ayarlar · "Tüm harita dili" (plan 27 Eki, Epic 4): sayfalardaki lejant yalnız görünen işaretleri gösterir; burada hepsi. */
export function TumHaritaDili({ acik, kapat }: { acik: boolean; kapat: () => void }) {
  const satir = ([svg, ad, alt]: Satir) => <li key={ad} title={`${ad}: ${alt}`}><svg aria-hidden width="44" height="44" viewBox="0 0 44 44" style={{ overflow: 'visible' }} dangerouslySetInnerHTML={{ __html: svg }} /><span><b>{ad}</b><small>{alt}</small></span></li>;
  const K = yuzeyKodlamalari('galaksi').filter((k) => k.durum === 'var');
  return (
    <AltSayfa acik={acik} kapat={kapat} baslik="Tüm harita dili" yukseklik={60} duraklar={['yuksek']}>
      <div className="lejant">
        <h2 className="lejant-baslik">Tüm harita dili</h2>
        <RenkKurali />
        <h3 className="lejant-alt-baslik">Evren: bütün akışlar</h3>
        <ul aria-label="Evren işaretleri">{EVREN_SATIRLAR.map(satir)}</ul>
        {GRUPLAR.map((gr) => <div key={gr}><h3 className="lejant-alt-baslik">Akış haritası · {gr}<small> · {GRUP_ALT[gr]}</small></h3>
        <ul aria-label={`${gr} işaretleri`}>{SATIRLAR.filter((x) => x[4] === gr).map(satir)}</ul></div>)}
        <p className="lejant-not">Alt görevler ana görevin çevresinde halka olarak görünür; yakınlaşınca kendi küçük yollarında açılır. Yol üzerindeki sıra zamandır: kimin kimi beklediğini görmek için göreve dokun.</p>
        <h3 className="lejant-alt-baslik">Ne neyi gösterir</h3>
        <dl className="lejant-kodlama">{K.map((k) => <div key={k.kod}><dt>{k.veri}</dt><dd>{k.galaksi}</dd></div>)}</dl>
      </div>
    </AltSayfa>
  );
}
